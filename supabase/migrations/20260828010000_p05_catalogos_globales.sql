-- ============================================================
-- P-05 — Catálogos globales de plataforma
-- Geografía (departamento/municipio), catálogo de módulos y
-- plantillas base por rubro. Escritura SOLO vía RPC admin_*
-- (ADR-005); lectura de geografía/módulos sigue abierta a
-- authenticated. admin_tenant_crear copia las plantillas del rubro.
-- ============================================================

-- ---------- plantillas base (sin tenant) ----------
create table public.catalogo_plantilla (
  id          bigint generated always as identity primary key,
  rubro       text not null,
  tipo        text not null check (tipo in ('actividad', 'formulario', 'hora')),
  nombre      text not null,
  payload     jsonb not null default '{}'::jsonb,
  activo      boolean not null default true,
  creado_en   timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  unique (rubro, tipo, nombre)
);

create trigger trg_catalogo_plantilla_actualizado
  before update on public.catalogo_plantilla
  for each row execute function public.set_actualizado_en();

alter table public.catalogo_plantilla enable row level security;

create policy catalogo_plantilla_select on public.catalogo_plantilla
  for select to authenticated
  using (public.es_usuario_plataforma());

grant select on public.catalogo_plantilla to authenticated;

-- ---------- seed de plantillas (idempotente) ----------
insert into public.catalogo_plantilla (rubro, tipo, nombre, payload) values
  -- agro
  ('agro', 'actividad', 'Verificación de garantías',
    '{"sub_actividades":["Inspección prendaria","Verificación de activos","Revisión de documentos"]}'::jsonb),
  ('agro', 'actividad', 'Seguimiento de crédito',
    '{"sub_actividades":["Revisión de estado de cuenta","Renegociación de cuota","Verificación de uso de fondos"]}'::jsonb),
  ('agro', 'actividad', 'Prospección de cliente',
    '{"sub_actividades":["Levantamiento de ficha","Presentación de producto"]}'::jsonb),
  ('agro', 'actividad', 'Recuperación de cartera',
    '{"sub_actividades":["Aviso de mora","Acuerdo de pago","Recuperación judicial"]}'::jsonb),
  ('agro', 'actividad', 'Inspección de cultivo',
    '{"sub_actividades":["Medición de hectáreas","Estado fenológico"]}'::jsonb),
  ('agro', 'hora', '30 minutos', '{"cantidad":0.5}'::jsonb),
  ('agro', 'hora', '1 hora', '{"cantidad":1}'::jsonb),
  ('agro', 'hora', '2 horas', '{"cantidad":2}'::jsonb),
  ('agro', 'hora', '4 horas', '{"cantidad":4}'::jsonb),
  ('agro', 'hora', 'Jornada completa', '{"cantidad":8}'::jsonb),
  ('agro', 'formulario', 'Ficha de cultivo',
    '{"descripcion":"Levantamiento en campo del estado del cultivo financiado","calculo":"porcentaje_completado","esquema":{"campos":[{"clave":"cultivo","etiqueta":"Cultivo","tipo":"texto","requerido":true},{"clave":"hectareas","etiqueta":"Hectáreas sembradas","tipo":"numero","requerido":true,"min":0.1,"max":10000},{"clave":"estado_fenologico","etiqueta":"Estado fenológico","tipo":"seleccion","requerido":true,"opciones":["Germinación","Crecimiento","Floración","Llenado de grano","Madurez","Cosecha"]},{"clave":"observaciones","etiqueta":"Observaciones","tipo":"texto","requerido":false}]}}'::jsonb),
  ('agro', 'formulario', 'Verificación de garantías',
    '{"descripcion":"Inspección prendaria de activos del crédito","calculo":"porcentaje_completado","esquema":{"campos":[{"clave":"tipo_garantia","etiqueta":"Tipo de garantía","tipo":"seleccion","requerido":true,"opciones":["Maquinaria agrícola","Vehículo","Inventario","Inmueble","Prenda ganadera"]},{"clave":"estado_conservacion","etiqueta":"Estado de conservación","tipo":"seleccion","requerido":true,"opciones":["Excelente","Bueno","Regular","Deteriorado"]},{"clave":"valor_estimado","etiqueta":"Valor estimado (Q)","tipo":"numero","requerido":true,"min":0,"max":10000000},{"clave":"observaciones","etiqueta":"Observaciones","tipo":"texto","requerido":false}]}}'::jsonb),
  -- distribuidora (ex consumo)
  ('distribuidora', 'actividad', 'Toma de pedido',
    '{"sub_actividades":["Pedido programado","Pedido de temporada"]}'::jsonb),
  ('distribuidora', 'actividad', 'Cobro de factura',
    '{"sub_actividades":["Cobro a 30 días","Cobro contado"]}'::jsonb),
  ('distribuidora', 'actividad', 'Merchandising',
    '{"sub_actividades":["Montaje de exhibidor","Rotación de inventario"]}'::jsonb),
  ('distribuidora', 'actividad', 'Apertura de punto de venta',
    '{"sub_actividades":["Firma de contrato","Entrega de mobiliario"]}'::jsonb),
  ('distribuidora', 'hora', '30 minutos', '{"cantidad":0.5}'::jsonb),
  ('distribuidora', 'hora', '1 hora', '{"cantidad":1}'::jsonb),
  ('distribuidora', 'hora', '2 horas', '{"cantidad":2}'::jsonb),
  ('distribuidora', 'hora', '4 horas', '{"cantidad":4}'::jsonb),
  ('distribuidora', 'formulario', 'Auditoría de punto de venta',
    '{"descripcion":"Revisión de exhibición y rotación de producto","calculo":"porcentaje_completado","esquema":{"campos":[{"clave":"categoria_tienda","etiqueta":"Categoría de tienda","tipo":"seleccion","requerido":true,"opciones":["Tienda de barrio","Mini mercado","Distribuidora","Farmacia","Otro"]},{"clave":"exhibidores","etiqueta":"Exhibidores presentes","tipo":"numero","requerido":true,"min":0,"max":50},{"clave":"cumple_planograma","etiqueta":"Cumple planograma","tipo":"seleccion","requerido":true,"opciones":["Sí","No","Parcial"]},{"clave":"observaciones","etiqueta":"Observaciones","tipo":"texto","requerido":false}]}}'::jsonb),
  -- farmaceutica
  ('farmaceutica', 'actividad', 'Visita médica',
    '{"sub_actividades":["Presentación de producto","Actualización de Guía Clínica"]}'::jsonb),
  ('farmaceutica', 'actividad', 'Entrega de muestra',
    '{"sub_actividades":["Muestra médica","Material informativo"]}'::jsonb),
  ('farmaceutica', 'actividad', 'Cierre de venta',
    '{"sub_actividades":["Pedido de farmacia","Consignación"]}'::jsonb),
  ('farmaceutica', 'hora', '30 minutos', '{"cantidad":0.5}'::jsonb),
  ('farmaceutica', 'hora', '1 hora', '{"cantidad":1}'::jsonb),
  ('farmaceutica', 'hora', '2 horas', '{"cantidad":2}'::jsonb),
  ('farmaceutica', 'formulario', 'Detalle de visita médica',
    '{"descripcion":"Registro de interacción con profesional de salud","calculo":"porcentaje_completado","esquema":{"campos":[{"clave":"profesional","etiqueta":"Profesional visitado","tipo":"texto","requerido":true},{"clave":"especialidad","etiqueta":"Especialidad","tipo":"texto","requerido":false},{"clave":"productos_presentados","etiqueta":"Productos presentados","tipo":"texto","requerido":true},{"clave":"nivel_interes","etiqueta":"Nivel de interés","tipo":"seleccion","requerido":true,"opciones":["Alto","Medio","Bajo","Ninguno"]},{"clave":"observaciones","etiqueta":"Observaciones","tipo":"texto","requerido":false}]}}'::jsonb),
  -- genérico (fallback)
  ('generico', 'actividad', 'Visita comercial',
    '{"sub_actividades":["Seguimiento"]}'::jsonb),
  ('generico', 'hora', '30 minutos', '{"cantidad":0.5}'::jsonb),
  ('generico', 'hora', '1 hora', '{"cantidad":1}'::jsonb),
  ('generico', 'hora', '2 horas', '{"cantidad":2}'::jsonb)
