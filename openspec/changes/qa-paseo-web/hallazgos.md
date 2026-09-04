# Hallazgos qa-paseo — apps/web (Pages prod)

**Fecha:** 2026-09-03 (pasada) / 2026-09-04 (fixes)  
**Entorno:** `https://jarguetam.github.io/gestiones-comerciales/`  
**Usuario:** admin (MFA)  
**Suite:** `apps/web/tests/qa-paseo/`  
**PR:** rama `cursor/qa-paseo-web-1c6b`

## Estado

| Id | Hallazgo | Resolución |
|----|----------|------------|
| H1 | Realtime doble `inbox-notificacion` | **Fixed** — `inboxRealtime.ts` refcount + un solo `.on/.subscribe` |
| H2 | Falta `W-02` en `/` | **Harness** — admin usa `W-02b` (drill); catálogo acepta `W-02\|W-02b` |
| H3 | Falta `W-14` mapa | **Harness** — espera Suspense/lazy (antes 400ms) |
| H4 | Falta `W-13` + console notificaciones | **H1** + espera `data-spec` |
| H5–H7 | Falta W-12/W-10/W-11 | **Harness** — espera carga estable antes de assert |

## Verificación pendiente
Re-correr `test:qa-paseo` auth contra Pages (requiere `E2E_MFA_CODE`) tras deploy o contra preview local con backend. Criterio done del goal: **0 hallazgos high** en esas rutas.

## Cómo re-verificar
```bash
PLAYWRIGHT_BASE_URL=https://jarguetam.github.io/gestiones-comerciales/ \
PLAYWRIGHT_NO_SERVER=1 \
E2E_ADMIN_EMAIL=... E2E_ADMIN_PASSWORD=... E2E_MFA_CODE=... \
pnpm --filter @gc/web test:qa-paseo
```

## Out of scope
Backoffice, mobile, mutaciones de negocio, secreto TOTP en CI.
