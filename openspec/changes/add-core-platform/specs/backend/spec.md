# Capability: backend — Especificación de requisitos (delta)

## ADDED Requirements

### Requirement: Composición sin API dedicada
El backend SHALL componerse de PostgREST (CRUD con RLS), funciones RPC de Postgres (lógica transaccional) y Edge Functions (efectos externos), sin servidor de aplicación monolítico.

#### Scenario: CRUD de visita
- **WHEN** un cliente crea una visita vía PostgREST
- **THEN** la RLS valida tenant y rol, y no existe un endpoint custom para el alta

### Requirement: Claims de tenant en el JWT
El sistema SHALL emitir JWT con `app_metadata.tenant_id` y `app_metadata.rol` en el login, y ninguna política ni RPC SHALL aceptar el tenant desde el cuerpo del request.

#### Scenario: Cliente envía tenant_id en el body
- **WHEN** una RPC recibe `tenant_id` en el payload
- **THEN** lo ignora y usa exclusivamente el claim del JWT autenticado

### Requirement: Errores de negocio con código GC-*
Toda respuesta de error de negocio SHALL incluir un código `GC-<MOD>-NNN` y estructura `{code, message, details?}` mapeable a i18n por el frontend.

#### Scenario: Check-in fuera de ventana
- **WHEN** `visita_checkin` se invoca fuera de la ventana de la actividad
- **THEN** responde error `GC-CORE-001` con estructura estándar

### Requirement: Jobs genéricos parametrizados por tenant
Los jobs programados SHALL ser genéricos y multi-tenant: una corrida pg_cron selecciona los tenants activos y aplica su configuración (módulos, ventanas, plantillas de notificación).

#### Scenario: Job recordatorio_depositos con tenants mixtos
- **WHEN** corre el job en un instante con 3 tenants (2 con módulo depositos, 1 sin él)
- **THEN** solo los 2 tenants con el módulo activo generan notificaciones

### Requirement: Idempotencia en escrituras de campo
Las escrituras de dispositivo y rastreo SHALL ser idempotentes (upsert / `Idempotency-Key` opcional) para tolerar reintentos de red sin duplicar datos.

#### Scenario: Doble envío de batch GPS
- **WHEN** `rastreo-ingesta` recibe dos veces el mismo batch (retry de red)
- **THEN** no se duplican filas en `rastreo_ubicacion`

### Requirement: Alcance jerárquico en API
Toda consulta vía PostgREST o RPC SHALL aplicar el alcance del rol: admin (tenant completo), gerente (subárbol con drill-down por supervisor), supervisor (equipo) y asesor (propios), materializado en RLS y re-verificado en RPC.

#### Scenario: Dashboard gerencial con drill-down
- **WHEN** un gerente invoca `dashboard_gerente(hoy)` sin supervisor
- **THEN** recibe el consolidado de su subárbol
- **WHEN** invoca con `p_supervisor_id` válido de su equipo
- **THEN** recibe los KPIs filtrados a ese supervisor

### Requirement: Transiciones de lead validadas server-side
Las transiciones de estado de lead SHALL validarse en `lead_transicion` (sentido, permisos, motivo en pérdida) y SHALL ser idempotentes en la conversión a persona.

#### Scenario: Asesor intenta retroceder etapa
- **WHEN** un asesor mueve un lead a una etapa anterior
- **THEN** la RPC rechaza con `GC-CRM-001` (requiere supervisor+)

### Requirement: JWT de plataforma separado del JWT de empresa
Los usuarios de plataforma SHALL autenticarse con JWT marcado `{plataforma: true}` sin `tenant_id`, y SHALL estar bloqueados de las apps de campo/empresa; toda operación administrativa pasa por RPC `admin_*` con re-verificación de membresía y auditoría.

#### Scenario: Plataforma intenta leer datos operativos vía PostgREST
- **WHEN** un JWT de plataforma consulta tablas de negocio directamente
- **THEN** la RLS por tenant le deniega el acceso (no tiene `tenant_id` en claims)
