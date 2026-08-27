-- ============================================================
-- F3.4 — Módulo kilometraje (spec db §5.5)
--   kilometraje unique (tenant_id, usuario_id, periodo)
--   RPC km_registrar(periodo, km_inicial, km_final)
--   Job recordatorio_kilometraje: último día del mes (corrida diaria + guarda)
-- ============================================================

create table public.kilometraje (
  id            bigint generated always as identity primary key,
  tenant_id     uuid not null references public.tenant(id),
  usuario_id    uuid not null references public.usuario(id),
  periodo       date not null,
  km_inicial    numeric(10,1),
  km_final      numeric(10,1),
  observaciones text,
  creado_en     timestamptz not null default now(),
  unique (tenant_id, usuario_id, periodo)
);
create index on public.kilometraje (tenant_id, periodo);

alter table public.kilometraje enable row level security;

create policy alcance_kilometraje on public.kilometraje
  for select to authenticated
  using (
    tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
    and public.modulo_activo(tenant_id, 'kilometraje')
    and public.asesor_en_alcance(usuario_id)
  );

create policy insertar_kilometraje on public.kilometraje
  for insert to authenticated
  with check (
    tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
    and public.modulo_activo(tenant_id, 'kilometraje')
    and usuario_id = auth.uid()
  );

create policy actualizar_kilometraje on public.kilometraje
  for update to authenticated
  using (
    tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
    and public.modulo_activo(tenant_id, 'kilometraje')
    and (usuario_id = auth.uid() or (auth.jwt() ->> 'rol') in ('admin','supervisor','gerente'))
  )
  with check (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

grant select, insert, update on public.kilometraje to authenticated;

-- Upsert del periodo del asesor autenticado. periodo se normaliza al día 1 del mes.
create or replace function public.km_registrar(
  p_periodo    date,
  p_km_inicial numeric,
  p_km_final   numeric
)
returns public.kilometraje
language plpgsql security definer
set search_path = public
as $$
declare
  v_tenant  uuid := (auth.jwt() ->> 'tenant_id')::uuid;
  v_uid     uuid := auth.uid();
  v_periodo date := date_trunc('month', p_periodo)::date;
  v_row     public.kilometraje;
begin
  if v_tenant is null or v_uid is null then
    raise exception 'GC-KM-003: autenticación requerida';
  end if;
  if not public.modulo_activo(v_tenant, 'kilometraje') then
    raise exception 'GC-KM-002: módulo kilometraje no activo';
  end if;
  if p_km_inicial is null or p_km_final is null then
    raise exception 'GC-KM-001: km_inicial y km_final son requeridos';
  end if;
  if p_km_final < p_km_inicial then
    raise exception 'GC-KM-001: km_final no puede ser menor que km_inicial';
  end if;

  insert into public.kilometraje (tenant_id, usuario_id, periodo, km_inicial, km_final)
  values (v_tenant, v_uid, v_periodo, p_km_inicial, p_km_final)
  on conflict (tenant_id, usuario_id, periodo) do update
    set km_inicial = excluded.km_inicial,
        km_final   = excluded.km_final
  returning * into v_row;

  perform public.registrar_auditoria(
    v_tenant, 'kilometraje', v_row.id::text, 'update',
    jsonb_build_object('periodo', v_periodo, 'km_inicial', p_km_inicial, 'km_final', p_km_final)
  );

  return v_row;
end;
$$;
grant execute on function public.km_registrar(date, numeric, numeric) to authenticated;

-- Último día del mes: pg_cron no soporta L → corrida diaria + guarda (spec db §7)
create or replace function public.recordatorio_kilometraje()
returns int
language plpgsql security definer
set search_path = public
as $$
declare
  v_count   int := 0;
  v_hoy     date := (timezone('America/Guatemala', now()))::date;
  v_ultimo  date := (date_trunc('month', v_hoy) + interval '1 month - 1 day')::date;
  v_periodo date := date_trunc('month', v_hoy)::date;
begin
  if v_hoy <> v_ultimo then
    return 0;
  end if;

  insert into public.notificacion (tenant_id, usuario_id, titulo, cuerpo, datos, canal)
  select u.tenant_id,
         u.id,
         'Cierre de kilometraje',
         'Hoy es el último día del mes: registra tu kilometraje.',
         jsonb_build_object('tipo', 'recordatorio_kilometraje', 'periodo', v_periodo),
         'in_app'
    from public.usuario u
   where u.activo
     and u.rol = 'asesor'
     and public.modulo_activo(u.tenant_id, 'kilometraje')
     and not exists (
       select 1 from public.kilometraje k
        where k.tenant_id = u.tenant_id
          and k.usuario_id = u.id
          and k.periodo = v_periodo
          and k.km_final is not null
     );
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;
revoke all on function public.recordatorio_kilometraje() from public;
grant execute on function public.recordatorio_kilometraje() to postgres;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    execute 'grant execute on function public.recordatorio_kilometraje() to service_role';
  end if;
end $$;

do $$
begin
  perform cron.schedule(
    'recordatorio-kilometraje',
    '0 14,23 * * *',
    'select public.recordatorio_kilometraje()'
  );
exception
  when others then
    raise notice 'recordatorio-kilometraje: no se pudo programar el cron (%). Continúa la migración.', sqlerrm;
end $$;
