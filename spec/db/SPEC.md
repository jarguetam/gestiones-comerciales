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
| G-3 | **Configuración sobre código** | Catálogos, estados, horarios de rastreo, ventanas de jobs y formularios son **datos**, no constantes compiladas. Cero hardcodeo (≤ 5 líneas legado). |

### 1.1 Núcleo vs. módulos

```
NUCLEO (siempre activo)
├── tenant / modulo / tenant_modulo     ← multi-rubro y feature flags
├── usuario_plataforma (+tenant)        ← backoffice global (superadmin/soporte)
├── usuario / dispositivo               ← identidad, jerarquía, MFA
├── zona / departamento / municipio     ← territorio y geografía
├── persona                             ← clientes, prospectos, puntos de venta (ex `cliente`)
├── actividad / subactividad / visita   ← agenda y gestión de campo
├── formulario_plantilla / respuesta    ← captura dinámica de datos (ex precalificación)
├── rastreo_ubicacion / config_rastreo  ← tracking GPS configurable
├── notificacion                        ← centro de notificaciones
└── auditoria                           ← trazabilidad

MÓDULOS OPTATIVOS (por tenant)
├── crm       ← lead / lead_estado / lead_actividad / lead_origen (embudo comercial)
├── creditos  ← cuenta / cuenta_saldo / movimiento / producto     (ex préstamos SIFCO)
├── solicitudes ← solicitud / estado / archivo / firma            (ex cotización + firma)
├── depositos ← deposito                                            (ex depósitos pendientes)
└── kilometraje ← kilometraje                                       (ex km del mes)
```

---

## 2. Convenciones

| Tema | Convención |
|------|------------|
| Esquemas | Todo en `public`. Los módulos no usan esquemas separados (PostgREST los expone igual y simplifica joins), se distinguen por tabla. |
| PK | `bigint generated always as identity` en tablas de negocio; `uuid` solo donde se referencia `auth.users`. |
| Auditoría temporal | `creado_en timestamptz not null default now()`, `actualizado_en timestamptz not null default now()` con trigger. |
| Borrado | Borrado lógico (`activo boolean`) en entidades maestras; `on delete cascade` solo en hijas puras (archivos, respuestas). |
| Nombres | Singular, snake_case, español (`persona`, `visita`, `solicitud`). |
| Dinero | `numeric(18,2)`. Nunca `float`. |
| Fechas | `timestamptz` (UTC en BD; presentación por local). |
| Extensibilidad rubro | Columnas extra **no** se agregan a lo bruto: se usan `detalles jsonb` validados por esquema del tenant, o módulos. |
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
| `gerente` | Registros propios + todo su subárbol (supervisores y los asesores de estos) vía `subordinados()`. |
| `supervisor` | Registros propios + los de sus asesores (jerarquía materializada, ±6 `subordinados()`). |
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
> siempre es una travesía de RPC administrativas.

---

## 4. Esquema — NÚCLEO

### 4.1 Tenancy y módulos

```sql
create table public.tenant (
  id             uuid primary key default gen_random_uuid(),
  codigo         text not null unique,                    -- slug: 'agromoney', 'distribuidora-x'
  nombre         text not null,
  rubro          text not null,                           -- 'microfinanzas', 'distribucion', 'retail'...
  plan           text not null default 'basico' check (plan in ('basico','pro','enterprise')),
  branding       jsonb not null default '{}',             -- {logo_url, color_primario, color_secundario, nombre_comercial, idioma}
  configuracion  jsonb not null default '{}',             -- zona horaria, moneda, formato documento, dominios_corp[]
  activo         boolean not null default true,
  creado_en      timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

-- identidad de PLATAFORMA (por encima de los tenants): backoffice global
create table public.usuario_plataforma (
  id            uuid primary key references auth.users(id) on delete cascade,
  email         text not null unique,
  nombre        text not null,
  es_superadmin boolean not null default false,    -- acceso total a N tenants
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
  jefe_id         uuid references public.usuario(id),   -- jerarquía: asesor→supervisor→gerente
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
```

### 4.4 Personas (ex `cliente`)

```sql
create table public.persona (
  id                bigint generated always as identity primary key,
  tenant_id         uuid not null references public.tenant(id),
  codigo_externo    text,                             -- referencia en el sistema del rubro (ex C0021290)
  nombre            text not null,
  documento         text,                             -- DUI/DNI/NIT/RUC según rubro
  documento_tipo    text not null default 'DNI',
  direccion         text,
  municipio_id      bigint references public.municipio(id),
  coordenada        geography(point, 4326),            -- PostGIS para rutas/mapas
  categoria         text,                              -- clasificación interna del tenant (ex 'III')
  asesor_id         uuid references public.usuario(id),
  verificacion_estado text not null default 'pendiente',  -- 'pendiente'|'verificada'|'rechazada'
  es_registro_generico boolean not null default false,    -- ex flag "CLIENTE NUEVO" (§8)
  detalles          jsonb not null default '{}',      -- atributos específicos del rubro
  activo            boolean not null default true,
  creado_en         timestamptz not null default now(),
  actualizado_en    timestamptz not null default now()
);
create index on public.persona (tenant_id);
create index on public.persona (documento);
create index on public.persona (asesor_id);
create unique index on public.persona (tenant_id, documento) where activo and documento is not null;
create index on public.persona using gin (detalles);
```

> El registro legado "CLIENTE NUEVO" (fila ficticia hardcodeada en el servicio) se conserva en
> un `persona` con `es_registro_generico = true`, uno por asesor, creado por seed. Nunca se
> inventa en memoria.

### 4.5 Actividades y visitas

```sql
-- catálogos por tenant (el legado los tenía globales y en infierno de scripts)
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
  id            bigint generated always as identity primary key,
  tenant_id     uuid not null references public.tenant(id),
  actividad_id  bigint not null references public.actividad(id) on delete cascade,
  nombre        text not null
);
create table public.actividad_horario (
  id            bigint generated always as identity primary key,
  actividad_id  bigint not null references public.actividad(id) on delete cascade,
  hora_inicio   time not null,
  hora_fin      time not null
);

-- estados de visita configurables (ex enum hardcodeado 'Pendiente|Completada|...')
create table public.visita_estado (
  id        bigint generated always as identity primary key,
  tenant_id uuid not null references public.tenant(id),
  codigo    text not null,
  nombre    text not null,
  es_final  boolean not null default false,    -- marca cierre del flujo
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
  titulo          text not null,
  asunto          date,
  hora_comenzar   time,
  hora_fin        time,
  observaciones   text,
  creado_en       timestamptz not null default now()
);
```
