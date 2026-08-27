-- ============================================================
-- Claims de empresa viven en JWT app_metadata (spec backend §3.1).
-- Las políticas históricas leían auth.jwt() ->> 'tenant_id' en la raíz,
-- que en GoTrue no existe (allí va role=authenticated). Resultado:
-- SELECT propio a veces pasa por auth.uid(); INSERT/RPC de admin fallan.
-- ============================================================

create or replace function public.jwt_claim(p_key text)
returns text
language sql
stable
as $$
  select coalesce(
    nullif(auth.jwt() ->> p_key, ''),
    auth.jwt() -> 'app_metadata' ->> p_key
  );
$$;

-- Solo el tenant/rol del usuario autenticado. Definer para leer public.usuario
-- si el access token aún no tiene claims (sesión previa al hook).
create or replace function public.tenant_id_actual()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    nullif(public.jwt_claim('tenant_id'), '')::uuid,
    (select u.tenant_id from public.usuario u where u.id = auth.uid() and u.activo)
  );
$$;

create or replace function public.rol_actual()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    public.jwt_claim('rol'),
    (select u.rol from public.usuario u where u.id = auth.uid() and u.activo)
  );
$$;

revoke all on function public.jwt_claim(text) from public;
revoke all on function public.tenant_id_actual() from public;
revoke all on function public.rol_actual() from public;
grant execute on function public.jwt_claim(text) to authenticated;
grant execute on function public.tenant_id_actual() to authenticated;
grant execute on function public.rol_actual() to authenticated;

-- ---------- W-11 ----------
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
  v_rol text := public.rol_actual();
  v_tenant uuid := public.tenant_id_actual();
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

-- ---------- W-10 catálogos: INSERT/UPDATE con el tenant real ----------
drop policy if exists tenant_actividad on public.actividad;
create policy tenant_actividad on public.actividad
  for all to authenticated
  using (tenant_id = public.tenant_id_actual())
  with check (tenant_id = public.tenant_id_actual());

drop policy if exists tenant_sub_actividad on public.sub_actividad;
create policy tenant_sub_actividad on public.sub_actividad
  for all to authenticated
  using (tenant_id = public.tenant_id_actual())
  with check (tenant_id = public.tenant_id_actual());

drop policy if exists tenant_actividad_hora on public.actividad_hora;
create policy tenant_actividad_hora on public.actividad_hora
  for all to authenticated
  using (tenant_id = public.tenant_id_actual())
  with check (tenant_id = public.tenant_id_actual());

drop policy if exists zona_admin on public.zona;
create policy zona_admin on public.zona
  for all to authenticated
  using (tenant_id = public.tenant_id_actual())
  with check (tenant_id = public.tenant_id_actual());

-- ---------- Hook: copia app_metadata.{tenant_id,rol,...} a la raíz del JWT
-- para que el resto de políticas históricas (visita, persona, CRM) coincidan.
-- Hay que activarlo en Auth > Hooks (o config.toml local).
create or replace function public.custom_access_token_hook(event jsonb)
returns jsonb
language plpgsql
stable
as $$
declare
  claims jsonb;
  meta jsonb;
begin
  claims := event->'claims';
  meta := coalesce(claims->'app_metadata', '{}'::jsonb);

  if meta ? 'tenant_id' then
    claims := jsonb_set(claims, '{tenant_id}', meta->'tenant_id');
  end if;
  if meta ? 'rol' then
    claims := jsonb_set(claims, '{rol}', meta->'rol');
  end if;
  if meta ? 'plataforma' then
    claims := jsonb_set(claims, '{plataforma}', meta->'plataforma');
  end if;
  if meta ? 'superadmin' then
    claims := jsonb_set(claims, '{superadmin}', meta->'superadmin');
  end if;

  return jsonb_set(event, '{claims}', claims);
end;
$$;

grant usage on schema public to supabase_auth_admin;
grant execute on function public.custom_access_token_hook(jsonb) to supabase_auth_admin;
revoke execute on function public.custom_access_token_hook(jsonb) from authenticated, anon, public;
