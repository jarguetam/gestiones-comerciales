# Spec de Base de Datos — Gestiones Comerciales

**Producto:** Gestiones Comerciales (plataforma genérica multi-rubro)
**Derivado de:** `spec-agromoney-v2.md` (Agromoney Gestiones v2)
**Motor:** PostgreSQL 15+ (Supabase)
**Versión:** 1.0 · 2026-08-26
**Estado:** Borrador para revisión

---

## 1. Objetivo y principio de generalización

Agromoney Gestiones resuelve la gestión de campo de una financiera agrícola: visitas a clientes,
precalificación de crédito, cotizaciones firmadas, depósitos y rastreo GPS. El 80% de ese dominio
es **idéntico** en cualquier rubro con fuerza comercial en campo (distribuidoras, retail, seguros,
farmacéuticas, microfinanzas, servicios). Solo cambia el vocabulario y los datos específicos del rubro.

**Gestiones Comerciales** generaliza ese dominio con tres reglas:

| # | Regla | Mecanismo |
|---|-------|-----------|
| G-1 | **Multi-tenant estricto** | `tenant_id` en toda tabla de negocio + RLS por JWT. Un rubro = un tenant (o N tenants del mismo rubro). |
| G-2 | **Núcleo + módulos optativos** | El núcleo (personas, visitas, formularios, rastreo, notificaciones) es rubro-agnóstico. Lo específico del rubro vive en módulos que se activan por tenant (`tenant_modulo`). |
| G-3 | **Configuración sobre código** | Catálogos, estados, horarios de rastreo, ventanas de jobs y formularios son **datos**, no constantes compiladas. Cero hardcodeos (lea §8 Mapeo legado). |

### 1.1 Núcleo vs. módulos

```
NUCLEO (siempre activo)
├── tenant / modulo / tenant_modulo      → multi-rubro y feature flags
├── usuario_plataforma (+tenant)         → backoffice global (superadmin/soporte)
├── usuario / dispositivo                → identidad, jerarquía, MFA
├── zona / departamento / municipio      → territorio y geografía
├── persona                              → clientes, prospectos, puntos de venta (ex `cliente`)
├── actividad / subactividad / visita    → agenda y gestión de campo
├── formulario_plantilla / respuesta     → captura dinámica de datos (ex precalificación)
├── rastreo_ubicacion / config_rastreo   → tracking GPS configurable
├── notificacion                         → centro de notificaciones
└── auditoria                            → trazabilidad

MODULOS OPTATIVOS (por tenant)
├── crm          → lead / lead_estado / lead_actividad / lead_origen (embudo comercial)
├── creditos     → cuenta / cuenta_saldo / movimiento / producto   (ex préstamos SIFCO)
├── solicitudes  → solicitud / estado / archivo / firma            (ex cotización + firma)
├── depositos    → deposito                                         (ex depósitos pendientes)
└── kilometraje  → kilometraje                                      (ex km del mes)
```

---

## 2. Convenciones

| Tema | Convención |
|------|-----------|
| Esquemas | Todo en `public`. Los módulos no usan esquemas separados (PostgREST los expone igual y simplifica joins), se distinguen por tabla. |
| PK | `bigint generated always as identity` en tablas de negocio; `uuid` solo donde se referencia `auth.users`. |
| Auditoría temporal | `creado_en timestamptz not null default now()`, `actualizado_en timestamptz not null default now()` con trigger. |
| Borrado | Borrado lógico (`activo boolean`) en entidades maestras; `on delete cascade` solo en hijas puras (archivos, respuestas). |
| Nombres | Singular, snake_case, español (coherente con el equipo). |
| Dinero | `numeric(18,2)`. Nunca `float`. |
| Fechas | `timestamptz` (UTC en BD; presentación por locale). |
| Extensibilidad rubro | Columnas extra **no** se agregan a lo bruto: se usan `detalles jsonb` validado por esquema del tenant, o módulos. |
| IDs externos | Referencias a sistemas legados del rubro en columna `codigo_externo` (ex referencia SIFCO `C0021290`). |

---

## 3. Multi-tenancy y RLS

### 3.1 Modelo

- Cada usuario tiene en `auth.users.app_metadata`: `{ "tenant_id": "<uuid>", "rol": "admin|gerente|supervisor|asesor" }`.
- El JWT de Supabase transporta esos claims; **ninguna** política confía en un parámetro del cliente.
- Rol mínimo requerido para operar la API: `authenticated`.

### 3.2 Patrón de política (aplicado a TODA tabla de negocio)

```sql
-- aislamiento por tenant: primera política de toda tabla
create policy tenant on public.persona
  for all to authenticated
  using (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid)
  with check (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);
```

### 3.3 Alcance por rol (segunda política, según tabla)

