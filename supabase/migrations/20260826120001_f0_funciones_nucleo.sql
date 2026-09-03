-- ============================================================
-- F0 · Migración 002 — Funciones núcleo (jerarquía y plataforma)
-- Ref: spec/db/SPEC.md §6 · design D9, D11
-- ============================================================

-- ---------- árbol jerárquico para UI (W-11) ----------
-- (subordinados() está definida en la migración 001, requerida por RLS)
create or replace function public.estructura_comercial()
returns jsonb
language sql stable security invoker
set search_path = public
as $$
  with recursive arbol as (
    select u.id, u.nombre, u.rol, u.jefe_id, 0 as nivel
    from public.usuario u
    where u.id = auth.uid() or u.jefe_id = auth.uid()
    union all
    select u.id, u.nombre, u.rol, u.jefe_id, a.nivel + 1
    from public.usuario u
    join arbol a on u.jefe_id = a.id
    where u.activo
  )
  select jsonb_agg(to_jsonb(arbol) order by nivel, nombre) from arbol;
$$;

-- ---------- helpers de plataforma ----------
create or replace function public.es_usuario_plataforma()
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.usuario_plataforma up
    where up.id = auth.uid() and up.activo
  );
$$;

create or replace function public.es_superadmin()
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.usuario_plataforma up
    where up.id = auth.uid() and up.activo and up.es_superadmin
  );
$$;

