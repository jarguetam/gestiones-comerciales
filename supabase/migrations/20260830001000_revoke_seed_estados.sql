-- Gate 1 / Task 5 — el seed de estados se invoca solo desde lógica interna.
-- Recorre todos los overloads para cerrar también cualquier firma equivalente.
do $migration$
declare
  v_signature text;
begin
  for v_signature in
    select format(
      '%I.%I(%s)',
      n.nspname,
      p.proname,
      pg_get_function_identity_arguments(p.oid)
    )
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname = 'seed_solicitud_estados'
       and p.prokind in ('f', 'w')
     order by p.oid
  loop
    execute format(
      'revoke execute on function %s from public, anon, authenticated',
      v_signature
    );
    execute format(
      'grant execute on function %s to postgres',
      v_signature
    );

    if exists (
      select 1
        from pg_roles
       where rolname = 'service_role'
    ) then
      execute format(
        'grant execute on function %s to service_role',
        v_signature
      );
    end if;
  end loop;
end
$migration$;
