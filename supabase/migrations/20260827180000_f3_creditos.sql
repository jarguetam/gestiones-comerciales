-- ============================================================
-- F3.1 — Módulo créditos (spec db §5.1, backend GC-CRED-*)
--   producto, cuenta, cuenta_saldo, movimiento
--   RLS: tenant + modulo_activo('creditos') + alcance por rol
--   Cliente: GET only. Escritura de movimientos/saldos vía ingesta (service/admin).
--   Job snapshot_cuentas: corte diario, solo tenants con el módulo activo.
-- ============================================================

-- ---------- helper: alcance comercial por asesor_id ----------
create or replace function public.asesor_en_alcance(p_asesor uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select (auth.jwt() ->> 'rol') = 'admin'
      or p_asesor = auth.uid()
      or p_asesor in (select * from public.subordinados());
$$;
revoke all on function public.asesor_en_alcance(uuid) from public;
grant execute on function public.asesor_en_alcance(uuid) to authenticated;

-- catálogo de módulos: lectura para que el front resuelva tenant_modulo → codigo
alter table public.modulo enable row level security;
drop policy if exists modulo_select on public.modulo;
create policy modulo_select on public.modulo
  for select to authenticated
  using (true);
grant select on public.modulo to authenticated;

-- ---------- producto ----------
create table public.producto (
  id          bigint generated always as identity primary key,
  tenant_id   uuid not null references public.tenant(id),
  codigo      text not null,
  nombre      text not null,
  tasa        numeric(8,4),
  plazo_meses int,
  activo      boolean not null default true,
  unique (tenant_id, codigo)
);

-- ---------- cuenta ----------
create table public.cuenta (
  id             bigint generated always as identity primary key,
  tenant_id      uuid not null references public.tenant(id),
  persona_id     bigint not null references public.persona(id),
  producto_id    bigint references public.producto(id),
  codigo_externo text not null,
  monto          numeric(18,2) not null default 0,
  estado         text not null default 'activa' check (estado in ('activa','cancelada','mora')),
  activo         boolean not null default true,
  creado_en      timestamptz not null default now(),
  unique (tenant_id, codigo_externo)
);
create index on public.cuenta (tenant_id, persona_id);
create index on public.cuenta (persona_id);

-- ---------- cuenta_saldo (snapshot de corte diario) ----------
create table public.cuenta_saldo (
  cuenta_id      bigint not null references public.cuenta(id) on delete cascade,
  dias_atraso    int not null default 0,
  rango_mora     text,
  capital_riesgo numeric(18,2) not null default 0,
  corte_en       timestamptz not null,
  primary key (cuenta_id, corte_en)
);
create index on public.cuenta_saldo (rango_mora);

-- ---------- movimiento ----------
create table public.movimiento (
  id         bigint generated always as identity primary key,
  tenant_id  uuid not null references public.tenant(id),
  cuenta_id  bigint not null references public.cuenta(id),
  numero     text not null,
  tipo       text not null check (tipo in ('cuota','abono','cargo','desembolso')),
  monto      numeric(18,2) not null,
  fecha      date not null,
  creado_en  timestamptz not null default now()
);
create index on public.movimiento (tenant_id, fecha);
create index on public.movimiento (cuenta_id, fecha);

-- ---------- RLS ----------
alter table public.producto      enable row level security;
alter table public.cuenta        enable row level security;
alter table public.cuenta_saldo  enable row level security;
alter table public.movimiento    enable row level security;

-- producto: lectura si el módulo está activo; escritura solo admin del tenant
create policy alcance_producto on public.producto
  for select to authenticated
  using (
    tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
    and public.modulo_activo(tenant_id, 'creditos')
  );
create policy gestion_producto on public.producto
  for all to authenticated
  using (
    tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
    and (auth.jwt() ->> 'rol') = 'admin'
    and public.modulo_activo(tenant_id, 'creditos')
  )
  with check (
    tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
    and (auth.jwt() ->> 'rol') = 'admin'
    and public.modulo_activo(tenant_id, 'creditos')
  );

-- cuenta: GET only. Asesor = cuentas de sus personas; supervisor/gerente = subárbol; admin = tenant.
create policy alcance_cuenta on public.cuenta
  for select to authenticated
  using (
    tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
    and public.modulo_activo(tenant_id, 'creditos')
    and exists (
      select 1 from public.persona p
      where p.id = persona_id
        and public.asesor_en_alcance(p.asesor_id)
    )
  );

-- cuenta_saldo: lectura vía la cuenta (sin tenant_id propio)
create policy alcance_cuenta_saldo on public.cuenta_saldo
  for select to authenticated
  using (
    exists (
      select 1 from public.cuenta c
      join public.persona p on p.id = c.persona_id
      where c.id = cuenta_id
        and c.tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
        and public.modulo_activo(c.tenant_id, 'creditos')
        and public.asesor_en_alcance(p.asesor_id)
    )
  );

-- movimiento: GET only, mismo alcance
create policy alcance_movimiento on public.movimiento
  for select to authenticated
  using (
    tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
    and public.modulo_activo(tenant_id, 'creditos')
    and exists (
      select 1 from public.cuenta c
      join public.persona p on p.id = c.persona_id
      where c.id = cuenta_id
        and public.asesor_en_alcance(p.asesor_id)
    )
  );

grant select on public.producto, public.cuenta, public.cuenta_saldo, public.movimiento to authenticated;
grant insert, update, delete on public.producto to authenticated;

-- ---------- snapshot_cuentas (spec db §7: 30 0 * * *) ----------
-- Corte diario de cuenta_saldo. Solo tenants con módulo creditos activo.
-- Si el módulo está inactivo no escribe (GC-CRED-001 implícito: skip).
-- Replica el último saldo conocido; si no hay, usa cuenta.monto / 0 atraso.
create or replace function public.snapshot_cuentas()
returns int
language plpgsql security definer
set search_path = public
as $$
declare
  v_count int := 0;
  v_corte timestamptz := date_trunc('day', timezone('utc', now()));
begin
  insert into public.cuenta_saldo (cuenta_id, dias_atraso, rango_mora, capital_riesgo, corte_en)
  select c.id,
         coalesce(ult.dias_atraso, 0),
         ult.rango_mora,
         coalesce(ult.capital_riesgo, c.monto, 0),
         v_corte
    from public.cuenta c
    left join lateral (
      select s.dias_atraso, s.rango_mora, s.capital_riesgo
        from public.cuenta_saldo s
       where s.cuenta_id = c.id
       order by s.corte_en desc
       limit 1
    ) ult on true
   where c.activo
     and public.modulo_activo(c.tenant_id, 'creditos')
     and not exists (
       select 1 from public.cuenta_saldo x
        where x.cuenta_id = c.id and x.corte_en = v_corte
     );
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;
revoke all on function public.snapshot_cuentas() from public;
grant execute on function public.snapshot_cuentas() to postgres;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    execute 'grant execute on function public.snapshot_cuentas() to service_role';
  end if;
end $$;

do $$
begin
  perform cron.schedule('snapshot-cuentas', '30 0 * * *', 'select public.snapshot_cuentas()');
exception
  when others then
    raise notice 'snapshot-cuentas: no se pudo programar el cron (%). Continúa la migración.', sqlerrm;
end $$;
