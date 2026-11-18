-- ============================================================
-- Cambio de clave obligatorio en el primer ingreso.
-- La Edge Function `invitar-usuario` pone app_metadata.debe_cambiar_clave = true
-- al crear un usuario con contraseña temporal; la web y la app lo leen del JWT
-- y fuerzan la pantalla de cambio. Este trigger quita SOLO esa clave cuando
-- encrypted_password cambia de verdad, sin tocar tenant_id, rol, etc.
-- No es SECURITY DEFINER: solo modifica NEW.
-- ============================================================
create or replace function public.borrar_marca_cambio_clave()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.raw_app_meta_data := coalesce(new.raw_app_meta_data, '{}'::jsonb) - 'debe_cambiar_clave';
  return new;
end;
$$;

revoke all on function public.borrar_marca_cambio_clave() from public, anon, authenticated;

create trigger trg_borrar_marca_cambio_clave
  before update of encrypted_password on auth.users
  for each row
  when (old.encrypted_password is distinct from new.encrypted_password)
  execute function public.borrar_marca_cambio_clave();
