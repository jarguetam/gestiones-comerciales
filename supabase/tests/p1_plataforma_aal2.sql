-- Gate 1 / Task 14 — require_plataforma_aal2 rechaza sin membresía y con AAL1.
begin;
select plan(2);

insert into auth.users (id, email)
values
  ('00000000-0000-0000-0000-000000000401'::uuid, 'plat-aal2@test.local'),
  ('00000000-0000-0000-0000-000000000402'::uuid, 'empresa-aal2@test.local')
on conflict do nothing;

-- tenant requerido por FK de usuario
insert into public.tenant (id, codigo, nombre, rubro, activo)
values ('00000000-0000-0000-0000-000000000301'::uuid, 'aal2-test', 'Tenant AAL2', 'agro', true)
on conflict do nothing;

insert into public.usuario (id, tenant_id, nombre, rol, activo)
values (
  '00000000-0000-0000-0000-000000000402'::uuid,
  '00000000-0000-0000-0000-000000000301'::uuid,
  'Empresa',
  'admin',
  true
)
on conflict do nothing;

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000402","role":"authenticated","tenant_id":"00000000-0000-0000-0000-000000000301","rol":"admin","aal":"aal1"}',
  true
);

select throws_ok(
  $$ select public.require_plataforma_aal2() $$,
  'GC-AUTH-010',
  'usuario empresa sin fila plataforma recibe GC-AUTH-010'
);

insert into public.usuario_plataforma (id, email, nombre, es_superadmin, activo)
values ('00000000-0000-0000-0000-000000000401'::uuid, 'plat-aal2@test.local', 'Plat', true, true)
on conflict do nothing;

select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000401","role":"authenticated","plataforma":true,"superadmin":true,"aal":"aal1"}',
  true
);

select throws_ok(
  $$ select public.require_plataforma_aal2() $$,
  'GC-AUTH-011',
  'plataforma con AAL1 recibe GC-AUTH-011'
);

select * from finish();
rollback;
