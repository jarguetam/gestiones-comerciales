# Gate 6 — Go-live Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Promocionar a producción (`xcoeipsnykceorcvjwve` + Pages root + Play Internal) solo cuando Gates 0–5 están verdes. Restore drill. Rollback sin down-migrations. Sin demo de emergencia.

**Architecture:** `golive-preflight` bloquea. Promoción `workflow_dispatch` + environment `production` con reviewers. Staging se migró desde cero y desde el schema prod anterior.

**Tech Stack:** GitHub Environments, Supabase CLI, EAS Submit, Sentry.

**Spec:** Gate 6 + Manejo de fallos + Definición de terminado  
**Índice:** `docs/superpowers/plans/2026-08-29-production-hardening-index.md`

## Global Constraints

- SHA candidato = el que pasó staging post-merge.
- Pages solo prod. Smoke no destructivo (sin writes de negocio).
- iOS fuera. Play track = Internal Testing, no production track.
- Secretos comprometidos se rotan; no se restauran valores viejos.
- README y specs coinciden con 26 migraciones / 8 Edge.

---

## File structure

```
docs/runbooks/golive.md
docs/runbooks/rollback.md
docs/runbooks/production-readiness.md     # final sign-off table
.github/workflows/supabase-prod.yml       # enable promotion steps
scripts/ops/golive-preflight.ts
scripts/ops/pages-smoke.sh
```

---

### Task 1: Script `golive-preflight` (bloquea promoción)

**Files:**
- Create: `scripts/ops/golive-preflight.ts`
- Create: `scripts/ops/golive-preflight.test.ts`

El script **lee** (no adivina) evidencia:

```ts
export type GoliveCheck = {
  id: string;
  ok: boolean;
  detail: string;
};

export async function runGolivePreflight(input: {
  gate0InventoryPath: string;
  ciConclusion: "success" | "failure" | "unknown";
  pgtapConclusion: "success" | "failure";
  stagingHealth: "success" | "failure";
  sentryReleaseExists: boolean;
  demoStringInWebSrc: boolean;
  apkTrackedInGit: boolean;
}): Promise<{ ready: boolean; checks: GoliveCheck[] }> {
  const checks: GoliveCheck[] = [
    { id: "ci", ok: input.ciConclusion === "success", detail: input.ciConclusion },
    { id: "pgtap", ok: input.pgtapConclusion === "success", detail: input.pgtapConclusion },
    { id: "staging-health", ok: input.stagingHealth === "success", detail: input.stagingHealth },
    { id: "sentry-release", ok: input.sentryReleaseExists, detail: "web@sha" },
    { id: "no-demo", ok: !input.demoStringInWebSrc, detail: "DEMO_MODE" },
    { id: "no-apk-git", ok: !input.apkTrackedInGit, detail: "releases/*.apk" },
  ];
  return { ready: checks.every((c) => c.ok), checks };
}
```

CLI: combina `gh run list`, `rg DEMO_MODE apps/web/src`, `git ls-files '*.apk'`, output JSON Gate 0.

- [x] **Step 1: Unit tests** — `ready===false` si cualquier check falla; `true` solo si todos ok

- [x] **Step 2: Implement CLI + commit**

```bash
git commit -m "feat: go-live preflight that blocks promotion on red gates"
```

---

### Task 2: Ensayo restore en staging (obligatorio)

**Files:**
- Modify: `docs/runbooks/backup-restore.md` — sección “ensayo Gate 6”
- Create: `scripts/ops/restore-staging-dryrun.sh`

Pasos:
1. Tomar artifact del job Gate 5.
2. Restore a database **staging-clone** o `supabase db reset` + replay dump en proyecto scratch (Management API create/delete permitido).
3. `supabase test db` o smoke SQL `select count(*) from tenant`.
4. Borrar scratch.

**No** restore a prod.

- [x] **Step 1: Script exit 0 en dry-run con dump fixture mínimo (SQL `select 1`)**

- [ ] **Step 2: Ejecutar ensayo real cuando exista artifact; adjuntar log al PR de go-live

- [x] **Step 3: Commit**

```bash
git commit -m "docs: staging restore drill required before production promote"
```

---