| Rol | Alcance |
|-----|---------|
| `admin` | Todo el tenant (todas las zonas, toda la estructura comercial). |
| `gerente` | Registros propios + todo su subárbol (sus supervisores y los asesores de estos) vía `subordinados()`. |
| `supervisor` | Registros propios + los de sus asesores (jerarquía materializada, §6 `subordinados()`). |
| `asesor` | Solo registros propios (`asesor_id = auth.uid()` o `usuario_id = auth.uid()`). |

**Jerarquía comercial (única estructura válida):** `asesor.jefe_id → supervisor`,
`supervisor.jefe_id → gerente`, `gerente.jefe_id → NULL` (o admin del tenant). Las violaciones
de cadena o ciclos se rechazan con error `GC-CORE-010`. Un gerente puede
tener N supervisores; un supervisor, N asesores. Un trigger `validar_jerarquia_usuario()`
rechaza asignaciones fuera de esa cadena y ciclos (asesor con jefe asesor, supervisor con jefe
supervisor, etc.). `admin` no participa de la jerarquía: su alcance nace del rol, no del árbol.

```sql
-- ejemplo: visitas visibles para el asesor dueño y su cadena de jefes
create policy alcance_visita on public.visita
  for select to authenticated
  using (
    asesor_id = auth.uid()
    or asesor_id in (select * from public.subordinados())
  );
```

> **Regla:** RLS es la única capa de autorización para PostgREST. Las RPC re-verifican
> alcance internamente (defensa en profundidad). Edge Functions con service_role filtran
> SIEMPRE por `tenant_id` explícito.

> **Acceso de plataforma (backoffice global):** los usuarios de `usuario_plataforma` NO usan las
> políticas por tenant; operan mediante RPC `security definer` (`admin_tenant_crear`,
> `admin_usuario_invitar`, `admin_modulo_activar`, …) que verifican membresía
> (`usuario_plataforma_tenant` o `es_superadmin`) y auditan cada operación en `auditoria`
> con el `tenant_id` afectado. Nunca se relaja la RLS de las tablas de negocio: la plataforma
> siempre escribe a través de RPC administrativas.

---

## 4. Esquema — NÚCLEO

### 4.1 Tenancy y módulos

```sql
create table public.tenant (
  id             uuid primary key default gen_random_uuid(),
  codigo         text not null unique,              -- slug: 'agromoney', 'distribuidora-x'
  nombre         text not null,
  rubro          text not null,                     -- 'microfinanzas', 'distribucion', 'retail'...
  plan           text not null default 'basico' check (plan in ('basico','pro','enterprise')),
  branding       jsonb not null default '{}',       -- {logo_url, color_primario, color_secundario, nombre_comercial, idioma}
  configuracion  jsonb not null default '{}',       -- zona horaria, moneda, formato documento, dominios_cors[]
  activo         boolean not null default true,
  creado_en       timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

-- identidad de PLATAFORMA (por encima de los tenants): backoffice global
create table public.usuario_plataforma (
  id            uuid primary key references auth.users(id) on delete cascade,
  email         text not null unique,
  nombre        text not null,
  es_superadmin boolean not null default false,     -- acceso total a N tenants
  activo        boolean not null default true,
  creado_en     timestamptz not null default now()
);

-- alcance de plataforma: qué tenants puede administrar cada usuario de plataforma
create table public.usuario_plataforma_tenant (
  usuario_plataforma_id uuid not null references public.usuario_plataforma(id) on delete cascade,
  tenant_id             uuid not null references public.tenant(id) on delete cascade,
  rol                   text not null default 'soporte' check (rol in ('owner','soporte','lectura')),
  creado_en             timestamptz not null default now(),
  primary key (usuario_plataforma_id, tenant_id)
);

create table public.modulo (
  id        bigint generated always as identity primary key,
  codigo    text not null unique,                   -- 'creditos','solicitudes','depositos','kilometraje'
  nombre    text not null,
  nucleo    boolean not null default false          -- true = no desactivable
);

create table public.tenant_modulo (
  tenant_id      uuid not null references public.tenant(id) on delete cascade,
  modulo_id      bigint not null references public.modulo(id),
  activo         boolean not null default true,
  configuracion  jsonb not null default '{}',       -- params específicos del tenant para el módulo
  primary key (tenant_id, modulo_id)
);
```

### 4.2 Identidad y jerarquía

```sql
create table public.usuario (
  id              uuid primary key references auth.users(id) on delete cascade,
  tenant_id       uuid not null references public.tenant(id),
  nombre          text not null,
  telefono        text,
  rol             text not null check (rol in ('admin','gerente','supervisor','asesor')),
  jefe_id         uuid references public.usuario(id),     -- jerarquía: asesor→supervisor→gerente
  zona_id         bigint references public.zona(id),
  rastreo_activo  boolean not null default false,
  activo          boolean not null default true,
  creado_en       timestamptz not null default now(),
  actualizado_en  timestamptz not null default now()
);
create index on public.usuario (tenant_id);
create index on public.usuario (jefe_id);

create table public.dispositivo (
  id            bigint generated always as identity primary key,
  usuario_id    uuid not null references public.usuario(id) on delete cascade,
  token_fcm     text not null,
  plataforma    text not null check (plataforma in ('android','ios','web')),
  activo        boolean not null default true,
  creado_en     timestamptz not null default now(),
  unique (usuario_id, token_fcm)
);
```

