-- Gate 1 / Task 13 — auth_evento no es legible por authenticated.
begin;
select plan(4);

select ok(
  to_regclass('public.auth_evento') is not null,
  'existe la tabla auth_evento'
);

select is(
  (
    select relrowsecurity
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public'
       and c.relname = 'auth_evento'
  ),
  true,
  'auth_evento tiene RLS habilitado'
);

set local role authenticated;

select throws_ok(
  $$select count(*) from public.auth_evento$$,
  '42501',
  null,
  'authenticated no puede leer auth_evento'
);

reset role;

select is(
  (
    select bool_and(not has_table_privilege('authenticated', 'public.auth_evento', priv))
      from unnest(array['SELECT', 'INSERT', 'UPDATE', 'DELETE']) as priv
  ),
  true,
  'authenticated no tiene privilegios directos sobre auth_evento'
);

select * from finish();
rollback;
