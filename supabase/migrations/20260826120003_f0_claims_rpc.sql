-- ============================================================
-- F0 · Migración 003 — Claims JWT duales + RPCs admin restantes
-- Ref: spec/db/SPEC.md §3.1, §6 · spec/backend/SPEC.md §3.1 · design D4, D11
-- ============================================================

-- ---------- 1. Claims JWT al crear usuario de auth ----------
-- Dual: usuarios de empresa llevan {tenant_id, rol}; usuarios de plataforma
-- llevan {plataforma: true, superadmin}. El trigger lee public.usuario /
-- public.usuario_plataforma y NO confía en nada del cliente.
create or replace function public.sync_auth_user_claims()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_usuario public.usuario%rowtype;
  v_plataforma public.usuario_plataforma%rowtype;
  v_metadata jsonb;
begin
  select * into v_usuario from public.usuario where id = new.id;
  select * into v_plataforma from public.usuario_plataforma where id = new.id;

  if v_usuario.id is not null then
    v_metadata := jsonb_build_object('tenant_id', v_usuario.tenant_id, 'rol', v_usuario.rol);
  elsif v_plataforma.id is not null then
    v_metadata := jsonb_build_object(
      'plataforma', true,
      'superadmin', v_plataforma.es_superadmin
    );
  else
    -- usuario sin perfil aún (flujo signup controlado): sin claims de negocio
    v_metadata := '{}'::jsonb;
  end if;

  update auth.users
  set app_metadata = coalesce(app_metadata, '{}'::jsonb) || v_metadata
  where id = new.id;

  return new;
end;
$$;

create trigger trg_sync_auth_user_claims
  after insert on auth.users
  for each row execute function public.sync_auth_user_claims();

-- ---------- 2. Sincronización de claims al cambiar rol/tenant ----------
-- Re-emite claims cuando cambia el rol o el tenant de un usuario existente.
create or replace function public.usuario_claims_refresh()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  update auth.users
  set app_metadata = coalesce(app_metadata, '{}'::jsonb)
    - 'plataforma' - 'superadmin'
    || jsonb_build_object('tenant_id', new.tenant_id, 'rol', new.rol)
  where id = new.id;
  return new;
end;
$$;

create trigger trg_usuario_claims_refresh
  after update of rol, tenant_id, activo on public.usuario
  for each row
  when (old.rol is distinct from new.rol
        or old.tenant_id is distinct from new.tenant_id
        or old.activo is distinct from new.activo)
  execute function public.usuario_claims_refresh();

-- Un usuario desactivado pierde el claim de rol (sesiones vigentes degradan a solo-lectura).
create or replace function public.usuario_desactivar_claims()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  update auth.users
  set app_metadata = coalesce(app_metadata, '{}'::jsonb)
    || jsonb_build_object('activo', new.activo)
  where id = new.id;
  return new;
end;
$$;

create trigger trg_usuario_desactivar_claims
  after update of activo on public.usuario
  for each row
  when (old.activo and not new.activo)
  execute function public.usuario_desactivar_claims();

-- ---------- 3. RPCs admin restantes (D11) ----------
create or replace function public.admin_tenant_actualizar(
  p_tenant_id uuid,
  p_cambios jsonb
)
returns void
language plpgsql security definer
set search_path = public
as $$
declare
  v_conf jsonb;
begin
  if not (public.es_superadmin() or public.plataforma_puede_operar(p_tenant_id)) then
    raise exception 'GC-AUTH-001: requiere rol de plataforma';
  end if;

  if not exists (select 1 from public.tenant where id = p_tenant_id) then
    raise exception 'GC-CORE-001: tenant inexistente';
  end if;

  -- dominios CORS viven dentro de configuracion (B-6)
  if p_cambios ? 'dominios' then
    select configuracion || jsonb_build_object('dominios_cors', p_cambios -> 'dominios')
      into v_conf from public.tenant where id = p_tenant_id;
  end if;

  update public.tenant
  set nombre        = coalesce(p_cambios ->> 'nombre', nombre),
      rubro         = coalesce(p_cambios ->> 'rubro', rubro),
      plan          = coalesce(p_cambios ->> 'plan', plan),
      branding      = case when p_cambios ? 'branding' then p_cambios -> 'branding' else branding end,
      configuracion = coalesce(v_conf, case when p_cambios ? 'configuracion' then p_cambios -> 'configuracion' else configuracion end),
      activo        = coalesce((p_cambios ->> 'activo')::boolean, activo)
  where id = p_tenant_id;

  perform public.registrar_auditoria(p_tenant_id, 'tenant', p_tenant_id::text, 'update', p_cambios);
