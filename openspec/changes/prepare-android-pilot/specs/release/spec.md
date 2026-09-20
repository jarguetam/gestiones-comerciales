# Capability: release — Piloto Android

## ADDED Requirements

### Requirement: Desarrollo local aislado
Los tres clientes SHALL rechazar un backend público cuando el entorno sea local.
El móvil SHALL aceptar localhost, loopback de emulador y direcciones IPv4 privadas
para acceder a Supabase local. Una URL con usuario, query o fragmento no es un
endpoint válido. La configuración ausente o incompatible falla con GC-CORE-001.

#### Scenario: Desarrollo local intenta usar producción
- **WHEN** un cliente usa entorno local y una URL pública de Supabase
- **THEN** falla antes de crear el cliente o iniciar peticiones al backend

#### Scenario: Android usa Supabase del equipo de desarrollo
- **WHEN** el entorno es local y la URL usa 10.0.2.2:54321 o una IPv4 privada de la LAN
- **THEN** se permite conectar con la clave pública del Supabase local

#### Scenario: Distribución usa un endpoint local por error
- **WHEN** el entorno es production y la URL apunta a localhost o una IPv4 privada
- **THEN** falla con GC-CORE-001

### Requirement: Identidad de entorno en EAS
El perfil development SHALL seleccionar variables development y entorno de app
local. Los perfiles preview y production SHALL seleccionar variables production
y reportar entorno de app production. Preview produce APK; production produce AAB.

#### Scenario: APK de piloto
- **WHEN** se compila preview contra el proyecto productivo
- **THEN** el perfil y la telemetría lo identifican como production, nunca staging

### Requirement: Staging remoto optativo
Los jobs de despliegue, E2E y backup de staging SHALL omitir su ejecución salvo
que la variable de repositorio ENABLE_STAGING sea exactamente true. La entrega
no redirige pruebas sintéticas ni backups de staging a producción.

#### Scenario: Solo hay local y producción
- **WHEN** ENABLE_STAGING no está definido
- **THEN** los tres jobs remotos de staging se omiten y el CI local sigue activo

### Requirement: Evidencia del piloto
La aceptación SHALL registrar SHA, versión Android, dispositivo, perfil EAS y
resultado del recorrido login → agenda → check-in/formulario sin conexión →
reinicio → sincronización sin duplicados → revisión web, incluyendo denegación
de ubicación, cierre de sesión y aislamiento entre usuarios/tenants.

#### Scenario: Pipeline comprueba solamente archivos Detox
- **WHEN** no se ha instalado y ejecutado el binario en Android
- **THEN** la prueba de dispositivo permanece pendiente
