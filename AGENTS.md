# AGENTS.md — Gestiones Comerciales

Monorepo pnpm: `apps/web` (empresa), `apps/backoffice` (plataforma), `apps/mobile` (campo), `supabase/` (SQL + Edge). Specs en `spec/` y `openspec/`. Node 22.14.0, pnpm 9.15.9.

## Commands

Build: `pnpm --filter @gc/web build` · `pnpm --filter @gc/backoffice build`
Test: `pnpm -r test`
Contracts (CI): `pnpm test:contracts`
Single unit: `node --experimental-strip-types --test apps/web/tests/env.test.ts`
Lint: `pnpm lint`
Typecheck: `pnpm -r typecheck`
E2E fixtures (no backend): `pnpm --filter @gc/web test:e2e` · `pnpm --filter @gc/backoffice test:e2e`
Single e2e: `pnpm --filter @gc/web exec playwright test tests/flujos-f1.spec.ts`
Dev: `pnpm dev:web` (5173) · `pnpm dev:backoffice` (5174)
pgTAP: `bash scripts/ci/pgtap.sh`
Edge: `deno fmt --check supabase/functions && deno lint supabase/functions && deno test supabase/functions/_shared/ --allow-env --allow-read`
Types: `supabase gen types typescript --linked > apps/web/src/types/database.ts` (copiar también a `apps/backoffice/src/types/database.ts`)

## Architecture

- Tres clientes contra el mismo Supabase. No hay API propia ni `packages/` compartido: el kit UI se copia (web → backoffice); móvil tiene el suyo en `apps/mobile/src/components/ui` + `useTheme()`.
- Backend compuesto: PostgREST + RLS (CRUD), RPC de Postgres (reglas transaccionales), Edge Deno (efectos: push, import, PDF, GPS, invite, webhook, jobs). Validación de negocio en RPC, no en el cliente. Códigos `GC-*` al usuario (mensaje de catálogo + código).
- JWT empresa: claims `tenant_id` / `rol`. JWT de plataforma (`usuario_plataforma`) no tiene `tenant_id`; el backoffice muta solo vía RPC `admin_*` security definer. Nunca `service_role` en el cliente.
- Móvil offline-first: cola local → replay de RPC. Lecturas web: `supabase.from` con RLS. Mutaciones con reglas: `supabase.rpc`.
- Multi-tenant + módulos optativos por tenant. Specs: `spec/` y `openspec/changes/`. ADRs: `docs/adr/`.

## Canonical examples

- Auth (W-01, sin demo): `apps/web/src/features/auth/Login.tsx`
- Env fail-closed: `apps/web/src/lib/env.ts`
- RPC + error `GC-*`: `apps/web/src/features/crm/crmApi.ts`
- Escritura / sesión: `apps/web/src/lib/persistir.ts`
- Errores UI: `apps/web/src/lib/erroresUi.ts`
- Kit UI + labels: `apps/web/src/components/ui/` (`PageHeader`, `Field`)
- Tokens (y prohibiciones): `apps/web/src/theme/tokens.ts`
- Backoffice `admin_*`: `apps/backoffice/src/features/empresas/WizardEmpresa.tsx`
- Cola / sync móvil: `apps/mobile/src/lib/cola.ts`, `apps/mobile/src/lib/sync.ts`
- Edge request id: `supabase/functions/_shared/request_context.ts`
- Unitarios (node:test, sin RTL): `apps/web/tests/*.test.ts` · `apps/backoffice/src/features/**/*.test.ts` · `apps/mobile/tests/*.test.ts`

## Recipes

### Rama y PR

Un tema = una rama = un PR. Antes de escribir código:

1. `git fetch origin main` (el checkout local puede estar atrasado).
2. `gh pr list --state open` — si ya hay PR del mismo módulo, continuar esa rama; no abrir otra.
3. Si la rama quedó atrás de `main`, mergear `origin/main` y resolver conflictos antes de sumar trabajo.
4. Buscar implementación existente (`rg`) en `main` y en PRs abiertos. No duplicar libs.

Tras merge: `git push origin --delete <rama>`.

### Feature nueva (OpenSpec)

Pantalla, módulo, RPC/Edge, flujo o modelo de datos nuevo: no empieza por código.

