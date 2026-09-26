# Android 1.0.0 (3) — verificación técnica

Artefacto de diagnóstico, no candidato para Play. El perfil `verify-aab` usa
producción pero omite la subida de mapas de Sentry mientras falta el token de CI.

| Dato | Evidencia |
|---|---|
| Build EAS | [e11e593b-429e-4f5b-ad65-52dc5e3e0a55](https://expo.dev/accounts/jarguetams-team/projects/gestiones-comerciales-3uncfxmscvb2on8csmb7/builds/e11e593b-429e-4f5b-ad65-52dc5e3e0a55), `FINISHED` el 2026-09-26 |
| Perfil / código | `verify-aab`, `1.0.0` / `3` |
| SHA Git | `e90822d750c9558e07c00ad49566ebe227cb8916` |
| AAB | [Descargar artefacto](https://expo.dev/artifacts/eas/pF9Xi-CLnpbR4CtdREecO12LRegFa8L2mO3Uf61U98g.aab), 64,540,930 bytes |
| SHA-256 del AAB | `37d170fccc4c58e584cc593d312b1122c5de3bc7b4f2e30ac3ba21b469e1ec5c` |
| Certificado de carga SHA-256 | `FA:7A:C0:3D:7C:01:3A:B5:C5:67:62:CE:78:1A:1A:52:4C:F2:0A:43:D8:A3:04:03:80:3A:42:5E:DC:F0:D3:E0` |

`bundletool validate` y `jarsigner -verify` terminaron con código 0. El manifest
del módulo base declara `com.gc.mobile`, `minSdkVersion=24` y
`targetSdkVersion=36`. `bundletool dump config` indica `PAGE_ALIGNMENT_16K`.
La inspección de segmentos ELF con `llvm-readelf` no encontró alineación menor
a 16 KB en bibliotecas de 64 bits. Las bibliotecas de 32 bits conservan 4 KB;
el [requisito de Google Play](https://developer.android.com/guide/practices/page-sizes)
se refiere a dispositivos de 64 bits. El APK universal derivado del AAB pasó
`zipalign -c -P 16 -v 4`. Ese APK se firmó con una clave de depuración solo
para pruebas locales; no es el AAB firmado por EAS.

El 2026-09-26 se instaló el APK universal en un emulador limpio Android 14
(API 34, página de 4 KB). `adb install --no-streaming` terminó en `Success`;
la app abrió la pantalla de acceso, `com.gc.mobile/.MainActivity` quedó en
primer plano y no aparecieron excepciones fatales en el logcat consultado.
Esta prueba confirma únicamente el arranque sin sesión.

Se instaló también en un emulador Android 16 con página de 16 KB, pero el
sistema operativo reinició repetidamente sus servicios gráficos antes de poder
comprobar el uso de la app. La prueba de ejecución de 16 KB queda inconclusa;
la validación estática de alineación indicada arriba sí pasó.

Pendiente: probar login, permisos, SQLite y sincronización con tenant piloto;
repetir la prueba de 16 KB en un dispositivo o emulador estable; compilar el
AAB candidato con subida de mapas de Sentry y enviarlo a Play.
