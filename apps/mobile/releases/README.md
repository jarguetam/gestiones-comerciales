# APK temporal (no es el artefacto de Play Store)

`gestiones-comerciales-campo-arm64.apk` — login real, agendar visita, 4 tabs.

**Antes de probar agendar:** aplicá en Supabase la migración `supabase/migrations/20260829010000_rls_jwt_app_metadata.sql` (SQL Editor). Sin eso, RLS sigue leyendo `tenant_id` en la raíz del JWT y `visita_crear` no existe.

Desinstalá `com.gc.mobile` anterior. Keystore debug.
