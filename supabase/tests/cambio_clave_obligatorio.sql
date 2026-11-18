-- ============================================================
-- Cambio de clave obligatorio — el trigger
-- trg_borrar_marca_cambio_clave quita app_metadata.debe_cambiar_clave
-- solo cuando encrypted_password cambia de verdad, y no toca otras claves.
-- Autónomo: crea y revierte sus propios fixtures.
-- ============================================================
begin;
select plan(5);

insert into auth.users (id, email, encrypted_password, raw_app_meta_data)
values (
  'cccccccc-0000-0000-0000-000000000001', 'clave-t1@gt1.test',
  crypt('temporal-1', gen_salt('bf')),
  '{"tenant_id":"11111111-1111-1111-1111-111111111111","rol":"asesor","debe_cambiar_clave":true}'::jsonb
);

-- caso 3 y 4 primero con la marca puesta (no cambia la clave)
update auth.users
   set raw_user_meta_data = '{"x":1}'::jsonb, last_sign_in_at = now()
 where id = 'cccccccc-0000-0000-0000-000000000001';
select ok(
  (select raw_app_meta_data ? 'debe_cambiar_clave' from auth.users where id = 'cccccccc-0000-0000-0000-000000000001'),
  'caso 3: update de raw_user_meta_data / last_sign_in_at conserva la marca'
);

update auth.users
   set encrypted_password = encrypted_password
 where id = 'cccccccc-0000-0000-0000-000000000001';
select ok(
  (select raw_app_meta_data ? 'debe_cambiar_clave' from auth.users where id = 'cccccccc-0000-0000-0000-000000000001'),
  'caso 4: reescribir el mismo encrypted_password conserva la marca'
);

-- casos 1 y 2: cambio real de contraseña
update auth.users
   set encrypted_password = crypt('nueva-123', gen_salt('bf'))
 where id = 'cccccccc-0000-0000-0000-000000000001';
select ok(
  not (select raw_app_meta_data ? 'debe_cambiar_clave' from auth.users where id = 'cccccccc-0000-0000-0000-000000000001'),
  'caso 1: cambiar la contraseña borra la marca'
);
select is(
  (select raw_app_meta_data from auth.users where id = 'cccccccc-0000-0000-0000-000000000001'),
  '{"tenant_id":"11111111-1111-1111-1111-111111111111","rol":"asesor"}'::jsonb,
  'caso 2: cambiar la contraseña conserva tenant_id y rol'
);

-- caso 5: usuario_claims_refresh (merge con ||) no pisa la marca
update auth.users
   set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || '{"debe_cambiar_clave":true}'::jsonb
 where id = 'aaaaaaaa-0000-0000-0000-000000000004';
update public.usuario
   set activo = false
 where id = 'aaaaaaaa-0000-0000-0000-000000000004';
update public.usuario set activo = true where id = 'aaaaaaaa-0000-0000-0000-000000000004';
select ok(
  (select raw_app_meta_data ? 'debe_cambiar_clave' and raw_app_meta_data ->> 'rol' = 'asesor'
     from auth.users where id = 'aaaaaaaa-0000-0000-0000-000000000004'),
  'caso 5: usuario_claims_refresh conserva la marca'
);

select * from finish();
rollback;
