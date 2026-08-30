# Runbook — Android Internal Testing (Gate 4)

App de campo (`@gc/mobile`) en Play Internal Testing. iOS fuera de alcance.

## Artefactos

| Perfil EAS | Salida | Backend |
|---|---|---|
| `preview` | APK | staging (`EXPO_PUBLIC_ENVIRONMENT=staging`) |
| `production` | AAB | producción |

No commitear APK/AAB. `*.apk` / `*.aab` están en `.gitignore`.

## Secrets (GitHub environment `eas-android` + EAS)

- `EXPO_TOKEN`
- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- `EXPO_PUBLIC_SENTRY_DSN` (obligatorio en production)
- `SENTRY_AUTH_TOKEN` (source maps)
- `GOOGLE_SERVICE_ACCOUNT_KEY` (submit Play Internal)

`extra.eas.projectId` vive en `apps/mobile/app.json`. Confirmalo con `eas init` si Expo asigna otro UUID.

## Preview APK

1. Label del PR: `android-preview` → workflow `eas-preview.yml`.
2. Instalá el APK en emulador API 34 o dispositivo.
3. Sin URL/anon key el runtime falla con `GC-CORE-001` (no hay demo).

## AAB Internal

1. Tag `android-*` o `workflow_dispatch` → `eas-internal.yml`.
2. `eas build --platform android --profile production` + `eas submit --platform android --latest`.
3. Track: Internal Testing. No hay `eas submit --platform ios`.

## Checklist manual

1. APK preview en emulador API 34 → apunta a staging.
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

## Expo Doctor

`npx expo-doctor` en `apps/mobile` debe salir 17/17. `typescript` está en `expo.install.exclude` (monorepo 5.5). High de audit en `@expo/cli` / Metro: `docs/ops/expo-audit-exceptions.md`.
