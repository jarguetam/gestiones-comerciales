-- ============================================================
-- F0.6 / F1.5 / F1.12 — Suite pgTAP
-- Setup: 2 tenants (GT-1, GT-2), jerarquía GC-CORE-010
-- (admin y gerente sin jefe; supervisor→gerente; asesor→supervisor)
-- y datos mínimos. Este archivo COMMITEA el fixture para que el
-- resto de supabase/tests/*.sql lo vea (`supabase test db`).
-- ============================================================
begin;
select plan(1);

create schema if not exists tests;

-- ---------- datos base ----------
insert into public.tenant (id, codigo, nombre, rubro, plan) values
  ('11111111-1111-1111-1111-111111111111', 'GT1', 'Agro Test', 'agro', 'pro'),
  ('22222222-2222-2222-2222-222222222222', 'GT2', 'Consumo Test', 'consumo', 'basico');

-- public.usuario.id → auth.users(id). El auth user existe antes del perfil.
insert into auth.users (id, email) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'admin-t1@gt1.test'),
  ('aaaaaaaa-0000-0000-0000-000000000002', 'gerente-t1@gt1.test'),
  ('aaaaaaaa-0000-0000-0000-000000000003', 'supervisor-t1@gt1.test'),
  ('aaaaaaaa-0000-0000-0000-000000000004', 'asesor-a-t1@gt1.test'),
  ('aaaaaaaa-0000-0000-0000-000000000005', 'asesor-b-t1@gt1.test'),
  ('bbbbbbbb-0000-0000-0000-000000000001', 'admin-t2@gt2.test'),
  ('bbbbbbbb-0000-0000-0000-000000000003', 'gerente-t2@gt2.test'),
  ('bbbbbbbb-0000-0000-0000-000000000004', 'supervisor-t2@gt2.test'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'asesor-t2@gt2.test')
on conflict (id) do nothing;

-- usuarios: uuid deterministas, creados directo en public.usuario
-- (los tests setean request.jwt.claims para simular el JWT)
insert into public.usuario (id, tenant_id, nombre, rol, jefe_id) values
  ('aaaaaaaa-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'Admin T1', 'admin', null),
  ('aaaaaaaa-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'Gerente T1', 'gerente', null),
  ('aaaaaaaa-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111', 'Supervisor T1', 'supervisor', 'aaaaaaaa-0000-0000-0000-000000000002'),
  ('aaaaaaaa-0000-0000-0000-000000000004', '11111111-1111-1111-1111-111111111111', 'Asesor A T1', 'asesor', 'aaaaaaaa-0000-0000-0000-000000000003'),
  ('aaaaaaaa-0000-0000-0000-000000000005', '11111111-1111-1111-1111-111111111111', 'Asesor B T1', 'asesor', 'aaaaaaaa-0000-0000-0000-000000000003'),
  ('bbbbbbbb-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 'Admin T2', 'admin', null),
  ('bbbbbbbb-0000-0000-0000-000000000003', '22222222-2222-2222-2222-222222222222', 'Gerente T2', 'gerente', null),
  ('bbbbbbbb-0000-0000-0000-000000000004', '22222222-2222-2222-2222-222222222222', 'Supervisor T2', 'supervisor', 'bbbbbbbb-0000-0000-0000-000000000003'),
  ('bbbbbbbb-0000-0000-0000-000000000002', '22222222-2222-2222-2222-222222222222', 'Asesor T2', 'asesor', 'bbbbbbbb-0000-0000-0000-000000000004');

insert into public.persona (tenant_id, nombre, documento, asesor_id) values
  ('11111111-1111-1111-1111-111111111111', 'Finca T1', 'NIT-T1-1', 'aaaaaaaa-0000-0000-0000-000000000004'),
  ('22222222-2222-2222-2222-222222222222', 'Tienda T2', 'NIT-T2-1', 'bbbbbbbb-0000-0000-0000-000000000002');

insert into public.departamento (nombre) values ('Guatemala Fixture')
on conflict (nombre) do nothing;

insert into public.municipio (departamento_id, nombre)
select d.id, 'Guatemala Fixture'
  from public.departamento d
 where d.nombre = 'Guatemala Fixture'
on conflict (departamento_id, nombre) do nothing;

insert into public.zona (tenant_id, codigo, nombre) values
  ('11111111-1111-1111-1111-111111111111', 'Z1', 'Zona 1'),
  ('22222222-2222-2222-2222-222222222222', 'Z1', 'Zona 1');

insert into public.actividad (tenant_id, nombre) values
  ('11111111-1111-1111-1111-111111111111', 'Visita comercial'),
  ('22222222-2222-2222-2222-222222222222', 'Visita comercial');

insert into public.sub_actividad (tenant_id, actividad_id, nombre)
select a.tenant_id, a.id, 'Seguimiento'
  from public.actividad a
 where a.tenant_id in (
   '11111111-1111-1111-1111-111111111111',
   '22222222-2222-2222-2222-222222222222'
 ) and a.nombre = 'Visita comercial';

insert into public.actividad_hora (tenant_id, nombre, cantidad) values
  ('11111111-1111-1111-1111-111111111111', '1 hora', 1),
  ('22222222-2222-2222-2222-222222222222', '1 hora', 1);

-- helpers para simular JWT (postgrest setea request.jwt.claims)
create or replace function tests.set_claims(p_tenant uuid, p_rol text, p_uid uuid)
returns void language sql as $$
  select set_config('request.jwt.claims',
    json_build_object('tenant_id', p_tenant::text, 'rol', p_rol, 'sub', p_uid::text)::text, true);
  select set_config('role', 'authenticated', true);
$$;

create or replace function tests.reset_claims()
returns void language sql as $$
  select set_config('request.jwt.claims', '', true);
  select set_config('role', 'postgres', true);
$$;

-- set_claims deja role=authenticated; sin USAGE el siguiente tests.* explota.
grant usage on schema tests to postgres, authenticated, anon;
grant execute on all functions in schema tests to postgres, authenticated, anon;

select ok(
  exists (select 1 from public.usuario where id = 'aaaaaaaa-0000-0000-0000-000000000004')
  and exists (select 1 from information_schema.schemata where schema_name = 'tests'),
  'fixture de tenants, jerarquía válida y schema tests'
);

select * from finish();
commit;
