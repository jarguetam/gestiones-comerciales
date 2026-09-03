# Diseño — qa-paseo-web (2026-09-03)

## Objetivo
Paseo QA de `apps/web` que **lista** errores pantalla por pantalla, usable por agente ahora y
por CI en modo público (auth cuando haya MFA/TOTP).

## Arquitectura
- Catálogo + recolector puros (unit-testable) en `apps/web/tests/qa-paseo/`.
- Spec Playwright que visita rutas, adjunta listeners, aplica axe, smoke de controles,
  vuelca reporte acumulado al final.
- Modos: `public` (siempre) y `auth` (env: email/password/`E2E_MFA_CODE`).
- BaseURL externa con `PLAYWRIGHT_NO_SERVER=1`.

## Criterios de hallazgo (B)
`crash`, `blank`, `redirect`, `console`, `network` (4xx/5xx no esperados), `data-spec`,
`axe` (critical/serious), `control` (sin nombre accesible o click que deja blank/crash).

## No hacer
Backoffice/mobile, mutaciones de negocio, commitear credenciales, autofix de bugs hallados.
