# Runbook — Android prueba cerrada (Gate 4)

App de campo (`@gc/mobile`) en prueba cerrada de Play. iOS fuera de alcance.

## Artefactos

| Perfil EAS | Salida | Backend |
|---|---|---|
| `preview` | APK | producción (`EXPO_PUBLIC_ENVIRONMENT=production`) |
| `production` | AAB | producción |
| `verify-aab` | AAB de diagnóstico, sin mapas de Sentry | producción |

No commitear APK/AAB. `*.apk` / `*.aab` están en `.gitignore`.
`verify-aab` permite comprobar la compilación nativa mientras se configura
`SENTRY_AUTH_TOKEN`; no subir ese artefacto a Play. La entrega usa `production`
con mapas de Sentry y el token guardado en EAS.

Desde el 2026-09-20, desarrollo es local y el piloto remoto usa producción.
Los perfiles preview/production seleccionan explícitamente variables EAS
`production`; development selecciona `development`. Ver `environments.md`.

## Estado de la preparación

El propietario creó el proyecto Expo el 2026-09-20:
[jarguetams-team / gestiones-comerciales-3uncfxmscvb2on8csmb7](https://expo.dev/accounts/jarguetams-team/projects/gestiones-comerciales-3uncfxmscvb2on8csmb7).
Vinculado en `app.json` con owner/slug y UUID
`f38df0fe-a2df-464e-95c0-98695be71198`, verificado en el dashboard y con
`eas project:info` autenticado. El AAB firmado de diagnóstico
[`1.0.0 (6)`](../releases/android-1.0.0-6-verify.md) pasó verificación de
firma, alineación de 16 KB y arranque sin sesión en emulador. Todavía no hay
instalación desde Play ni build `production` con mapas de Sentry verificados.
No publicar con keystore debug.

Consulta de solo lectura al Supabase productivo el 2026-09-26: hay 3 tenants
activos y 4 usuarios activos, todos con rol `admin`; no hay asesores,
supervisores ni plantillas de formulario activas. Los catálogos básicos de
visitas tienen datos. Falta crear la jerarquía y una cuenta de asesor para
probar el recorrido móvil, además de una plantilla para el formulario. La
migración de reintento de `visita_completar` está en el
[PR #79](https://github.com/jarguetam/gestiones-comerciales/pull/79) y aún no
figura entre las migraciones aplicadas en producción.

La app usa Expo 54/RN 0.81. La migración y la verificación de bibliotecas de
16 KB se registran en `openspec/changes/upgrade-android-sdk54`. El workflow
`detox-android.yml` actual solo comprueba archivos; no constituye un E2E ejecutado.

## Credenciales y entornos

- GitHub environment `eas-android`: `EXPO_TOKEN` para autenticar EAS CLI en
  los workflows. Crear el entorno y el token de Expo antes de ejecutarlos.
- EAS environment `production`: `EXPO_PUBLIC_SUPABASE_ANON_KEY`,
  `EXPO_PUBLIC_SENTRY_DSN`, `SENTRY_ORG`, `SENTRY_PROJECT` y
  `SENTRY_AUTH_TOKEN` como secreto para subir mapas de Sentry. URL y etiqueta
  de producción están en los perfiles de `eas.json`.
- Credenciales Android del proyecto EAS: cargar una Google Service Account Key
  con acceso a Play Console para `eas submit`. `GOOGLE_SERVICE_ACCOUNT_KEY`
  como variable de GitHub no es el mecanismo documentado de EAS Submit.

El 2026-09-26, `eas-android` no existía y no se encontró `EXPO_TOKEN` entre los
secrets del repositorio ni del environment `production`. `SENTRY_AUTH_TOKEN`
sí existía en el environment de GitHub
`production`, pero faltaba en EAS `production`; un secret del runner no se
transfiere automáticamente al builder remoto. Tampoco se verificó la clave de
servicio de Play en EAS. Los workflows de Android no están listos para correr.

El 2026-11-13 se creó el environment de GitHub `eas-android`, sin reglas de
rama porque `eas-preview.yml` corre en PR (los PR desde forks no reciben
secrets). `EXPO_TOKEN` sigue pendiente: el propietario lo carga con
`gh secret set EXPO_TOKEN --env eas-android`. El estado de EAS (variables
`production` y Service Account Key) no se verificó: no había sesión de Expo
en el equipo.

`extra.eas.projectId` vive en `apps/mobile/app.json`. Desde `apps/mobile`,
`eas project:info` debe resolver al proyecto anterior. No crear otro proyecto.

Las variables de un step de GitHub no sustituyen la configuración del builder
remoto. Configurar clave pública, DSN y credenciales de source maps en el
entorno EAS correspondiente. Ver la [documentación EAS](https://docs.expo.dev/eas/environment-variables/faq/)
y la [guía de EAS Submit](https://docs.expo.dev/submit/android/).
No poner credenciales ni claves de firma en documentos o mensajes del PR.

## Preview APK

1. Label del PR: `android-preview` → workflow `eas-preview.yml`.
2. Instalá el APK en emulador API 34 o dispositivo.
3. Sin URL/anon key el runtime falla con `GC-CORE-001` (no hay demo).

## Publicación en Google Play

`eas-internal.yml` («EAS Android → Google Play») compila el AAB `production`
y lo envía con un perfil de submit explícito
(`--auto-submit-with-profile`): EAS Submit recibe ese build y no otro
`--latest` concurrente. No hay `eas submit --platform ios`.

| Perfil de submit | Track de Play | Release | Uso |
|---|---|---|---|
| `internal` | prueba interna | borrador (`draft`) | primera subida, mientras la app está en borrador en Play |
| `closed` | `alpha` (prueba cerrada) | completado | prueba cerrada de 12 testers / 14 días |

Ningún perfil apunta al track `production`; `eas-config.test.ts` lo impide
mientras no haya acceso a producción.

Elección del perfil:

- `workflow_dispatch`: input `submit_profile`.
- Tag `android-*`: variable `ANDROID_SUBMIT_PROFILE` (del environment
  `eas-android` o del repositorio). Sin variable usa `internal`.

Secuencia de la primera publicación:

1. Credenciales de la sección anterior: `EXPO_TOKEN` en `eas-android`,
   variables EAS `production` y la Service Account Key cargada en EAS
   (`eas credentials --platform android` → Google Service Account).
2. App creada en Play Console con el paquete `com.gc.mobile` (queda fijo).
3. Ejecutar el workflow con `internal`. El AAB queda como borrador en prueba
   interna; revisarlo y desplegarlo desde Play Console. Si Play rechaza la
   firma, la llave de subida registrada no es la de EAS: resolver antes de
   seguir.
4. Completar ficha, Data safety, clasificación de contenido, política,
   declaración de ubicación en segundo plano y acceso del revisor
   (borradores en `docs/releases/`).
5. Crear la prueba cerrada con su lista de testers, promover a ella el release
   de prueba interna y enviarlo a revisión.
6. Tras la primera aprobación, fijar `ANDROID_SUBMIT_PROFILE=closed`. Desde
   ahí cada tag sube a prueba cerrada:

   ```bash
   git tag android-1.0.1 && git push origin android-1.0.1
   ```

Mientras la app está en borrador, la API de Play solo acepta releases en
borrador («Only releases with status draft may be created on draft app»);
por eso `closed` se usa después de la primera aprobación.

EAS incrementa `versionCode` (`appVersionSource: remote` + `autoIncrement`).
El nombre del tag no cambia la versión visible: para eso, actualizar
`version` en `app.json`.

## Checklist manual

1. APK preview apunta a producción → usar únicamente cuentas del tenant piloto.
2. Denegar ubicación → pantalla «Ubicación requerida»; logout ok; agenda/check-in/sync no interactivos.
3. Conceder ubicación → agenda usable; Ajustes muestra «Activo · cada N min» **sin** switch.
4. AAB en prueba cerrada (`eas submit`) solo después de completar la ficha y las declaraciones de Play.
5. `gc://recuperar` abre recuperación de contraseña (sobrevive kill).
6. Logout limpia sesión SecureStore y la partición de cola `${tenantId}:${userId}`.

## Detox

```bash
# Emulador local API 34 (AVD Pixel_API_34)
cd apps/mobile
npx detox test -c android.emu.release
```

CI: `.github/workflows/detox-android.yml` es `workflow_dispatch` (el runner no levanta AVD).

## Cuenta Play personal

El propietario confirmó una cuenta creada después del 13-11-2023. Antes de
solicitar acceso al track público se requiere una **prueba cerrada**, con
**12 testers inscritos continuamente durante al menos 14 días**. La prueba
interna no inicia ese requisito y cumplir los días no garantiza aprobación.
Preparar ficha, Data safety, privacidad, declaración/video de ubicación y
credenciales de revisión antes de enviar la app.

Fuente: [requisitos para cuentas personales](https://support.google.com/googleplay/android-developer/answer/14151465?hl=en).
Checklist de progreso: `openspec/changes/prepare-android-pilot/tasks.md`.

## Expo Doctor

`npx expo-doctor` en `apps/mobile` debe completar todos sus controles (18/18
en la validación de SDK 54). TypeScript móvil usa 5.9 y ya no se excluye del
control de dependencias. Las excepciones históricas de SDK 51 en
`docs/ops/expo-audit-exceptions.md` no acreditan el estado del SDK actual.
