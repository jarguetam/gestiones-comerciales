# Proposal — qa-paseo-web

## Idioma
Todos los artefactos de este cambio se redactan en español.

## Problema
No hay un paseo QA sistemático de `apps/web` que visite pantalla por pantalla y **liste** errores
(crash, blank, redirect, consola, red, `data-spec`, axe graves, controles rotos). Los e2e
actuales fallan al primer `expect` y no entregan un reporte acumulado estilo QA.

## Cambio propuesto
1. Harness Playwright **qa-paseo** que recorre rutas de empresa, recolecta hallazgos y escribe
   un reporte JSON/MD (no se detiene en el primer fallo).
2. Modo `public` (CI sin secretos): login/recuperar + redirects a login + axe.
3. Modo `auth` (agente/manual): login admin + MFA vía env; paseo de pantallas autenticadas.
4. Pasada de agente (computerUse) contra Pages prod cuando haya código MFA.

## Impacto
- `apps/web/tests/qa-paseo/` + unitarios del recolector/catálogo.
- Script `test:qa-paseo` y ajuste de `playwright.config` para baseURL externa sin preview local.
- Openspec + plan en `docs/superpowers`.
- Sin cambios de producto UI ni migraciones.

## Out of scope
- Backoffice y mobile (segunda pasada).
- Flujos profundos (crear visita/lead, mutaciones).
- Guardar secreto TOTP en el repo (fase posterior con GitHub Secrets).
- Corregir los bugs hallados en esta pasada (solo listarlos).

## Supuestos aprobados
| # | Pregunta | Respuesta |
|---|----------|-----------|
| 1 | Entrega | A (paseo ahora) + C (suite CI) |
| 2 | Apps | D — empezar por `web` |
| 3 | Criterio error | B — roturas duras + axe graves + controles rotos |
| 4 | Entorno | D — Pages prod; fallback documentado |
| 5 | MFA suite | D — código manual ahora; TOTP en secretos después |
| 6 | Enfoque | 1 — Playwright paseo + reporte + pasada agente |

## Preguntas de aclaración
Ninguna pendiente: el usuario aprobó los supuestos y el enfoque 1 («dale con todo»).