> Auth (password, MFA/TOTP, recuperación) la resuelve Supabase Auth; `usuario` es el perfil
> de negocio. El JWT debe llevar `tenant_id` y `rol` en `app_metadata` (se setean al crear
> el usuario con service_role).

### 4.3 Territorio y geografía

```sql
create table public.zona (
  id        bigint generated always as identity primary key,
  tenant_id uuid not null references public.tenant(id),
  codigo    text not null,
  nombre    text not null,
  activo    boolean not null default true,
  unique (tenant_id, codigo)
);

-- catálogos geográficos compartidos (país), sin tenant
create table public.departamento (id bigint generated always as identity primary key, nombre text not null unique);
create table public.municipio (
  id              bigint generated always as identity primary key,
  departamento_id bigint not null references public.departamento(id),
  nombre          text not null,
  unique (departamento_id, nombre)
);

-- plantillas base por rubro (P-05): se copian al tenant en admin_tenant_crear
create table public.catalogo_plantilla (
  id      bigint generated always as identity primary key,
  rubro   text not null,
  tipo    text not null check (tipo in ('actividad','formulario','hora')),
  nombre  text not null,
  payload jsonb not null default '{}',
  activo  boolean not null default true,
  unique (rubro, tipo, nombre)
);
```

### 4.4 Personas (ex `cliente`)

```sql
create table public.persona (
  id                 bigint generated always as identity primary key,
  tenant_id          uuid not null references public.tenant(id),
  codigo_externo     text,                          -- referencia en el sistema del rubro (ex C0021290)
  nombre             text not null,
  documento          text,                          -- DUI/DNI/NIT/RUC según rubro
  documento_tipo     text not null default 'DNI',
  direccion          text,
  municipio_id       bigint references public.municipio(id),
  coordenada         geography(point, 4326),        -- PostGIS para rutas/mapas
  categoria          text,                          -- clasificación interna del tenant (ex 'III')
  asesor_id          uuid references public.usuario(id),
  verificacion_estado text not null default 'pendiente',  -- 'pendiente'|'verificada'|'rechazada'
  es_registro_generico boolean not null default false,    -- ex flag "CLIENTE NUEVO" (§8)
  detalles           jsonb not null default '{}',   -- atributos específicos del rubro
  activo             boolean not null default true,
  creado_en          timestamptz not null default now(),
  actualizado_en     timestamptz not null default now()
);
create index on public.persona (tenant_id);
create index on public.persona (documento);
create index on public.persona (asesor_id);
create unique index on public.persona (tenant_id, documento) where activo and documento is not null;
create index on public.persona using gin (detalles);
```

> El registro legado "CLIENTE NUEVO" (fila ficticia hardcodeada en el servicio) se convierte en
> un `persona` con `es_registro_generico = true`, uno por asesor, creado por seed. Nunca se
> inventa en memoria.

### 4.5 Actividades y visitas

```sql
-- catálogos por tenant (el legado los tenía globales y en inglés mal escrito)
create table public.actividad (
  id        bigint generated always as identity primary key,
  tenant_id uuid not null references public.tenant(id),
  codigo    text not null,
  nombre    text not null,
  requiere_subactividad boolean not null default false,
  activo    boolean not null default true,
  unique (tenant_id, codigo)
);
create table public.subactividad (
  id           bigint generated always as identity primary key,
  tenant_id    uuid not null references public.tenant(id),
  actividad_id bigint not null references public.actividad(id) on delete cascade,
  nombre       text not null
);
create table public.actividad_horario (
  id           bigint generated always as identity primary key,
  actividad_id bigint not null references public.actividad(id) on delete cascade,
  hora_inicio  time not null,
  hora_fin     time not null
);

-- estados de visita configurables (ex enum hardcoded 'Pendiente|Completada|...')
create table public.visita_estado (
  id        bigint generated always as identity primary key,
  tenant_id uuid not null references public.tenant(id),
  codigo    text not null,
  nombre    text not null,
  es_final  boolean not null default false,   -- marca cierre del flujo
  orden     int not null default 0,
  unique (tenant_id, codigo)
);

create table public.visita (
  id              bigint generated always as identity primary key,
  tenant_id       uuid not null references public.tenant(id),
  persona_id      bigint not null references public.persona(id),
  asesor_id       uuid not null references public.usuario(id),
  actividad_id    bigint not null references public.actividad(id),
  subactividad_id bigint references public.subactividad(id),
  estado_id       bigint not null references public.visita_estado(id) default (select id from public.visita_estado where codigo='pendiente' limit 1),
  titulo          text,
  observaciones   text,
  programada_en   timestamptz not null,
  iniciada_en     timestamptz,                -- check-in
  finalizada_en   timestamptz,                -- check-out
  ubicacion       geography(point, 4326),     -- punto de check-in
  fuera_de_rango  boolean,                    -- check-in lejos del punto esperado
  creado_en       timestamptz not null default now(),
  actualizado_en  timestamptz not null default now()
);
create index on public.visita (tenant_id, programada_en);
create index on public.visita (asesor_id, programada_en);
create index on public.visita (persona_id);
create index on public.visita (estado_id);
```

