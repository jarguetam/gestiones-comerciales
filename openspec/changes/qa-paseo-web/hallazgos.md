# Hallazgos qa-paseo — apps/web (Pages / verify local)

**Pasada original:** 2026-09-03 Pages  
**Verificación:** 2026-09-04 preview local con sesión admin + fixes  
**Reporte verify:** `/opt/cursor/artifacts/qa_paseo_auth_verify_h1_h7.md` — **0 hallazgos**

## Resuelto

| Id | Hallazgo | Fix |
|----|----------|-----|
| H1 | Realtime doble `inbox-notificacion` | `inboxRealtime.ts` refcount |
| H2 | Falta `W-02` | Harness acepta `W-02\|W-02b` (admin drill) |
| H3 | Falta `W-14` mapa | `RequireRol` esperaba `rol` antes de hidratar `useAuth` → bounce a `/` |
| H4 | Falta `W-13` + console notificaciones | H1 + espera `data-spec` |
| H5–H7 | Falta W-12/W-10/W-11 | mismo bug `RequireRol` (`decidirAccesoRuta` waiting) |
| extra | axe `select-name` en `/usuarios` | `aria-label` en selects de invitar/rol |

## Causa H3/H5–H7
`useAuth` no es Context: cada mount arranca con `rol=undefined`. `RequireRol` denegaba al instante y hacía `Navigate` a `/`.

## Verificación
Rutas `/`, `/mapa`, `/notificaciones`, `/auditoria`, `/configuracion`, `/usuarios` — sin hallazgos high/critical (axe sin `color-contrast` en esta pasada de cierre).
