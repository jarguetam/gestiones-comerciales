# Runbook — Android Internal Testing (Gate 4)

App de campo (`@gc/mobile`) en Play Internal Testing. iOS fuera de alcance.

## Artefactos

| Perfil EAS | Salida | Backend |
|---|---|---|
| `preview` | APK | producción (`EXPO_PUBLIC_ENVIRONMENT=production`) |
| `production` | AAB | producción |

No commitear APK/AAB. `*.apk` / `*.aab` están en `.gitignore`.

Desde el 2026-09-20, desarrollo es local y el piloto remoto usa producción.
Los perfiles preview/production seleccionan explícitamente variables EAS
`production`; development selecciona `development`. Ver `environments.md`.

## Estado de la preparación

Todavía no hay cuenta Expo del propietario (confirmado el 2026-09-20), ni build
EAS/instalación Play verificados. El UUID en `app.json` no acredita un proyecto
accesible. Crear cuenta en https://expo.dev/signup y luego verificar acceso con
EAS antes de vincular o sustituir ese identificador. No publicar con keystore debug.

La app sigue en Expo 51/RN 0.74. La migración compatible con API 36 y la
verificación de bibliotecas de 16 KB son una entrega separada. El workflow
`detox-android.yml` actual solo comprueba archivos; no constituye un E2E ejecutado.

## Secrets (GitHub environment `eas-android` + EAS)

- `EXPO_TOKEN`
- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- `EXPO_PUBLIC_SENTRY_DSN` (obligatorio en production)
- `SENTRY_AUTH_TOKEN` (source maps)
- `GOOGLE_SERVICE_ACCOUNT_KEY` (submit Play Internal)

`extra.eas.projectId` vive en `apps/mobile/app.json`. Confirmalo con `eas init` si Expo asigna otro UUID.

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

`npx expo-doctor` en `apps/mobile` debe salir 17/17. `typescript` está en `expo.install.exclude` (monorepo 5.5). High de audit en `@expo/cli` / Metro: `docs/ops/expo-audit-exceptions.md`.
