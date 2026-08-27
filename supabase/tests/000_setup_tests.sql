-- ============================================================
-- F0.6 / F1.5 / F1.12 — Suite pgTAP
-- Setup: universo de prueba con 2 tenants (GT-1, GT-2), jerarquía
-- admin → gerente → supervisor → asesores, y datos mínimos.
-- Corre con `supabase test db` (rol postgres, bypasea RLS).
-- ============================================================
begin;
select plan(24);

-- ---------- datos base ----------
insert into public.tenant (id, codigo, nombre, rubro, plan) values
  ('11111111-1111-1111-1111-111111111111', 'GT1', 'Agro Test', 'agro', 'pro'),
  ('22222222-2222-2222-2222-222222222222', 'GT2', 'Consumo Test', 'consumo', 'basico');

-- usuarios: uuid deterministas, creados directo en public.usuario
-- (los tests setean request.jwt.claims para simular el JWT)
insert into public.usuario (id, tenant_id, nombre, rol, jefe_id) values
  ('aaaaaaaa-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'Admin T1', 'admin', null),
  ('aaaaaaaa-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'Gerente T1', 'gerente', 'aaaaaaaa-0000-0000-0000-000000000001'),
  ('aaaaaaaa-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111', 'Supervisor T1', 'supervisor', 'aaaaaaaa-0000-0000-0000-000000000002'),
  ('aaaaaaaa-0000-0000-0000-000000000004', '11111111-1111-1111-1111-111111111111', 'Asesor A T1', 'asesor', 'aaaaaaaa-0000-0000-0000-000000000003'),
  ('aaaaaaaa-0000-0000-0000-000000000005', '11111111-1111-1111-1111-111111111111', 'Asesor B T1', 'asesor', 'aaaaaaaa-0000-0000-0000-000000000003'),
  ('bbbbbbbb-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 'Admin T2', 'admin', null),
  ('bbbbbbbb-0000-0000-0000-000000000002', '22222222-2222-2222-2222-222222222222', 'Asesor T2', 'asesor', 'bbbbbbbb-0000-0000-0000-000000000001');

insert into public.persona (tenant_id, nombre, documento, asesor_id) values
  ('11111111-1111-1111-1111-111111111111', 'Finca T1', 'NIT-T1-1', 'aaaaaaaa-0000-0000-0000-000000000004'),
  ('22222222-2222-2222-2222-222222222222', 'Tienda T2', 'NIT-T2-1', 'bbbbbbbb-0000-0000-0000-000000000002');

insert into public.actividad (tenant_id, codigo, nombre) values
  ('11111111-1111-1111-1111-111111111111', 'VIS', 'Visita comercial'),
  ('22222222-2222-2222-2222-222222222222', 'VIS', 'Visita comercial');

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
