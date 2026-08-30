-- usuario_desactivar_claims todavía escribía auth.users.app_metadata
-- (columna de GoTrue antiguo). El schema actual usa raw_app_meta_data;
-- UPDATE de usuario.activo abortaba con "column app_metadata does not exist".

create or replace function public.usuario_desactivar_claims()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  update auth.users
  set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb)
    || jsonb_build_object('activo', new.activo)
  where id = new.id;
  return new;
end;
$$;
