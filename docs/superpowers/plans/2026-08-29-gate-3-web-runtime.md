# Gate 3 — Runtime web y backoffice Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Quitar DEMO_MODE, exigir backend + sesión + roles, Sentry, ErrorBoundary, MFA backoffice, calidad (axe, bundle, CSP) y e2e reales.

**Architecture:** Un solo camino: `requirePublicConfig` del índice. Sin URL/anon/environment/release/DSN → build falla (`GC-CORE-001`). Sin sesión → login. Sin rol → 403. `RequestContext.requestId` en fetch + Sentry.

**Tech Stack:** React 18, Vite 5, Sentry Browser, Playwright, `errors.json` + códigos `GC-*`.

**Spec:** Gate 3 del diseño  
**Índice:** `docs/superpowers/plans/2026-08-29-production-hardening-index.md`

## Global Constraints

- `requirePublicConfig` / `WebhookSecretStatus` / `RequestContext` según índice.
- UI usa `GC-CORE-001` para env/red/dominio; no `GC-OPS-001`.
- Sin DEMO_MODE ni AgroMoney fallback.
- IDs de spec en `data-spec`, nunca eyebrow.
- Plus Jakarta Sans; tokens `bg-canvas` `#FAFAF8`; no serif ni canvas crema.
- Pages no permite todos los headers: CSP en `index.html` meta + documentar límite.
- iOS / PWA / service worker / Storybook / i18n EN fuera.

---

## File structure

```
apps/web/src/lib/demo.ts                 # delete or throw
apps/web/src/lib/cargarDominio.ts        # no AgroMoney fallback
apps/web/src/App.tsx                     # guards
apps/web/src/components/ErrorBoundary.tsx
apps/web/src/lib/sentry.ts
apps/web/src/lib/erroresUi.ts
apps/web/src/locales/es/errors.json
apps/web/vite.config.ts                  # fail without env
apps/backoffice/src/App.tsx
apps/backoffice/src/lib/auth.ts
apps/backoffice/src/features/mfa/*
tests/e2e/*.spec.ts                      # both apps
```

---

### Task 1: Build falla sin `VITE_SUPABASE_*`

**Files:**
- Modify: `apps/web/vite.config.ts`, `apps/backoffice/vite.config.ts`
- Create: `apps/web/src/lib/env.ts`, `apps/backoffice/src/lib/env.ts`
- Create: `apps/web/tests/env.test.ts`

Usar **`requirePublicConfig`** del índice (no inventar `requirePublicEnv`):

```ts
export function requirePublicConfig(input: {
  url?: string | null
  anonKey?: string | null
  environment: 'local' | 'staging' | 'production'
}): PublicSupabaseConfig {
  if (!input.url || !input.anonKey) throw new Error('GC-CORE-001')
  return { url: input.url, anonKey: input.anonKey, environment: input.environment }
}

export function requireBuildEnv(env: Record<string, string | undefined>) {
  const cfg = requirePublicConfig({
    url: env.VITE_SUPABASE_URL,
    anonKey: env.VITE_SUPABASE_ANON_KEY,
    environment: env.VITE_ENVIRONMENT as PublicSupabaseConfig['environment'],
  })
  if (!env.VITE_SENTRY_DSN || !env.VITE_RELEASE) throw new Error('GC-CORE-001')
  return { ...cfg, sentryDsn: env.VITE_SENTRY_DSN, release: env.VITE_RELEASE }
}
```

- [ ] **Step 1: Write failing test**

```ts
test("requirePublicConfig lanza GC-CORE-001 sin URL", () => {
  assert.throws(() => requirePublicConfig({ environment: 'production' }), /GC-CORE-001/);
});
```

Hoy no existe el módulo → FAIL.

- [ ] **Step 2: Implement plugin Vite `enforceEnv()` que llama `requireBuildEnv(loadEnv(...))` en `configResolved`.**

- [ ] **Step 3: Commit**