1. `openspec/changes/<kebab>/`: `proposal.md` (problema, cambio, impacto, out-of-scope, **Preguntas de aclaración** con default si no contestan), `specs/` WHEN/THEN como `openspec/changes/add-core-platform/specs/`, `design.md` solo con trade-offs reales.
2. Entregar el proposal y parar. Implementar cuando respondan o aprueben los supuestos.
3. `tasks.md` con criterio de done (unit, pgTAP o e2e).
4. Un PR por change; referenciar `openspec/changes/<nombre>`; ir marcando tasks.

No aplica a bugfix, refactor ni copy/estilo.

### Pantalla o control UI

1. Kit en `src/components/ui` (web/backoffice) o `apps/mobile/src/components/ui` + `useTheme()`. Detalle: `docs/frontend/design-system.md`.
2. `PageHeader spec="W-xx"` / `data-spec`. Playwright usa `[data-spec="…"]`. El id nunca es eyebrow visible.
3. Labels: `htmlFor` o `accessibilityLabel`. Targets ≥ 44px; bottom nav ≥ 56px.
4. Empty + skeleton + toast `GC-*`. **Salir** visible. Sin rail de acento en visitas/leads/cards.

### Migración, RPC o Edge

1. Forwards-only (expand → soak staging → contract). Runbook: `docs/runbooks/migrations.md`.
2. Nombre `supabase/migrations/*.sql` en orden lexicográfico (CI lo exige).
3. `SECURITY DEFINER` nueva → listar en `supabase/tests/security_definer_allowlist.txt`.
4. pgTAP en `supabase/tests/`. Edge: `supabase/functions/<fn>/index.ts` + `_shared/`.
5. No migraciones ni Edge desde un cambio de UI salvo que el ticket lo pida.

## Gotchas

- Sin `VITE_SUPABASE_URL` + anon (y en build web: `VITE_SENTRY_DSN` + `VITE_RELEASE`) falla `GC-CORE-001`. Móvil: `EXPO_PUBLIC_SUPABASE_*`. No hay `DEMO_MODE` ni «Entrar al tablero» (`apps/web/tests/no-demo.test.ts`). `cargarDominio` no hace fallback de datos: tira `GC-CORE-001`.
- CI `validate` inyecta placeholders `VITE_*` y corre e2e contra fixtures locales. Staging real: `.github/workflows/e2e-staging.yml` (secrets). Sin credenciales, reportar el check no corrido.
- `supabase gen types --linked` exige login/`SUPABASE_ACCESS_TOKEN`. No está en CI; no bloquea UI. No inventar el schema a mano si se pueden regenerar tipos.
- Nunca `.env` versionado ni `service_role` en el cliente (job security + gitleaks).
- Kit propio, no shadcn (el README miente). No reintroducir Playfair/serif, canvas `#F3EEE4`, pasteles de evento, header púrpura, `PhoneMockup`. Tests: `apps/web/tests/tokens.test.ts`.
- Dependabot: no subir `react-native` / Expo minor / TypeScript major (rompe Expo 51 y lint). Ver `.github/dependabot.yml`.
- `pnpm-workspace.yaml` lista `packages/*` vacío: no crear un package «compartido» para el kit.
- pgTAP y `supabase start` necesitan Docker + CLI. Deno para Edge.

---

## Verification

- Run the relevant checks before saying the work is done.
- Report any check you could not run. Never claim unverified work is verified.
- For unfamiliar or version-sensitive APIs, check the actual documentation. Don't guess from memory.

## Scope

- Do only what was asked. No unrequested refactors or "while I'm here" cleanups.
- Keep changes scoped to the task. Minimize the diff.
- Search before building. Prefer existing patterns, helpers and abstractions over introducing new ones.
- If behavior is unclear, inspect the code, tests and docs for evidence. Ask only when ambiguity remains and materially affects behavior.
- Don't add a dependency when the problem can reasonably be solved with what is already available.
- Never widen visibility for convenience.

## Bugs

- For bug fixes, write a regression test that fails before the fix and passes after it.
- Never weaken, delete or rewrite a test just to make it pass. Change tests only when the requested behavior changes.
- Never swallow errors: no empty catches, silent fallbacks or default values that hide failures.

## Prose

- Use the fewest words needed. No superlatives, praise or conversational filler.
- Comment why, not what. If code needs a "what" comment, make the code clearer instead.
- Commits: imperative subject, <=50 chars, no period. Use the body only when the reason is not obvious from the diff.

## When rules conflict

Correctness beats convenience.
Smallest diff beats style.
Evidence beats assumptions.
