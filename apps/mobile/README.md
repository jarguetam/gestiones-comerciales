# App móvil — Gestiones Comerciales (`@gc/mobile`)

App de campo con Expo SDK 54 y React Native 0.81. Usa el mismo Supabase que
web y backoffice, con RLS y RPC para las reglas de negocio. No tiene modo demo.

## Entornos

- **Desarrollo:** Supabase local. El emulador Android llega al equipo por
  `http://10.0.2.2:54321`; en un teléfono físico se usa la IPv4 LAN del equipo.
  Copiar `apps/mobile/.env.example` a un `.env` local y completar únicamente
  la clave pública de Supabase local. Nunca versionar ese archivo.
- **Piloto y Play:** Supabase remoto productivo. Los perfiles EAS `preview`,
  `production` y `verify-aab` seleccionan ese entorno. Sin URL y clave pública
  válidas, la app falla con `GC-CORE-001`.

Para iniciar Metro: `pnpm --filter @gc/mobile start`. La guía de variables
y aislamiento está en [entornos](../../docs/runbooks/environments.md).

## Estado de Android

El proyecto EAS ya está vinculado a
[`@jarguetams-team/gestiones-comerciales-3uncfxmscvb2on8csmb7`](https://expo.dev/accounts/jarguetams-team/projects/gestiones-comerciales-3uncfxmscvb2on8csmb7).
Existe un [AAB firmado de diagnóstico 1.0.0 (6)](../../docs/releases/android-1.0.0-6-verify.md):
pasó validación de firma, alineación de 16 KB y arranque sin sesión en Android
15. El perfil `verify-aab` omite la subida de mapas de Sentry; ese artefacto
no es la entrega final de Play.

La entrega requiere un build EAS `production` con `SENTRY_AUTH_TOKEN` en el
entorno EAS, instalación desde Play y pruebas con una cuenta real del tenant
piloto. La cuenta personal de Play confirmada por el propietario necesita una
prueba cerrada con 12 testers inscritos continuamente al menos 14 días antes
de solicitar acceso a producción. Ver
[runbook de Android](../../docs/runbooks/android-internal.md) y
[requisitos de Google](https://support.google.com/googleplay/android-developer/answer/14151465?hl=es).

## Funciones y límites del piloto

El núcleo permite iniciar sesión, consultar agenda, registrar visitas,
check-in con ubicación, completar visitas, enviar formularios y sincronizar
operaciones pendientes. Los módulos opcionales dependen del tenant.
`Solicitudes` aún usa un adjunto y una firma ficticios; `Depósitos` no sube
la foto de la boleta. No activar esos flujos en el piloto como si estuvieran
terminados. Ver [auditoría de datos para Play](../../docs/releases/play-data-safety-audit.md).

La ficha, privacidad, declaraciones de ubicación y acceso del revisor están
preparados como borradores en [`docs/releases`](../../docs/releases/).
Faltan datos del publicador y verificación del backend productivo antes de
presentarlos a Google.
