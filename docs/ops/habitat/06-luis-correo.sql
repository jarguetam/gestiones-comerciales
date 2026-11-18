-- Hábitat · Fase 0 · 0.6 — Correo de Luis Martínez a @habitathn.org
-- Aprobado por Josue el 2026-11-13. Misma cuenta (mismo id, rol, contraseña
-- y visitas); solo cambia el correo con el que entra.
-- Equivale a auth.admin.updateUserById(id, { email, email_confirm: true }).
-- La identidad «email» guarda el correo en identity_data (provider_id es el id).
-- Idempotente: si ya tiene el correo nuevo no hace nada.

begin;

do $$
declare
  v_viejo constant text := 'luis.martinez@habitat.com';
  v_nuevo constant text := 'luis.martinez@habitathn.org';
  v_id uuid;
  n int;
begin
  select au.id into v_id
    from auth.users au
    join public.usuario u on u.id = au.id
    join public.tenant t on t.id = u.tenant_id
   where au.email = v_viejo and t.codigo = 'h-bitat-para-la-humanidad-honduras';

  if v_id is null then
    if exists (select 1 from auth.users where email = v_nuevo) then
      raise notice 'Luis ya tiene el correo %', v_nuevo;
      return;
    end if;
    raise exception 'No se encontró a Luis con el correo %', v_viejo;
  end if;

  if exists (select 1 from auth.users where lower(email) = v_nuevo) then
    raise exception 'El correo % ya lo usa otra cuenta', v_nuevo;
  end if;

  update auth.users
     set email = v_nuevo, updated_at = now()
   where id = v_id;

  update auth.identities
     set identity_data = jsonb_set(identity_data, '{email}', to_jsonb(v_nuevo)),
         updated_at = now()
   where user_id = v_id and provider = 'email';
  get diagnostics n = row_count;
  if n <> 1 then
    raise exception 'Se esperaba 1 identidad email para Luis y hay %', n;
  end if;

  perform public.registrar_auditoria(
    (select tenant_id from public.usuario where id = v_id), 'usuario', v_id::text, 'update',
    jsonb_build_object('script', 'docs/ops/habitat/06-luis-correo.sql', 'email', v_viejo || ' → ' || v_nuevo));
end $$;

commit;
