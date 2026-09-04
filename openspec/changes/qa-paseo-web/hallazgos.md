# Hallazgos qa-paseo — apps/web (Pages prod)

**Fecha:** 2026-09-03  
**Entorno:** `https://jarguetam.github.io/gestiones-comerciales/`  
**Usuario:** admin (MFA)  
**Suite:** `apps/web/tests/qa-paseo/`  
**PR harness:** rama `cursor/qa-paseo-web-1c6b`  
**Reporte raw:** `apps/web/test-results/qa-paseo-report.md` (local) / artifact `qa_paseo_auth_pages_report`

## Pendientes (high)

### H1 — Realtime notificaciones (bug confirmado)
- **Ruta:** `/notificaciones`
- **Tipo:** `console`
- **Mensaje:** `cannot add postgres_changes callbacks for realtime:inbox-notificacion after subscribe()`
- **Causa probable:** `useNotificaciones(live)` se usa en `AppShell` y otra vez en la página de notificaciones; mismo channel `inbox-notificacion`.
- **Archivos:** `apps/web/src/features/notificaciones/useNotificaciones.ts`, `apps/web/src/app/AppShell.tsx`, `apps/web/src/features/notificaciones/NotificacionesPage.tsx`
- **Done:** sin error de consola al abrir `/notificaciones`; qa-paseo auth limpio en esa ruta.

### H2 — Falta `data-spec=W-02`
- **Ruta:** `/` (Dashboard)
- **Tipo:** `data-spec`
- **Nota:** `DashboardHome` sí declara `PageHeader spec={drill ? 'W-02b' : 'W-02'}`. Puede ser timing del harness (400ms) o shell en “Cargando…”.
- **Done:** `data-spec=W-02` (o `W-02b` si drill) visible tras carga estable.

### H3 — Falta `data-spec=W-14`
- **Ruta:** `/mapa`
- **Tipo:** `data-spec`
- **Nota:** gated por `RequireRol`; confirmar que admin llega a `MapaPage` y no a fallback.
- **Done:** `data-spec=W-14` visible para admin.

### H4 — Falta `data-spec=W-13`
- **Ruta:** `/notificaciones`
- **Tipo:** `data-spec`
- **Nota:** puede ser colateral del crash H1 o timing.
- **Done:** `data-spec=W-13` visible.

### H5 — Falta `data-spec=W-12`
- **Ruta:** `/auditoria`
- **Tipo:** `data-spec`
- **Done:** `data-spec=W-12` visible para admin.

### H6 — Falta `data-spec=W-10`
- **Ruta:** `/configuracion`
- **Tipo:** `data-spec`
- **Done:** `data-spec=W-10` visible para admin.

### H7 — Falta `data-spec=W-11`
- **Ruta:** `/usuarios`
- **Tipo:** `data-spec`
- **Done:** `data-spec=W-11` visible para admin.

## OK en la misma pasada (no tocar salvo regresión)
`/visitas`, `/personas`, `/crm`, `/formularios`, `/solicitudes`, `/depositos`, `/cuentas`, `/kilometraje` — sin hallazgos high; sin axe critical/serious ni controles rotos reportados.

## Cómo re-verificar
```bash
PLAYWRIGHT_BASE_URL=https://jarguetam.github.io/gestiones-comerciales/ \
PLAYWRIGHT_NO_SERVER=1 \
E2E_ADMIN_EMAIL=... E2E_ADMIN_PASSWORD=... E2E_MFA_CODE=... \
pnpm --filter @gc/web test:qa-paseo
```

## Out of scope de este backlog
Backoffice, mobile, mutaciones de negocio, secreto TOTP en CI.
