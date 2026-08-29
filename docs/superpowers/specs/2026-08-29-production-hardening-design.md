# Diseño de hardening y salida a producción

**Estado:** aprobado por el usuario el 2026-08-29.

**Objetivo:** llevar Gestiones Comerciales a una salida controlada de web, backoffice y Android interno, eliminando el modo demo y cerrando los riesgos de seguridad, datos, despliegue y operación detectados en la auditoría.

## Decisiones aprobadas

- Alcance de esta salida: web, backoffice y Android mediante Google Play Internal Testing.
- iOS, PWA, Storybook e internacionalización inglesa quedan fuera.
- El proyecto Supabase actual `xcoeipsnykceorcvjwve` será producción.
- Se creará un proyecto Supabase separado para staging.
- GitHub Pages seguirá alojando web y backoffice de producción.
- Los cambios de base de datos usarán migraciones expand/contract compatibles, sin downtime.
- Android tendrá dos artefactos: APK preview instalable contra staging y AAB firmado contra producción.
- Sentry cubrirá web, backoffice y móvil; Supabase Logs y alertas cubrirán DB y Edge.
- El modo demo y sus datos se eliminarán de las tres aplicaciones.
- El rastreo será obligatorio para asesores cuando el administrador del tenant lo active en `config_rastreo`. El asesor no tendrá interruptor para desactivarlo.
- La ejecución no dependerá de acceso manual del usuario a Supabase. La automatización usará credenciales existentes en GitHub y comprobará sus permisos antes de realizar cambios.

## Arquitectura de promoción

Un mismo commit avanzará por tres niveles:

1. **Pull request:** controles deterministas sin tocar servicios remotos.
2. **Staging tras merge a `main`:** migración, Edge y pruebas reales automáticas sobre un proyecto Supabase aislado.
3. **Producción:** promoción manual del commit verificado, protegida por GitHub Environment y probes posteriores.

GitHub Pages alojará solamente producción. Las pruebas de staging levantarán Vite en CI contra Supabase staging. El APK preview se conectará exclusivamente a staging; el AAB se conectará exclusivamente a producción.

Ningún despliegue degradará a demo ni continuará si faltan credenciales. Una configuración incompleta será un error de build o de arranque claramente visible.

## Programa por gates

### Gate 0 — Inventario, acceso y línea base

Antes de mutar entornos:

- Confirmar mediante preflight que los secretos de GitHub permiten consultar el proyecto actual, listar/aplicar migraciones, desplegar Edge y crear o administrar staging.
- Inventariar sin exponer valores: referencias de proyecto, migraciones remotas, Edge desplegadas, Auth hooks, URLs permitidas, buckets, cron jobs y secretos requeridos.
- Comparar las 26 migraciones versionadas con producción y detener la promoción ante cualquier drift.
- Registrar el commit, versiones de Node, pnpm, Deno, Supabase CLI, Expo y EAS que forman la línea base.
- Conservar una exportación del estado operativo previo: lista de migraciones, funciones, cron y configuración no secreta.

Si el token existente no puede crear proyectos, la automatización debe fallar con el permiso exacto que falta. No debe pedir al usuario operar el Dashboard; deberá aceptar una credencial reemplazada por un administrador de la organización a través de GitHub Secrets.

### Gate 1 — Contención de seguridad

Este gate se despliega antes de ampliar el uso real.

#### Secretos e integraciones

- Sacar `webhook_secret` de `tenant.configuracion`, porque esa columna es legible por usuarios del tenant.
- Guardar secretos HMAC en Supabase Vault o en una tabla privada no expuesta a PostgREST.
- Exponer únicamente RPCs auditadas para consultar si existe un secreto y para rotarlo.
- Rotar todos los secretos HMAC existentes después de desplegar el nuevo almacenamiento.
- Restringir la API key Firebase a las APIs y aplicaciones Android requeridas.

#### Autorización antes de efectos con `service_role`

- En `invitar-usuario`, validar primero identidad, rol, tenant y AAL2; crear el usuario Auth sólo después.
- Si el alta de perfil falla tras crear Auth, eliminar inmediatamente el usuario recién creado y registrar la operación fallida.
- En `importer`, comprobar autorización antes de subir archivos con `service_role`.
- Rechazar tenant IDs que no correspondan al actor y evitar objetos huérfanos si falla la importación.
- Eliminar el fallback `service_role` de `pdf-solicitud`; un fallo RLS será un error cerrado y observable.
- Restringir `push-notifications` a `service_role` o a roles explícitamente autorizados, sin confiar en claims decodificados manualmente.

