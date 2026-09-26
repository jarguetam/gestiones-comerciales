# Android 1.0.0 (6) — formulario offline

Build firmado de diagnóstico después de corregir la clave de idempotencia del
formulario e incorporar `expo-crypto`. El perfil `verify-aab` usa el backend
productivo y omite la subida de mapas de Sentry. No es la entrega final para
Play.

| Dato | Evidencia |
|---|---|
| Build EAS | [e2ae1a35-13ce-4259-88c7-ed3f7b1b3b19](https://expo.dev/accounts/jarguetams-team/projects/gestiones-comerciales-3uncfxmscvb2on8csmb7/builds/e2ae1a35-13ce-4259-88c7-ed3f7b1b3b19), `FINISHED` el 2026-09-26 |
| Perfil / código | `verify-aab`, `1.0.0` / `6` |
| SHA Git | `1437b6a821417458c689d9a8ebd514d4f297a0de` |
| AAB | [Descargar artefacto](https://expo.dev/artifacts/eas/TXNZw2v__ybTosBXc9Tsw1khFlbdhaex7TScRelPzPQ.aab), 64,567,680 bytes |
| SHA-256 del AAB | `fdd9af1e7bb02517836b1ea54c316f2b13e892ec225b0e1514af24b469379eaf` |
| Certificado de carga SHA-256 | `FA:7A:C0:3D:7C:01:3A:B5:C5:67:62:CE:78:1A:1A:52:4C:F2:0A:43:D8:A3:04:03:80:3A:42:5E:DC:F0:D3:E0` |

`bundletool validate` y `jarsigner -verify` terminaron con código 0. El
manifest declara `com.gc.mobile`, `minSdkVersion=24`, `targetSdkVersion=36` y
`versionCode=6`. El bundle declara `PAGE_ALIGNMENT_16K`. El APK universal
derivado pasó `zipalign -c -P 16 -v 4`; sus 38 bibliotecas ELF de 64 bits
contienen 114 segmentos `LOAD`, ninguno alineado por debajo de 16 KB. Ese APK
de prueba se firmó con una clave de depuración solo para instalarlo localmente;
el AAB original conserva la firma de carga de EAS.

En el emulador Android 15 con páginas de 16 KB, la instalación terminó en
`Success`. La app abrió la [pantalla de acceso](assets/android-15-16kb-login-code6.png),
quedó al frente y su proceso siguió activo. El logcat de ese proceso no mostró
`FATAL EXCEPTION`, error de carga del bundle, ni errores visibles de Sentry o
`expo-crypto`. El emulador mostró una vez «System UI isn't responding»; al
elegir «Wait» se recuperó y la app siguió activa.

La regresión falló antes del arreglo y luego pasó. Se ejecutaron 105 pruebas
móviles, typecheck, lint y Expo Doctor 18/18. Lint
terminó con dos advertencias de imports no usados preexistentes. La prueba en
emulador cubre arranque sin sesión; no ejecuta el envío de formulario ni prueba
Sentry real. Quedan pendientes la cuenta del tenant piloto, el build
`production` con mapas de Sentry y la instalación desde Play.
