-- ============================================================
-- F3.6 — Importer + webhook-tenant (cola integraciones)
--   - admin_importar_personas devuelve {insertados, actualizados, errores[]}
--   - admin_importar_cuentas / admin_importar_catalogos
--   - cola integracion_evento + HMAC (pgcrypto) + rotación de secret
--   - bucket storage importes
-- ============================================================

-- ---------- helper de autorización de importación ----------
create or replace function public.puede_importar(p_tenant uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  -- app.importacion_interna lo setea integracion_recibir (webhook HMAC ya verificado)
  select coalesce(current_setting('app.importacion_interna', true), '') = '1'
      or public.es_superadmin()
      or public.plataforma_puede_operar(p_tenant)
      or (public.rol_actual() = 'admin' and public.tenant_id_actual() = p_tenant);
$$;
revoke all on function public.puede_importar(uuid) from public;
grant execute on function public.puede_importar(uuid) to authenticated;

-- auditoría: 'import' es una acción válida; registro_id nunca nulo
alter table public.auditoria drop constraint if exists auditoria_accion_check;
alter table public.auditoria
  add constraint auditoria_accion_check
  check (accion in ('insert','update','delete','import'));

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
  values (
    p_tenant,
    p_tabla,
    coalesce(nullif(p_registro_id, ''), 'lote'),
    p_accion,
    auth.uid(),
    coalesce(p_cambios, '{}'::jsonb)
  );
end;
$$;

-- ---------- personas: upsert + reporte por fila ----------
drop function if exists public.admin_importar_personas(uuid, jsonb);

create or replace function public.admin_importar_personas(
  p_tenant_id uuid,
  p_personas jsonb
)
returns jsonb
language plpgsql security definer
set search_path = public
as $$
declare
  v_row         jsonb;
  v_idx         int := 0;
  v_insertados  int := 0;
  v_actualizados int := 0;
  v_errores     jsonb := '[]'::jsonb;
  v_nombre      text;
  v_documento   text;
  v_id          bigint;
  v_detalles    jsonb;
  v_asesor      uuid;
  v_muni        bigint;
begin
  if not public.puede_importar(p_tenant_id) then
    raise exception 'GC-AUTH-001: sin permisos para importar en este tenant';
  end if;
  if not exists (select 1 from public.tenant where id = p_tenant_id) then
    raise exception 'GC-CORE-001: tenant inexistente';
  end if;
  if p_personas is null or jsonb_typeof(p_personas) <> 'array' then
    raise exception 'GC-IMP-001: se espera un arreglo JSON de personas';
  end if;

  for v_row in select * from jsonb_array_elements(p_personas) loop
    v_idx := v_idx + 1;
    v_nombre := nullif(trim(v_row ->> 'nombre'), '');
    v_documento := nullif(trim(v_row ->> 'documento'), '');
    if v_nombre is null or v_documento is null then
      v_errores := v_errores || jsonb_build_array(jsonb_build_object(
        'fila', v_idx, 'codigo', 'GC-IMP-001',
        'mensaje', 'nombre y documento son obligatorios'));
      continue;
    end if;

    v_asesor := null;
    begin
      if nullif(v_row ->> 'asesor_id', '') is not null then
        v_asesor := (v_row ->> 'asesor_id')::uuid;
      end if;
    exception when others then
      v_errores := v_errores || jsonb_build_array(jsonb_build_object(
        'fila', v_idx, 'codigo', 'GC-IMP-004',
        'mensaje', 'asesor_id inválido'));
      continue;
    end;

    v_muni := null;
    begin
      if nullif(v_row ->> 'municipio_id', '') is not null then
        v_muni := (v_row ->> 'municipio_id')::bigint;
      end if;
    exception when others then
      v_errores := v_errores || jsonb_build_array(jsonb_build_object(
        'fila', v_idx, 'codigo', 'GC-IMP-005',
        'mensaje', 'municipio_id inválido'));
      continue;
    end;

    v_detalles := coalesce(v_row -> 'detalles', '{}'::jsonb);
    if nullif(v_row ->> 'telefono', '') is not null then
      v_detalles := v_detalles || jsonb_build_object('telefono', v_row ->> 'telefono');
    end if;

    select id into v_id
      from public.persona
     where tenant_id = p_tenant_id and documento = v_documento and activo
     limit 1;

    if v_id is not null then
      update public.persona set
        nombre = v_nombre,
        documento_tipo = coalesce(nullif(v_row ->> 'documento_tipo', ''), documento_tipo),
        direccion = coalesce(nullif(v_row ->> 'direccion', ''), direccion),
        municipio_id = coalesce(v_muni, municipio_id),
        asesor_id = coalesce(v_asesor, asesor_id),
        detalles = detalles || v_detalles,
        codigo_externo = coalesce(nullif(v_row ->> 'codigo_externo', ''), codigo_externo),
        categoria = coalesce(nullif(v_row ->> 'categoria', ''), categoria)
      where id = v_id;
      v_actualizados := v_actualizados + 1;
    else
      insert into public.persona (
        tenant_id, nombre, documento, documento_tipo, direccion,
        municipio_id, asesor_id, detalles, codigo_externo, categoria
      ) values (
        p_tenant_id, v_nombre, v_documento,
        coalesce(nullif(v_row ->> 'documento_tipo', ''), 'DNI'),
        nullif(v_row ->> 'direccion', ''),
        v_muni, v_asesor, v_detalles,
        nullif(v_row ->> 'codigo_externo', ''),
        nullif(v_row ->> 'categoria', '')
      );
      v_insertados := v_insertados + 1;
    end if;
    v_id := null;
  end loop;

  perform public.registrar_auditoria(p_tenant_id, 'persona', 'lote', 'import',
    jsonb_build_object('insertados', v_insertados, 'actualizados', v_actualizados,
                       'errores', jsonb_array_length(v_errores)));

  return jsonb_build_object(
    'insertados', v_insertados,
    'actualizados', v_actualizados,
    'errores', v_errores
  );
end;
$$;
revoke all on function public.admin_importar_personas(uuid, jsonb) from public;
grant execute on function public.admin_importar_personas(uuid, jsonb) to authenticated;

-- ---------- cuentas (módulo creditos) ----------
create or replace function public.admin_importar_cuentas(
  p_tenant_id uuid,
  p_cuentas jsonb
)
returns jsonb
language plpgsql security definer
set search_path = public
as $$
declare
  v_row          jsonb;
  v_idx          int := 0;
  v_insertados   int := 0;
  v_actualizados int := 0;
  v_errores      jsonb := '[]'::jsonb;
  v_documento    text;
  v_codigo       text;
  v_persona_id   bigint;
  v_cuenta_id    bigint;
  v_producto_id  bigint;
  v_monto        numeric;
  v_estado       text;
begin
  if not public.puede_importar(p_tenant_id) then
    raise exception 'GC-AUTH-001: sin permisos para importar en este tenant';
  end if;
  if not public.modulo_activo(p_tenant_id, 'creditos') then
    raise exception 'GC-IMP-020: el módulo creditos no está activo';
  end if;
  if p_cuentas is null or jsonb_typeof(p_cuentas) <> 'array' then
    raise exception 'GC-IMP-001: se espera un arreglo JSON de cuentas';
  end if;

  for v_row in select * from jsonb_array_elements(p_cuentas) loop
    v_idx := v_idx + 1;
    v_documento := nullif(trim(v_row ->> 'documento'), '');
    v_codigo := nullif(trim(v_row ->> 'codigo_externo'), '');
    if v_documento is null or v_codigo is null then
      v_errores := v_errores || jsonb_build_array(jsonb_build_object(
        'fila', v_idx, 'codigo', 'GC-IMP-022',
        'mensaje', 'documento y codigo_externo son obligatorios'));
      continue;
    end if;

    select id into v_persona_id
      from public.persona
     where tenant_id = p_tenant_id and documento = v_documento and activo
     limit 1;
    if v_persona_id is null then
      v_errores := v_errores || jsonb_build_array(jsonb_build_object(
        'fila', v_idx, 'codigo', 'GC-IMP-021',
        'mensaje', format('persona no encontrada (%s)', v_documento)));
      continue;
    end if;

    v_producto_id := null;
    if nullif(v_row ->> 'producto_codigo', '') is not null then
      select id into v_producto_id
        from public.producto
       where tenant_id = p_tenant_id and codigo = v_row ->> 'producto_codigo'
       limit 1;
    end if;

    begin
      v_monto := coalesce(nullif(v_row ->> 'monto', '')::numeric, 0);
    exception when others then
      v_errores := v_errores || jsonb_build_array(jsonb_build_object(
        'fila', v_idx, 'codigo', 'GC-IMP-023',
        'mensaje', 'monto inválido'));
      continue;
    end;

    v_estado := coalesce(nullif(v_row ->> 'estado', ''), 'activa');
    if v_estado not in ('activa','cancelada','mora') then
      v_errores := v_errores || jsonb_build_array(jsonb_build_object(
        'fila', v_idx, 'codigo', 'GC-IMP-024',
        'mensaje', 'estado de cuenta inválido'));
      continue;
    end if;

    select id into v_cuenta_id
      from public.cuenta
     where tenant_id = p_tenant_id and codigo_externo = v_codigo
     limit 1;

    if v_cuenta_id is not null then
      update public.cuenta set
        persona_id = v_persona_id,
        producto_id = coalesce(v_producto_id, producto_id),
        monto = v_monto,
        estado = v_estado,
        activo = true
      where id = v_cuenta_id;
      v_actualizados := v_actualizados + 1;
    else
      insert into public.cuenta (
        tenant_id, persona_id, producto_id, codigo_externo, monto, estado
      ) values (
        p_tenant_id, v_persona_id, v_producto_id, v_codigo, v_monto, v_estado
      )
      returning id into v_cuenta_id;
      v_insertados := v_insertados + 1;
    end if;

    if v_row ? 'capital_riesgo' or v_row ? 'dias_atraso' or v_row ? 'rango_mora' then
      insert into public.cuenta_saldo (cuenta_id, dias_atraso, rango_mora, capital_riesgo, corte_en)
      values (
        v_cuenta_id,
        coalesce(nullif(v_row ->> 'dias_atraso', '')::int, 0),
        nullif(v_row ->> 'rango_mora', ''),
        coalesce(nullif(v_row ->> 'capital_riesgo', '')::numeric, v_monto, 0),
        date_trunc('day', timezone('utc', now()))
      )
      on conflict (cuenta_id, corte_en) do update set
        dias_atraso = excluded.dias_atraso,
        rango_mora = excluded.rango_mora,
        capital_riesgo = excluded.capital_riesgo;
    end if;

    v_cuenta_id := null;
    v_persona_id := null;
  end loop;

  perform public.registrar_auditoria(p_tenant_id, 'cuenta', 'lote', 'import',
    jsonb_build_object('insertados', v_insertados, 'actualizados', v_actualizados,
                       'errores', jsonb_array_length(v_errores)));

  return jsonb_build_object(
    'insertados', v_insertados,
    'actualizados', v_actualizados,
    'errores', v_errores
  );
end;
$$;
revoke all on function public.admin_importar_cuentas(uuid, jsonb) from public;
grant execute on function public.admin_importar_cuentas(uuid, jsonb) to authenticated;

-- ---------- catálogos del tenant ----------
create or replace function public.admin_importar_catalogos(
  p_tenant_id uuid,
  p_filas jsonb
)
returns jsonb
language plpgsql security definer
set search_path = public
as $$
declare
  v_row          jsonb;
  v_idx          int := 0;
  v_insertados   int := 0;
  v_actualizados int := 0;
  v_errores      jsonb := '[]'::jsonb;
  v_tipo         text;
  v_nombre       text;
  v_codigo       text;
  v_id           bigint;
  v_act_id       bigint;
  v_cantidad     numeric;
begin
  if not public.puede_importar(p_tenant_id) then
    raise exception 'GC-AUTH-001: sin permisos para importar en este tenant';
  end if;
  if p_filas is null or jsonb_typeof(p_filas) <> 'array' then
    raise exception 'GC-IMP-001: se espera un arreglo JSON de catálogos';
  end if;

  for v_row in select * from jsonb_array_elements(p_filas) loop
    v_idx := v_idx + 1;
    v_tipo := lower(trim(coalesce(v_row ->> 'tipo', '')));
    v_nombre := nullif(trim(v_row ->> 'nombre'), '');
    v_codigo := nullif(trim(v_row ->> 'codigo'), '');

    if v_tipo = 'actividad' then
      if v_nombre is null then
        v_errores := v_errores || jsonb_build_array(jsonb_build_object(
          'fila', v_idx, 'codigo', 'GC-IMP-001', 'mensaje', 'actividad requiere nombre'));
        continue;
      end if;
      select id into v_id from public.actividad
       where tenant_id = p_tenant_id and nombre = v_nombre limit 1;
      if v_id is not null then
        update public.actividad set activo = coalesce((v_row ->> 'activo')::boolean, activo)
         where id = v_id;
        v_actualizados := v_actualizados + 1;
      else
        insert into public.actividad (tenant_id, nombre, activo)
        values (p_tenant_id, v_nombre, coalesce((v_row ->> 'activo')::boolean, true));
        v_insertados := v_insertados + 1;
      end if;

    elsif v_tipo = 'sub_actividad' then
      if v_nombre is null or nullif(trim(v_row ->> 'actividad'), '') is null then
        v_errores := v_errores || jsonb_build_array(jsonb_build_object(
          'fila', v_idx, 'codigo', 'GC-IMP-001',
          'mensaje', 'sub_actividad requiere nombre y actividad padre'));
        continue;
      end if;
      select id into v_act_id from public.actividad
       where tenant_id = p_tenant_id and nombre = trim(v_row ->> 'actividad') limit 1;
      if v_act_id is null then
        v_errores := v_errores || jsonb_build_array(jsonb_build_object(
          'fila', v_idx, 'codigo', 'GC-IMP-030',
          'mensaje', format('actividad padre no encontrada (%s)', v_row ->> 'actividad')));
        continue;
      end if;
      select id into v_id from public.sub_actividad
       where tenant_id = p_tenant_id and actividad_id = v_act_id and nombre = v_nombre limit 1;
      if v_id is not null then
        update public.sub_actividad set activo = coalesce((v_row ->> 'activo')::boolean, activo)
         where id = v_id;
        v_actualizados := v_actualizados + 1;
      else
        insert into public.sub_actividad (tenant_id, actividad_id, nombre, activo)
        values (p_tenant_id, v_act_id, v_nombre, coalesce((v_row ->> 'activo')::boolean, true));
        v_insertados := v_insertados + 1;
      end if;

    elsif v_tipo = 'zona' then
      if v_codigo is null or v_nombre is null then
        v_errores := v_errores || jsonb_build_array(jsonb_build_object(
          'fila', v_idx, 'codigo', 'GC-IMP-001', 'mensaje', 'zona requiere codigo y nombre'));
        continue;
      end if;
      select id into v_id from public.zona
       where tenant_id = p_tenant_id and codigo = v_codigo limit 1;
      if v_id is not null then
        update public.zona set nombre = v_nombre,
          activo = coalesce((v_row ->> 'activo')::boolean, activo)
         where id = v_id;
        v_actualizados := v_actualizados + 1;
      else
        insert into public.zona (tenant_id, codigo, nombre, activo)
        values (p_tenant_id, v_codigo, v_nombre, coalesce((v_row ->> 'activo')::boolean, true));
        v_insertados := v_insertados + 1;
      end if;

    elsif v_tipo in ('actividad_hora', 'hora') then
      if v_nombre is null then
        v_errores := v_errores || jsonb_build_array(jsonb_build_object(
          'fila', v_idx, 'codigo', 'GC-IMP-001', 'mensaje', 'actividad_hora requiere nombre'));
        continue;
      end if;
      begin
        v_cantidad := coalesce(nullif(v_row ->> 'cantidad', '')::numeric, 1);
      exception when others then
        v_errores := v_errores || jsonb_build_array(jsonb_build_object(
          'fila', v_idx, 'codigo', 'GC-IMP-031', 'mensaje', 'cantidad inválida'));
        continue;
      end;
      select id into v_id from public.actividad_hora
       where tenant_id = p_tenant_id and nombre = v_nombre limit 1;
      if v_id is not null then
        update public.actividad_hora set cantidad = v_cantidad,
          activo = coalesce((v_row ->> 'activo')::boolean, activo)
         where id = v_id;
        v_actualizados := v_actualizados + 1;
      else
        insert into public.actividad_hora (tenant_id, nombre, cantidad, activo)
        values (p_tenant_id, v_nombre, v_cantidad, coalesce((v_row ->> 'activo')::boolean, true));
        v_insertados := v_insertados + 1;
      end if;

    else
      v_errores := v_errores || jsonb_build_array(jsonb_build_object(
        'fila', v_idx, 'codigo', 'GC-IMP-032',
        'mensaje', format('tipo de catálogo no soportado (%s)', coalesce(v_tipo, ''))));
    end if;

    v_id := null;
    v_act_id := null;
  end loop;

  perform public.registrar_auditoria(p_tenant_id, 'catalogo', 'lote', 'import',
    jsonb_build_object('insertados', v_insertados, 'actualizados', v_actualizados,
                       'errores', jsonb_array_length(v_errores)));

  return jsonb_build_object(
    'insertados', v_insertados,
    'actualizados', v_actualizados,
    'errores', v_errores
  );
end;
$$;
revoke all on function public.admin_importar_catalogos(uuid, jsonb) from public;
grant execute on function public.admin_importar_catalogos(uuid, jsonb) to authenticated;

-- ---------- cola de integraciones ----------
create table public.integracion_evento (
  id               bigint generated always as identity primary key,
  tenant_id        uuid not null references public.tenant(id) on delete cascade,
  origen           text not null default 'webhook',
  tipo             text not null,
  payload          jsonb not null default '{}'::jsonb,
  firma_ok         boolean not null default false,
  estado           text not null default 'pendiente'
                     check (estado in ('pendiente','procesado','error')),
  idempotency_key  text,
  error            text,
  procesado_en     timestamptz,
  creado_en        timestamptz not null default now()
);
create index on public.integracion_evento (tenant_id, estado, creado_en desc);
create unique index integracion_evento_idempotencia
  on public.integracion_evento (tenant_id, idempotency_key)
  where idempotency_key is not null;

alter table public.integracion_evento enable row level security;
create policy integracion_evento_select on public.integracion_evento
  for select to authenticated
  using (
    tenant_id = public.tenant_id_actual()
    and public.rol_actual() = 'admin'
  );
grant select on public.integracion_evento to authenticated;

create or replace function public.admin_webhook_rotar_secret(p_tenant_id uuid)
returns text
language plpgsql security definer
set search_path = public
as $$
declare
  v_secret text;
begin
  if not (public.es_superadmin() or public.plataforma_puede_operar(p_tenant_id)) then
    raise exception 'GC-AUTH-001: requiere rol de plataforma';
  end if;
  if not exists (select 1 from public.tenant where id = p_tenant_id) then
    raise exception 'GC-CORE-001: tenant inexistente';
  end if;
  v_secret := encode(gen_random_bytes(32), 'hex');
  update public.tenant
     set configuracion = coalesce(configuracion, '{}'::jsonb)
                         || jsonb_build_object('webhook_secret', v_secret)
   where id = p_tenant_id;
  perform public.registrar_auditoria(p_tenant_id, 'tenant', p_tenant_id::text, 'update',
    jsonb_build_object('webhook_secret', 'rotado'));
  return v_secret;
end;
$$;
revoke all on function public.admin_webhook_rotar_secret(uuid) from public;
grant execute on function public.admin_webhook_rotar_secret(uuid) to authenticated;

-- Recibe un webhook: verifica HMAC con pgcrypto, encola y procesa tipos conocidos.
create or replace function public.integracion_recibir(
  p_tenant_id uuid,
  p_origen text,
  p_tipo text,
  p_payload jsonb,
  p_cuerpo text,
  p_firma text,
  p_idempotency_key text default null
)
returns jsonb
language plpgsql security definer
set search_path = public, extensions
as $$
declare
  v_secret   text;
  v_esperada text;
  v_firma    text;
  v_id       bigint;
  v_estado   text;
  v_firma_ok boolean := false;
  v_error    text;
  v_filas    jsonb;
  v_res      jsonb;
begin
  if p_tenant_id is null or p_tipo is null or p_cuerpo is null then
    raise exception 'GC-IMP-012: tenant, tipo y cuerpo son obligatorios';
  end if;
  if not exists (select 1 from public.tenant t where t.id = p_tenant_id and t.activo) then
    raise exception 'GC-CORE-001: tenant inexistente o inactivo';
  end if;

  select t.configuracion ->> 'webhook_secret' into v_secret
    from public.tenant t where t.id = p_tenant_id;
  if v_secret is null or v_secret = '' then
    raise exception 'GC-IMP-011: webhook no configurado para este tenant';
  end if;

  v_firma := lower(regexp_replace(coalesce(p_firma, ''), '^sha256=', '', 'i'));
  v_esperada := encode(hmac(convert_to(p_cuerpo, 'UTF8'), convert_to(v_secret, 'UTF8'), 'sha256'), 'hex');
  v_firma_ok := (v_firma = v_esperada);

  if p_idempotency_key is not null then
    select id, estado into v_id, v_estado
      from public.integracion_evento
     where tenant_id = p_tenant_id and idempotency_key = p_idempotency_key;
    if v_id is not null then
      return jsonb_build_object('id', v_id, 'estado', v_estado, 'idempotente', true, 'firma_ok', v_firma_ok);
    end if;
  end if;

  if not v_firma_ok then
    v_error := 'GC-IMP-010: firma HMAC inválida';
    insert into public.integracion_evento (
      tenant_id, origen, tipo, payload, firma_ok, estado, idempotency_key, error
    ) values (
      p_tenant_id, coalesce(p_origen, 'webhook'), p_tipo, coalesce(p_payload, '{}'::jsonb),
      false, 'error', p_idempotency_key, v_error
    ) returning id into v_id;
    return jsonb_build_object(
      'id', v_id, 'estado', 'error', 'firma_ok', false, 'error', v_error);
  end if;

  insert into public.integracion_evento (
    tenant_id, origen, tipo, payload, firma_ok, estado, idempotency_key
  ) values (
    p_tenant_id, coalesce(p_origen, 'webhook'), p_tipo, coalesce(p_payload, '{}'::jsonb),
    true, 'pendiente', p_idempotency_key
  ) returning id into v_id;

  perform set_config('app.importacion_interna', '1', true);

  -- Procesador mínimo: persona.upsert / cuenta.snapshot / catalogo.upsert
  begin
    v_filas := coalesce(p_payload -> 'filas', p_payload -> 'personas', p_payload -> 'cuentas');
    if jsonb_typeof(v_filas) is distinct from 'array' then
      if p_payload ? 'documento' or p_payload ? 'nombre' or p_payload ? 'codigo_externo' then
        v_filas := jsonb_build_array(p_payload);
      else
        v_filas := '[]'::jsonb;
      end if;
    end if;

    if p_tipo in ('persona.upsert', 'personas', 'persona') then
      v_res := public.admin_importar_personas(p_tenant_id, v_filas);
    elsif p_tipo in ('cuenta.snapshot', 'cuentas', 'cuenta') then
      v_res := public.admin_importar_cuentas(p_tenant_id, v_filas);
    elsif p_tipo in ('catalogo.upsert', 'catalogos', 'catalogo') then
      v_res := public.admin_importar_catalogos(p_tenant_id, v_filas);
    else
      -- tipos desconocidos quedan en cola (ERP custom = fuera de alcance)
      update public.integracion_evento
         set estado = 'pendiente',
             error = 'GC-IMP-040: tipo no procesado automáticamente'
       where id = v_id;
      return jsonb_build_object('id', v_id, 'estado', 'pendiente', 'firma_ok', true);
    end if;

    update public.integracion_evento
       set estado = 'procesado', procesado_en = now(), error = null
     where id = v_id;
    return jsonb_build_object('id', v_id, 'estado', 'procesado', 'firma_ok', true, 'resultado', v_res);
  exception when others then
    update public.integracion_evento
       set estado = 'error', error = sqlerrm, procesado_en = now()
     where id = v_id;
    return jsonb_build_object('id', v_id, 'estado', 'error', 'firma_ok', true, 'error', sqlerrm);
  end;
end;
$$;
revoke all on function public.integracion_recibir(uuid, text, text, jsonb, text, text, text) from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    execute 'grant execute on function public.integracion_recibir(uuid, text, text, jsonb, text, text, text) to service_role';
  end if;
end $$;

-- ---------- storage: bucket importes ----------
do $$
begin
  insert into storage.buckets (id, name, public)
  values ('importes', 'importes', false)
  on conflict (id) do nothing;

  execute $pol$
    create policy importes_select on storage.objects
      for select to authenticated
      using (
        bucket_id = 'importes'
        and (storage.foldername(name))[1] = coalesce(auth.jwt() ->> 'tenant_id', '')
      )
  $pol$;
  execute $pol$
    create policy importes_insert on storage.objects
      for insert to authenticated
      with check (
        bucket_id = 'importes'
        and (storage.foldername(name))[1] = coalesce(auth.jwt() ->> 'tenant_id', '')
      )
  $pol$;
exception
  when others then
    raise notice 'storage importes: omitido (%). Continúa la migración.', sqlerrm;
end $$;

notify pgrst, 'reload schema';
