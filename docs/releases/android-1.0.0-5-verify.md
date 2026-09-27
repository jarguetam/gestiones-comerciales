# Android 1.0.0 (5) — verificación de Sentry

Build firmado de diagnóstico desde la rama de corrección de Sentry. El perfil
`verify-aab` usa el backend productivo y omite la subida de mapas de Sentry.
No es todavía la entrega final para Play.

| Dato | Evidencia |
|---|---|
| Build EAS | [ceeb0c07-b32b-41d3-80f6-da2040edb613](https://expo.dev/accounts/jarguetams-team/projects/gestiones-comerciales-3uncfxmscvb2on8csmb7/builds/ceeb0c07-b32b-41d3-80f6-da2040edb613), `FINISHED` el 2026-09-26 |
| Perfil / código | `verify-aab`, `1.0.0` / `5` |
| SHA Git | `af4e07ddabbfb619d2fd75c511781c5852b3964b` |
| AAB | [Descargar artefacto](https://expo.dev/artifacts/eas/E7AyRonpD0KuQzVXUMHMRo1lXKfSgcbHQcfQcLEzTuI.aab), 64,560,361 bytes |
| SHA-256 del AAB | `435bd5dd7b0d0f42d763d4f5fe257fa6d22b14e5efb96dc30ebbd281ebc4f2bf` |
| Certificado de carga SHA-256 | `FA:7A:C0:3D:7C:01:3A:B5:C5:67:62:CE:78:1A:1A:52:4C:F2:0A:43:D8:A3:04:03:80:3A:42:5E:DC:F0:D3:E0` |

`bundletool validate` y `jarsigner -verify` terminaron con código 0. El
manifest declara `com.gc.mobile`, `minSdkVersion=24`, `targetSdkVersion=36` y
`versionCode=5`. El bundle declara `PAGE_ALIGNMENT_16K`. El APK universal
derivado pasó `zipalign -c -P 16 -v 4`; las 38 bibliotecas ELF de 64 bits
inspeccionadas con `llvm-readelf` no tenían segmentos `LOAD` alineados por
debajo de 16 KB. Ese APK de prueba se firmó con una clave de depuración para
instalarlo localmente; el AAB original conserva la firma de carga de EAS.

En un emulador Android 15 (API 35) con páginas de 16 KB, la instalación del
APK universal terminó en `Success`. La app abrió la pantalla de acceso, quedó
al frente y su proceso continuó activo. El logcat consultado no mostró una
excepción fatal de la app ni el mensaje «No se pudo inicializar Sentry».
[Captura tras la recuperación del emulador](assets/android-15-16kb-login-code5.png).
El emulador mostró una vez «System UI isn't responding» antes de esa captura;
tras elegir «Wait», System UI se recuperó y la app siguió activa. Este aviso
del emulador limita la prueba de estabilidad del sistema, no demuestra un
fallo de la app.

La prueba cubre arranque sin sesión y la ausencia de un fallo visible al
inicializar el SDK. No demuestra que Sentry haya recibido un evento ni que los
mapas de código se hayan subido. Siguen pendientes el token de Sentry para el
build `production`, el flujo con tenant piloto y la instalación desde Play.
