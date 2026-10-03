# Capability: frontend — Especificación de requisitos (delta)

## MODIFIED Requirements

### Requirement: Home móvil con resumen de gestión (M-02)
La pantalla inicial de la app móvil SHALL mostrar, sobre la agenda del día,
tarjetas resumen de visitas, sincronización y de cada módulo activo (`crm`,
`solicitudes`, `depositos`), con acceso directo a su pantalla. Las tarjetas
SHALL usar solo tokens de campo: sin rail de color, sin pasteles, sin ilustraciones.

#### Scenario: Asesor con todos los módulos
- **WHEN** un asesor de un tenant con `crm`, `solicitudes` y `depositos` abre la app
- **THEN** ve las tarjetas Visitas, Leads, Solicitudes, Depósitos y Sincronización sobre la lista de visitas de hoy

#### Scenario: Tenant sin módulo crm
- **WHEN** un asesor de un tenant sin `crm` abre la app
- **THEN** no existe la tarjeta Leads

#### Scenario: Tocar una tarjeta
- **WHEN** el asesor toca la tarjeta Leads
- **THEN** la app abre la pestaña Leads

#### Scenario: Progreso de la jornada
- **WHEN** el asesor tiene 5 visitas hoy y 2 completadas o aprobadas
- **THEN** la tarjeta Visitas muestra «2 / 5» y una barra al 40 % con el primario del tenant

#### Scenario: Sin conexión
- **WHEN** el asesor abre la app sin red y tiene 3 mutaciones pendientes en la cola
- **THEN** la tarjeta Sincronización muestra 3 pendientes y las tarjetas que dependen de red muestran «—» con «Sin conexión», nunca 0

#### Scenario: Falla una lectura
- **WHEN** la lectura de leads devuelve error
- **THEN** solo la tarjeta Leads muestra «—» con su código `GC-*`; la agenda y las demás tarjetas cargan

#### Scenario: Accesibilidad
- **WHEN** un lector de pantalla enfoca una tarjeta
- **THEN** anuncia título, valor y destino (`accessibilityLabel`), y el target táctil mide al menos 44 px