### Task 3: Promoción prod (manual, reviewed)

**Files:**
- Modify: `.github/workflows/supabase-prod.yml`
- Modify: `.github/workflows/pages-prod.yml` — `environment: production`
- Create: `docs/runbooks/golive.md`

Orden de promoción (expand/contract ya en prod schema):
1. `golive-preflight` must print `ready: true`.
2. `supabase db push` → prod (migrations only contract-safe).
3. `supabase functions deploy` → prod.
4. Pages prod (root) con `VITE_*` de **prod** (no staging).
5. `eas submit` AAB Internal (no production Play track).
6. Smoke: `scripts/ops/pages-smoke.sh` contra `https://jarguetam.github.io/gestiones-comerciales/` — login form visible, **no** “Entrar al tablero”, Edge 401 sin JWT.
7. Sentry release finalize + `gate6-ping` y borrar.

- [x] **Step 1: Contract test** — `supabase-prod.yml` tiene `environment: production` y `workflow_dispatch` only

- [x] **Step 2: Implement + commit**

```bash
git commit -m "ci: reviewed production promote for db, functions, and Pages"
```

---

### Task 4: Rollback

**Files:**
- Create: `docs/runbooks/rollback.md`

Pasos canónicos:
1. **Pages:** redeploy workflow con SHA anterior (artifact retenido 30 días) o revert commit + push `main`.
2. **Edge:** `supabase functions deploy` desde SHA anterior.
3. **DB:** **no down-migration** automática. Solo forward fixes. Si una migración expand rompe, feature-flag / RPC `returns null` (ya diseñado expand/contract).
4. **Android:** Play Internal halt; testers siguen APK preview SHA-1.
5. **Secret leak:** rotar (Gate 5 script) + invalidar sesiones `auth.users` via Admin API.

- [x] **Step 1: Commit runbook (no código de down)**

```bash
git commit -m "docs: production rollback without down-migrations"
```

---

### Task 5: Sign-off table + quitar deuda README

**Files:**
- Update: `README.md` — 26 migraciones, Edge listadas (incl. `pdf-solicitud`), **sin** “demo / 404”, Node 22, cómo correr staging
- Update: `docs/runbooks/production-readiness.md` — tabla GO/NO-GO

Columnas: Gate, PR, CI run, fecha, `ready`.

- [x] **Step 1: Test contrato README** — no afirma “24 migraciones” ni “pdf-solicitud 404”

```ts
const r = readFileSync("README.md", "utf8");
assert.equal(r.includes("24 migraciones"), false);
assert.equal(/pdf-solicitud[\s\S]{0,40}404/.test(r), false);
```

- [ ] **Step 2: Commit**

```bash
git commit -m "docs: go-live sign-off table and accurate README"
```

---

### Task 6: Criterio de salida (humano + script)

GO solo si (spec Gate 6, todos):
- `golive-preflight` → `ready: true` (CI, pgTAP, health, sentry, no-demo, no-apk-git)
- Staging migrado **desde cero** y **desde schema prod anterior** (dos logs)
- pgTAP por tabla/rol relevante verde
- Pruebas negativas: cross-tenant, UPDATE estados, definers, invite, import, Storage, push
- E2E real: login, MFA, visita, formulario, notificación, backoffice, admin
- Detox Android: sesión, offline, rastreo, permisos
- Bundle budget OK
- Probes de las 8 Edge + cron + Pages
- PITR verificado + restore drill log
- Política de privacidad publicada
- APK preview validado + AAB en Internal Testing (si Gate 0 marcó Play ausente → GO condicional **web-only**)
- Smoke prod sin writes destructivos
- iOS fuera
- Cero `DEMO_MODE` en `apps/*/src`

NO-GO si reaparece P0: webhook en `configuracion`, invite huérfano, importer upload pre-auth.

```bash
git commit -m "docs: gate 6 go-live exit criteria"
```

---

## Self-review

| Spec § | Task |
|--------|------|
| 6 go-live | 1, 3, 6 |
| 13 backup drill | 2 |
| 13 rollback | 4 |
| 14 automation | 1, 3 |
| 15 out of scope | 6 (iOS out, web-only conditional) |
| README drift | 5 |
