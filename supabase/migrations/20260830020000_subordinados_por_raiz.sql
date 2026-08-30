-- Expand: overload subordinados(uuid) para dashboard_asesor(p_usuario_id).
-- Remotos que ya aplicaron 20260826120000 sin el overload lo reciben aquí.
-- Blank reset también lo define en 20260826120000 (create or replace).

create or replace function public.subordinados(p_raiz uuid)
returns setof uuid
language sql stable security definer
set search_path = public
as $$
  with recursive arbol as (
    select u.id, u.rol, u.activo from public.usuario u where u.id = p_raiz
    union all
    select u.id, u.rol, u.activo
    from public.usuario u
    join arbol a on u.jefe_id = a.id
    where u.activo
  )
  select id from arbol where p_raiz is not null and id <> p_raiz;
$$;

create or replace function public.subordinados()
returns setof uuid
language sql stable security definer
set search_path = public
as $$
  select public.subordinados(auth.uid());
$$;

revoke all on function public.subordinados(uuid) from public;
grant execute on function public.subordinados(uuid) to authenticated;
grant execute on function public.subordinados() to authenticated;