### 4.6 Formularios dinámicos (generaliza la precalificación de 14 preguntas)

El legado tenía 14 columnas `int` fijas en `Prequal`. Cualquier cambio de criterio era un
`ALTER TABLE` + release. En la plataforma genérica, **el cuestionario es un esquema JSON** por
tenant/rubro y la respuesta es un documento JSONB validado contra ese esquema.

```sql
create table public.formulario_plantilla (
  id         bigint generated always as identity primary key,
  tenant_id  uuid not null references public.tenant(id),
  modulo_id  bigint references public.modulo(id),      -- null = núcleo; 'creditos' = precalificación
  codigo     text not null,                            -- 'precalificacion', 'encuesta_satisfaccion'...
  nombre     text not null,
  version    int not null default 1,
  esquema    jsonb not null,        -- JSON Schema: campos, tipos, opciones, puntajes
  calculo    jsonb,                 -- reglas de scoring/resultados (ex: aprobar si score >= X)
  activo     boolean not null default true,
  creado_en  timestamptz not null default now(),
  unique (tenant_id, codigo, version)
);

create table public.formulario_respuesta (
  id           bigint generated always as identity primary key,
  tenant_id    uuid not null references public.tenant(id),
  plantilla_id bigint not null references public.formulario_plantilla(id),
  persona_id   bigint references public.persona(id),
  visita_id    bigint references public.visita(id),
  asesor_id    uuid not null references public.usuario(id),
  respuestas   jsonb not null,      -- validado contra plantilla.esquema
  resultado    jsonb,               -- {score, clasificacion} calculado por el backend
  creado_en    timestamptz not null default now()
);
create index on public.formulario_respuesta (tenant_id, plantilla_id);
create index on public.formulario_respuesta (persona_id);
```

**Estructura de `esquema` (contrato con frontend):**

```json
{
  "campos": [
    {"clave": "antiguedad_anios", "tipo": "numero", "etiqueta": "Años en el negocio", "puntaje": 2},
    {"clave": "tiene_garantia", "tipo": "booleano", "etiqueta": "Presenta garantía", "puntaje": 3},
    {"clave": "rubro_actividad", "tipo": "lista", "etiqueta": "Rubro", "opciones": ["agro", "comercio", "servicios"]}
  ]
}
```

### 4.7 Rastreo (GPS)

```sql
create table public.rastreo_ubicacion (
  id           bigint generated always as identity primary key,
  tenant_id    uuid not null references public.tenant(id),
  usuario_id   uuid not null references public.usuario(id),
  latitud      double precision not null,
  longitud     double precision not null,
  precision_m  double precision,
  velocidad_ms double precision,
  bateria      int,
  capturado_en timestamptz not null
);
create index on public.rastreo_ubicacion (tenant_id, usuario_id, capturado_en desc);

-- ventanas horarias POR TENANT (el legado las tenía en main.dart: L-V 07:30-17:30, Sáb 07:30-12:30)
create table public.config_rastreo (
  id              bigint generated always as identity primary key,
  tenant_id       uuid not null references public.tenant(id),
  dia_semana      int not null check (dia_semana between 0 and 6),
  hora_inicio     time not null,
  hora_fin        time not null,
  intervalo_seg   int not null default 1200,     -- 20 min
  precision_max_m int not null default 700,      -- descarta lecturas con accuracy >= 700m
  activo          boolean not null default true,
  unique (tenant_id, dia_semana)
);
```

### 4.8 Notificaciones y auditoría

```sql
create table public.notificacion (
  id         bigint generated always as identity primary key,
  tenant_id  uuid not null references public.tenant(id),
  usuario_id uuid not null references public.usuario(id),
  tipo       text not null,                      -- 'visita_pendiente','rastreo_inactivo','deposito_pendiente',...
  titulo     text not null,
  cuerpo     text not null,
  datos      jsonb not null default '{}',        -- payload de deep-link
  leida_en   timestamptz,
  creado_en  timestamptz not null default now()
);
create index on public.notificacion (usuario_id, leida_en nulls first, creado_en desc);

create table public.auditoria (
  id          bigint generated always as identity primary key,
  tenant_id   uuid,
  tabla       text not null,
  registro_id text not null,
  accion      text not null check (accion in ('insert','update','delete')),
  usuario_id  uuid,
  cambios     jsonb not null default '{}',       -- diff antes/después
  creado_en   timestamptz not null default now()
);
create index on public.auditoria (tenant_id, tabla, registro_id);
```

