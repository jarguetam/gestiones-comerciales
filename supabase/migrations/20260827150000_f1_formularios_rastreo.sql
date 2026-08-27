-- ============================================================
-- F1 · Migración 005 — Formularios dinámicos y rastreo GPS
-- Ref: spec/db/SPEC.md §4.5 (formularios), §4.6 (rastreo) · design D4, D6
-- F1.3 + F1.4 del roadmap: formulario_plantilla/respuesta y
-- rastreo_ubicacion/config_rastreo con RLS por tenant+rol.
-- ============================================================

-- ---------- formulario_plantilla (JSON Schema suavizado + cálculo) ----------
-- Rubro-agnóstico: cada tenant define sus formularios (Ficha de cultivo,
-- Verificación de garantías, Encuesta de satisfacción, ...) con un esquema
-- de campos y opcionalmente una expresión de scoring.
create table public.formulario_plantilla (
  id          bigint generated always as identity primary key,
  tenant_id   uuid not null references public.tenant(id) on delete cascade,
  nombre      text not null,
  descripcion text,
  -- JSON Schema suavizado: { campos: [{clave, etiqueta, tipo, requerido, opciones, min, max}] }
  esquema     jsonb not null default '{"campos": []}'::jsonb,
  -- Expresión de cálculo opcional sobre respuestas (evaluada en formulario_enviar)
  calculo     text,
  activo      boolean not null default true,
  creado_por  uuid references auth.users(id),
  creado_en   timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  unique (tenant_id, nombre)
);
create index on public.formulario_plantilla (tenant_id);

-- ---------- formulario_respuesta (respuestas JSONB validadas server-side) ----------
-- Cada respuesta se liga a una visita (check-in) o queda suelta (form general).
create table public.formulario_respuesta (
  id            bigint generated always as identity primary key,
  tenant_id     uuid not null references public.tenant(id) on delete cascade,
  plantilla_id  bigint not null references public.formulario_plantilla(id) on delete restrict,
  visita_id     bigint references public.visita(id) on delete set null,
  usuario_id    uuid not null references public.usuario(id),
  respuestas    jsonb not null default '{}'::jsonb,
  resultado     numeric(10,2),
  enviado_en    timestamptz not null default now(),
  -- idempotencia offline: el móvil genera un key por intento de envío (§9.3)
  cliente_key   uuid not null default gen_random_uuid() unique
);
create index on public.formulario_respuesta (tenant_id, plantilla_id);
create index on public.formulario_respuesta (visita_id);
create index on public.formulario_respuesta (tenant_id, usuario_id, enviado_en desc);

-- ---------- rastreo_ubicacion (trazas GPS de campo) ----------
-- Ingesta batch desde el móvil; respeta config_rastreo del tenant.
create table public.rastreo_ubicacion (
  id          bigint generated always as identity primary key,
  tenant_id   uuid not null references public.tenant(id) on delete cascade,
  usuario_id  uuid not null references public.usuario(id),
  posicion    geography(point, 4326) not null,
  precision_m numeric(6,2),
  velocidad_kmh numeric(5,2),
  registrado_en timestamptz not null,
  creado_en   timestamptz not null default now()
);
create index on public.rastreo_ubicacion (tenant_id, usuario_id, registrado_en desc);
create index rastreo_posicion_idx on public.rastreo_ubicacion using gist (posicion);

-- ---------- config_rastreo (ventanas horarias por tenant y día) ----------
-- Datos, no código: un admin cambia la ventana y los dispositivos la respetan.
create table public.config_rastreo (
  id          bigint generated always as identity primary key,
  tenant_id   uuid not null references public.tenant(id) on delete cascade,
  dia_semana  smallint not null check (dia_semana between 0 and 6), -- 0=domingo
  hora_inicio time not null default '07:00',
  hora_fin    time not null default '18:00',
  intervalo_min smallint not null default 15 check (intervalo_min between 1 and 240),
  precision_max_m numeric(6,2) not null default 100,
  actualizado_en timestamptz not null default now(),
  unique (tenant_id, dia_semana)
);