#### Frontera de base de datos

- Revocar a `authenticated` la ejecución de `seed_solicitud_estados(uuid)` y cualquier otra función `SECURITY DEFINER` interna.
- Impedir UPDATE directos de estados en depósitos, solicitudes, leads y demás máquinas de estado.
- Mantener las transiciones exclusivamente en RPCs transaccionales auditadas.
- Añadir triggers defensivos o privilegios de columna para que PostgREST no pueda saltarse reglas `GC-*`.
- Migrar RLS, RPCs y Storage de claims raíz a `tenant_id_actual()` y `rol_actual()`.
- Verificar el Auth hook de claims en staging y producción, manteniendo compatibilidad durante la transición expand/contract.
- Generar y versionar tipos Supabase para web, backoffice y contratos compartidos relevantes.

#### Autenticación y superficie cliente

- Exigir AAL2 a usuarios de plataforma antes de entrar al backoffice y también en RPCs sensibles.
- Rechazar inmediatamente en backoffice cualquier sesión que no pertenezca a `usuario_plataforma`.
- Proteger por rol todas las rutas administrativas de web, no sólo los elementos de navegación.
- Integrar revocación/expiración de sesión en móvil mediante `onAuthStateChange`.
- Añadir recuperación de contraseña segura para las superficies que autentican usuarios.
- Implementar rate limiting efectivo: registrar intentos, incluir IP normalizada, bloquear después del umbral y probar el 429.
- Declarar `verify_jwt` explícitamente para cada Edge Function.
- Sustituir CORS `*` por una allowlist cerrada de los orígenes autorizados; una variable ausente debe fallar cerrado.

### Gate 2 — Entornos, migraciones y CI/CD

#### Entornos

- Crear Supabase staging en la misma región y con la misma versión mayor de PostgreSQL que producción.
- Configurar secretos separados por GitHub Environment: staging y production.
- Sustituir referencias de proyecto hardcodeadas por variables de entorno protegidas.
- Configurar en ambos proyectos Auth URLs, redirect allowlist, custom access-token hook, SMTP, Edge secrets, Storage y cron.
- Usar datos sintéticos en staging; nunca copiar PII de producción.

#### Pipeline de pull request

Cada PR ejecutará:

- instalación con lockfile congelado;
- lint de las tres apps;
- typecheck de todo el workspace;
- pruebas unitarias web, backoffice y móvil;
- `deno fmt --check`, `deno lint`, `deno check` y tests Edge;
- Supabase local desde cero, todas las migraciones, seeds de prueba y pgTAP;
- builds web/backoffice y validación estática de configuración EAS;
- Playwright y axe sin backend remoto;
- gitleaks, auditoría de dependencias y análisis de funciones `SECURITY DEFINER`.

Node tendrá una única versión fijada en CI y desarrollo. Las acciones tendrán permisos mínimos por job. El pipeline no modificará el lockfile.

#### Pipeline de staging

Tras merge a `main`:

- aplicar migraciones pendientes a staging;
- desplegar todas las Edge Functions;
- ejecutar pgTAP sobre staging;
- sembrar tenants y usuarios sintéticos de prueba;
- ejecutar E2E reales, pruebas de autorización negativas y probes de funciones;
- generar un APK preview conectado a staging;
- publicar reportes y artefactos con el SHA del commit.

#### Promoción a producción

Un workflow manual aceptará únicamente un SHA que haya pasado staging:

- comprobar backup/PITR y estado saludable previo;
- ejecutar preflight y migraciones expand/contract;
- desplegar Edge y verificar sus versiones;
- construir Pages con variables de producción;
- comprobar que no existen símbolos, botones ni datos demo en el bundle;
- desplegar Pages;
- ejecutar smoke tests no destructivos;
- generar el AAB de producción y enviarlo a Play Internal Testing;
- registrar release, commit, migraciones y artefactos.

La ausencia de cualquier secret, migración, función o probe será un fallo. No se utilizarán warnings para continuar una promoción incompleta.

### Gate 3 — Runtime web y backoffice

#### Eliminación del demo

