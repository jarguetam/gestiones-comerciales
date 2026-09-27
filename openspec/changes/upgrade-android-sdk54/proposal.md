# Compatibilidad Android para publicación

## Problema
Expo 51 / RN 0.74 no es la base de publicación Android requerida por el piloto.
Falta validar API objetivo 36, librerías nativas de 16 KB y ejecución real.

## Autorización y alcance
El 2026-09-20 el propietario aprobó continuar con actualización, firma y publicación.
Este cambio técnico implementa la actualización aprobada en `prepare-android-pilot`.
Parte del PR #71 y se revisa separado; no incluye nuevas pantallas de negocio.

## Cambio
- Actualizar incrementalmente SDK 51 → 52 → 53 → 54 y alinear módulos nativos.
- Adaptar APIs y áreas seguras necesarias por React 19 / RN 0.81 / Android 16.
- Validar Doctor, tipos, tests, bundle, prebuild y artefacto Android.
- Conservar paquete `com.gc.mobile`, proyecto Expo y separación local/producción.

## Fuera de alcance
Rediseño, módulos nuevos, migraciones SQL, datos productivos y publicación automática
sin los requisitos de Play. Firma y envío dependen de comprobar la app en Play Console.

## Preguntas de aclaración
- ¿Existe una versión previa en Play? Pendiente; conservar paquete y no sustituir una firma existente.
- ¿Empresa piloto y 12 testers disponibles? Pendiente; usar primero datos sintéticos locales.

## Decisión técnica
SDK 54 es el primer SDK con API 36 por defecto. Limita el salto necesario desde 51;
no se adopta una versión preview. Mantener los defaults soportados y comprobar
cada dependencia en el artefacto, porque la versión del SDK no prueba compatibilidad de 16 KB.

Fuentes: https://expo.dev/changelog/sdk-54 y
https://docs.expo.dev/workflow/upgrading-expo-sdk-walkthrough/.
