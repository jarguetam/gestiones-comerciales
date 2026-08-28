-- ============================================================
-- Claims JWT al dar de alta el primer admin de una empresa.
-- Repro: createUser (auth.users) ocurre ANTES de public.usuario;
-- trg_usuario_claims_refresh solo disparaba en UPDATE, así que el
-- JWT queda sin {tenant_id, rol} y la web oculta Configuración.
-- ============================================================
begin;
select plan(5);

insert into auth.users (id, email) values
  ('eeeeeeee-0000-0000-0000-000000000001', 'admin-nuevo@empresa.test')
on conflict (id) do nothing;

insert into public.tenant (id, codigo, nombre, rubro, plan) values
  ('33333333-3333-3333-3333-333333333333', 'GTNEW', 'Empresa Nueva Claims', 'agro', 'pro');

-- 1. Sin fila en public.usuario el auth user no tiene claim de negocio
select is(
  (select raw_app_meta_data ->> 'rol' from auth.users
    where id = 'eeeeeeee-0000-0000-0000-000000000001'),
  null,
  'auth user recién creado (sin perfil) no tiene claim rol'
);

insert into public.usuario (id, tenant_id, nombre, rol) values
  ('eeeeeeee-0000-0000-0000-000000000001',
   '33333333-3333-3333-3333-333333333333',
   'Admin Nuevo', 'admin');

-- 2-3. El INSERT del perfil debe copiar tenant_id y rol a raw_app_meta_data
select is(
  (select raw_app_meta_data ->> 'rol' from auth.users
    where id = 'eeeeeeee-0000-0000-0000-000000000001'),
  'admin',
  'al insertar el admin de empresa se copia rol a app_metadata'
);

select is(
  (select raw_app_meta_data ->> 'tenant_id' from auth.users
    where id = 'eeeeeeee-0000-0000-0000-000000000001'),
  '33333333-3333-3333-3333-333333333333',
  'al insertar el admin de empresa se copia tenant_id a app_metadata'
);

-- 4-5. El hook de access token hidrata claims aunque app_metadata llegue vacío
-- (admins ya invitados antes del fix, o token emitido antes del INSERT).
update auth.users
  set raw_app_meta_data = '{}'::jsonb
  where id = 'eeeeeeee-0000-0000-0000-000000000001';

select is(
  (select public.custom_access_token_hook(jsonb_build_object(
      'user_id', 'eeeeeeee-0000-0000-0000-000000000001',
      'claims', jsonb_build_object(
        'sub', 'eeeeeeee-0000-0000-0000-000000000001',
        'app_metadata', '{}'::jsonb
      )
    )) -> 'claims' -> 'app_metadata' ->> 'rol'),
  'admin',
  'el hook hidrata app_metadata.rol desde public.usuario'
);

select is(
  (select public.custom_access_token_hook(jsonb_build_object(
      'user_id', 'eeeeeeee-0000-0000-0000-000000000001',
      'claims', jsonb_build_object(
        'sub', 'eeeeeeee-0000-0000-0000-000000000001',
        'app_metadata', '{}'::jsonb
      )
    )) -> 'claims' ->> 'rol'),
  'admin',
  'el hook copia rol a la raíz del JWT (RLS histórica)'
);

select * from finish();
rollback;