---

## 5. Esquema — MÓDULOS OPTATIVOS

> Solo se crean las tablas de un módulo si `tenant_modulo` lo activa. La RLS de módulo incluye
> además el chequeo `public.modulo_activo(tenant_id, 'creditos')`.

```sql
create function public.modulo_activo(p_tenant uuid, p_codigo text)
returns boolean language sql stable as $$
  select exists (
    select 1 from public.tenant_modulo tm
    join public.modulo m on m.id = tm.modulo_id
    where tm.tenant_id = p_tenant and m.codigo = p_codigo and tm.activo
  );
$$;
```

### 5.1 Módulo `creditos` (ex SIFCO: préstamos, saldos, movimientos)

```sql
create table public.producto (
  id        bigint generated always as identity primary key,
  tenant_id uuid not null references public.tenant(id),
  codigo    text not null,
  nombre    text not null,
  tasa      numeric(8,4),
  plazo_meses int,
  activo    boolean not null default true,
  unique (tenant_id, codigo)
);

create table public.cuenta (
  id         bigint generated always as identity primary key,
  tenant_id  uuid not null references public.tenant(id),
  persona_id bigint not null references public.persona(id),
  producto_id bigint references public.producto(id),
  codigo_externo text not null,                  -- número de contrato en el core del rubro
  monto      numeric(18,2) not null default 0,
  estado     text not null default 'activa',     -- 'activa'|'cancelada'|'mora'
  activo     boolean not null default true,
  creado_en  timestamptz not null default now(),
  unique (tenant_id, codigo_externo)
);

-- snapshot de corte diario (ex prestamo_saldo; normaliza rango_mora en la ingesta)
create table public.cuenta_saldo (
  cuenta_id      bigint not null references public.cuenta(id) on delete cascade,
  dias_atraso    int not null default 0,
  rango_mora     text,                           -- '1-30','31-60',... sin prefijo "Mora "
  capital_riesgo numeric(18,2) not null default 0,
  corte_en       timestamptz not null,
  primary key (cuenta_id, corte_en)
);
create index on public.cuenta_saldo (rango_mora);

create table public.movimiento (
  id         bigint generated always as identity primary key,
  tenant_id  uuid not null references public.tenant(id),
  cuenta_id  bigint not null references public.cuenta(id),
  numero     text not null,
  tipo       text not null,                      -- 'cuota','abono','cargo','desembolso'
  monto      numeric(18,2) not null,
  fecha      date not null,
  creado_en  timestamptz not null default now()
);
create index on public.movimiento (tenant_id, fecha);
```

### 5.2 Módulo `solicitudes` (ex cotización + firma)

```sql
create table public.solicitud_estado (
  id        bigint generated always as identity primary key,
  tenant_id uuid not null references public.tenant(id),
  codigo    text not null,
  nombre    text not null,
  orden     int not null default 0,
  unique (tenant_id, codigo)
);

create table public.solicitud (
  id            bigint generated always as identity primary key,
  tenant_id     uuid not null references public.tenant(id),
  persona_id    bigint not null references public.persona(id),
  asesor_id     uuid not null references public.usuario(id),
  estado_id     bigint not null references public.solicitud_estado(id),
  monto         numeric(18,2),
  descripcion   text not null,
  formulario_respuesta_id bigint references public.formulario_respuesta(id),
  creado_en     timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);
create index on public.solicitud (tenant_id, estado_id);

create table public.solicitud_archivo (
  id            bigint generated always as identity primary key,
  solicitud_id  bigint not null references public.solicitud(id) on delete cascade,
  ruta          text not null,                   -- storage: {bucket}/{tenant}/{solicitud}/{archivo}
  tipo          text not null default 'adjunto',
  creado_en     timestamptz not null default now()
);

create table public.solicitud_firma (
  solicitud_id bigint primary key references public.solicitud(id) on delete cascade,
  firma_ruta   text not null,                    -- PNG del canvas
  pdf_ruta     text,                             -- PDF generado por Edge Function
  firmado_en   timestamptz not null default now(),
  firmado_por  uuid not null references public.usuario(id)
);
```

### 5.3 Módulo `depositos`

```sql
create table public.deposito (
  id             bigint generated always as identity primary key,
  tenant_id      uuid not null references public.tenant(id),
  asesor_id      uuid not null references public.usuario(id),
  monto          numeric(18,2) not null,
  referencia     text,                           -- boleta / transferencia
  estado         text not null default 'pendiente' check (estado in ('pendiente','confirmado','rechazado')),
  confirmado_por uuid references public.usuario(id),
  confirmado_en  timestamptz,
  creado_en      timestamptz not null default now()
);
create index on public.deposito (tenant_id, estado);
```

### 5.4 Módulo `crm` (leads y embudo comercial)

