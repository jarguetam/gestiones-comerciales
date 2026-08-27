-- ============================================================
-- F3.3 — Módulo depósitos (spec db §5.3, backend GC-DEPO-001)
--   deposito + RPC deposito_confirmar + job recordatorio_depositos
-- ============================================================

create table public.deposito (
  id             bigint generated always as identity primary key,
  tenant_id      uuid not null references public.tenant(id),
  asesor_id      uuid not null references public.usuario(id),
  monto          numeric(18,2) not null,
  referencia     text,
  estado         text not null default 'pendiente'
                   check (estado in ('pendiente','confirmado','rechazado')),
  confirmado_por uuid references public.usuario(id),
  confirmado_en  timestamptz,
  creado_en      timestamptz not null default now()
);
create index on public.deposito (tenant_id, estado);
create index on public.deposito (asesor_id, creado_en desc);

alter table public.deposito enable row level security;

create policy alcance_deposito on public.deposito
  for select to authenticated
  using (
    tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
    and public.modulo_activo(tenant_id, 'depositos')
    and public.asesor_en_alcance(asesor_id)
  );

create policy insertar_deposito on public.deposito
  for insert to authenticated
  with check (
    tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
    and public.modulo_activo(tenant_id, 'depositos')
    and asesor_id = auth.uid()
    and estado = 'pendiente'
  );

-- el estado solo cambia vía RPC (security definer)
create policy actualizar_deposito on public.deposito
  for update to authenticated
  using (
    tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
    and public.modulo_activo(tenant_id, 'depositos')
    and public.asesor_en_alcance(asesor_id)
    and (auth.jwt() ->> 'rol') in ('admin', 'supervisor')
  )
  with check (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

grant select, insert, update on public.deposito to authenticated;

-- GC-DEPO-001: solo supervisor/admin y si está pendiente
create or replace function public.deposito_confirmar(
  p_id bigint,
  p_estado text
)
returns public.deposito
language plpgsql security definer
set search_path = public
as $$
declare
  v_dep public.deposito;
  v_rol text := auth.jwt() ->> 'rol';
begin
  if v_rol not in ('admin', 'supervisor') then
    raise exception 'GC-DEPO-001: el depósito solo lo confirma un supervisor o admin';
  end if;
  if p_estado not in ('confirmado', 'rechazado') then
    raise exception 'GC-DEPO-001: el estado destino debe ser confirmado o rechazado';
  end if;

  select * into v_dep from public.deposito where id = p_id for update;
  if not found then
    raise exception 'GC-DEPO-001: depósito no encontrado';
  end if;

  if v_dep.tenant_id is distinct from (auth.jwt() ->> 'tenant_id')::uuid
     or not public.asesor_en_alcance(v_dep.asesor_id) then
    raise exception 'GC-DEPO-001: sin alcance sobre este depósito';
  end if;

  if not public.modulo_activo(v_dep.tenant_id, 'depositos') then
    raise exception 'GC-DEPO-001: módulo depositos no activo';
  end if;

  if v_dep.estado <> 'pendiente' then
    raise exception 'GC-DEPO-001: el depósito solo es confirmable en estado pendiente';
  end if;

  update public.deposito
     set estado         = p_estado,
         confirmado_por = auth.uid(),
         confirmado_en  = now()
   where id = v_dep.id
  returning * into v_dep;

  perform public.registrar_auditoria(
    v_dep.tenant_id, 'deposito', v_dep.id::text, 'update',
    jsonb_build_object('estado', p_estado)
  );

  return v_dep;
end;
$$;
grant execute on function public.deposito_confirmar(bigint, text) to authenticated;

-- Job: notifica supervisores de depósitos pendientes (lun-vie 14:30 y 21:30 UTC)
create or replace function public.recordatorio_depositos()
returns int
language plpgsql security definer
set search_path = public
as $$
declare
  v_count int := 0;
begin
  insert into public.notificacion (tenant_id, usuario_id, titulo, cuerpo, datos, canal)
  select d.tenant_id,
         coalesce(u.jefe_id, u.id),
         'Depósitos pendientes',
         format('%s depósito(s) pendiente(s) de confirmar', count(*)),
         jsonb_build_object('tipo', 'deposito_pendiente', 'cantidad', count(*)),
         'in_app'
    from public.deposito d
    join public.usuario u on u.id = d.asesor_id
   where d.estado = 'pendiente'
     and public.modulo_activo(d.tenant_id, 'depositos')
   group by d.tenant_id, coalesce(u.jefe_id, u.id);
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;
revoke all on function public.recordatorio_depositos() from public;
grant execute on function public.recordatorio_depositos() to postgres;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    execute 'grant execute on function public.recordatorio_depositos() to service_role';
  end if;
end $$;

do $$
begin
  perform cron.schedule(
    'recordatorio-depositos',
    '30 14,21 * * 1-5',
    'select public.recordatorio_depositos()'
  );
exception
  when others then
    raise notice 'recordatorio-depositos: no se pudo programar el cron (%). Continúa la migración.', sqlerrm;
end $$;
