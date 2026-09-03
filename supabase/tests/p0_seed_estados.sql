-- ============================================================
-- Gate 1 / Task 5 — seed_solicitud_estados es solo interna.
-- Archivo autónomo: no requiere fixtures ni 000_setup_tests.sql.
-- ============================================================
begin;
select plan(7);

select ok(
  to_regprocedure('public.seed_solicitud_estados(uuid)') is not null,
  'existe la firma interna seed_solicitud_estados(uuid)'
);

set local role authenticated;

select throws_ok(
  $$select public.seed_solicitud_estados(
      '00000000-0000-0000-0000-000000000001'::uuid
    )$$,
  '42501',
  null,
  'authenticated no puede ejecutar seed_solicitud_estados(uuid)'
);

reset role;

select is(
  (
    select bool_and(
      not exists (
        select 1
          from aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) acl
         where acl.grantee = 0
           and acl.privilege_type = 'EXECUTE'
      )
    )
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname = 'seed_solicitud_estados'
  ),
  true,
  'PUBLIC no puede ejecutar ningún overload de seed_solicitud_estados'
);

select is(
  (
    select bool_and(
      not has_function_privilege('anon', p.oid, 'EXECUTE')
    )
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname = 'seed_solicitud_estados'
  ),
  true,
  'anon no puede ejecutar ningún overload de seed_solicitud_estados'
);

select is(
  (
    select bool_and(
      not has_function_privilege('authenticated', p.oid, 'EXECUTE')
    )
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname = 'seed_solicitud_estados'
  ),
  true,
  'authenticated no puede ejecutar ningún overload de seed_solicitud_estados'
);

select is(
  (
    select bool_and(
      has_function_privilege('postgres', p.oid, 'EXECUTE')
    )
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname = 'seed_solicitud_estados'
  ),
  true,
  'postgres conserva EXECUTE en todos los overloads internos'
);

select is(
  (
    select bool_and(
      has_function_privilege('service_role', p.oid, 'EXECUTE')
    )
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname = 'seed_solicitud_estados'
  ),
  true,
  'service_role conserva EXECUTE en todos los overloads internos'
);

select * from finish();
rollback;