end;
$$;

create or replace function public.admin_usuario_gestionar(
  p_usuario_id uuid,
  p_accion text,
  p_datos jsonb default '{}'::jsonb
)
returns void
language plpgsql security definer
set search_path = public
as $$
declare
  v_tenant uuid;
begin
  select tenant_id into v_tenant from public.usuario where id = p_usuario_id;
  if v_tenant is null then
    raise exception 'GC-CORE-002: usuario inexistente';
  end if;

  if not (public.es_superadmin() or public.plataforma_puede_operar(v_tenant)
          or ((auth.jwt() ->> 'rol') = 'admin' and (auth.jwt() ->> 'tenant_id')::uuid = v_tenant)) then
    raise exception 'GC-AUTH-001: sin permisos para gestionar este usuario';
  end if;

  case p_accion
    when 'activar' then
      update public.usuario set activo = true where id = p_usuario_id;
    when 'desactivar' then
      update public.usuario set activo = false where id = p_usuario_id;
    when 'cambiar_rol' then
      if p_datos ->> 'rol' not in ('admin','gerente','supervisor','asesor') then
        raise exception 'GC-AUTH-002: rol inválido';
      end if;
      update public.usuario set rol = p_datos ->> 'rol' where id = p_usuario_id;
    when 'cambiar_jefe' then
      update public.usuario set jefe_id = (p_datos ->> 'jefe_id')::uuid where id = p_usuario_id;
    when 'cambiar_zona' then
      update public.usuario set zona_id = (p_datos ->> 'zona_id')::bigint where id = p_usuario_id;
    else
      raise exception 'GC-CORE-003: acción no soportada (%)', p_accion;
  end case;

  perform public.registrar_auditoria(v_tenant, 'usuario', p_usuario_id::text, 'update',
    jsonb_build_object('accion', p_accion) || p_datos);
end;
$$;

create or replace function public.admin_importar_personas(
  p_tenant_id uuid,
  p_personas jsonb
)
returns int
language plpgsql security definer
set search_path = public
as $$
declare
  v_count int := 0;
  v_rubro text;
  v_row   jsonb;
begin
  if not (public.es_superadmin() or public.plataforma_puede_operar(p_tenant_id)
          or ((auth.jwt() ->> 'rol') = 'admin' and (auth.jwt() ->> 'tenant_id')::uuid = p_tenant_id)) then
    raise exception 'GC-AUTH-001: sin permisos para importar en este tenant';
  end if;

  select rubro into v_rubro from public.tenant where id = p_tenant_id;
  if v_rubro is null then
    raise exception 'GC-CORE-001: tenant inexistente';
  end if;

  -- persona se crea en F1 (migración núcleo); la RPC queda lista desde F0
  if to_regclass('public.persona') is null then
    raise exception 'GC-CORE-004: tabla persona aún no migrada (F1 · 1.1)';
  end if;

  for v_row in select * from jsonb_array_elements(p_personas) loop
    begin
      insert into public.persona (
        tenant_id, nombre, documento, documento_tipo, direccion,
        municipio_id, asesor_id, detalles, codigo_externo, categoria
      )
      select
        p_tenant_id,
        v_row ->> 'nombre',
        v_row ->> 'documento',
        coalesce(v_row ->> 'documento_tipo', 'DNI'),
        v_row ->> 'direccion',
        (v_row ->> 'municipio_id')::bigint,
        (v_row ->> 'asesor_id')::uuid,
        coalesce(v_row -> 'detalles', '{}'::jsonb),
        v_row ->> 'codigo_externo',
        v_row ->> 'categoria'
      where v_row ->> 'nombre' is not null
        and v_row ->> 'documento' is not null;

      if found then v_count := v_count + 1; end if;
    exception when unique_violation then
      -- idempotente por (tenant, documento): saltar duplicados
      null;
    end;
  end loop;

  perform public.registrar_auditoria(p_tenant_id, 'persona', null, 'import',
    jsonb_build_object('total', v_count));

  return v_count;
end;
$$;

-- grants
grant execute on function public.admin_tenant_actualizar(uuid, jsonb) to authenticated;
grant execute on function public.admin_usuario_gestionar(uuid, text, jsonb) to authenticated;
grant execute on function public.admin_importar_personas(uuid, jsonb) to authenticated;
grant execute on function public.sync_auth_user_claims() to authenticated;

-- revocar ejecución pública de funciones sensibles
revoke execute on function public.sync_auth_user_claims() from public;
revoke execute on function public.usuario_claims_refresh() from public;
revoke execute on function public.usuario_desactivar_claims() from public;
