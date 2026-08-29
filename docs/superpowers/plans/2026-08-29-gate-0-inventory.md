# Gate 0 — Inventario, acceso y línea base

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Comprobar credenciales de GitHub, inventariar producción sin mutarla y fallar con el permiso exacto si no se puede crear o administrar staging.

**Architecture:** Un script Node/TS de preflight usa `SUPABASE_ACCESS_TOKEN` y `SUPABASE_PROJECT_REF` para listar migraciones, funciones, hooks y cron. Nunca imprime secretos. Un job de CI de solo lectura corre el mismo script. Si falta un permiso, el proceso sale distinto de 0 con un código `GC-OPS-*`.

**Tech Stack:** Node 22.14.0, pnpm 9.15.9, Supabase Management API, GitHub Actions.

## Global Constraints

- El proyecto Supabase actual `xcoeipsnykceorcvjwve` será producción.
- La ejecución no dependerá de acceso manual del usuario a Supabase.
- La automatización usará credenciales existentes en GitHub y comprobará sus permisos antes de realizar cambios.
- Si el token existente no puede crear proyectos, la automatización debe fallar con el permiso exacto que falta.
- No debe pedir al usuario operar el Dashboard; deberá aceptar una credencial reemplazada por un administrador de la organización a través de GitHub Secrets.
- Inventariar sin exponer valores.
- Comparar las 26 migraciones versionadas con producción y detener la promoción ante cualquier drift.

---

### Task 1: Modelo de inventario y códigos de preflight

**Files:**
- Create: `scripts/ops/preflight-types.ts`
- Create: `scripts/ops/preflight-types.test.ts`
- Create: `scripts/ops/package.json` only if needed; prefer workspace root scripts invoked with `node --experimental-strip-types`

**Interfaces:**
- Consumes: none
- Produces:

```ts
export type PreflightCode =
  | 'GC-OPS-001' // falta SUPABASE_ACCESS_TOKEN
  | 'GC-OPS-002' // token inválido
  | 'GC-OPS-003' // no puede leer proyecto
  | 'GC-OPS-004' // no puede listar migraciones
  | 'GC-OPS-005' // no puede listar functions
  | 'GC-OPS-006' // no puede crear/administrar staging
  | 'GC-OPS-007' // drift de migraciones
  | 'GC-OPS-008' // falta secret de GitHub requerido

export interface RemoteInventory {
  projectRef: string
  region: string | null
  postgresMajor: number | null
  migrations: string[]
  functions: string[]
  buckets: string[]
  cronJobs: string[]
  authHookEnabled: boolean | null
  siteUrl: string | null
}

export interface LocalInventory {
  migrations: string[]
  functions: string[]
}

export interface PreflightReport {
  ok: boolean
  code?: PreflightCode
  message: string
  local: LocalInventory
  remote?: RemoteInventory
  missing: string[]
  extraRemote: string[]
  canCreateProject: boolean
}
```

- [ ] **Step 1: Write the failing test**

```ts
import assert from 'node:assert/strict'
import test from 'node:test'
import { diffMigrations, summarizePreflight } from './preflight-types.ts'

test('diffMigrations detecta locales no aplicadas', () => {
  const d = diffMigrations(
    ['20260826120000_f0_tenancy_plataforma.sql', '20260829100000_persona_visita_rls_claims.sql'],
    ['20260826120000_f0_tenancy_plataforma.sql'],
  )
  assert.deepEqual(d.missing, ['20260829100000_persona_visita_rls_claims.sql'])
  assert.deepEqual(d.extraRemote, [])
})

test('summarizePreflight falla con GC-OPS-007 si hay drift', () => {
  const r = summarizePreflight({
    ok: true,
    message: '',
    local: { migrations: ['a.sql'], functions: [] },
    remote: {
      projectRef: 'xcoeipsnykceorcvjwve',
      region: 'us-west-2',
      postgresMajor: 17,
      migrations: [],
      functions: [],
      buckets: [],
      cronJobs: [],
      authHookEnabled: true,
      siteUrl: null,
    },
    missing: ['a.sql'],
    extraRemote: [],
    canCreateProject: true,
  })
  assert.equal(r.ok, false)
  assert.equal(r.code, 'GC-OPS-007')
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --experimental-strip-types --test scripts/ops/preflight-types.test.ts`

Expected: FAIL `Cannot find module` or `diffMigrations is not a function`.

- [ ] **Step 3: Write minimal implementation**

