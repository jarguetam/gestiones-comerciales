# Runbook — Android Internal Testing (Gate 4)

App de campo (`@gc/mobile`) en Play Internal Testing. iOS fuera de alcance.

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
`eas project:info` autenticado. No hay build EAS ni instalación Play verificados.
No publicar con keystore debug.

La app usa Expo 54/RN 0.81. La migración y la verificación de bibliotecas de
16 KB se registran en `openspec/changes/upgrade-android-sdk54`. El workflow
`detox-android.yml` actual solo comprueba archivos; no constituye un E2E ejecutado.

## Secrets (GitHub environment `eas-android` + EAS)

- `EXPO_TOKEN`
- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- `EXPO_PUBLIC_SENTRY_DSN` (obligatorio en production)
- `SENTRY_AUTH_TOKEN` (source maps)
- `GOOGLE_SERVICE_ACCOUNT_KEY` (submit Play Internal)

`extra.eas.projectId` vive en `apps/mobile/app.json`. Desde `apps/mobile`,
`eas project:info` debe resolver al proyecto anterior. No crear otro proyecto.

Las variables de un step de GitHub no sustituyen la configuración del builder
remoto. Configurar URL, clave pública, DSN y credenciales de source maps en el
entorno EAS correspondiente. Ver la [documentación EAS](https://docs.expo.dev/eas/environment-variables/).
No poner credenciales ni claves de firma en documentos o mensajes del PR.

## Preview APK

1. Label del PR: `android-preview` → workflow `eas-preview.yml`.
2. Instalá el APK en emulador API 34 o dispositivo.
3. Sin URL/anon key el runtime falla con `GC-CORE-001` (no hay demo).

## AAB Internal

1. Tag `android-*` o `workflow_dispatch` → `eas-internal.yml`.
2. `eas build --platform android --profile production` + `eas submit --platform android --latest`.
3. Track: Internal Testing. No hay `eas submit --platform ios`.

## Checklist manual

1. APK preview apunta a producción → usar únicamente cuentas del tenant piloto.
2. Denegar ubicación → pantalla «Ubicación requerida»; logout ok; agenda/check-in/sync no interactivos.
3. Conceder ubicación → agenda usable; Ajustes muestra «Activo · cada N min» **sin** switch.
4. AAB Internal (`eas submit`) o dry-run si Play aún no está configurado (Gate 0).
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