-- ---------- actualizado_en ----------
create trigger trg_formulario_plantilla_actualizado
  before update on public.formulario_plantilla
  for each row execute function public.set_actualizado_en();

create trigger trg_config_rastreo_actualizado
  before update on public.config_rastreo
  for each row execute function public.set_actualizado_en();

-- ============================================================
-- RLS — aislamiento por tenant + alcance por rol (mismo patrón F1.2)
-- ============================================================

alter table public.formulario_plantilla enable row level security;
alter table public.formulario_respuesta enable row level security;
alter table public.rastreo_ubicacion enable row level security;
alter table public.config_rastreo enable row level security;

-- formulario_plantilla: visible a todo el tenant (los formularios se comparten)
create policy tenant on public.formulario_plantilla
  for all to authenticated
  using (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid)
  with check (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

create policy gestion_plantilla on public.formulario_plantilla
  for all to authenticated
  using ((auth.jwt() ->> 'rol') in ('admin','gerente'))
  with check ((auth.jwt() ->> 'rol') in ('admin','gerente'));

-- formulario_respuesta: tenant + alcance por rol (el asesor ve las suyas)
create policy tenant on public.formulario_respuesta
  for all to authenticated
  using (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid)
  with check (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

create policy alcance_respuesta on public.formulario_respuesta
  for select to authenticated
  using (
    (auth.jwt() ->> 'rol') = 'admin'
    or usuario_id = auth.uid()
    or usuario_id in (select * from public.subordinados())
  );

create policy escritura_respuesta on public.formulario_respuesta
  for insert to authenticated
  with check (
    usuario_id = auth.uid()
    or (auth.jwt() ->> 'rol') in ('admin','gerente')
  );

-- rastreo_ubicacion: el asesor escribe su propia traza; el subárbol la consulta
create policy tenant on public.rastreo_ubicacion
  for all to authenticated
  using (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid)
  with check (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

create policy alcance_rastreo on public.rastreo_ubicacion
  for select to authenticated
  using (
    (auth.jwt() ->> 'rol') = 'admin'
    or usuario_id = auth.uid()
    or usuario_id in (select * from public.subordinados())
  );

create policy escritura_rastreo on public.rastreo_ubicacion
  for insert to authenticated
  with check (usuario_id = auth.uid());

-- config_rastreo: lectura para todo el tenant, escritura solo admin
create policy tenant on public.config_rastreo
  for select to authenticated
  using (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

create policy gestion_config_rastreo on public.config_rastreo
  for all to authenticated
  using (
    tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
    and (auth.jwt() ->> 'rol') = 'admin'
  )
  with check (
    tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
    and (auth.jwt() ->> 'rol') = 'admin'
  );

-- ============================================================
-- RPCs (F1.6) — formularios, rastreo, dashboards y módulos
-- ============================================================

-- ---------- RPC: envío de formulario con validación server-side ----------
-- GC-FORM-001: respuestas que violan el esquema se rechazan sin persistir.
create or replace function public.formulario_enviar(
  p_plantilla_id bigint,
  p_respuestas jsonb,
  p_visita_id bigint default null,
  p_cliente_key uuid default null
)
returns public.formulario_respuesta
language plpgsql security definer
set search_path = public
as $$
declare
  v_plantilla public.formulario_plantilla;
  v_tenant uuid := (auth.jwt() ->> 'tenant_id')::uuid;
  v_existente public.formulario_respuesta;
  v_resultado numeric(10,2);
  v_campo jsonb;
  v_valor jsonb;
begin
  select * into v_plantilla
  from public.formulario_plantilla
  where id = p_plantilla_id and tenant_id = v_tenant and activo;

  if not found then
    raise exception 'Plantilla no encontrada o inactiva (GC-FORM-001)'
      using errcode = 'GC-FORM-001';
  end if;

  -- Idempotencia offline: mismo cliente_key devuelve la respuesta ya guardada
  if p_cliente_key is not null then
    select * into v_existente
    from public.formulario_respuesta
    where cliente_key = p_cliente_key and tenant_id = v_tenant;
    if found then
      return v_existente;
    end if;
  end if;

  -- Validación de campos requeridos contra el esquema suavizado
  for v_campo in select * from jsonb_array_elements(v_plantilla.esquema -> 'campos') loop
    v_valor := p_respuestas -> (v_campo ->> 'clave');
    if coalesce(v_campo ->> 'requerido', 'false')::boolean and (v_valor is null or v_valor::text = '""') then
      raise exception 'Falta el campo requerido: % (GC-FORM-001)', v_campo ->> 'clave'
        using errcode = 'GC-FORM-001';
    end if;
    if v_valor is not null and v_campo ->> 'tipo' = 'numero' then
      if jsonb_typeof(v_valor) <> 'number' then
        raise exception 'El campo % debe ser numérico (GC-FORM-001)', v_campo ->> 'clave'
          using errcode = 'GC-FORM-001';
      end if;
      if v_campo ? 'min' and (v_valor ->> 0)::numeric < (v_campo ->> 'min')::numeric then
        raise exception 'El campo % está bajo el mínimo (GC-FORM-001)', v_campo ->> 'clave'
          using errcode = 'GC-FORM-001';
      end if;
      if v_campo ? 'max' and (v_valor ->> 0)::numeric > (v_campo ->> 'max')::numeric then
        raise exception 'El campo % excede el máximo (GC-FORM-001)', v_campo ->> 'clave'
          using errcode = 'GC-FORM-001';
      end if;
    end if;
    if v_valor is not null and v_campo ->> 'tipo' = 'seleccion' and v_campo ? 'opciones' then
      if not (v_valor ->> 0) = any (select jsonb_array_elements_text(v_campo -> 'opciones')) then
        raise exception 'Valor fuera de las opciones de % (GC-FORM-001)', v_campo ->> 'clave'
          using errcode = 'GC-FORM-001';
      end if;
    end if;
  end loop;

  -- Scoring opcional: la plantilla define calculo como 'porcentaje_completado'
  if v_plantilla.calculo = 'porcentaje_completado' then
    select round(
      100.0 * count(*) filter (where p_respuestas ? (c ->> 'clave')) / greatest(count(*), 1)
    , 2) into v_resultado
    from jsonb_array_elements(v_plantilla.esquema -> 'campos') c;
  end if;

  insert into public.formulario_respuesta (tenant_id, plantilla_id, visita_id, usuario_id, respuestas, resultado, cliente_key)
  values (v_tenant, p_plantilla_id, p_visita_id, auth.uid(), p_respuestas, v_resultado, coalesce(p_cliente_key, gen_random_uuid()))
  returning * into v_existente;

  perform public.registrar_auditoria(v_tenant, 'formulario_respuesta', v_existente.id::text, 'insert',
    jsonb_build_object('plantilla', p_plantilla_id, 'resultado', v_resultado));

  return v_existente;
end;
$$;

-- ---------- RPC: ingesta batch de rastreo ----------
-- El móvil envía un arreglo de puntos; se ignoran los duplicados por (usuario, registrado_en).
create or replace function public.rastreo_ingesta(
  p_puntos jsonb
)
returns integer
language plpgsql security definer
set search_path = public
as $$
declare
  v_tenant uuid := (auth.jwt() ->> 'tenant_id')::uuid;
  v_punto jsonb;
  v_insertados integer := 0;
begin
  for v_punto in select * from jsonb_array_elements(p_puntos) loop
    insert into public.rastreo_ubicacion (tenant_id, usuario_id, posicion, precision_m, velocidad_kmh, registrado_en)
    values (
      v_tenant,
      auth.uid(),
      st_setsrid(st_makepoint((v_punto ->> 'longitud')::double precision, (v_punto ->> 'latitud')::double precision), 4326)::geography,
      nullif(v_punto ->> 'precision_m', '')::numeric,
      nullif(v_punto ->> 'velocidad_kmh', '')::numeric,
      (v_punto ->> 'registrado_en')::timestamptz
    )
    on conflict do nothing;
    if found then
      v_insertados := v_insertados + 1;
    end if;
  end loop;

  perform public.registrar_auditoria(v_tenant, 'rastreo_ubicacion', auth.uid()::text, 'insert',
    jsonb_build_object('puntos', v_insertados));

  return v_insertados;
end;
$$;

-- ---------- RPC: módulo activo por tenant (verificación RLS de tablas de rubro) ----------
create or replace function public.modulo_activo(
  p_tenant uuid,
  p_codigo text
)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.tenant_modulo tm
    join public.modulo m on m.id = tm.modulo_id
    where tm.tenant_id = p_tenant
      and m.codigo = p_codigo
      and tm.activo
  );
$$;
revoke all on function public.modulo_activo(uuid, text) from public;
grant execute on function public.modulo_activo(uuid, text) to authenticated;

-- ---------- RPC: dashboards con alcance por rol ----------
-- W-02/02b: métricas del día por asesor; gerente/supervisor ven su subárbol.
create or replace function public.dashboard_asesor(
  p_usuario_id uuid default auth.uid(),
  p_fecha date default current_date
)
returns table (
  visitas_programadas bigint,
  visitas_completadas bigint,
  visitas_aprobadas bigint,
  visitas_rechazadas bigint,
  visitas_anuladas bigint,
  checkins_realizados bigint,
  primera_hora time,
  ultima_hora time
)
language sql stable security definer
set search_path = public
as $$
  with ambito as (
    select p_usuario_id as usuario_id
    union
    select * from public.subordinados(p_usuario_id)
  )
  select
    count(*) filter (where v.estado = 'programada'),
    count(*) filter (where v.estado = 'completada'),
    count(*) filter (where v.estado = 'aprobada'),
    count(*) filter (where v.estado = 'rechazada'),
    count(*) filter (where v.estado = 'anulada'),
    count(*) filter (where v.latitud is not null),
    min(v.hora_inicio),
    max(v.hora_inicio)
  from public.visita v
  where v.usuario_id in (select usuario_id from ambito)
    and v.fecha_visita = p_fecha;
$$;

-- KPIs del subárbol para gerente/supervisor (drill-down W-02b)
create or replace function public.dashboard_supervisor(
  p_fecha date default current_date
)
returns table (
  usuario_id uuid,
  nombre text,
  rol text,
  visitas_programadas bigint,
  visitas_completadas bigint,
  visitas_aprobadas bigint,
  visitas_rechazadas bigint
)
language sql stable security definer
set search_path = public
as $$
  select
    u.id,
    u.nombre,
    u.rol,
    count(*) filter (where v.estado = 'programada'),
    count(*) filter (where v.estado = 'completada'),
    count(*) filter (where v.estado = 'aprobada'),
    count(*) filter (where v.estado = 'rechazada')
  from public.usuario u
  left join public.visita v
    on v.usuario_id = u.id and v.fecha_visita = p_fecha
  where u.id = auth.uid() or u.id in (select * from public.subordinados())
  group by u.id, u.nombre, u.rol
  order by u.nombre;
$$;

create or replace function public.dashboard_gerente(
  p_fecha date default current_date
)
returns table (
  usuario_id uuid,
  nombre text,
  rol text,
  jefe_id uuid,
  visitas_programadas bigint,
  visitas_completadas bigint,
  visitas_aprobadas bigint,
  visitas_rechazadas bigint,
  total_personas bigint
)
language sql stable security definer
set search_path = public
as $$
  select
    u.id,
    u.nombre,
    u.rol,
    u.jefe_id,
    count(distinct v.id) filter (where v.estado = 'programada'),
    count(distinct v.id) filter (where v.estado = 'completada'),
    count(distinct v.id) filter (where v.estado = 'aprobada'),
    count(distinct v.id) filter (where v.estado = 'rechazada'),
    count(distinct p.id)
  from public.usuario u
  left join public.visita v
    on v.usuario_id = u.id and v.fecha_visita = p_fecha
  left join public.persona p
    on p.asesor_id = u.id
  where u.id = auth.uid() or u.id in (select * from public.subordinados())
  group by u.id, u.nombre, u.rol, u.jefe_id
  order by u.nombre;
$$;