```ts
export function diffMigrations(local: string[], remote: string[]) {
  const r = new Set(remote)
  const l = new Set(local)
  return {
    missing: local.filter((m) => !r.has(m)),
    extraRemote: remote.filter((m) => !l.has(m)),
  }
}

export function summarizePreflight(report: PreflightReport): PreflightReport {
  if (report.missing.length > 0) {
    return {
      ...report,
      ok: false,
      code: 'GC-OPS-007',
      message: `GC-OPS-007: migraciones locales no aplicadas: ${report.missing.join(', ')}`,
    }
  }
  return { ...report, ok: true, message: 'preflight ok' }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --experimental-strip-types --test scripts/ops/preflight-types.test.ts`

Expected: `ok 2`, `# fail 0`.

- [ ] **Step 5: Commit**

```bash
git add scripts/ops/preflight-types.ts scripts/ops/preflight-types.test.ts
git commit -m "feat(ops): model production preflight inventory"
```

---

### Task 2: Cliente Management API sin filtrar secretos

**Files:**
- Create: `scripts/ops/supabase-mgmt.ts`
- Create: `scripts/ops/supabase-mgmt.test.ts`

**Interfaces:**
- Consumes: `PreflightCode`
- Produces:

```ts
export function redact(value: unknown): unknown
export function requireToken(env: NodeJS.ProcessEnv): string
export async function getJson(url: string, token: string): Promise<{ status: number; body: unknown }>
```

- [ ] **Step 1: Write the failing test**

```ts
import assert from 'node:assert/strict'
import test from 'node:test'
import { redact, requireToken } from './supabase-mgmt.ts'

test('requireToken lanza GC-OPS-001 si falta', () => {
  assert.throws(() => requireToken({}), /GC-OPS-001/)
})

test('redact oculta access tokens y service keys', () => {
  const out = redact({
    Authorization: 'Bearer sbp_secret',
    nested: { service_role: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.aaa.bbb' },
  }) as { Authorization: string; nested: { service_role: string } }
  assert.equal(out.Authorization, 'Bearer [redacted]')
  assert.equal(out.nested.service_role, '[redacted]')
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --experimental-strip-types --test scripts/ops/supabase-mgmt.test.ts`

Expected: FAIL module not found.

- [ ] **Step 3: Write minimal implementation**

```ts
const SECRET = /(token|secret|key|authorization|service_role|password)/i
export function requireToken(env: NodeJS.ProcessEnv): string {
  const t = env.SUPABASE_ACCESS_TOKEN?.trim()
  if (!t) throw new Error('GC-OPS-001: falta SUPABASE_ACCESS_TOKEN')
  return t
}
export function redact(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redact)
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([k, v]) => [
        k,
        SECRET.test(k) ? (typeof v === 'string' && v.startsWith('Bearer ') ? 'Bearer [redacted]' : '[redacted]') : redact(v),
      ]),
    )
  }
  return value
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --experimental-strip-types --test scripts/ops/supabase-mgmt.test.ts`

Expected: `# fail 0`.

- [ ] **Step 5: Commit**

```bash
git add scripts/ops/supabase-mgmt.ts scripts/ops/supabase-mgmt.test.ts
git commit -m "feat(ops): redact secrets in supabase management client"
```

---

### Task 3: Script de inventario local + remoto

**Files:**
- Create: `scripts/ops/preflight.ts`
- Create: `scripts/ops/preflight.test.ts`
- Modify: `package.json` — add `"ops:preflight": "node --experimental-strip-types scripts/ops/preflight.ts"`

**Interfaces:**
- Consumes: `diffMigrations`, `summarizePreflight`, `requireToken`, `getJson`
- Produces: `main(env): Promise<PreflightReport>` writes `docs/ops/inventory-latest.json` without secrets

- [ ] **Step 1: Write the failing test**

```ts
import assert from 'node:assert/strict'
import test from 'node:test'
import { listLocalMigrations, listLocalFunctions } from './preflight.ts'

test('listLocalMigrations cuenta 26 sql', async () => {
  const migs = await listLocalMigrations()
  assert.equal(migs.length, 26)
  assert.ok(migs[0].endsWith('.sql'))
})

test('listLocalFunctions incluye las 8 edge', async () => {
  const fns = await listLocalFunctions()
  for (const f of [
    'auth-guard', 'importer', 'invitar-usuario', 'notify-jobs',
    'pdf-solicitud', 'push-notifications', 'rastreo-ingesta', 'webhook-tenant',
  ]) assert.ok(fns.includes(f), f)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --experimental-strip-types --test scripts/ops/preflight.test.ts`

Expected: FAIL.

- [ ] **Step 3: Write minimal implementation**

Leer `supabase/migrations/*.sql` y directorios `supabase/functions/*/index.ts`. Si `SUPABASE_ACCESS_TOKEN` existe, GET:

- `https://api.supabase.com/v1/projects/{ref}`
- `https://api.supabase.com/v1/projects/{ref}/database/migrations` (o CLI `npx supabase migration list --project-ref`)
- `https://api.supabase.com/v1/projects/{ref}/functions`