```bash
git commit -m "fix: fail web and backoffice builds without Supabase env"
```

---

### Task 2: Eliminar DEMO_MODE y fallback AgroMoney

**Files:**
- Delete usages: `DEMO_MODE`, `entrar al tablero`, `datosDemo`, `agromoney` seed en cliente
- Modify: `apps/web/src/lib/cargarDominio.ts` (L232–351 hoy swallow error → AgroMoney)
- Modify: `apps/web/src/pages/LoginPage.tsx`
- Modify: `apps/backoffice` login equivalente
- Modify: `apps/mobile` demo entry (si existe) — o dejar stub que lanza; Gate 4 limpia nativo
- Create: `apps/web/tests/no-demo.test.ts`

```ts
test("no queda DEMO_MODE en src", () => {
  // grep files under src
});
test("cargarDominio no menciona AgroMoney como fallback", () => {
  const s = readFileSync("apps/web/src/lib/cargarDominio.ts", "utf8");
  assert.equal(/AgroMoney/.test(s) && /catch/.test(s), false);
});
```

Comportamiento `cargarDominio`: error de red/RLS → UI `GC-CORE-001` + retry, **no** datos estáticos.

- [ ] **Step 1: Tests que fallan (strings aún existen)**

- [ ] **Step 2: Borrar código demo; actualizar e2e (coordinar Gate 2 Task 6)**

- [ ] **Step 3: Commit**

```bash
git commit -m "feat: remove DEMO_MODE and static AgroMoney fallback"
```

---

### Task 3: Guards de ruta — web

**Files:**
- Modify: `apps/web/src/App.tsx` (`/configuracion`, `/usuarios` ~109–110)
- Create: `apps/web/src/components/RequireRol.tsx`
- Create: `apps/web/tests/require-rol.test.ts`

```tsx
export function canAccess(path: string, rol: "admin" | "supervisor" | "asesor"): boolean {
  if (path.startsWith("/configuracion") || path.startsWith("/usuarios")) {
    return rol === "admin" || rol === "supervisor";
  }
  return true;
}
```

Ajustar matriz exacta al spec de producto (`spec/`): admin-only vs supervisor. **Canónico:** `/configuracion` y `/usuarios` = `admin` only; supervisor ve reportes, no invitación. Confirmar contra `admin_usuario_invitar` (admin|supervisor) — **invitar** puede ser supervisor; **config webhook/rastreo** = admin only.

- [ ] **Step 1: Test matriz `canAccess`**

- [ ] **Step 2: Wrap routes; deep link sin rol → `/` + toast `GC-AUTH-001`**

- [ ] **Step 3: Playwright** — usuario asesor no ve nav Configuración

- [ ] **Step 4: Commit**

```bash
git commit -m "fix: enforce role guards on configuracion and usuarios"
```

---

### Task 4: Guards de ruta — backoffice + MFA

**Files:**
- Modify: `apps/backoffice/src/App.tsx` (hoy cualquier JWT entra)
- Create: `apps/backoffice/src/lib/plataformaRol.ts`
- Create: `apps/backoffice/src/features/mfa/RequireMfa.tsx`
- Create: `apps/backoffice/src/features/mfa/mfa.test.ts`

**Reglas:**
1. JWT ausente → login.
2. Claim `app_metadata.plataforma_rol` ∈ `{owner, operador}` (nombre exacto: leer schema actual; si no existe, añadir en Gate 1 follow-up migration `plataforma_usuario`). Sin claim → 403, no chrome.
3. MFA: `supabase.auth.mfa.listFactors()`. Si `totp.length === 0` → pantalla enroll obligatoria (no skip). Si hay factor y AAL1 → challenge. Si AAL2 → chrome.

- [ ] **Step 1: Tests unitarios de `resolveBackofficeAccess({ session, factors, aal })`**

```ts
type Access = "login" | "enroll_mfa" | "challenge_mfa" | "forbidden" | "ok";
```

- [ ] **Step 2: Implement pages + commit**