-- ¿puede el autenticado (plataforma) operar sobre este tenant?
create or replace function public.plataforma_puede_operar(p_tenant uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select public.es_superadmin()
     or exists (
       select 1 from public.usuario_plataforma_tenant upt
       where upt.usuario_plataforma_id = auth.uid()
         and upt.tenant_id = p_tenant
         and upt.rol in ('owner','soporte')
     );
$$;

-- ---------- auditoría genérica ----------
create or replace function public.registrar_auditoria(
  p_tenant uuid, p_tabla text, p_registro_id text,
  p_accion text, p_cambios jsonb default '{}'
)
returns void
language plpgsql security definer
set search_path = public
as $$
begin
  insert into public.auditoria (tenant_id, tabla, registro_id, accion, usuario_id, cambios)
  values (p_tenant, p_tabla, p_registro_id, p_accion, auth.uid(), coalesce(p_cambios, '{}'::jsonb));
end;
$$;

-- ---------- validación de jerarquía (GC-CORE-010) ----------
create or replace function public.validar_jerarquia_usuario()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_rol_jefe text;
  v_rol_new  text := new.rol;
begin
  if new.jefe_id is not null then
    -- el jefe debe existir y estar activo
    select rol into v_rol_jefe from public.usuario where id = new.jefe_id and activo;
    if v_rol_jefe is null then
      raise exception 'GC-CORE-010: jefe inexistente o inactivo';
    end if;

    -- cadena válida: asesor→supervisor, supervisor→gerente; admin no tiene jefe
    if (new.rol = 'asesor' and v_rol_jefe <> 'supervisor')
       or (new.rol = 'supervisor' and v_rol_jefe <> 'gerente')
       or (new.rol in ('gerente','admin'))
    then
      raise exception 'GC-CORE-010: jerarquía inválida (asesor→supervisor→gerente)';
    end if;

    -- sin ciclos: el jefe no puede ser subordinado del usuario
    if exists (select 1 from public.usuario where jefe_id = new.id and id = new.jefe_id) then
      raise exception 'GC-CORE-010: jerarquía cíclica detectada';
    end if;
  elsif new.rol = 'asesor' then
    raise exception 'GC-CORE-010: todo asesor requiere supervisor';
  end if;
  return new;
end;
$$;

create trigger trg_usuario_jerarquia
  before insert or update of rol, jefe_id on public.usuario
  for each row execute function public.validar_jerarquia_usuario();

-- ---------- RPC administrativas de plataforma (D11) ----------
-- NOTA: la creación del auth.users la hace la Edge Function con service_role;
-- estas RPC asumen que el auth user ya existe y gestionan el resto transaccionalmente.

create or replace function public.admin_tenant_crear(
  p_nombre text, p_rubro text, p_plan text default 'basico',
  p_branding jsonb default '{}', p_configuracion jsonb default '{}',
  p_modulos text[] default null
)
returns uuid
language plpgsql security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_codigo text := lower(regexp_replace(p_nombre, '[^a-zA-Z0-9]+', '-', 'g'));
begin
  -- solo plataforma con permisos
  if not public.plataforma_puede_operar(null::uuid) and not public.es_superadmin() then
    raise exception 'GC-AUTH-001: requiere rol de plataforma';
  end if;

  insert into public.tenant (codigo, nombre, rubro, plan, branding, configuracion)
  values (v_codigo, p_nombre, p_rubro, p_plan, coalesce(p_branding,'{}'), coalesce(p_configuracion,'{}'))
  returning id into v_id;

  -- módulos: núcleo siempre + los solicitados
  insert into public.tenant_modulo (tenant_id, modulo_id, activo)
  select v_id, m.id, true
  from public.modulo m
  where m.nucleo or (p_modulos is not null and m.codigo = any(p_modulos));

  perform public.registrar_auditoria(v_id, 'tenant', v_id::text, 'insert',
    jsonb_build_object('nombre', p_nombre, 'rubro', p_rubro, 'plan', p_plan));

  return v_id;
end;
$$;

create or replace function public.admin_usuario_invitar(
  p_tenant_id uuid, p_email text, p_rol text, p_jefe_id uuid default null,
  p_nombre text default null, p_zona_id bigint default null
)
returns uuid
language plpgsql security definer
set search_path = public
as $$
declare
  v_user uuid;
begin
  if not (public.es_superadmin() or public.plataforma_puede_operar(p_tenant_id))
     and not ((auth.jwt() ->> 'rol') = 'admin' and (auth.jwt() ->> 'tenant_id')::uuid = p_tenant_id) then
    raise exception 'GC-AUTH-001: sin permisos para invitar en este tenant';
  end if;

  if p_rol not in ('admin','gerente','supervisor','asesor') then
    raise exception 'GC-AUTH-002: rol inválido';
  end if;

  -- auth user creado previamente por Edge Function (service_role); se recibe p_email
  select id into v_user from auth.users where email = p_email;
  if v_user is null then
    raise exception 'GC-AUTH-003: usuario de auth no existe (debe crearse vía Edge Function)';
  end if;

  insert into public.usuario (id, tenant_id, nombre, telefono, rol, jefe_id, zona_id)
  values (v_user, p_tenant_id, coalesce(p_nombre, p_email), null, p_rol, p_jefe_id, p_zona_id);

  perform public.registrar_auditoria(p_tenant_id, 'usuario', v_user::text, 'insert',
    jsonb_build_object('email', p_email, 'rol', p_rol));

  return v_user;
end;
$$;

create or replace function public.admin_modulo_activar(
  p_tenant_id uuid, p_modulo text, p_activo boolean default true, p_configuracion jsonb default null
)
returns void
language plpgsql security definer
set search_path = public
as $$
begin
  if not (public.es_superadmin() or public.plataforma_puede_operar(p_tenant_id)) then
    raise exception 'GC-AUTH-001: requiere rol de plataforma';
  end if;

  update public.tenant_modulo tm
  set activo = p_activo,
      configuracion = coalesce(p_configuracion, tm.configuracion)
  from public.modulo m
  where tm.modulo_id = m.id and tm.tenant_id = p_tenant_id and m.codigo = p_modulo;

  if not found then
    insert into public.tenant_modulo (tenant_id, modulo_id, activo, configuracion)
    select p_tenant_id, m.id, p_activo, coalesce(p_configuracion, '{}'::jsonb)
    from public.modulo m where m.codigo = p_modulo;
  end if;

  perform public.registrar_auditoria(p_tenant_id, 'tenant_modulo', p_modulo, 'update',
    jsonb_build_object('activo', p_activo));
end;
$$;

-- grants
grant execute on function public.subordinados() to authenticated;
grant execute on function public.subordinados(uuid) to authenticated;
grant execute on function public.estructura_comercial() to authenticated;
grant execute on function public.admin_tenant_crear(text,text,text,jsonb,jsonb,text[]) to authenticated;
grant execute on function public.admin_usuario_invitar(uuid,text,text,uuid,text,bigint) to authenticated;
grant execute on function public.admin_modulo_activar(uuid,text,boolean,jsonb) to authenticated;
