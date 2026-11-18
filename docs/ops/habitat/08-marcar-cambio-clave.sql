-- Hábitat · Fase 0 · 0.7 — Obligar a cambiar la clave temporal en el primer ingreso
-- Los usuarios de Hábitat se crearon antes de que invitar-usuario pusiera la
-- marca app_metadata.debe_cambiar_clave. Este script se la agrega a los 19
-- usuarios activos que todavía usan la clave temporal (18 nuevos + Luis Martínez).
-- Queda fuera admin2@gestionescomerciales.com (cuenta de soporte).
-- La marca se mezcla con || para no tocar tenant_id, rol ni otras claves, y la
-- quita el trigger trg_borrar_marca_cambio_clave cuando el usuario cambia su clave.
-- Requiere la migración 20261115120000_cambio_clave_obligatorio.sql.
-- Correr UNA sola vez, con las claves aún sin cambiar: repetirlo volvería a marcar a
-- quien ya la cambió, así que el script se niega a correr dos veces (lo detecta por su
-- fila en public.auditoria). Si una corrida falla se revierte junto con su fila de
-- auditoría, y se puede reintentar.
-- Correr en el SQL editor de Supabase (rol postgres), justo después del despliegue a
-- producción y antes de invitar a cualquier usuario nuevo de Hábitat.
-- Los usuarios la verán al renovar su sesión o al volver a entrar.

begin;

do $$
declare
  v_t uuid;
  v_candidatos int;
  v_marcados int;
  v_admin2_marcado boolean;
  v_ids jsonb;
begin
  select id into v_t from public.tenant where codigo = 'h-bitat-para-la-humanidad-honduras';
  if v_t is null then
    raise exception 'No existe la empresa Hábitat';
  end if;

  if not exists (
    select 1 from pg_trigger
     where tgname = 'trg_borrar_marca_cambio_clave' and tgrelid = 'auth.users'::regclass and not tgisinternal
  ) then
    raise exception 'Falta la migración 20261115120000_cambio_clave_obligatorio: sin ella la marca nunca se quitaría';
  end if;

  if exists (
    select 1 from public.auditoria
     where tenant_id = v_t
       and cambios->>'script' = 'docs/ops/habitat/08-marcar-cambio-clave.sql'
  ) then
    raise exception 'El script 08-marcar-cambio-clave.sql ya se ejecutó para Hábitat: no se repite porque volvería a marcar a quien ya cambió su clave';
  end if;

  select count(*) into v_candidatos
    from public.usuario u
    join auth.users au on au.id = u.id
   where u.tenant_id = v_t and u.activo
     and lower(au.email) <> 'admin2@gestionescomerciales.com';
  if v_candidatos <> 19 then
    raise exception 'Se esperaban 19 usuarios activos de Hábitat (sin admin2) y hay %', v_candidatos;
  end if;

  -- Marca a los 19 (el guard de arriba impide una segunda corrida)
  update auth.users au
     set raw_app_meta_data = coalesce(au.raw_app_meta_data, '{}'::jsonb)
                             || jsonb_build_object('debe_cambiar_clave', true)
    from public.usuario u
   where u.id = au.id and u.tenant_id = v_t and u.activo
     and lower(au.email) <> 'admin2@gestionescomerciales.com'
     and au.raw_app_meta_data->>'debe_cambiar_clave' is distinct from 'true';

  -- Cuenta e identifica a los que quedaron marcados (no las filas cambiadas)
  select count(*), coalesce(jsonb_agg(au.id order by au.id), '[]'::jsonb) into v_marcados, v_ids
    from public.usuario u
    join auth.users au on au.id = u.id
   where u.tenant_id = v_t and u.activo
     and lower(au.email) <> 'admin2@gestionescomerciales.com'
     and au.raw_app_meta_data->>'debe_cambiar_clave' = 'true';
  if v_marcados <> 19 then
    raise exception 'Se esperaban 19 usuarios marcados y hay %', v_marcados;
  end if;

  select coalesce(bool_or(au.raw_app_meta_data->>'debe_cambiar_clave' = 'true'), false) into v_admin2_marcado
    from auth.users au
   where lower(au.email) = 'admin2@gestionescomerciales.com';
  if v_admin2_marcado then
    raise exception 'admin2@gestionescomerciales.com no debe llevar la marca';
  end if;

  perform public.registrar_auditoria(v_t, 'usuario', 'habitat-fase0', 'update',
    jsonb_build_object('script', 'docs/ops/habitat/08-marcar-cambio-clave.sql',
                       'marcados_cambio_clave', v_marcados,
                       'usuarios_marcados', v_ids));
end $$;

commit;