Si el GET de creación de proyecto (`POST /v1/projects` dry-check vía GET org) falla 401/403, set `canCreateProject=false` y `code=GC-OPS-006`.

Escribir JSON en `docs/ops/inventory-latest.json` usando `redact`.

- [ ] **Step 4: Run tests**

Run:

```bash
node --experimental-strip-types --test scripts/ops/preflight.test.ts
pnpm ops:preflight
```

Expected: tests pass. Preflight en este entorno sin token: exit 1, stdout `GC-OPS-001`. En CI con token: report JSON, exit 0 o `GC-OPS-007`.

- [ ] **Step 5: Commit**

```bash
git add scripts/ops/preflight.ts scripts/ops/preflight.test.ts package.json
git commit -m "feat(ops): inventory local and remote supabase state"
```

---

### Task 4: Job CI de solo lectura

**Files:**
- Create: `.github/workflows/preflight.yml`
- Modify: `.gitignore` if inventory JSON must stay local; prefer committing a sanitized example `docs/ops/inventory.example.json`

**Interfaces:**
- Consumes: `pnpm ops:preflight`
- Produces: artifact `preflight-report.json`

- [ ] **Step 1: Write the workflow**

```yaml
name: Preflight
on:
  workflow_dispatch:
  pull_request:
    paths: ['supabase/**', 'scripts/ops/**', '.github/workflows/preflight.yml']
permissions:
  contents: read
jobs:
  inventory:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '22.14.0'
      - uses: pnpm/action-setup@v4
        with:
          version: 9.15.9
      - run: pnpm ops:preflight
        env:
          SUPABASE_ACCESS_TOKEN: ${{ secrets.SUPABASE_ACCESS_TOKEN }}
          SUPABASE_PROJECT_REF: ${{ secrets.SUPABASE_PROJECT_REF || 'xcoeipsnykceorcvjwve' }}
      - uses: actions/upload-artifact@v4
        if: always()
        with:
          name: preflight-report
          path: docs/ops/inventory-latest.json
```

- [ ] **Step 2: Dry-run local**

Run: `python3 -c "import yaml,sys; yaml.safe_load(open('.github/workflows/preflight.yml'))"` or `npx --yes js-yaml .github/workflows/preflight.yml >/dev/null`

Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/preflight.yml docs/ops/inventory.example.json
git commit -m "ci: add read-only supabase preflight job"
```

---

### Task 5: Línea base de versiones

**Files:**
- Create: `scripts/ops/toolchain.ts`
- Create: `.nvmrc` with `22.14.0`
- Modify: `package.json` `engines.node` to `22.14.0`

**Interfaces:**
- Produces: `scripts/ops/toolchain-lock.json`

```json
{
  "node": "22.14.0",
  "pnpm": "9.15.9",
  "deno": "2.x",
  "supabaseCli": "2.116.0",
  "expo": "51.0.39"
}
```

- [ ] **Step 1: Write failing test** that `toolchain.ts` rejects Node 20.

```ts
import assert from 'node:assert/strict'
import test from 'node:test'
import { assertToolchain } from './toolchain.ts'
test('rechaza node 20', () => {
  assert.throws(() => assertToolchain({ node: '20.20.2', pnpm: '9.15.9' }), /GC-OPS-010/)
})
```

- [ ] **Step 2: Run to fail**

Run: `node --experimental-strip-types --test scripts/ops/toolchain.test.ts`

- [ ] **Step 3: Implement `assertToolchain`**

```ts
export function assertToolchain(v: { node: string; pnpm: string }) {
  if (!v.node.startsWith('22.14.')) throw new Error('GC-OPS-010: Node debe ser 22.14.x')
  if (v.pnpm !== '9.15.9') throw new Error('GC-OPS-010: pnpm debe ser 9.15.9')
}
```

- [ ] **Step 4: Run tests and `node -v`**

Expected: tests pass; local Node is 22.14.x.

- [ ] **Step 5: Commit**

```bash
git add .nvmrc package.json scripts/ops/toolchain.ts scripts/ops/toolchain.test.ts scripts/ops/toolchain-lock.json
git commit -m "chore: pin Node 22.14 and record toolchain baseline"
```

---

## Definition of Done — Gate 0

- [ ] `pnpm ops:preflight` existe y no imprime tokens.
- [ ] CI corre el job de solo lectura.
- [ ] El report lista 26 migraciones locales y 8 funciones.
- [ ] Si producción no tiene las 26, el job falla `GC-OPS-007` y **no** se aplica `db push`.
- [ ] Si el token no puede crear proyectos, el report tiene `canCreateProject: false` y `GC-OPS-006`.
- [ ] `.nvmrc` = `22.14.0`.
