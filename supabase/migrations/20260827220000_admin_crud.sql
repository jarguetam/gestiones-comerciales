-- ============================================================
-- Admin CRUD: listados de usuarios con email (auth.users)
-- W-11 (empresa) y P-04 (plataforma). Lectura security definer
-- porque el cliente no puede hacer join a auth.users.
-- ============================================================

create or replace function public.usuarios_empresa()
returns table (
  id uuid,
  nombre text,
  rol text,
  activo boolean,
  jefe_id uuid,
  zona_id bigint,
  email text
)
language plpgsql
stable
security definer
set search_path = public, auth
as $$
declare
  v_rol text := auth.jwt() ->> 'rol';
  v_tenant uuid := (auth.jwt() ->> 'tenant_id')::uuid;
begin
  if v_rol not in ('admin', 'gerente') or v_tenant is null then
    raise exception 'GC-AUTH-001: requiere admin o gerente de empresa';
  end if;

  return query
    select u.id, u.nombre, u.rol, u.activo, u.jefe_id, u.zona_id, au.email::text
    from public.usuario u
    left join auth.users au on au.id = u.id
    where u.tenant_id = v_tenant
      and (
        v_rol = 'admin'
        or u.id = auth.uid()
        or u.id in (select public.subordinados())
      )
    order by u.nombre;
end;
$$;

create or replace function public.admin_usuarios_tenant(p_tenant_id uuid)
returns table (
  id uuid,
  nombre text,
  rol text,
  activo boolean,
  jefe_id uuid,
  zona_id bigint,
  email text
)
language plpgsql
stable
security definer
set search_path = public, auth
as $$
begin
  if not (public.es_superadmin() or public.plataforma_puede_operar(p_tenant_id)) then
    raise exception 'GC-AUTH-001: requiere rol de plataforma';
  end if;

  return query
    select u.id, u.nombre, u.rol, u.activo, u.jefe_id, u.zona_id, au.email::text
    from public.usuario u
    left join auth.users au on au.id = u.id
    where u.tenant_id = p_tenant_id
    order by u.nombre;
end;
$$;

revoke all on function public.usuarios_empresa() from public;
revoke all on function public.admin_usuarios_tenant(uuid) from public;
grant execute on function public.usuarios_empresa() to authenticated;
grant execute on function public.admin_usuarios_tenant(uuid) to authenticated;
