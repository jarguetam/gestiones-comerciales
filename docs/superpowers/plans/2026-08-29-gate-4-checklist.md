# Gate 4 — checklist

Plan: `docs/superpowers/plans/2026-08-29-gate-4-android.md`

- [x] EAS `projectId` en `app.json`; APKs fuera del git; `eas.json` sin iOS
- [x] `requireMobileEnv` / `GC-CORE-001`; sin `DEMO_MODE` ni seeds
- [x] Ajustes sin switch de rastreo (`RastreoEstado` solo lectura)
- [x] TaskManager + `startLocationUpdatesAsync`; bloqueo sin GPS
- [x] `onAuthStateChange` (SIGNED_IN / SIGNED_OUT / refresh)
- [x] Sentry RN; prod sin DSN → `GC-CORE-001`; test no crashea
- [x] Workflows `eas-preview.yml` (label) y `eas-internal.yml` (tag / dispatch)
- [x] Expo Doctor 17/17; excepciones de audit documentadas
- [x] Cola particionada `${tenantId}:${userId}`; FCM invalidado al logout
- [x] Recuperar contraseña + scheme `gc://recuperar`
- [x] Detox Android API 34 (local / `workflow_dispatch`); sin iOS
- [x] Runbook `docs/runbooks/android-internal.md`