- Eliminar estado global `DEMO_MODE`, sesiones demo y botones de acceso sin autenticación.
- Eliminar datos ficticios y ramas de persistencia simulada de web, backoffice y móvil.
- Sustituir fixtures runtime por fixtures exclusivas de tests.
- Ante error de sesión, red, RLS o carga de dominio, mostrar error, código `GC-*`, reintento y soporte; nunca sustituir datos reales por datos de muestra.
- Hacer que el build falle si faltan URL, anon key, entorno, release o DSN requeridos.

#### Resiliencia y observabilidad

- Añadir Error Boundaries a web y backoffice, y un boundary equivalente en React Native.
- Reportar errores no controlados a Sentry con release y environment, sin contraseñas, tokens, documentos, coordenadas ni payloads sensibles.
- Añadir estados coherentes de carga, vacío, error y reintento.
- Mostrar conectividad y deshabilitar operaciones no seguras cuando la web esté offline.

#### Calidad y rendimiento

- Cargar rutas y módulos pesados de forma diferida, especialmente Leaflet y mapa.
- Definir presupuestos de bundle y fallar CI ante regresiones significativas.
- Corregir labels, controles sin nombre accesible, foco de diálogos, cancelación de pointer en firma y cobertura axe de todas las rutas.
- Reemplazar colores hardcodeados del mapa por tokens de branding.
- Endurecer la CSP compatible con GitHub Pages, eliminando `unsafe-inline` de scripts y documentando que Pages no permite configurar todos los headers desde el repositorio.
- Resolver los hallazgos React confirmados; no cambiar código por falsos positivos del scanner.
- Alinear variables `.env.example`, scripts de paquetes y documentación con las variables realmente consumidas.

### Gate 4 — Android interno

#### Build y distribución

- Inicializar y fijar el proyecto EAS.
- Configurar credenciales de firma administradas por EAS.
- Perfil `preview`: APK instalable, staging, distribución interna y nombre visual inequívoco.
- Perfil `production`: AAB, producción, auto-incremento y submit a Play Internal Testing.
- Incluir un chequeo de runtime que impida iniciar un build sin URL/anon key correctas para su entorno.
- Ejecutar Expo Doctor y alinear todas las dependencias con un SDK soportado antes del primer AAB.
- Resolver vulnerabilidades de dependencias o documentar una excepción limitada a tooling que no llegue al artefacto.
- Quitar APK/AAB del control de versiones, mantenerlos ignorados y publicarlos como artefactos de CI o releases.

#### Rastreo obligatorio administrado

- El administrador controla días, ventana, intervalo, precisión y activación mediante `config_rastreo`.
- El asesor no verá un interruptor para apagar el rastreo.
- Android solicitará foreground y background location con explicación previa y enlace a privacidad.
- El servicio usará `TaskManager`/background location nativo, no `setInterval`.
- La captura respetará estrictamente la ventana del tenant y conservará una cola durable ante falta de red.
- Si el usuario revoca permisos desde Android, la app lo detectará al iniciar, volver a foreground y antes de operaciones de campo.
- Mientras falten permisos obligatorios, bloqueará agenda operativa, check-in, formularios asociados y sincronización de campo; permitirá únicamente cerrar sesión, leer la explicación y abrir ajustes del sistema.
- Cada bloqueo y restauración de permisos será observable y auditable sin almacenar coordenadas en Sentry.
- Detox cubrirá permiso concedido, denegado, revocado, restaurado, background, reinicio y reenvío de cola.

#### Sesión, push y datos locales

- Limpiar de forma segura sesión, cola y cachés al cerrar sesión o revocar la cuenta.
- Verificar que la cola esté particionada por usuario/tenant y cifrada donde aplique.
- Registrar y rotar tokens FCM; desactivar tokens inválidos.
- Probar deep links, notificaciones, persistencia tras kill y actualizaciones desde Play Internal Testing.

### Gate 5 — Observabilidad, privacidad y operación

#### Sentry y logs

- Integrar proyectos Sentry separados por aplicación y environment.
- Propagar `request_id` desde clientes a Edge/RPC y devolverlo en errores.
- Añadir release, commit, función y tenant pseudonimizado a logs; excluir PII y secretos.
- Correlacionar Sentry con Supabase Logs mediante `request_id`.

#### Alertas y objetivos

