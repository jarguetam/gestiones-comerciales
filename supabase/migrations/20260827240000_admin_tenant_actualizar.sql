-- RPCs de plataforma que quedaron en F0 (20260826120003) pero no están
-- en el proyecto remoto: PostgREST devolvía PGRST202 al guardar empresa.

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
          or (public.rol_actual() = 'admin' and public.tenant_id_actual() = v_tenant)) then
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

revoke all on function public.admin_tenant_actualizar(uuid, jsonb) from public;
revoke all on function public.admin_usuario_gestionar(uuid, text, jsonb) from public;
grant execute on function public.admin_tenant_actualizar(uuid, jsonb) to authenticated;
grant execute on function public.admin_usuario_gestionar(uuid, text, jsonb) to authenticated;

notify pgrst, 'reload schema';
