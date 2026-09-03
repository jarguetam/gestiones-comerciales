-- ============================================================
-- P-06 — Tests de admin_salud_plataforma (pgTAP)
--   - sin plataforma: GC-AUTH-001
--   - superadmin ve jobs esperados + uso de todos los tenants
--   - membresía (no superadmin) solo ve tenants asignados
-- ============================================================
begin;
select plan(9);

insert into public.tenant (id, codigo, nombre, rubro, plan) values
  ('11111111-1111-1111-1111-111111111111', 'GT1', 'Agro Test', 'agro', 'pro'),
  ('22222222-2222-2222-2222-222222222222', 'GT2', 'Consumo Test', 'consumo', 'basico')
on conflict (id) do nothing;

insert into auth.users (id, email) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'admin-t1@salud.test'),
  ('bbbbbbbb-0000-0000-0000-000000000001', 'admin-t2@salud.test'),
  ('cccccccc-0000-0000-0000-000000000001', 'owner@plataforma.test'),
  ('cccccccc-0000-0000-0000-000000000002', 'lectura@plataforma.test')
on conflict (id) do nothing;

insert into public.usuario (id, tenant_id, nombre, rol) values
  ('aaaaaaaa-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'Admin T1', 'admin'),
  ('bbbbbbbb-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 'Admin T2', 'admin')
on conflict (id) do nothing;

insert into public.usuario_plataforma (id, email, nombre, es_superadmin) values
  ('cccccccc-0000-0000-0000-000000000001', 'owner@plataforma.test', 'Owner Plataforma', true),
  ('cccccccc-0000-0000-0000-000000000002', 'lectura@plataforma.test', 'Lectura Plataforma', false)
on conflict (id) do nothing;

insert into public.usuario_plataforma_tenant (usuario_plataforma_id, tenant_id, rol) values
  ('cccccccc-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'lectura')
on conflict do nothing;

insert into public.dispositivo (usuario_id, token_fcm, plataforma, activo) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'fcm-t1-a', 'android', true),
  ('aaaaaaaa-0000-0000-0000-000000000001', 'fcm-t1-b', 'ios', true),
  ('aaaaaaaa-0000-0000-0000-000000000001', 'fcm-t1-off', 'web', false),
  ('bbbbbbbb-0000-0000-0000-000000000001', 'fcm-t2-a', 'android', true);

insert into public.notificacion (tenant_id, usuario_id, titulo, cuerpo) values
  ('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-0000-0000-0000-000000000001', 'Agenda', 'Visita mañana');

insert into public.integracion_evento (tenant_id, origen, tipo, payload, firma_ok, estado, error) values
  ('11111111-1111-1111-1111-111111111111', 'webhook', 'persona.upsert', '{}', false, 'error', 'GC-IMP-010'),
  ('11111111-1111-1111-1111-111111111111', 'webhook', 'persona.upsert', '{}', true, 'procesado', null);

insert into public.edge_invocacion (tenant_id, funcion, duracion_ms, ok, error) values
  ('11111111-1111-1111-1111-111111111111', 'notify-jobs', 120, false, 'GC-JOBS-013'),
  ('11111111-1111-1111-1111-111111111111', 'push-notifications', 40, true, null);

-- 1. asesor de empresa no opera la RPC de plataforma
select set_config('request.jwt.claims',
  json_build_object('tenant_id', '11111111-1111-1111-1111-111111111111',
                    'rol', 'asesor',
                    'sub', 'aaaaaaaa-0000-0000-0000-000000000001')::text, true);
select set_config('role', 'authenticated', true);

select throws_ok(
  $$select public.admin_salud_plataforma()$$,
  'GC-AUTH-010: requiere usuario de plataforma',
  'usuario de empresa no consulta salud de plataforma'
);

select set_config('request.jwt.claims', '', true);
select set_config('role', 'postgres', true);

-- 2-6. superadmin
select set_config('request.jwt.claims',
  json_build_object('plataforma', true, 'superadmin', true,
                    'sub', 'cccccccc-0000-0000-0000-000000000001',
                    'aal', 'aal2')::text, true);
select set_config('role', 'authenticated', true);

select lives_ok(
  $$select public.admin_salud_plataforma()$$,
  'superadmin puede consultar salud de plataforma'
);

select ok(
  (select public.admin_salud_plataforma() -> 'jobs' @> '[{"nombre":"snapshot-cuentas"}]'::jsonb)
  and (select public.admin_salud_plataforma() -> 'jobs' @> '[{"nombre":"notify-jobs-recordatorio-agenda"}]'::jsonb)
  and (select public.admin_salud_plataforma() -> 'jobs' @> '[{"nombre":"recordatorio-depositos"}]'::jsonb)
  and (select public.admin_salud_plataforma() -> 'jobs' @> '[{"nombre":"recordatorio-kilometraje"}]'::jsonb),
  'la respuesta incluye los 4 jobs esperados'
);

select is(
  (select (t ->> 'dispositivos_activos')::int
     from jsonb_array_elements(public.admin_salud_plataforma() -> 'tenants') t
    where t ->> 'id' = '11111111-1111-1111-1111-111111111111'),
  2,
  'T1 cuenta solo dispositivos activos'
);

select is(
  (select (t ->> 'errores_integracion_24h')::int
     from jsonb_array_elements(public.admin_salud_plataforma() -> 'tenants') t
    where t ->> 'id' = '11111111-1111-1111-1111-111111111111'),
  1,
  'T1 cuenta webhooks en error de las últimas 24 h'
);

select is(
  (select (t ->> 'errores_edge_24h')::int
     from jsonb_array_elements(public.admin_salud_plataforma() -> 'tenants') t
    where t ->> 'id' = '11111111-1111-1111-1111-111111111111'),
  1,
  'T1 cuenta invocaciones Edge fallidas de las últimas 24 h'
);

select is(
  (select (t ->> 'notificaciones_24h')::int
     from jsonb_array_elements(public.admin_salud_plataforma() -> 'tenants') t
    where t ->> 'id' = '11111111-1111-1111-1111-111111111111'),
  1,
  'T1 cuenta notificaciones de las últimas 24 h'
);

-- 7-8. membresía lectura: solo T1
select set_config('request.jwt.claims', '', true);
select set_config('role', 'postgres', true);
select set_config('request.jwt.claims',
  json_build_object('plataforma', true, 'superadmin', false,
                    'sub', 'cccccccc-0000-0000-0000-000000000002',
                    'aal', 'aal2')::text, true);
select set_config('role', 'authenticated', true);

select is(
  (select jsonb_array_length(public.admin_salud_plataforma() -> 'tenants')),
  1,
  'usuario plataforma con membresía T1 no ve T2'
);

select is(
  (select t ->> 'id'
     from jsonb_array_elements(public.admin_salud_plataforma() -> 'tenants') t),
  '11111111-1111-1111-1111-111111111111',
  'el único tenant visible es T1'
);

select set_config('request.jwt.claims', '', true);
select set_config('role', 'postgres', true);
select * from finish();
rollback;
