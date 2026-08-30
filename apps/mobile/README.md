# App móvil — Gestiones Comerciales (`@gc/mobile`)

Expo SDK 51 · React Native 0.74 · asesor de campo (offline-first).

## APK de prueba

Build local arm64 contra el proyecto Supabase real. Pedirá email y contraseña de un asesor; no hay modo demo.

1. En el teléfono: Ajustes → Seguridad → permitir instalar apps de fuentes desconocidas.
2. Copiá el APK al teléfono e instalalo. Paquete: `com.gc.mobile`.
3. Abrí **Gestiones Comerciales** e ingresá con tu usuario de campo.

Este APK está firmado con el keystore de debug (no Play Store). Solo incluye ABI `arm64-v8a`.

## Desarrollo

```bash
cp apps/mobile/.env.example apps/mobile/.env
# Completá EXPO_PUBLIC_SUPABASE_ANON_KEY
pnpm --filter @gc/mobile start
```

Sin URL/anon key y con `NODE_ENV !== production` la app entra en **modo demo**.

## Build de producción (EAS)

1. Instalá EAS CLI: `pnpm add -g eas-cli` y `eas login`.
2. `extra.eas.projectId` ya está en `app.json`. Confirmalo con `eas init` en la org Expo (reemplazá el UUID si Expo asigna otro).
3. Secretos (nunca en git):

```bash
eas secret:create --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value "<anon key>"
eas secret:create --name EXPO_PUBLIC_SUPABASE_URL --value "https://xcoeipsnykceorcvjwve.supabase.co"
```

4. Preview interna (APK): `eas build --profile preview --platform android`
5. Producción Android: `eas build --profile production --platform android` (AAB). iOS queda fuera de Gate 4.
6. Store: `eas submit --platform android --profile production` (Play Internal Testing; requiere cuenta Google Play).

## Qué ya cubre el código

- Cola offline persistente (sobrevive kill de la app) por usuario
- Sesión en SecureStore
- Permisos de ubicación / cámara / notificaciones para revisión de tiendas
- Rastreo a nivel de app con toggle y justificación en Ajustes
- Registro de token FCM en `dispositivo`
- Deep links `gestiones://visita|{solicitud}/id`
- Foto de boleta (cámara/galería)

## Pendiente operativo (fuera de este repo)

| Ítem | Por qué bloquea el store |
|---|---|
| `eas init` + projectId | EAS no firma sin proyecto |
| Apple Developer + bundle `com.gc.mobile` | IPA / TestFlight |
| Google Play Console + SHA-1 en Firebase | AAB / FCM |
| Política de privacidad URL | Requisito de ubicación en background |
| `GoogleService-Info.plist` iOS | Push iOS |
| Detox E2E en CI | Smoke login→agenda→check-in |
| Firma canvas real (view-shot) | Módulo solicitudes en campo |
| Biometría de reingreso | Spec M-01 opcional |

Versión de tienda: `1.0.0` (`android.versionCode` / `ios.buildNumber` = 1). EAS production usa `autoIncrement`.