```bash
git commit -m "feat: backoffice role claim and mandatory TOTP MFA"
```

---

### Task 5: ErrorBoundary + Sentry + request_id

**Files:**
- Create: `apps/web/src/components/ErrorBoundary.tsx`
- Create: `apps/backoffice/src/components/ErrorBoundary.tsx`
- Create: `apps/web/src/lib/sentry.ts`, `apps/backoffice/src/lib/sentry.ts`
- Create: `packages/` no — keep per-app
- Modify: `apps/web/src/lib/api.ts` — header `x-request-id`
- Modify: `apps/web/src/locales/es/errors.json` — `GC-CORE-001` + `GcCode` del índice

**Sentry tags:** `tenant_id`, `request_id` (no PII: no email, no nombre).

`ErrorBoundary`: mensaje humano + código + botón reintentar. No stack al usuario. Sentry: sin passwords, tokens, documentos, coordenadas.

Header de fetch: `x-request-id` = `RequestContext.requestId` (UUID). Respuesta error muestra el mismo id.

- [ ] **Step 1: Test `formatError(err)` incluye código GC-**

- [ ] **Step 2: `initSentry` requiere DSN en build (Task 1). Local test puede mockear.

- [ ] **Step 3: Commit**

```bash
git commit -m "feat: ErrorBoundary, Sentry, and request_id on web clients"
```

---

### Task 6: Mensajes `GC-*` visibles

**Files:**
- Modify: `erroresUi.ts` + `errors.json` para `GC-CORE-001` y cada `GcCode` del índice

- [ ] **Step 1: Test** — cada código en `GcCode` tiene entrada JSON

- [ ] **Step 2: Commit**

```bash
git commit -m "feat: humanize GC-* error codes in the UI"
```

---

### Task 7: E2E web/backoffice post-demo

**Files:**
- Rewrite: `apps/web/tests/e2e/*.spec.ts`
- Rewrite: `apps/backoffice/tests/e2e/*.spec.ts`

Flujos mínimos (spec §12.1):
1. Login asesor → agenda del día (`data-spec` W-*)
2. Check-in + resultado visita
3. Login admin → invitacion usuario (no completa Auth real si rate-limit; mock staging)
4. Backoffice: MFA enroll (usar factor seed) → lista tenants
5. Asesor no accede `/configuracion`
6. Axe: mismas páginas, sin botón demo

- [ ] **Step 1: Correr Playwright local contra staging; fallan hasta Task 2–4**

- [ ] **Step 2: Commit specs verdes**

```bash
git commit -m "test: replace demo Playwright flows with staging sessions"
```

---

### Task 8: Recuperación de contraseña (web + backoffice)

**Files:**
- Create: `apps/web/src/pages/RecuperarPasswordPage.tsx`
- Create: `apps/backoffice/src/pages/RecuperarPasswordPage.tsx`
- Create: `apps/web/tests/recuperar-password.test.ts`
- Modify: Auth redirect allowlist (Gate 2 ya puso URLs)

