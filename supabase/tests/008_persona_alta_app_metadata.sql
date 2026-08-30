-- ============================================================
-- Alta inline de persona (W-03): RLS debe leer claims de
-- app_metadata / public.usuario, no solo auth.jwt() ->> 'tenant_id'
-- en la raíz (GoTrue no los pone ahí si el hook no está activo).
-- ============================================================
begin;
select plan(4);

insert into public.tenant (id, codigo, nombre, rubro, plan) values
  ('11111111-1111-1111-1111-111111111111', 'GT1', 'Agro Test', 'agro', 'pro')
on conflict (id) do nothing;

insert into public.usuario (id, tenant_id, nombre, rol, jefe_id) values
  ('aaaaaaaa-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'Gerente T1', 'gerente', null),
  ('aaaaaaaa-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111', 'Supervisor T1', 'supervisor', 'aaaaaaaa-0000-0000-0000-000000000002'),
  ('aaaaaaaa-0000-0000-0000-000000000004', '11111111-1111-1111-1111-111111111111', 'Asesor A T1', 'asesor', 'aaaaaaaa-0000-0000-0000-000000000003'),
  ('aaaaaaaa-0000-0000-0000-000000000005', '11111111-1111-1111-1111-111111111111', 'Asesor B T1', 'asesor', 'aaaaaaaa-0000-0000-0000-000000000003')
on conflict (id) do nothing;

-- 1. JWT estilo GoTrue: tenant_id/rol solo en app_metadata
select set_config('request.jwt.claims', json_build_object(
  'sub', 'aaaaaaaa-0000-0000-0000-000000000004',
  'role', 'authenticated',
  'app_metadata', json_build_object(
    'tenant_id', '11111111-1111-1111-1111-111111111111',
    'rol', 'asesor'
  )
)::text, true);
select set_config('role', 'authenticated', true);

select lives_ok(
  $$insert into public.persona (tenant_id, nombre, documento, asesor_id, categoria, detalles)
    values (
      '11111111-1111-1111-1111-111111111111',
      'Test AppMeta',
      '0501199403142',
      'aaaaaaaa-0000-0000-0000-000000000004',
      'Prospecto — En evaluación',
      '{"telefono":"958555"}'::jsonb
    )$$,
  'asesor con claims solo en app_metadata puede registrar persona'
);

select is(
  (select nombre from public.persona where documento = '0501199403142'),
  'Test AppMeta',
  'la persona quedó persistida y visible para el asesor'
);

-- 2. Sin tenant en la raíz NI en app_metadata: fallback public.usuario vía auth.uid()
select set_config('request.jwt.claims', json_build_object(
  'sub', 'aaaaaaaa-0000-0000-0000-000000000004',
  'role', 'authenticated'
)::text, true);

select lives_ok(
  $$insert into public.persona (tenant_id, nombre, documento, asesor_id)
    values (
      '11111111-1111-1111-1111-111111111111',
      'Test Solo Sub',
      'DOC-SOLO-SUB',
      'aaaaaaaa-0000-0000-0000-000000000004'
    )$$,
  'asesor con solo sub en el JWT registra vía tenant_id_actual() → public.usuario'
);

-- 3. Sigue sin poder asignar a otro asesor
select throws_ok(
  $$insert into public.persona (tenant_id, nombre, documento, asesor_id)
    values (
      '11111111-1111-1111-1111-111111111111',
      'Robada',
      'DOC-ROBADA',
      'aaaaaaaa-0000-0000-0000-000000000005'
    )$$,
  '42501',
  'asesor no puede crear persona asignada a otro asesor'
);

select set_config('request.jwt.claims', '', true);
select set_config('role', 'postgres', true);

select * from finish();
rollback;
