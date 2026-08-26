# Capability: frontend — Especificación de requisitos (delta)

## ADDED Requirements

### Requirement: Theming runtime multi-tenant
La UI SHALL aplicar branding (logo, colores, nombre comercial, vocabulario de entidades) leído de `tenant.branding` en el boot, sin rebuild ni variables de build por cliente.

#### Scenario: Dos rubros, un deploy
- **WHEN** dos usuarios de tenants distintos inician sesión sobre el mismo deploy
- **THEN** cada uno ve el branding y vocabulario de su tenant

### Requirement: Pantallas condicionadas por módulo
El routing SHALL filtrar pantallas de módulos según `tenant_modulo`; un tenant sin módulo no ve sus rutas, navegación ni accesos.

#### Scenario: Tenant sin módulo creditos
- **WHEN** un usuario de tenant sin `creditos` navega
- **THEN** no existen rutas ni menús de cuentas/movimientos

### Requirement: Formularios server-driven
Los formularios de captura SHALL renderizarse desde `formulario_plantilla.esquema` con un renderer único, sin formularios compilados por rubro.

#### Scenario: Nueva plantilla sin release
- **WHEN** un admin crea una nueva plantilla de formulario para su tenant
- **THEN** la app la renderiza sin actualizar binarios

### Requirement: Offline-first móvil
La app móvil SHALL operar la jornada completa sin conexión mediante cola local con estados `pendiente|enviado|error` y sincronización en background con backoff, sin pérdida de datos capturados.

#### Scenario: Jornada sin cobertura
- **WHEN** el asesor completa visitas sin señal
- **THEN** todo queda encolado localmente y se sincroniza al recuperar red

### Requirement: Tipos generados desde el schema
Los clientes SHALL usar tipos TypeScript generados desde el schema de la base (`supabase gen types`), regenerados en CI al cambiar migraciones.

#### Scenario: Migración agrega columna
- **WHEN** una migración agrega una columna a `persona`
- **THEN** CI regenera tipos y falla si el cliente no se actualiza

### Requirement: Pipeline CRM server-driven
La pantalla de pipeline (W-15) SHALL construir sus columnas desde `lead_estado` del tenant (orden configurable) y operar transiciones vía RPC con reversión visual en error.

#### Scenario: Rubro con embudo distinto
- **WHEN** un tenant define 5 etapas y otro 8
- **THEN** ambos renderizan su pipeline sin cambios de código

### Requirement: Conexión CRM→Gestiones en la navegación
Desde el detalle de lead SHALL poder agendarse una visita (creación de `visita` ligada) y convertirse el lead (navegación a la persona/solicitud creada); la ficha de persona SHALL mostrar el origen del lead.

#### Scenario: Lead calificado agenda visita
- **WHEN** el asesor agenda visita desde W-16/M-12
- **THEN** se crea una visita en estado pendiente para su agenda y el lead registra la actividad

### Requirement: Backoffice de plataforma como app separada
La plataforma SHALL operarse desde `apps/backoffice` (P-01..P-06: empresas, detalle, usuarios, catálogos globales, salud) con MFA obligatorio, sin mezclarse con la app de empresa; el admin de empresa gestiona TODO su alcance (clientes, usuarios, catálogos, georeferencia) desde `apps/web`.

#### Scenario: Soporte de plataforma inspecciona una empresa
- **WHEN** un usuario de plataforma con membresía 'soporte' abre el detalle de una empresa (P-03)
- **THEN** ve configuración y salud, y toda acción queda auditada
- **AND** no ve datos operativos de las apps de campo salvo lectura de soporte