```ts
export async function solicitarReset(email: string): Promise<void> {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/recuperar`,
  })
  if (error) throw new Error('GC-AUTH-021')
}
```

- [ ] **Step 1: Test** — `solicitarReset` llama `resetPasswordForEmail` y no entra demo.

- [ ] **Step 2: Rutas `/recuperar` + form `htmlFor`. Rate limit lo cubre auth-guard.

- [ ] **Step 3: Commit**

```bash
git commit -m "feat: password recovery pages for web and backoffice"
```

---

### Task 9: Offline web

**Files:**
- Create: `apps/web/src/lib/online.ts`
- Modify: mutation buttons / persistir

```ts
export function canMutate(online: boolean): boolean {
  return online
}
```

- [ ] **Step 1: Test** `canMutate(false) === false`

- [ ] **Step 2: Banner “Sin conexión” + disable check-in/import/invitar. Lectura de caché de sesión OK. **No** service worker (PWA fuera).

- [ ] **Step 3: Commit**

```bash
git commit -m "feat: disable unsafe web mutations while offline"
```

---

### Task 10: Code-split mapa + presupuesto de bundle

**Files:**
- Modify: map route to `lazy(() => import('./pages/MapaPage'))`
- Create: `scripts/ci/bundle-budget.mjs`
- Modify: `ci.yml` — fail if `apps/web/dist/assets/*.js` entry > presupuesto

Presupuesto canónico (ajustar midiendo baseline post-demo): entry JS **≤ 450 kB** gzip, total JS **≤ 900 kB** gzip. Leaflet solo en chunk `mapa`.

- [ ] **Step 1: Test** — `bundle-budget.mjs` falla con fixture 2 MB.

- [ ] **Step 2: Implement lazy + budget en CI.

- [ ] **Step 3: Commit**

```bash
git commit -m "perf: lazy-load Leaflet and enforce web bundle budget"
```

---

### Task 11: Axe, labels, foco, firma + tokens de mapa

**Files:**
- Modify: e2e axe para **todas** las rutas autenticadas (lista `apps/web/src/App.tsx`)
- Modify: map color literals → `var(--gc-primary)` / tokens Tailwind
- Modify: signature canvas — `pointercancel` aborta trazo
- Modify: dialogs — `role="dialog"` + focus trap existente del kit `src/components/ui`

- [ ] **Step 1: Test unitario** de firma: `pointercancel` limpia stroke in-progress.

- [ ] **Step 2: Playwright axe por ruta (`data-spec`).

- [ ] **Step 3: Commit**

```bash
git commit -m "fix: axe coverage, map tokens, and signature pointer cancel"
```

---

### Task 12: CSP sin `unsafe-inline` de scripts

**Files:**
- Modify: `apps/web/index.html`, `apps/backoffice/index.html`
- Create: `docs/runbooks/csp-pages.md`

```html
<meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self'; connect-src 'self' https://*.supabase.co https://*.sentry.io; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline';">
```

`style-src 'unsafe-inline'` permitido (Tailwind runtime/attrs). `script-src` **sin** `unsafe-inline`. Sentry/Pages CDN documentados. Pages no setea headers reales: el meta es el control.

- [ ] **Step 1: Test** — `index.html` no contiene `script-src` con `unsafe-inline`.

- [ ] **Step 2: Commit**

```bash
git commit -m "fix: CSP meta without unsafe-inline scripts"
```

---

### Task 13: React Doctor confirmados + `.env.example`

**Files:**
- Create: `docs/ops/react-doctor-triage.md` — lista hallazgo → fix o “falso positivo”
- Modify: `.env.example`, `apps/web/.env.example`, `apps/backoffice/.env.example`

No cambiar código por falsos positivos de `persistir.ts` / `CatalogosPage` salvo que el triage los confirme. Fixes reales: secrets en cliente, `dangerouslySetInnerHTML`, keys inestables en listas tocadas.

- [ ] **Step 1: Commit triage + env examples alineados a `requireBuildEnv`

```bash
git commit -m "docs: React Doctor triage and aligned env examples"
```

---

### Task 14: Checklist Gate 3

- [ ] `pnpm --filter @gc/web test && test:e2e`
- [ ] `pnpm --filter @gc/backoffice test && test:e2e`
- [ ] Vite preview abre login (no tablero demo)
- [ ] PR `fix/gate-3-web-runtime`

```bash
git commit -m "docs: gate 3 web runtime checklist"
```

---

## Self-review

| Spec / índice | Task |
|---|---|
| Build env + no demo | 1–2, 7 |
| Guards + MFA BO | 3–4 |
| ErrorBoundary / Sentry / GC-* | 5–6 |
| Password recovery | 8 |
| Offline web | 9 |
| Bundle + Leaflet | 10 |
| Axe / mapa tokens / firma | 11 |
| CSP | 12 |
| React Doctor + env.example | 13 |