on conflict (rubro, tipo, nombre) do nothing;

-- ---------- helpers ----------
create or replace function public.requiere_plataforma()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.es_superadmin() then
    return;
  end if;
  if public.es_usuario_plataforma()
     and exists (
       select 1 from public.usuario_plataforma_tenant upt
       where upt.usuario_plataforma_id = auth.uid()
         and upt.rol in ('owner', 'soporte')
     ) then
    return;
  end if;
  raise exception 'GC-AUTH-001: requiere rol de plataforma';
end;
$$;

create or replace function public.normalizar_rubro(p_rubro text)
returns text
language sql
immutable
as $$
  select case lower(trim(p_rubro))
    when 'agromoney' then 'agro'
    when 'consumo' then 'distribuidora'
    when 'farmacia' then 'farmaceutica'
    else lower(trim(p_rubro))
  end;
$$;

create or replace function public.validar_payload_plantilla(p_tipo text, p_payload jsonb)
returns void
language plpgsql
immutable
as $$
begin
  if p_tipo not in ('actividad', 'formulario', 'hora') then
    raise exception 'GC-CAT-001: tipo de plantilla inválido';
  end if;
  if p_tipo = 'actividad' and p_payload ? 'sub_actividades'
     and jsonb_typeof(p_payload -> 'sub_actividades') <> 'array' then
    raise exception 'GC-CAT-001: sub_actividades debe ser una lista de textos';
  end if;
  if p_tipo = 'hora' then
    if coalesce((p_payload ->> 'cantidad')::numeric, 0) <= 0 then
      raise exception 'GC-CAT-001: cantidad debe ser un número mayor a 0';
    end if;
  end if;
  if p_tipo = 'formulario' then
    if jsonb_typeof(coalesce(p_payload -> 'esquema' -> 'campos', 'null'::jsonb)) <> 'array' then
      raise exception 'GC-CAT-001: el formulario requiere esquema.campos';
    end if;
  end if;
