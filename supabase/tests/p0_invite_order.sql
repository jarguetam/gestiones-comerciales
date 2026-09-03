-- ============================================================
-- Gate 1 — admin_usuario_invitar exige que Auth exista primero.
-- Un fallo GC-AUTH-003 no debe dejar una fila public.usuario.
-- ============================================================
begin;
select plan(3);

insert into public.tenant (id, codigo, nombre, rubro, plan) values
  ('91919191-0000-0000-0000-000000000001', 'G1-INVITE', 'Gate 1 Invite', 'agro', 'pro');

-- Actor autorizado de plataforma con un JWT AAL2.
insert into auth.users (id, email) values
  ('91919191-0000-0000-0000-000000000002', 'admin-plataforma@gate1.test');

insert into public.usuario_plataforma (id, email, nombre, es_superadmin) values
  (
    '91919191-0000-0000-0000-000000000002',
    'admin-plataforma@gate1.test',
    'Admin Plataforma Gate 1',
    true
  );

select is_empty(
  $$select id from auth.users where email = 'huerfano-invite@gate1.test'$$,
  'precondición: el usuario objetivo no existe en Auth'
);

select set_config(
  'request.jwt.claims',
  json_build_object(
    'sub', '91919191-0000-0000-0000-000000000002',
    'role', 'authenticated',
    'aal', 'aal2',
    'plataforma', true,
    'superadmin', true
  )::text,
  true
);
select set_config('role', 'authenticated', true);

select throws_ok(
  $$select public.admin_usuario_invitar(
    p_tenant_id => '91919191-0000-0000-0000-000000000001'::uuid,
    p_email => 'huerfano-invite@gate1.test'::text,
    p_rol => 'asesor'::text,
    p_jefe_id => null::uuid,
    p_nombre => 'Huérfano Gate 1'::text,
    p_zona_id => null::bigint
  )$$,
  'P0001',
  'GC-AUTH-003: usuario de auth no existe (debe crearse vía Edge Function)',
  'admin_usuario_invitar rechaza un usuario inexistente en Auth'
);

select set_config('request.jwt.claims', '', true);
select set_config('role', 'postgres', true);

select ok(
  not exists (
    select 1
    from public.usuario
    where tenant_id = '91919191-0000-0000-0000-000000000001'
      and nombre = 'Huérfano Gate 1'
  ),
  'no queda fila public.usuario cuando Auth no existe'
);

select * from finish();
rollback;