El embudo es **configurable por tenant**: cada etapa es una fila en `lead_estado` con orden y
reglas de salida. El lead vive su ciclo propio (nuevo → contacto → calificación → …) y se
**conecta con el núcleo** en dos puntos: al agendar (crea `visita`) y al madurar (crea
`persona` + `solicitud` si el módulo está activo). Nunca hay duplicados: un lead ganado se
convierte en `persona` una sola vez, conservando `persona_id` en el lead.

```sql
create table public.lead_origen (
  id        bigint generated always as identity primary key,
  tenant_id uuid not null references public.tenant(id),
  codigo    text not null,                     -- 'referido','campania','walk-in','whatsapp'...
  nombre    text not null,
  activo    boolean not null default true,
  unique (tenant_id, codigo)
);

create table public.lead_estado (
  id         bigint generated always as identity primary key,
  tenant_id  uuid not null references public.tenant(id),
  codigo     text not null,                    -- 'nuevo','contactado','calificado','ganado','perdido'
  nombre     text not null,
  orden      int not null,                     -- posición en el embudo
  es_ganado  boolean not null default false,   -- dispara conversión a persona/solicitud
  es_perdido boolean not null default false,   -- requiere motivo al salir
  activo     boolean not null default true,
  unique (tenant_id, codigo)
);

create table public.lead (
  id             bigint generated always as identity primary key,
  tenant_id      uuid not null references public.tenant(id),
  estado_id      bigint not null references public.lead_estado(id),
  origen_id      bigint references public.lead_origen(id),
  nombre         text not null,
  documento      text,
  telefono       text not null,
  email          text,
  municipio_id   bigint references public.municipio(id),
  direccion      text,
  coordenada     geography(point, 4326),
  monto_estimado numeric(18,2),
  detalles       jsonb not null default '{}',  -- atributos específicos del rubro
  -- conexión con el núcleo
  persona_id     bigint references public.persona(id),        -- set al convertir (ganado)
  asesor_id      uuid references public.usuario(id),          -- dueño del lead
  -- trazabilidad del embudo
  perdido_motivo text,
  convertido_en  timestamptz,
  creado_en      timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);
create index on public.lead (tenant_id, estado_id);
create index on public.lead (asesor_id, creado_en desc);
create index on public.lead (persona_id);
create unique index on public.lead (tenant_id, telefono) where persona_id is null;

-- historial de movimientos en el embudo (audita cada transición + razones)
create table public.lead_actividad (
  id           bigint generated always as identity primary key,
  tenant_id    uuid not null references public.tenant(id),
  lead_id      bigint not null references public.lead(id) on delete cascade,
  tipo         text not null check (tipo in ('estado','nota','llamada','whatsapp','visita','email')),
  estado_anterior_id bigint references public.lead_estado(id),
  estado_nuevo_id    bigint references public.lead_estado(id),
  descripcion  text,
  realizado_por uuid not null references public.usuario(id),
  creado_en    timestamptz not null default now()
);
create index on public.lead_actividad (lead_id, creado_en desc);
```

**Reglas del flujo (re-verificadas en RPC, no solo triggers):**

| # | Regla | Código |
|---|---|---|
| CRM-1 | Transiciones solo entre estados activos y hacia adelante o hacia `es_perdido`/`es_ganado` (regresar requiere permiso de supervisor). | GC-CRM-001 |
| CRM-2 | Salida hacia `es_perdido` exige `perdido_motivo`. | GC-CRM-002 |
| CRM-3 | Entrada a `es_ganado` dispara conversión idempotente: crea `persona` si no existe (match por documento/teléfono) y setea `persona_id`. | GC-CRM-003 |
| CRM-4 | Un lead con `persona_id` no puede volver a estados previos. | GC-CRM-004 |
| CRM-5 | Reasignar `asesor_id` solo supervisor/gerente (auditoría en `lead_actividad`). | GC-CRM-005 |

### 5.5 Módulo `kilometraje`

```sql
create table public.kilometraje (
  id           bigint generated always as identity primary key,
  tenant_id    uuid not null references public.tenant(id),
  usuario_id   uuid not null references public.usuario(id),
  periodo      date not null,                    -- primer día del mes
  km_inicial   numeric(10,1),
  km_final     numeric(10,1),
  observaciones text,
  creado_en    timestamptz not null default now(),
  unique (tenant_id, usuario_id, periodo)
);
```

---

## 6. Funciones (RPC) del núcleo

