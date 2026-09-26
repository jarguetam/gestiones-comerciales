# Android 1.0.0 (4) — marca GC

Artefacto de diagnóstico firmado para pruebas internas. El perfil `verify-aab`
usa el entorno productivo y omite la subida de mapas de Sentry porque el token
de CI aún no está configurado. La ausencia de mapas dificulta leer fallos; no
altera la ejecución del AAB.

| Dato | Evidencia |
|---|---|
| Build EAS | [d7a61897-53bd-4476-a305-b62bc8fb8383](https://expo.dev/accounts/jarguetams-team/projects/gestiones-comerciales-3uncfxmscvb2on8csmb7/builds/d7a61897-53bd-4476-a305-b62bc8fb8383), `FINISHED` el 2026-09-26 |
| Perfil / código | `verify-aab`, `1.0.0` / `4` |
| SHA Git | `eccf14804e63fc20833d9336c5130d75dfdd16ff` |
| AAB | [Descargar artefacto](https://expo.dev/artifacts/eas/6VQxrioQCtu4CTRSA8Z68YTkPGRU0nMacsfT8WC-yWc.aab), 64,560,194 bytes |
| SHA-256 del AAB | `23243bda9a2f6f8b82bcc7e7f6660720e75f9abcccaa1b9eb7c2bb2c1ca54600` |
| Certificado de carga SHA-256 | `FA:7A:C0:3D:7C:01:3A:B5:C5:67:62:CE:78:1A:1A:52:4C:F2:0A:43:D8:A3:04:03:80:3A:42:5E:DC:F0:D3:E0` |

`bundletool validate` y `jarsigner -verify` terminaron con código 0. El
manifest declara `com.gc.mobile`, `minSdkVersion=24`, `targetSdkVersion=36` y
`versionCode=4`. La configuración del bundle declara `PAGE_ALIGNMENT_16K`; el
APK universal derivado pasó `zipalign -c -P 16 -v 4`. Se revisaron las 38
bibliotecas ELF de 64 bits (`arm64-v8a` y `x86_64`) con `llvm-readelf`; ningún
segmento `LOAD` tenía alineación menor a 16 KB. Ese APK universal se
firmó con una clave de depuración únicamente para la prueba local. El AAB
original conserva la firma de carga de EAS.

Se extrajeron del APK los recursos compilados `ic_launcher.webp`,
`ic_launcher_foreground.webp` y `splashscreen_logo.png`; los tres muestran la
marca GC. En un emulador Android 15 (API 35) con `getconf PAGESIZE=16384`,
`adb install --no-streaming` terminó en `Success`. La pantalla de acceso
mostró el ícono GC, `com.gc.mobile/.MainActivity` quedó al frente y el proceso
siguió activo después de 25 segundos. El logcat consultado no mostró
excepciones fatales de `AndroidRuntime` para la app.
[Captura de la prueba](assets/android-15-16kb-login-code4.png).

Esta prueba cubre firma, empaquetado e inicio sin sesión. Faltan el flujo con
tenant piloto, la revisión de privacidad y declaraciones de Play, y la prueba
cerrada exigida a la cuenta personal antes de publicar en producción.
