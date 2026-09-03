# qa-paseo-web Implementation Plan

> **For agentic workers:** implementar task-by-task con TDD. Checkboxes en
> `openspec/changes/qa-paseo-web/tasks.md`.

**Goal:** Harness Playwright de paseo QA en `apps/web` con reporte acumulado + pasada agente en Pages.

**Architecture:** Catálogo/recolector unitarios + spec Playwright public/auth + reporte JSON/MD.

**Tech Stack:** Playwright, @axe-core/playwright, node:test, TypeScript strip-types.

## Global Constraints
- Sin secretos en git. MFA vía `E2E_MFA_CODE` / agente.
- IDs de spec solo en `data-spec`.
- Un tema = esta rama/PR.

---

### Task 1: Catálogo + recolector
**Files:** `apps/web/tests/qa-paseo/rutas.ts`, `hallazgos.ts`, `apps/web/tests/qa-paseo.test.ts`

- [ ] RED unit tests
- [ ] GREEN implementación
- [ ] Commit

### Task 2: Playwright + config
**Files:** `observadores.ts`, `login.ts`, `qa-paseo.spec.ts`, `playwright.config.ts`, `package.json`

- [ ] Spec public + auth skip
- [ ] NO_SERVER + script
- [ ] Commit

### Task 3: Pasada Pages
- [ ] Auth con MFA del usuario
- [ ] Listar hallazgos