| Función | Propósito | Reemplaza a |
|---|---|---|
| `subordinados()` → `setof uuid` | Subárbol completo del autenticado (CTE recursivo sobre `usuario.jefe_id`): gerente → sus supervisores + sus asesores; supervisor → sus asesores; asesor → vacío. | `GET /User/GetBySupervisor{id}` |
| `estructura_comercial()` → `jsonb` | Árbol jerárquico listo para UI (gerente → supervisores → asesores) con KPIs resumidos por nodo. | — |
| `visitas_del_dia(p_fecha date)` | Agenda del asesor autenticado con persona, actividad y estado. | `GET /api/Visits/ByUser...` |
| `visita_checkin(id, ubicacion)` / `visita_checkout(id, ...)` | Transición de estado con validación de ventana y geocerca. | lógica embebida en la app |
| `dashboard_asesor(p_fecha)` / `dashboard_supervisor(p_fecha)` | Agregados para el home (visitas totales/completadas, depósitos pendientes, km, cuentas en mora si el módulo está activo). | servicios de reporte .NET |
| `dashboard_gerente(p_fecha, p_supervisor_id default null)` | Consolidado del subárbol del gerente con drill-down opcional por supervisor (comparativa de equipos). | — |
| `formulario_enviar(respuesta jsonb)` | Valida contra `plantilla.esquema`, calcula `resultado` y persiste. | `Prequal` service |
| `deposito_confirmar(id)` | Transición validada (solo supervisor/admin). | endpoint .NET |
| `solicitud_transicion(id, estado_codigo, comentario)` | Transición de solicitud con historial y validación de flujo. | flujo cotización .NET |
| `km_registrar(periodo, km_inicial, km_final)` | Upsert del kilometraje del periodo del asesor autenticado. | job Hangfire km |
| `importar_personas(jsonb)` | Carga masiva validada de personas (usada por Edge `importer`). | ETL manual |
| `lead_transicion(id, estado_codigo, motivo?)` | Transición validada del embudo (reglas CRM-1..4) + registro en `lead_actividad`; en ganado dispara conversión a persona. | — |
| `lead_convertir(id)` | Conversión explícita idempotente lead→persona (+solicitud si el módulo está activo). | — |
| `lead_reasignar(id, asesor_id)` | Reasignación de dueño del lead (solo supervisor/gerente) con auditoría. | — |
| `crm_funnel(p_desde, p_hasta)` | Agregados del embudo por estado (conteos, monto estimado, tasa de conversión) con alcance por rol. | — |
| `admin_tenant_crear(nombre, rubro, plan, branding)` | Alta de empresa (tenant) + seed inicial completo en una transacción. Solo plataforma. | — |
| `admin_tenant_actualizar(id, cambios)` | Edición de tenant (branding, plan, dominios CORS, activo). Solo plataforma. | — |
| `admin_usuario_invitar(tenant_id, email, rol, jefe_id?)` | Invitación de usuario de empresa (auth user + `usuario` + claims) con email. | — |
| `admin_usuario_gestionar(id, accion, datos)` | Activar/desactivar, cambiar rol/jefe/zona de un usuario de tenant. | — |
| `admin_modulo_activar(tenant_id, modulo, activo, config?)` | Activación de módulos por empresa. | — |
| `admin_departamento_guardar(id?, nombre)` | Alta/edición de departamento compartido (P-05). | — |
| `admin_municipio_guardar(id?, departamento_id, nombre)` | Alta/edición de municipio compartido (P-05). | — |
| `admin_geografia_importar(filas jsonb)` | Importación masiva departamento/municipio. | — |
| `admin_modulo_catalogo_guardar(codigo, nombre, nucleo)` | Upsert del catálogo global de módulos. | — |
| `admin_plantilla_guardar(...)` | Upsert de plantilla base por rubro (actividad/formulario/hora). | — |
| `admin_importar_personas(tenant_id, jsonb)` | Carga masiva de clientes por admin de empresa o plataforma. | — |
| `modulo_activo(tenant, codigo)` | Helper usado por RLS de módulos. | — |

```sql
-- subárbol del autenticado (gerente: supervisores+asesores; supervisor: asesores)
create function public.subordinados()
returns setof uuid language sql stable security definer as $$
  with recursive arbol as (
    select id, rol from public.usuario where id = auth.uid()
    union all
    select u.id, u.rol from public.usuario u
    join arbol a on u.jefe_id = a.id
    where u.activo
  )
  select id from arbol where id <> auth.uid();
$$;

-- árbol jerárquico para UI (W-11) con conteos por nodo
create function public.estructura_comercial()
returns jsonb language sql stable security invoker as $$
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
```

---

## 7. Jobs programados (pg_cron)

El legado usaba Hangfire con 9 jobs globales. Aquí los jobs son **genéricos y parametrizados
por tenant**: una sola corrida pg_cron selecciona los tenants activos y sus configuraciones.

| Job (genérico) | Cron UTC | Qué hace |
|---|---|---|
| `recordatorio_agenda` | `0 14 * * 1-6` | Notifica asesores con visitas sin programar hoy. |
| `recordatorio_rastreo` | `0 15,18,21 * * 1-5` | Notifica asesores con `rastreo_activo=false` dentro de su ventana (según `config_rastreo`). |
| `cierre_visitas` | `0 23 * * 1-6` | Marca visitas vencidas y notifica. |
| `resumen_diario` | `30 13 * * 1-6` | Resumen de gestión a supervisores/admin. |
| `asesores_inactivos` | `30 14 * * 1-6` | Supervisores reciben asesores sin actividad. |
| `recordatorio_kilometraje` | diario 14:00 y 23:00 | Solo tenants con módulo `kilometraje`; recuerda el último día del mes. |
| `recordatorio_depositos` | `30 14,21 * * 1-5` | Solo tenants con módulo `depositos`. |
| `snapshot_cuentas` | `30 0 * * *` | Solo tenants con módulo `creditos`; corte diario de `cuenta_saldo`. |

