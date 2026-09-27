# Verificación — 2026-09-20

## Resultado local

- Node 22.14.0 y pnpm 9.15.9.
- Instalación `--frozen-lockfile --offline`: pasa.
- Migración incremental SDK 52 → 53 → 54. SDK 52 pasó tipos; su export se
  interrumpió sin resultado. SDK 53 exportó Android: 1156 módulos / 3.95 MB.
- SDK 54.0.37, React 19.1.0, RN 0.81.5 y TypeScript móvil 5.9.
- Expo Doctor: 18/18. `expo install --check`: dependencias alineadas.
- Unitarios: web 129, backoffice 49, móvil 80; todos pasan. El test nuevo
  de micrófono falló antes de configurar `microphonePermission: false`.
- Typecheck de los tres clientes: pasa. Las extensiones de peers de pnpm
  evitan que safe-area-context y React Router resuelvan tipos de otro cliente.
- Contratos: 87/87. Lint: cero errores, tres warnings preexistentes.
- Builds web/backoffice: pasan con variables locales de validación.
- Export Android SDK 54: 1215 módulos, Hermes 2.54 MB y mapa 9.45 MB,
  con `debugId` de Sentry. Este export de comprobación no es un AAB firmado.
- Prebuild Android: pasa; mantiene `com.gc.mobile`, 1.0.0 (1), arquitectura
  nueva y edge-to-edge. El manifiesto bloquea RECORD_AUDIO; mantiene GPS
  foreground/background, cámara, notificaciones y permisos transitorios
  de dependencias. Falta revisar el manifiesto fusionado del artefacto final.
- `eas build:inspect --stage archive`: 620 archivos; excluye `.cursor`,
  `.env`, credenciales, keystores y los directorios nativos generados.

## Servicios

- EAS sigue vinculado al proyecto UUID `f38df0fe-a2df-464e-95c0-98695be71198`.
- Variables EAS production: anon pública de Supabase, DSN Sentry,
  `SENTRY_ORG=gestionescomerciales`, `SENTRY_PROJECT=mobile`.
- Proyecto Sentry React Native `mobile` creado en la organización existente.
  Token org:ci para EAS preparado, pendiente de autorización del propietario.
- Supabase local inició y aplicó las migraciones. No equivale a ejecutar
  pgTAP ni a probar login/sync del dispositivo.

## Límites de publicación

- Sin AAB firmado, revisión de firma/alineación 16 KB ni instalación Play.
- Sin smoke de UI en Android 16; los tests de insets son contratos de código.
- Gradle local con Oracle JDK 17.0.12 falló al abrir una conexión loopback.
  Se está comprobando con el Temurin 17.0.15 instalado y entorno TEMP/TMP limpio.
- La compilación nativa debe demostrar target/compile API 36; la versión
  del SDK por sí sola no acredita el artefacto.
- Pendientes correcciones del piloto offline/GPS, evidencia de consentimiento
  de ubicación, ficha/privacidad/Data safety y usuarios de revisión.
- Play personal reciente: se necesita prueba cerrada de 12 testers durante
  14 días y aprobación de acceso a producción. No está iniciada.

## Audit

`pnpm audit --prod` del workspace reportó cuatro moderadas y dos altas.
Las dos altas son `image-size@1.2.1` transitivo de Metro
(GHSA-w3rx-r6r6-pgpr y GHSA-5p2g-fcmc-qvqq); no aparece en `sources` del
mapa del bundle Android inspeccionado. Aplica la excepción de tooling
existente. Las moderadas corresponden a fast-xml-parser/uuid de tooling
y a React Router web/backoffice. No se declara audit limpio ni se actualiza
React Router de major dentro de esta migración Android.
