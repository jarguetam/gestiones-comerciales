-- Gate 1 / Task 9 — solo admin escribe config_rastreo.
begin;
select plan(2);

insert into auth.users (id, email)
values
  ('00000000-0000-0000-0000-000000000201'::uuid, 'admin-rastreo@test.local'),
  ('00000000-0000-0000-0000-000000000202'::uuid, 'gerente-rastreo@test.local')
on conflict do nothing;

insert into public.tenant (id, codigo, nombre, rubro, activo)
values ('00000000-0000-0000-0000-000000000301'::uuid, 'rastreo-test', 'Tenant Rastreo', 'agro', true)
on conflict do nothing;

insert into public.usuario (id, tenant_id, nombre, rol, activo)
values
  ('00000000-0000-0000-0000-000000000201'::uuid, '00000000-0000-0000-0000-000000000301'::uuid, 'Admin', 'admin', true),
  ('00000000-0000-0000-0000-000000000202'::uuid, '00000000-0000-0000-0000-000000000301'::uuid, 'Gerente', 'gerente', true)
on conflict do nothing;

insert into public.config_rastreo (tenant_id, dia_semana, hora_inicio, hora_fin, intervalo_min, precision_max_m)
select '00000000-0000-0000-0000-000000000301'::uuid, 1, '08:00', '17:00', 15, 100
where not exists (
  select 1 from public.config_rastreo
  where tenant_id = '00000000-0000-0000-0000-000000000301'::uuid
    and dia_semana = 1
);

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000202","role":"authenticated","tenant_id":"00000000-0000-0000-0000-000000000301","rol":"gerente"}',
  true
);

select is(
  (select count(*) from (
    update public.config_rastreo
       set intervalo_min = 30
     where tenant_id = '00000000-0000-0000-0000-000000000301'::uuid
       and dia_semana = 1
    returning 1
  ) t),
  0::bigint,
  'gerente no puede actualizar config_rastreo (RLS bloquea)'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000201","role":"authenticated","tenant_id":"00000000-0000-0000-0000-000000000301","rol":"admin"}',
  true
);

select ok(
  (select count(*) from (
    update public.config_rastreo
       set intervalo_min = 20
     where tenant_id = '00000000-0000-0000-0000-000000000301'::uuid
       and dia_semana = 1
    returning 1
  ) t) > 0,
  'admin puede actualizar config_rastreo'
);

select * from finish();
rollback;
