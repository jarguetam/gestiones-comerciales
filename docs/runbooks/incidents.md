# Incidentes

Alertas = issues de GitHub con label `ops-alert` (workflow `ops-health.yml`, cada 15 min). No hay SMS ni PagerDuty.

## Probes

1. Pages producción: HTTP 200 y el HTML **no** contiene «Entrar al tablero».
2. Edge `auth-guard` sin JWT: 400 o 401 (vivo; no 5xx).
3. PostgREST con anon: no 5xx.

Cada issue `probe-failed` incluye `request_id`.

## Qué hacer

1. Abrir [docs/ops/panel.md](../ops/panel.md) (Sentry + Actions + logs).
2. Correlacionar `request_id` en Sentry y `console.log` JSON de Edge (`fn`, `outcome`, `tenant_id`).
3. Si Pages sirve demo: no promover. Revisar `VITE_*` del Environment `production`.
4. Si Edge 5xx: logs de la función + drift de migraciones (`pnpm ops:preflight`).
5. Cerrar el issue cuando el probe vuelva a verde. El cron no reabre el mismo título; duplicar a mano si hace falta.

Códigos: no reutilizar `GC-OPS-004` (preflight). Fallos de secretos = `GC-OPS-008`.
