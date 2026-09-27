# Android 1.0.0 (3) — verificación técnica

Artefacto de diagnóstico instalable para pruebas internas. El perfil
`verify-aab` usa producción pero omite la subida de mapas de Sentry mientras
falta el token de CI. Los mapas se suben a Sentry, fuera del AAB; su ausencia
afecta la lectura de fallos. La decisión de usar este
artefacto en prueba cerrada depende de los demás requisitos de Play y del
tenant piloto.

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
comprobar el uso de la app en esa imagen. La validación estática de alineación
indicada arriba sí pasó.

Una segunda prueba, el 2026-09-26, usó una imagen limpia de Android 15
(API 35) de 16 KB (`google_apis_playstore_ps16k/x86_64`). `getconf PAGESIZE`
devolvió `16384`, `adb install --no-streaming` terminó en `Success` y
`com.gc.mobile/.MainActivity` quedó en primer plano. Tras 25 segundos, el
proceso seguía activo y una captura mostró la pantalla de acceso. El logcat
consultado no mostró excepciones fatales. [Captura de la prueba](assets/android-15-16kb-login.png).
Esto verifica instalación y arranque en 16 KB, pero no los flujos con sesión.

El endpoint Auth del Supabase productivo respondió HTTP 200 con la clave pública
configurada en EAS. Consultas `HEAD` con `Prefer: count=exact` y rol `anon`
devolvieron `*/0` para `tenant`, `tenant_modulo`, `usuario`, `persona`,
`visita` y `rastreo_ubicacion`: las tablas son accesibles y ninguna fila quedó
visible al rol anónimo en esas consultas. Es una comprobación limitada de RLS,
no una prueba de permisos de usuarios autenticados ni de los RPC. La Edge
`rastreo-ingesta` respondió HTTP 401 sin credenciales.

Pendiente: probar login, permisos, SQLite y sincronización con tenant piloto;
decidir la subida de mapas de Sentry para el candidato de producción y enviar
el AAB a Play cuando estén listas las declaraciones y la cuenta de revisión.
