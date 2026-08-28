-- ============================================================
-- Claims al invitar el primer admin de una empresa.
-- trg_usuario_claims_refresh solo corría en UPDATE de rol/tenant/activo.
-- El alta (INSERT vía admin_usuario_invitar) dejaba auth.users sin
-- {tenant_id, rol}; el JWT salía vacío y la web ocultaba Configuración.
-- ============================================================

-- 1) Copiar claims también en el INSERT del perfil de empresa
drop trigger if exists trg_usuario_claims_refresh on public.usuario;
create trigger trg_usuario_claims_refresh
  after insert or update of rol, tenant_id, activo on public.usuario
  for each row
  execute function public.usuario_claims_refresh();

-- 2) El hook de access token hidrata desde public.usuario si app_metadata
-- llegó vacío (admins ya invitados, o token emitido antes del INSERT).
-- Escribe en app_metadata (lo que lee session.user) y en la raíz (RLS).
create or replace function public.custom_access_token_hook(event jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  claims jsonb;
  meta jsonb;
  uid uuid;
  v_usuario public.usuario%rowtype;
  v_plat public.usuario_plataforma%rowtype;
begin
  claims := coalesce(event->'claims', '{}'::jsonb);
  meta := coalesce(claims->'app_metadata', '{}'::jsonb);
  uid := coalesce((event->>'user_id')::uuid, (claims->>'sub')::uuid);

  if uid is not null and (nullif(meta->>'tenant_id', '') is null or nullif(meta->>'rol', '') is null) then
    select * into v_usuario from public.usuario where id = uid and activo;
    if v_usuario.id is not null then
      meta := meta || jsonb_build_object('tenant_id', v_usuario.tenant_id, 'rol', v_usuario.rol);
    end if;
  end if;

  if uid is not null and meta->>'plataforma' is null then
    select * into v_plat from public.usuario_plataforma where id = uid and activo;
    if v_plat.id is not null then
      meta := meta || jsonb_build_object(
        'plataforma', true,
        'superadmin', v_plat.es_superadmin
      );
    end if;
  end if;

  claims := jsonb_set(claims, '{app_metadata}', meta);

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

-- 3) Backfill: admins (y el resto) invitados antes de este fix
update auth.users au
set raw_app_meta_data = coalesce(au.raw_app_meta_data, '{}'::jsonb)
  || jsonb_build_object('tenant_id', u.tenant_id, 'rol', u.rol)
from public.usuario u
where u.id = au.id
  and u.activo
  and (
    coalesce(au.raw_app_meta_data->>'rol', '') is distinct from u.rol
    or coalesce(au.raw_app_meta_data->>'tenant_id', '') is distinct from u.tenant_id::text
  );