> Los cron con `L`/`?` (Quartz) no existen en pg_cron: el "último día del mes" se resuelve con
> corrida diaria + guarda `where current_date = (date_trunc('month', current_date) + interval '1 month - 1 day')::date`.
> pg_cron invoca Edge Functions vía `pg_net` (`net.http_post`) con firma de service_role.

---

## 8. Mapeo legado → genérico

| Legado Agromoney | Gestiones Comerciales | Motivo |
|---|---|---|
| `cliente` (DNI agro) | `persona` (documento por tipo) | Rubros distintos documentan distinto (RUC, NIT, cédula). |
| "CLIENTE NUEVO" hardcodeado en servicio | `persona.es_registro_generico` | Era una fila inventada en memoria con dirección de relleno. |
| Asesor | rol `asesor` de `usuario` | El rol se mantiene; la jerarquía formaliza su lugar en el árbol comercial. |
| `Prequal` 14 columnas `int` | `formulario_plantilla` + `formulario_respuesta` JSONB | Cambiar criterios sin `ALTER TABLE` ni release. |
| Catálogos globales (`zone`, `activitie`...) | Catálogos por `tenant_id` | Cada rubro define sus actividades. |
| Enum de estado de visita en código | `visita_estado` (tabla por tenant) | Flujos distintos por rubro. |
| `prestamo` / `prestamo_saldo` / `movimiento` (SIFCO) | Módulo `creditos`: `cuenta` / `cuenta_saldo` / `movimiento` | Solo tenants financieros lo activan. |
| `cotizacion` + firma | Módulo `solicitudes` | "Cotización" es específico; solicitud/firma es genérico. |
| Ventanas de rastreo en `main.dart` | `config_rastreo` por tenant | Cambiar horario sin recompilar. |
| Rango "Mora X" limpiado en lectura | `cuenta_saldo.rango_mora` normalizado en ingesta | Normalizar en escritura, no en cada lectura. |
| Hangfire (9 jobs globales) | pg_cron + jobs parametrizados por tenant | Multi-tenant. |
| — (no existía) | Módulo `crm` (leads + embudo configurable) | Boca de entrada del ciclo comercial; conecta con visitas y solicitudes. |
| Fortitoken | MFA TOTP de Supabase Auth | Elimina dependencia externa. |

---

## 9. No funcionales (DB)

| ID | Requisito | Objetivo |
|----|-----------|----------|
| NFR-DB-1 | Aislamiento | Ningún query cross-tenant posible con JWT de usuario (RLS verificado con tests de penetración por rol). |
| NFR-DB-2 | Latencia | p95 < 300 ms en endpoints PostgREST típicos con 1M filas por tabla (índices §4). |
| NFR-DB-3 | Volumen | `rastreo_ubicacion`: ~50 lecturas/asesor/día → partición mensual + retención 180 días (pg_partman o job de purga). |
| NFR-DB-4 | Auditoría | Toda mutación de negocio registra en `auditoria` (trigger genérico). |
| NFR-DB-5 | Respaldo | PITR de Supabase habilitado; retención ≥ 7 días. |
| NFR-DB-6 | Migraciones | Versionadas (`supabase db migrations`), forwards-only, reversibles por plan escrito. |
| NFR-DB-7 | Integridad | `not null` + `check` por defecto; validación JSONB con constraints (`jsonb matches_schema` vía función). |

---

## 10. Estrategia de migración e inicialización

1. **Orden de creación:** tenancy → identidad → geografía → personas → actividades/visitas → formularios → rastreo → notificaciones → módulos.
2. **Seed mínimo por tenant nuevo:**
   - `tenant` + `tenant_modulo` (núcleo + módulos elegidos).
   - `visita_estado` estándar: `pendiente`, `en_proceso`, `completada`, `cancelada`, `vencida`.
   - `lead_estado` estándar: `nuevo`, `contactado`, `calificado`, `propuesta`, `ganado`, `perdido` + orígenes base (si activa `crm`).
   - `config_rastreo` L–V 07:30–17:30, Sáb 07:30–12:30, Dom inactivo.
   - `persona` genérica por asesor (`es_registro_generico=true`).
   - Catálogo de actividades inicial según rubro.
3. **Onboarding de rubro:** alta de tenant → seed → import de catálogos (CSV por Edge Function `importar-catalogo`) → alta de usuarios con `app_metadata`.
4. **Migración Agromoney:** mapeos de §8; ETL one-shot de `cliente`, `prestamo*`, `movimiento`, `cotizacion*` con `codigo_externo` preservado para trazabilidad.