- Alertar por error rate Edge, p95, login bloqueado, fallos de sync, colas agotadas, FCM, cron ausente, drift de migraciones y probes fallidos.
- Mantener los objetivos documentados: disponibilidad 99.5%, RTO 4 h, RPO 1 h y límites p95 definidos en las specs.
- Añadir panel operativo para releases, errores, cron, almacenamiento y tenants afectados.

#### Datos y continuidad

- Habilitar y verificar PITR con retención mínima de siete días.
- Ejecutar y documentar un restore drill en staging.
- Implementar purga de `rastreo_ubicacion` mayor a 180 días.
- Implementar compactación/retención anual de auditoría sin romper obligaciones legales.
- Verificar buckets privados, tipos y tamaños permitidos, URLs firmadas y políticas por tenant.

#### Privacidad y runbooks

- Publicar política de privacidad accesible desde login y ajustes.
- Documentar finalidad, base de tratamiento, obligatoriedad, horario, retención y acceso a ubicación.
- Proporcionar el procedimiento administrativo para suspender rastreo mediante `config_rastreo`.
- Configurar SMTP de Supabase para recuperación e invitaciones. El `emailer` genérico descrito en la spec se retirará del alcance v1 y la documentación se corregirá para no prometer una función inexistente.
- Crear runbooks de despliegue, rollback, incidente, restauración, rotación de secretos, baja de usuario, pérdida de dispositivo, fallo de FCM y cron.
- Añadir `SECURITY.md`, `CODEOWNERS` y actualizaciones automatizadas de dependencias.
- Actualizar README, specs y estado de migraciones para eliminar afirmaciones desfasadas.

### Gate 6 — Aceptación y go-live

La promoción final requerirá:

- CI completa verde en el SHA candidato.
- Staging migrado desde cero y desde la versión productiva anterior.
- pgTAP verde para cada tabla y rol relevante.
- Pruebas negativas de cross-tenant, UPDATE de estados, funciones definer, invitaciones, importaciones, Storage y push.
- E2E real de login, MFA, visita, formulario, notificación, backoffice y administración.
- Detox verde en dispositivo/emulador Android para sesión, offline, rastreo y permisos.
- Presupuestos de rendimiento y bundle aceptados.
- Probes verdes de las ocho Edge Functions, cron y Pages.
- PITR verificado y restore drill documentado.
- Política de privacidad publicada.
- APK preview validado y AAB aceptado por Play Internal Testing.
- Smoke productivo posterior sin escrituras destructivas.

## Manejo de fallos y rollback

- Un fallo antes de promoción detiene el workflow sin tocar producción.
- Un fallo de migración expand detiene Edge y frontend nuevos; la versión anterior sigue siendo compatible.
- Los cambios contract se ejecutan en una release posterior, sólo después de comprobar que ningún cliente antiguo usa el contrato retirado.
- Un fallo de frontend revierte Pages al artefacto versionado anterior.
- Un fallo de Edge redepliega la versión registrada anterior.
- Un fallo móvil detiene la promoción en Play Internal Testing; no se amplía el grupo de testers.
- Los secretos comprometidos se rotan; no se restauran valores anteriores.

## Definición de terminado

El programa estará terminado cuando:

1. Ningún cliente pueda entrar sin sesión ni recibir datos demo.
2. Ninguna operación `service_role` ocurra antes de autorización.
3. Las máquinas de estado no puedan evadirse mediante PostgREST.
4. Staging y producción estén aislados y sus configuraciones se validen automáticamente.
5. Todas las migraciones y pruebas RLS se ejecuten en CI.
6. Backoffice exija usuario de plataforma y AAL2.
7. Web/backoffice reporten fallos sin pantallas blancas.
8. El rastreo Android sea durable, obligatorio para asesores cuando esté activo y administrable sólo por el tenant.
9. APK preview y AAB de Play Internal Testing provengan del mismo SHA verificado.
10. Sentry, alertas, retención, PITR y runbooks estén activos y ensayados.
11. La documentación describa el estado real.

## Fuera de alcance

- Aplicación y distribución iOS.
- PWA o service worker para web.
- Storybook/Chromatic.
- Traducción completa al inglés.
- Sustitución de GitHub Pages por otro hosting.
- Reescritura histórica destructiva de Git para borrar APKs antiguos.
- Nuevos módulos o capacidades de negocio no requeridos por el hardening.
