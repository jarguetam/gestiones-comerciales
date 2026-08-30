-- Gate 1 / Task 14 — AAL2 obligatorio en RPCs de plataforma.

create or replace function public.require_plataforma_aal2()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1
      from public.usuario_plataforma up
     where up.id = auth.uid()
       and up.activo
  ) then
    raise exception 'GC-AUTH-010: requiere usuario de plataforma';
  end if;
  if auth.jwt() ->> 'aal' is distinct from 'aal2' then
    raise exception 'GC-AUTH-011: requiere autenticación de dos factores (AAL2)';
  end if;
end;
$$;

revoke all on function public.require_plataforma_aal2() from public;
grant execute on function public.require_plataforma_aal2() to authenticated;

-- admin_tenant_actualizar (versión Vault-aware)
create or replace function public.admin_tenant_actualizar(
  p_tenant_id uuid,
  p_cambios jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_conf jsonb;
  v_cambios_auditoria jsonb;
begin
  perform public.require_plataforma_aal2();

  if not (
    public.es_superadmin()
    or public.plataforma_puede_operar(p_tenant_id)
  ) then
    raise exception 'GC-AUTH-001: requiere rol de plataforma';
  end if;

  if not exists (
    select 1 from public.tenant where id = p_tenant_id
  ) then
    raise exception 'GC-CORE-001: tenant inexistente';
  end if;

  if p_cambios ? 'dominios' then
    select configuracion
           || jsonb_build_object('dominios_cors', p_cambios -> 'dominios')
      into v_conf
      from public.tenant
     where id = p_tenant_id;
  end if;

  update public.tenant
     set nombre = coalesce(p_cambios ->> 'nombre', nombre),
         rubro = coalesce(p_cambios ->> 'rubro', rubro),
         plan = coalesce(p_cambios ->> 'plan', plan),
         branding = case
           when p_cambios ? 'branding' then p_cambios -> 'branding'
           else branding
         end,
         configuracion = coalesce(
           v_conf,
           case
             when p_cambios ? 'configuracion' then p_cambios -> 'configuracion'
             else configuracion
           end
         ),
         activo = coalesce((p_cambios ->> 'activo')::boolean, activo)
   where id = p_tenant_id;

  if jsonb_typeof(p_cambios) = 'object' then
    v_cambios_auditoria := p_cambios - 'webhook_secret';
    if jsonb_typeof(p_cambios -> 'configuracion') = 'object' then
      v_cambios_auditoria := jsonb_set(
        v_cambios_auditoria,
        '{configuracion}',
        (p_cambios -> 'configuracion') - 'webhook_secret',
        false
      );
    end if;
  else
    v_cambios_auditoria := p_cambios;
  end if;

  perform public.registrar_auditoria(
    p_tenant_id, 'tenant', p_tenant_id::text, 'update', v_cambios_auditoria
  );
end;
$$;

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
  v_rubro text := public.normalizar_rubro(p_rubro);
begin
  perform public.require_plataforma_aal2();

  if not public.plataforma_puede_operar(null::uuid) and not public.es_superadmin() then
    raise exception 'GC-AUTH-001: requiere rol de plataforma';
  end if;

  insert into public.tenant (codigo, nombre, rubro, plan, branding, configuracion)
  values (v_codigo, p_nombre, v_rubro, p_plan, coalesce(p_branding,'{}'), coalesce(p_configuracion,'{}'))
  returning id into v_id;

  insert into public.tenant_modulo (tenant_id, modulo_id, activo)
  select v_id, m.id, true
  from public.modulo m
  where m.nucleo or (p_modulos is not null and m.codigo = any(p_modulos));

  insert into public.zona (tenant_id, codigo, nombre)
  values (v_id, 'Z1', 'Zona 1');

  perform public.aplicar_plantillas_rubro(v_id, v_rubro);

  perform public.registrar_auditoria(v_id, 'tenant', v_id::text, 'insert',
    jsonb_build_object('nombre', p_nombre, 'rubro', v_rubro, 'plan', p_plan));

  return v_id;
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
  perform public.require_plataforma_aal2();

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
  if public.es_usuario_plataforma() then
    perform public.require_plataforma_aal2();
  end if;

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

create or replace function public.admin_salud_plataforma()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_jobs jsonb := '[]'::jsonb;
  v_tenants jsonb := '[]'::jsonb;
  v_storage jsonb := '{}'::jsonb;
begin
  perform public.require_plataforma_aal2();

  begin
    v_jobs := public.admin_salud_jobs();
  exception
    when undefined_table or undefined_object then
      v_jobs := public.admin_salud_jobs_catalogo();
  end;

  begin
    if to_regclass('storage.objects') is not null then
      select coalesce(jsonb_object_agg(tenant_key, bytes), '{}'::jsonb)
        into v_storage
      from (
        select split_part(o.name, '/', 1) as tenant_key,
               coalesce(sum(coalesce((o.metadata->>'size')::bigint, 0)), 0) as bytes
          from storage.objects o
         group by 1
      ) s;
    end if;
  exception
    when undefined_table or undefined_column then
      v_storage := '{}'::jsonb;
  end;

  select coalesce(jsonb_agg(row_to_json(t)::jsonb order by t.nombre), '[]'::jsonb)
    into v_tenants
  from (
    select
      te.id,
      te.codigo,
      te.nombre,
      te.activo,
      coalesce((
        select count(*)::int
          from public.dispositivo d
          join public.usuario u on u.id = d.usuario_id
         where u.tenant_id = te.id and d.activo
      ), 0) as dispositivos_activos,
      coalesce((
        select count(*)::int
          from public.notificacion n
         where n.tenant_id = te.id
           and n.creado_en >= now() - interval '24 hours'
      ), 0) as notificaciones_24h,
      coalesce((v_storage ->> te.id::text)::bigint, 0) as storage_bytes,
      coalesce((
        select count(*)::int
          from public.edge_invocacion e
         where e.tenant_id = te.id
           and e.ok is false
           and e.creado_en >= now() - interval '24 hours'
      ), 0) as errores_edge_24h,
      coalesce((
        select count(*)::int
          from public.integracion_evento ie
         where ie.tenant_id = te.id
           and ie.estado = 'error'
           and ie.creado_en >= now() - interval '24 hours'
      ), 0) as errores_integracion_24h
    from public.tenant te
    where public.es_superadmin()
       or exists (
         select 1
           from public.usuario_plataforma_tenant upt
          where upt.usuario_plataforma_id = auth.uid()
            and upt.tenant_id = te.id
       )
  ) t;

  return jsonb_build_object(
    'generado_en', now(),
    'jobs', coalesce(v_jobs, '[]'::jsonb),
    'tenants', coalesce(v_tenants, '[]'::jsonb)
  );
end;
$$;

notify pgrst, 'reload schema';

-- Webhook HMAC: superadmin + AAL2
create or replace function public.admin_webhook_rotar_secret(p_tenant_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_secret text;
  v_vault_secret_id uuid;
  v_last4 text;
  v_rotated_at timestamptz := clock_timestamp();
begin
  perform public.require_plataforma_aal2();

  if (
    select count(*)
      from public.usuario_plataforma up
     where up.id = auth.uid()
       and up.es_superadmin
       and up.activo
  ) <> 1 then
    raise exception 'GC-AUTH-001: requiere superadmin activo de plataforma';
  end if;

  perform 1
    from public.tenant
   where id = p_tenant_id
   for update;
  if not found then
    raise exception 'GC-CORE-001: tenant inexistente';
  end if;

  v_secret := encode(extensions.gen_random_bytes(32), 'hex');
  v_last4 := right(v_secret, 4);

  select tws.vault_secret_id
    into v_vault_secret_id
    from private.tenant_webhook_secret tws
   where tws.tenant_id = p_tenant_id
   for update;

  if v_vault_secret_id is null then
    select vault.create_secret(
      v_secret,
      null,
      'Webhook HMAC de tenant ' || p_tenant_id::text
    )
      into v_vault_secret_id;

    insert into private.tenant_webhook_secret (
      tenant_id,
      vault_secret_id,
      secret_last4,
      rotated_at
    )
    values (
      p_tenant_id,
      v_vault_secret_id,
      v_last4,
      v_rotated_at
    );
  else
    perform vault.update_secret(v_vault_secret_id, v_secret);

    update private.tenant_webhook_secret
       set secret_last4 = v_last4,
           rotated_at = v_rotated_at
     where tenant_id = p_tenant_id;
  end if;

  update public.tenant
     set configuracion = coalesce(configuracion, '{}'::jsonb)
                         - 'webhook_secret'
   where id = p_tenant_id;

  perform public.registrar_auditoria(
    p_tenant_id,
    'tenant_webhook_secret',
    p_tenant_id::text,
    'update',
    jsonb_build_object('estado', 'rotado', 'last4', v_last4)
  );

  return v_secret;
end;
$$;

create or replace function public.admin_webhook_secret_estado(p_tenant_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_last4 text;
  v_rotated_at timestamptz;
begin
  perform public.require_plataforma_aal2();

  if (
    select count(*)
      from public.usuario_plataforma up
     where up.id = auth.uid()
       and up.es_superadmin
       and up.activo
  ) <> 1 then
    raise exception 'GC-AUTH-001: requiere superadmin activo de plataforma';
  end if;

  if not exists (
    select 1 from public.tenant t where t.id = p_tenant_id
  ) then
    raise exception 'GC-CORE-001: tenant inexistente';
  end if;

  select tws.secret_last4, tws.rotated_at
    into v_last4, v_rotated_at
    from private.tenant_webhook_secret tws
   where tws.tenant_id = p_tenant_id;

  return jsonb_build_object(
    'tenantId', p_tenant_id,
    'configurado', v_last4 is not null,
    'rotadoEn', v_rotated_at,
    'last4', v_last4
  );
end;
$$;
