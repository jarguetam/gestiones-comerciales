# APK temporal (no es el artefacto de Play Store)

`gestiones-comerciales-campo-arm64.apk` — build de prueba arm64, login real contra Supabase (sin modo demo). Incluye los fixes de `GC-AUTH-021` (decoder JWT) y `GC-AUTH-022` (perfil sin bloquear si falla el SELECT a usuario).

Desinstalá cualquier `com.gc.mobile` anterior antes de instalar. Firmado con keystore de debug.

Este archivo se puede borrar del repo cuando ya no haga falta descargarlo.