end;
$$;

-- Copia plantillas del rubro al tenant. Fallback a 'generico' si no hay actividades.
create or replace function public.aplicar_plantillas_rubro(p_tenant uuid, p_rubro text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rubro text := public.normalizar_rubro(p_rubro);
  r public.catalogo_plantilla%rowtype;
  v_act bigint;
  v_sub text;
  v_tiene_act boolean;
begin
  perform public.requiere_plataforma();
  for r in
    select * from public.catalogo_plantilla
    where rubro = v_rubro and activo
    order by tipo, id
  loop
    if r.tipo = 'actividad' then
      insert into public.actividad (tenant_id, nombre)
      values (p_tenant, r.nombre)
      on conflict (tenant_id, nombre) do update set activo = true
      returning id into v_act;
      if v_act is null then
        select id into v_act from public.actividad
        where tenant_id = p_tenant and nombre = r.nombre;
      end if;
      for v_sub in
        select jsonb_array_elements_text(coalesce(r.payload -> 'sub_actividades', '[]'::jsonb))
      loop
        if length(trim(v_sub)) = 0 then continue; end if;
        insert into public.sub_actividad (tenant_id, actividad_id, nombre)
        values (p_tenant, v_act, trim(v_sub))
        on conflict (tenant_id, actividad_id, nombre) do nothing;
      end loop;
    elsif r.tipo = 'hora' then
      if not exists (
        select 1 from public.actividad_hora h
        where h.tenant_id = p_tenant and h.nombre = r.nombre
      ) then
        insert into public.actividad_hora (tenant_id, nombre, cantidad)
        values (p_tenant, r.nombre, (r.payload ->> 'cantidad')::numeric);
      end if;
    elsif r.tipo = 'formulario' then
      insert into public.formulario_plantilla (tenant_id, nombre, descripcion, esquema, calculo)
      values (
        p_tenant,
        r.nombre,
        r.payload ->> 'descripcion',
        coalesce(r.payload -> 'esquema', '{"campos":[]}'::jsonb),
        r.payload ->> 'calculo'
      )
      on conflict (tenant_id, nombre) do nothing;
    end if;
  end loop;

  select exists (select 1 from public.actividad where tenant_id = p_tenant) into v_tiene_act;
  if not v_tiene_act and v_rubro <> 'generico' then
    perform public.aplicar_plantillas_rubro(p_tenant, 'generico');
    return;
  end if;

  if not exists (select 1 from public.actividad where tenant_id = p_tenant) then
    insert into public.actividad (tenant_id, nombre)
    values (p_tenant, 'Visita comercial')
    returning id into v_act;
    insert into public.sub_actividad (tenant_id, actividad_id, nombre)
    values (p_tenant, v_act, 'Seguimiento');
  end if;

  if not exists (select 1 from public.actividad_hora where tenant_id = p_tenant) then
    insert into public.actividad_hora (tenant_id, nombre, cantidad) values
      (p_tenant, '30 minutos', 0.5),
      (p_tenant, '1 hora', 1.0),
      (p_tenant, '2 horas', 2.0);
  end if;

  if to_regclass('public.config_rastreo') is not null
     and not exists (select 1 from public.config_rastreo where tenant_id = p_tenant) then
    insert into public.config_rastreo (tenant_id, dia_semana, hora_inicio, hora_fin, intervalo_min, precision_max_m)
    select p_tenant, d, '07:00', '18:00', 15, 100
    from generate_series(1, 6) as d;
  end if;
end;
$$;

-- ---------- RPCs de geografía ----------
create or replace function public.admin_departamento_guardar(p_id bigint, p_nombre text)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id bigint;
  v_nombre text := trim(p_nombre);
begin
  perform public.requiere_plataforma();
  if v_nombre is null or length(v_nombre) = 0 then
    raise exception 'GC-CAT-001: el nombre del departamento es obligatorio';
  end if;
  if p_id is null then
    insert into public.departamento (nombre) values (v_nombre)
    returning id into v_id;
    perform public.registrar_auditoria(null, 'departamento', v_id::text, 'insert',
      jsonb_build_object('nombre', v_nombre));
  else
    update public.departamento set nombre = v_nombre where id = p_id
    returning id into v_id;
    if v_id is null then
      raise exception 'GC-CAT-003: departamento inexistente';
    end if;
    perform public.registrar_auditoria(null, 'departamento', v_id::text, 'update',
      jsonb_build_object('nombre', v_nombre));
  end if;
  return v_id;
exception
  when unique_violation then
    raise exception 'GC-CAT-002: ya existe un departamento con ese nombre';
end;
$$;

create or replace function public.admin_municipio_guardar(
  p_id bigint, p_departamento_id bigint, p_nombre text
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id bigint;
  v_nombre text := trim(p_nombre);
begin
  perform public.requiere_plataforma();
  if v_nombre is null or length(v_nombre) = 0 then
    raise exception 'GC-CAT-001: el nombre del municipio es obligatorio';
  end if;
  if p_departamento_id is null or not exists (
    select 1 from public.departamento d where d.id = p_departamento_id
  ) then
    raise exception 'GC-CAT-003: departamento inexistente';
  end if;
  if p_id is null then
    insert into public.municipio (departamento_id, nombre)
    values (p_departamento_id, v_nombre)
    returning id into v_id;
    perform public.registrar_auditoria(null, 'municipio', v_id::text, 'insert',
      jsonb_build_object('departamento_id', p_departamento_id, 'nombre', v_nombre));
  else
    update public.municipio
    set departamento_id = p_departamento_id, nombre = v_nombre
    where id = p_id
    returning id into v_id;
    if v_id is null then
      raise exception 'GC-CAT-003: municipio inexistente';
    end if;
    perform public.registrar_auditoria(null, 'municipio', v_id::text, 'update',
      jsonb_build_object('departamento_id', p_departamento_id, 'nombre', v_nombre));
  end if;
  return v_id;
exception
  when unique_violation then
    raise exception 'GC-CAT-002: ya existe ese municipio en el departamento';
end;
$$;

create or replace function public.admin_geografia_importar(p_filas jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row jsonb;
  v_dep text;
  v_mun text;
  v_dep_id bigint;
  v_deps int := 0;
  v_muns int := 0;
  v_ins int;
begin
  perform public.requiere_plataforma();
  if p_filas is null or jsonb_typeof(p_filas) <> 'array' then
    raise exception 'GC-CAT-001: se espera un arreglo de {departamento, municipio}';
  end if;
  for v_row in select * from jsonb_array_elements(p_filas)
  loop
    v_dep := trim(v_row ->> 'departamento');
    v_mun := trim(v_row ->> 'municipio');
    if v_dep is null or v_dep = '' or v_mun is null or v_mun = '' then
      raise exception 'GC-CAT-001: cada fila requiere departamento y municipio';
    end if;

    select d.id into v_dep_id from public.departamento d where d.nombre = v_dep;
    if v_dep_id is null then
      insert into public.departamento (nombre) values (v_dep)
      returning id into v_dep_id;
      v_deps := v_deps + 1;
    end if;

    insert into public.municipio (departamento_id, nombre)
    values (v_dep_id, v_mun)
    on conflict (departamento_id, nombre) do nothing;
    get diagnostics v_ins = row_count;
    v_muns := v_muns + v_ins;
  end loop;

  perform public.registrar_auditoria(null, 'municipio', 'import', 'insert',
    jsonb_build_object('filas', jsonb_array_length(p_filas), 'departamentos', v_deps, 'municipios', v_muns));
  return jsonb_build_object('filas', jsonb_array_length(p_filas), 'departamentos', v_deps, 'municipios', v_muns);
end;
$$;

-- ---------- catálogo de módulos ----------
create or replace function public.admin_modulo_catalogo_guardar(
  p_codigo text, p_nombre text, p_nucleo boolean default false
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id bigint;
  v_codigo text := lower(trim(p_codigo));
  v_nombre text := trim(p_nombre);
  v_nucleo boolean := coalesce(p_nucleo, false);
  v_existia boolean;
begin
  perform public.requiere_plataforma();
  if v_codigo is null or v_codigo = '' or v_nombre is null or v_nombre = '' then
    raise exception 'GC-CAT-001: código y nombre del módulo son obligatorios';
  end if;
  if v_codigo !~ '^[a-z][a-z0-9_]*$' then
    raise exception 'GC-CAT-001: código de módulo inválido';
  end if;
  if v_codigo = 'core' then
    v_nucleo := true;
  end if;

  select exists(select 1 from public.modulo m where m.codigo = v_codigo) into v_existia;

  insert into public.modulo (codigo, nombre, nucleo)
  values (v_codigo, v_nombre, v_nucleo)
  on conflict (codigo) do update
    set nombre = excluded.nombre,
        nucleo = case when excluded.codigo = 'core' then true else excluded.nucleo end
  returning id into v_id;

  perform public.registrar_auditoria(null, 'modulo', v_codigo, case when v_existia then 'update' else 'insert' end,
    jsonb_build_object('nombre', v_nombre, 'nucleo', v_nucleo));
  return v_id;
end;
$$;

-- ---------- plantillas ----------
create or replace function public.admin_plantilla_guardar(
  p_id bigint,
  p_rubro text,
  p_tipo text,
  p_nombre text,
  p_payload jsonb default '{}'::jsonb,
  p_activo boolean default true
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id bigint;
  v_rubro text := public.normalizar_rubro(p_rubro);
  v_nombre text := trim(p_nombre);
  v_payload jsonb := coalesce(p_payload, '{}'::jsonb);
begin
  perform public.requiere_plataforma();
  if v_rubro is null or v_rubro = '' then
    raise exception 'GC-CAT-001: el rubro es obligatorio';
  end if;
  if v_nombre is null or v_nombre = '' then
    raise exception 'GC-CAT-001: el nombre de la plantilla es obligatorio';
  end if;
  perform public.validar_payload_plantilla(p_tipo, v_payload);

  if p_id is null then
    insert into public.catalogo_plantilla (rubro, tipo, nombre, payload, activo)
    values (v_rubro, p_tipo, v_nombre, v_payload, coalesce(p_activo, true))
    returning id into v_id;
    perform public.registrar_auditoria(null, 'catalogo_plantilla', v_id::text, 'insert',
      jsonb_build_object('rubro', v_rubro, 'tipo', p_tipo, 'nombre', v_nombre));
  else
    update public.catalogo_plantilla
    set rubro = v_rubro,
        tipo = p_tipo,
        nombre = v_nombre,
        payload = v_payload,
        activo = coalesce(p_activo, activo)
    where id = p_id
    returning id into v_id;
    if v_id is null then
      raise exception 'GC-CAT-003: plantilla inexistente';
    end if;
    perform public.registrar_auditoria(null, 'catalogo_plantilla', v_id::text, 'update',
      jsonb_build_object('rubro', v_rubro, 'tipo', p_tipo, 'nombre', v_nombre, 'activo', p_activo));
  end if;
  return v_id;
exception
  when unique_violation then
    raise exception 'GC-CAT-002: ya existe una plantilla con ese rubro, tipo y nombre';
end;
$$;

-- ---------- admin_tenant_crear aplica plantillas del rubro ----------
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

revoke all on function public.requiere_plataforma() from public;
revoke all on function public.aplicar_plantillas_rubro(uuid, text) from public;
revoke all on function public.admin_departamento_guardar(bigint, text) from public;
revoke all on function public.admin_municipio_guardar(bigint, bigint, text) from public;
revoke all on function public.admin_geografia_importar(jsonb) from public;
revoke all on function public.admin_modulo_catalogo_guardar(text, text, boolean) from public;
revoke all on function public.admin_plantilla_guardar(bigint, text, text, text, jsonb, boolean) from public;

grant execute on function public.normalizar_rubro(text) to authenticated;
grant execute on function public.admin_departamento_guardar(bigint, text) to authenticated;
grant execute on function public.admin_municipio_guardar(bigint, bigint, text) to authenticated;
grant execute on function public.admin_geografia_importar(jsonb) to authenticated;
grant execute on function public.admin_modulo_catalogo_guardar(text, text, boolean) to authenticated;
grant execute on function public.admin_plantilla_guardar(bigint, text, text, text, jsonb, boolean) to authenticated;
grant execute on function public.admin_tenant_crear(text,text,text,jsonb,jsonb,text[]) to authenticated;
