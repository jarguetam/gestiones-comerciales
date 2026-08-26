# Capability: db — Especificación de requisitos (delta)

## ADDED Requirements

### Requirement: Multi-tenancy estricto por tenant_id + RLS
El sistema SHALL aislar los datos de cada tenant mediante columna `tenant_id` y políticas RLS basadas en claims del JWT (`tenant_id`, `rol`), de modo que ningún query autenticado pueda leer ni escribir datos de otro tenant.

#### Scenario: Agente consulta visitas de tenant ajeno
- **WHEN** un asesor autenticado consulta `visita` con un JWT cuyo `tenant_id` es A
- **THEN** solo obtiene filas cuyo `tenant_id` = A y cuya visibilidad corresponda a su rol
- **AND** nunca filas de tenant B

### Requirement: Núcleo + módulos optativos por tenant
El sistema SHALL mantener un núcleo rubro-agnóstico siempre activo y módulos optativos (`creditos`, `solicitudes`, `depositos`, `kilometraje`) activables por tenant mediante `tenant_modulo`, cuya RLS verifica `modulo_activo(tenant, codigo)`.

#### Scenario: Tenant sin módulo creditos
- **WHEN** un usuario de un tenant sin `creditos` activo consulta `cuenta`
- **THEN** la política RLS deniega el acceso aunque el JWT sea válido

### Requirement: Formularios dinámicos validados por esquema
El sistema SHALL almacenar plantillas de formularios como JSON Schema (`formulario_plantilla.esquema`) y respuestas JSONB (`formulario_respuesta.respuestas`) validadas server-side contra el esquema correspondiente, con resultado/score calculado por `plantilla.calculo`.

#### Scenario: Respuesta inválida contra el esquema
- **WHEN** `formulario_enviar` recibe respuestas que violan el esquema de la plantilla
- **THEN** la RPC rechaza con error `GC-FORM-001` y no persiste la respuesta

### Requirement: Configuración de rastreo por tenant
El sistema SHALL definir ventanas horarias, intervalo y precisión máxima de rastreo como datos (`config_rastreo`) por tenant y día de semana, sin requerir cambios de código para modificarlos.

#### Scenario: Tenant cambia ventana de rastreo
- **WHEN** un admin actualiza `config_rastreo` para un día
- **THEN** los dispositivos de campo respetan la nueva ventana sin reinstalar la app

### Requirement: Jerarquía comercial de 4 roles
El sistema SHALL soportar los roles `admin`, `gerente`, `supervisor` y `asesor`, con jerarquía auto-referida `asesor→supervisor→gerente` (`jefe_id`), validada por trigger (sin ciclos ni saltos de nivel), y alcance de datos resuelto por el subárbol recursivo `subordinados()`.

#### Scenario: Gerente consulta resultados de asesores indirectos
- **WHEN** un gerente consulta visitas o dashboards
- **THEN** ve los datos de sus supervisores y de todos los asesores de su subárbol
- **AND** un asesor ajeno a su subárbol le es invisible

#### Scenario: Asignación inválida de jefe
- **WHEN** se intenta asignar un asesor con jefe de rol asesor, o se crea un ciclo
- **THEN** la base rechaza la escritura con error `GC-CORE-010`

### Requirement: Módulo CRM con embudo configurable
El sistema SHALL implementar el módulo `crm` con etapas de embudo como datos (`lead_estado`: orden, ganado, perdido), historial de transiciones (`lead_actividad`) y reglas de transición verificadas en RPC, con conversión idempotente de lead ganado a `persona`.

#### Scenario: Lead ganado se convierte una sola vez
- **WHEN** `lead_transicion` lleva un lead a un estado `es_ganado`
- **THEN** se crea (o reutiliza por documento/teléfono) la `persona` y se registra `persona_id` + `convertido_en`
- **AND** reintentos posteriores no duplican la persona ni alteran el lead

### Requirement: Capa de plataforma (backoffice global)
El sistema SHALL soportar usuarios de plataforma (`usuario_plataforma`, con alcance a N empresas vía `usuario_plataforma_tenant`) que administran tenants, módulos y usuarios de empresa exclusivamente mediante RPC administrativas `security definer` con verificación de membresía y auditoría, sin relajar la RLS de las tablas de negocio.

#### Scenario: Usuario de plataforma sin membresía intenta operar
- **WHEN** un usuario de plataforma sin asignación al tenant X (y sin `es_superadmin`) invoca `admin_tenant_actualizar(X, ...)`
- **THEN** la RPC rechaza la operación y queda auditada

#### Scenario: Alta de empresa completa
- **WHEN** la plataforma invoca `admin_tenant_crear` con nombre, rubro, plan y branding
- **THEN** se crean tenant, tenant_modulo y seeds iniciales en una sola transacción
