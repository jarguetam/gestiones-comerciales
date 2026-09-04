# Tasks — qa-paseo-web

## 1. Catálogo y recolector (unitario)
- [x] `rutas.ts` con rutas public/auth + specs
- [x] `hallazgos.ts` (tipos, `Recolector`, `formatearReporteMd`)
- [x] `tests/qa-paseo.test.ts` verde
- **Done:** unitarios OK

## 2. Suite Playwright
- [x] Helpers login/MFA + observadores consola/red
- [x] `qa-paseo.spec.ts` modos public/auth (auth skip sin password)
- [x] Reporte en `test-results/qa-paseo-report.{json,md}`
- [x] `playwright.config`: `PLAYWRIGHT_NO_SERVER`
- [x] Script `test:qa-paseo` en `package.json`
- **Done:** e2e public local 16 passed / auth skipped

## 3. Docs / openspec
- [x] proposal + spec + este tasks.md
- [x] plan en `docs/superpowers/plans/`
- **Done:** artefactos en el PR

## 4. Pasada agente Pages
- [x] Login admin + MFA (código del usuario)
- [x] Recorrer pantallas y listar errores
- [x] Persistir hallazgos en `hallazgos.md` para follow-up
- **Done:** 7 hallazgos high documentados; H1 bug realtime confirmado
