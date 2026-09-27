# App móvil — Gestiones Comerciales (`@gc/mobile`)

Expo SDK 51 · React Native 0.74 · asesor de campo (offline-first).

## APK de prueba

Build local arm64 contra el proyecto Supabase real. Pedirá email y contraseña de un asesor; no hay modo demo.

1. En el teléfono: Ajustes → Seguridad → permitir instalar apps de fuentes desconocidas.
2. Copiá el APK al teléfono e instalalo. Paquete: `com.gc.mobile`.
3. Abrí **Gestiones Comerciales** e ingresá con tu usuario de campo.

Este APK está firmado con el keystore de debug (no Play Store). Solo incluye ABI `arm64-v8a`.

## Desarrollo

El backend de desarrollo es Supabase **local**. El `.env.example` usa
`http://10.0.2.2:54321` para Android Emulator; en un teléfono físico usar la IPv4
LAN del equipo. Copiar la clave pública de `supabase status`, no la de producción.
Con `EXPO_PUBLIC_ENVIRONMENT=local`, una URL pública falla con `GC-CORE-001`.

```bash
cp apps/mobile/.env.example apps/mobile/.env
# Completá EXPO_PUBLIC_SUPABASE_ANON_KEY
pnpm --filter @gc/mobile start
```

Sin URL/anon key reales la app no arranca (`GC-CORE-001`). No hay modo demo.

## Build de producción (EAS)

1. Instalá EAS CLI: `pnpm add -g eas-cli` y `eas login`.
2. Desde `apps/mobile`, verificá con `eas project:info` el proyecto ya vinculado: `@jarguetams-team/gestiones-comerciales-3uncfxmscvb2on8csmb7`.
3. Secretos (nunca en git):

```bash
eas secret:create --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value "<anon key>"
eas secret:create --name EXPO_PUBLIC_SUPABASE_URL --value "https://xcoeipsnykceorcvjwve.supabase.co"
```

4. Preview interna (APK, **backend productivo**): `eas build --profile preview --platform android`
5. Producción Android: `eas build --profile production --platform android` (AAB). iOS queda fuera de Gate 4.
6. Store: `eas submit --platform android --profile production` (Play Internal Testing; requiere cuenta Google Play).

Estos son pasos operativos pendientes, no evidencia de publicación. El propietario
ya creó el proyecto Expo en `jarguetams-team`; su UUID y acceso están verificados
y vinculados en `app.json`. Los perfiles preview/production seleccionan variables EAS `production`
y requieren DSN. Ver `docs/runbooks/android-internal.md` para el estado del piloto
y la actualización Android necesaria antes de generar el AAB.

## Qué ya cubre el código

- Cola offline persistente (sobrevive kill de la app) por usuario
- Sesión en SecureStore
- Permisos de ubicación / cámara / notificaciones para revisión de tiendas
- Rastreo a nivel de app (el asesor no puede apagarlo; intervalo en `config_rastreo`)
- Registro de token FCM en `dispositivo`
- Deep links `gestiones://visita|{solicitud}/id`
- Foto de boleta (cámara/galería)

## Pendiente operativo (fuera de este repo)

| Ítem | Por qué bloquea el store |
|---|---|
| Credenciales de firma EAS | Proyecto vinculado; firma Android aún pendiente |
| Apple Developer + bundle `com.gc.mobile` | IPA / TestFlight |
| Google Play Console + SHA-1 en Firebase | AAB / FCM |
| Política de privacidad URL | Requisito de ubicación en background |
| `GoogleService-Info.plist` iOS | Push iOS |
| Detox E2E en CI | Smoke login→agenda→check-in |
| Firma canvas real (view-shot) | Módulo solicitudes en campo |
| Biometría de reingreso | Spec M-01 opcional |

Versión de tienda: `1.0.0` (`android.versionCode` / `ios.buildNumber` = 1). EAS production usa `autoIncrement`.
