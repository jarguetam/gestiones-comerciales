# Gate 1 — Seguridad Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cerrar P0/P1 de Auth, RLS, HMAC, secretos y Edge antes de tocar UI o CI de deploy.

**Architecture:** Correcciones en SQL (`SECURITY DEFINER`, RLS, RPCs) + reorden de Edge + tests Deno/pgTAP. El cliente no gana reglas nuevas: solo deja de evadir las existentes (quita UPDATE PostgREST de entidades con máquina de estado). Invite sigue el spec: validar → `createUser` → RPC perfil → si el perfil falla, borrar Auth.

**Tech Stack:** PostgreSQL 17 / Supabase, Deno Edge, HMAC SHA-256, pgTAP, Deno test, node:test.

**Spec:** `docs/superpowers/specs/2026-08-29-production-hardening-design.md` Gate 1  
**Índice:** `docs/superpowers/plans/2026-08-29-production-hardening-index.md`

## Global Constraints

- El proyecto `xcoeipsnykceorcvjwve` es producción; este gate no hace `db push` a prod.
- Nombres canónicos del índice: `WebhookSecretStatus`, `RequestContext`, `tenant_id_actual()`, `rol_actual()`.
- Códigos `GC-*` al usuario (mensaje + código). Preflight `GC-OPS-001..010` no se reutilizan en UI.
- Migraciones expand/contract, sin downtime.
- iOS, PWA, Storybook, i18n EN y `emailer` fuera de alcance.
- Node 22.14.0; pnpm 9.15.9.

---

## File structure

```
supabase/migrations/YYYYMMDDHHMMSS_<name>.sql   # una preocupación por archivo
supabase/tests/p0_invite_order.sql
supabase/tests/p0_webhook_secret.sql
supabase/tests/p0_seed_estados.sql
supabase/tests/p1_state_machines.sql
supabase/tests/p1_hmac_constant.sql
supabase/tests/p1_config_rastreo.sql
supabase/functions/invitar-usuario/index.ts
supabase/functions/importer/index.ts
supabase/functions/auth-guard/index.ts
supabase/functions/_shared/hmac.ts              # ya existe timingSafeEqual
supabase/functions/_shared/hmac_test.ts
apps/web/src/lib/api.ts
apps/web/src/lib/persistir.ts
apps/web/src/lib/persistir.test.ts
apps/backoffice/src/lib/api.ts
```

---

### Task 1: Test pgTAP — invitar no crea Auth si falla admin

**Files:**
- Create: `supabase/tests/p0_invite_order.sql`

- [ ] **Step 1: Write the failing test**

```sql
-- pgtap: no se puede crear usuario Auth huérfano si admin_usuario_invitar falla.
-- En CI: simular con transacción + mock no es posible contra Auth real.
-- Este test cubre el contrato SQL: admin_usuario_invitar NO inserta
-- public.usuario si el auth.users id no existe (GC-AUTH-003).
-- El orden Edge se cubre en Task 2 (Deno).

begin;
select plan(2);

select throws_ok(
  $$select public.admin_usuario_invitar(
    '00000000-0000-0000-0000-000000000099'::uuid,
    'huérfano@example.com',
    'asesor',
    'Huérfano'
  )$$,
  'P0001',
  'GC-AUTH-003'
);

select ok(
  not exists (
    select 1 from public.usuario
    where email = 'huérfano@example.com'
  ),
  'no queda fila usuario si Auth id no existe'
);

select * from finish();
rollback;
```

- [ ] **Step 2: Run test to verify it fails**

Run: `supabase test db --file supabase/tests/p0_invite_order.sql`  
Expected: FAIL o SKIP si `admin_usuario_invitar` ya lanza GC-AUTH-003 (el test SQL puede pasar hoy). El **fallo real** está en Edge (Task 2).

- [ ] **Step 3: Commit**

```bash
git add supabase/tests/p0_invite_order.sql
git commit -m "test: document invite SQL contract GC-AUTH-003"
```

---

### Task 2: Reordenar `invitar-usuario` (SQL primero)

**Files:**
- Modify: `supabase/functions/invitar-usuario/index.ts`
- Create: `supabase/functions/invitar-usuario/invitar_test.ts`

**Spec (canónico, no inventar reserva SQL):** validar identidad + rol + tenant + AAL2 → `createUser` → `admin_usuario_invitar` (ya exige que Auth exista, `GC-AUTH-003`) → si el RPC falla, `auth.admin.deleteUser(id)` inmediato + log. Extraer dependencias inyectables.

**Interfaces:**
- Consumes: `admin_usuario_invitar(uuid, email, rol, nombre)` existente
- Produces:

```ts
export type InviteDeps = {
  requireActor: (req: Request) => Promise<{ userId: string; tenantId: string; rol: string; aal: string }>
  createUser: (input: { email: string; password: string; metadata: Record<string, string> }) => Promise<{ id: string }>
  inviteProfile: (input: { authUserId: string; email: string; rol: string; nombre: string }) => Promise<void>
  deleteUser: (id: string) => Promise<void>
}

export async function invitarUsuario(deps: InviteDeps, req: Request): Promise<Response>
```

- [ ] **Step 1: Write the failing Deno test**

```ts
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { invitarUsuario, type InviteDeps } from "./invitar.ts";

Deno.test("createUser no se llama si el actor no es admin/supervisor o AAL < aal2", async () => {
  let created = 0;
  const deps: InviteDeps = {
    requireActor: () => Promise.reject(new Error("GC-AUTH-001")),
    createUser: async () => { created += 1; return { id: "x" }; },
    inviteProfile: async () => {},
    deleteUser: async () => {},
  };
  const res = await invitarUsuario(deps, new Request("http://n", { method: "POST", body: "{}" }));
  assertEquals(res.status, 401);
  assertEquals(created, 0);
});

Deno.test("si inviteProfile falla se llama deleteUser", async () => {
  let deleted = "";
  const deps: InviteDeps = {
    requireActor: async () => ({ userId: "a", tenantId: "t", rol: "admin", aal: "aal2" }),
    createUser: async () => ({ id: "auth-new" }),
    inviteProfile: async () => { throw new Error("GC-AUTH-002"); },
    deleteUser: async (id) => { deleted = id; },
  };
  const res = await invitarUsuario(deps, new Request("http://n", { method: "POST", body: JSON.stringify({ email: "x@y.z", rol: "asesor", nombre: "X" }) }));
  assertEquals(res.status >= 400, true);
  assertEquals(deleted, "auth-new");
});
```

- [ ] **Step 2: Run test, verify it fails**

Run: `cd supabase/functions && deno test invitar-usuario/invitar_test.ts`  
Expected: FAIL (`invitar.ts` no existe o `invitarUsuario` no exportado).

- [ ] **Step 3: Extract `invitar.ts` and rewrite `index.ts`**

Orden: `requireActor` (JWT + `rol_actual` ∈ {admin, supervisor} + `aal === 'aal2'`) → `createUser` → `inviteProfile` → si throw, `deleteUser` + log `{ request_id, outcome: 'error' }` sin email en claro si se puede hashear.

No crear RPCs de reserva. No dejar Auth huérfano.

- [ ] **Step 4: Run test to verify it passes**

Run: `deno test supabase/functions/invitar-usuario/invitar_test.ts`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/invitar-usuario
git commit -m "fix: authorize invite before createUser and roll back Auth"
```

---

### Task 3: `importer` — authz antes de Storage

**Files:**
- Modify: `supabase/functions/importer/index.ts`
- Create: `supabase/functions/importer/importer_authz_test.ts`

**Bug:** upload L104–130 ocurre antes de `requireAuth` L132.

- [ ] **Step 1: Write the failing test**

```ts
Deno.test("sin Authorization no se llama storage.upload", async () => {
  // request sin header → 401 y uploadCalls === 0
  throw new Error("not wired");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `deno test supabase/functions/importer/importer_authz_test.ts`  
Expected: FAIL.

- [ ] **Step 3: Implement**

Mover `requireAuth` + chequeo rol `admin|supervisor` **antes** de `arrayBuffer`/`upload`. Si authz falla, no tocar Storage.

- [ ] **Step 4: Run test, verify pass**

Run: `deno test supabase/functions/importer/importer_authz_test.ts`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/importer
git commit -m "fix: authorize importer before storage upload"
```

---

### Task 4: Sacar `webhook_secret` de `tenant.configuracion`

**Files:**
- Create: `supabase/migrations/YYYYMMDDHHMMSS_webhook_secret_vault.sql`
- Create: `supabase/tests/p0_webhook_secret.sql`
- Modify: `supabase/migrations` consumers — `admin_webhook_rotar_secret`, `integracion_recibir`
- Modify: `apps/web/src/lib/cargarDominio.ts` — dejar de esperar el secret en `configuracion`
- Modify: `apps/web/src/pages/ConfiguracionPage.tsx` — UI de rotación usa RPC, no lee el valor

- [ ] **Step 1: Write the failing test**

```sql
begin;
select plan(3);

-- authenticated del tenant NO puede leer el secret
set local role authenticated;
-- set jwt claims via request.jwt.claim (pgTAP helper del repo)
select is(
  (select configuracion ? 'webhook_secret' from public.tenant limit 1),
  false,
  'configuracion no expone webhook_secret'
);

select throws_ok(
  $$select public.admin_webhook_secret_plain()$$,  -- no debe existir para authenticated
  '42501'
);

select * from finish();
rollback;
```

- [ ] **Step 2: Run test to verify it fails**

Run: `supabase test db --file supabase/tests/p0_webhook_secret.sql`  
Expected: FAIL (`configuracion` hoy SÍ tiene la key tras rotar).

- [ ] **Step 3: Implement**

1. Tabla `public.tenant_webhook_secret` (`tenant_id` PK, `secret_hash` text, `secret_last4` text, `rotated_at` timestamptz). RLS: **ningún** GRANT a `authenticated`. Solo SECURITY DEFINER + `service_role`.
2. `admin_webhook_rotar_secret()`: genera secret, escribe hash+last4, **borra** key de `tenant.configuracion`, retorna el plain **una vez** al caller (Edge/admin RPC).
3. `integracion_recibir`: lee hash de la tabla nueva, compara HMAC (Task 6).
4. Job único (migración de datos): si `configuracion->>'webhook_secret'` existe, mover y `configuracion = configuracion - 'webhook_secret'`.
5. UI: muestra `WebhookSecretStatus { tenantId, configurado, rotadoEn, last4 }` — nunca el plain salvo respuesta de rotación.

- [ ] **Step 4: Run test to verify it passes**

Run: `supabase test db --file supabase/tests/p0_webhook_secret.sql`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations supabase/tests/p0_webhook_secret.sql apps/web/src
git commit -m "fix: move webhook_secret out of tenant.configuracion"
```

---

### Task 5: Revocar `seed_solicitud_estados(uuid)` a authenticated

**Files:**
- Create: `supabase/migrations/YYYYMMDDHHMMSS_revoke_seed_estados.sql`
- Create: `supabase/tests/p0_seed_estados.sql`

- [ ] **Step 1: Write the failing test**

```sql
begin;
select plan(2);
select throws_ok(
  $$select public.seed_solicitud_estados('00000000-0000-0000-0000-000000000001'::uuid)$$,
  '42501'
);
select ok(
  has_function_privilege('service_role', 'public.seed_solicitud_estados(uuid)', 'execute')
  or has_function_privilege('postgres', 'public.seed_solicitud_estados(uuid)', 'execute')
);
select * from finish();
rollback;
```

- [ ] **Step 2: Run test to verify it fails**

Run: `supabase test db --file supabase/tests/p0_seed_estados.sql`  
Expected: FAIL (hoy authenticated tiene EXECUTE).

- [ ] **Step 3: Implement**

```sql
revoke execute on function public.seed_solicitud_estados(uuid) from public, anon, authenticated;
grant execute on function public.seed_solicitud_estados(uuid) to postgres, service_role;
```

Confirmar que `seed_solicitud_estados()` (sin uuid) — si existe — no queda abierta.

- [ ] **Step 4: Run test, verify pass + commit**

```bash
git add supabase/migrations supabase/tests/p0_seed_estados.sql
git commit -m "fix: revoke seed_solicitud_estados from authenticated"
```

---

### Task 6: HMAC constant-time en SQL

**Files:**
- Modify: whoever implements `integracion_recibir` HMAC compare
- Create: `supabase/tests/p1_hmac_constant.sql`
- Modify: `supabase/functions/_shared/hmac.ts` (ya tiene `timingSafeEqual` — verificar uso en todos los callers)

- [ ] **Step 1: Write failing test**

Buscar `hmac =` o `encode(hmac(...))` en `supabase/migrations/*integracion*`. El test pgTAP no mide timing; afirma **igualdad de longitud + digest compare**:

```sql
select ok(
  public.hmac_eq(decode('aa','hex'), decode('aa','hex')),
  'equal digests'
);
select ok(
  not public.hmac_eq(decode('aa','hex'), decode('bb','hex')),
  'different digests'
);
```

Helper nuevo `public.hmac_eq(bytea, bytea)` SECURITY DEFINER que usa `digest` + comparación por bloques (o `hmac` built-in + `=` sobre hashes de longitud fija — el leak de longitud ya no aplica).

- [ ] **Step 2: Implement + wire `integracion_recibir` + Edge callers**

- [ ] **Step 3: Commit**

```bash
git commit -m "fix: constant-time HMAC compare for webhooks"
```

---

### Task 7: Quitar UPDATE PostgREST de máquinas de estado

**Files:**
- Modify: `apps/web/src/lib/api.ts` (`updateDeposito`, `updateSolicitud`, mutaciones lead)
- Modify: `apps/web/src/lib/persistir.ts`
- Create/Modify: `apps/web/src/lib/persistir.test.ts`, `apps/web/tests/api-mutations.test.ts`
- Create: `supabase/migrations/YYYYMMDDHHMMSS_revoke_direct_updates.sql` — RLS UPDATE restrictivo
- Create: `supabase/tests/p1_state_machines.sql`

**Entidades:** `deposito`, `solicitud`, `lead` (y `visita`/`persona` si aún hay `.update()` directo fuera de RPC).

- [ ] **Step 1: Write failing client test**

```ts
// apps/web/tests/api-mutations.test.ts
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const api = readFileSync(new URL("../src/lib/api.ts", import.meta.url), "utf8");

test("api.ts no hace update() directo a deposito/solicitud/lead", () => {
  assert.equal(/\.(from\(['\"]deposito['\"]\)[\s\S]*?\.update\()/.test(api), false);
  assert.equal(/\.(from\(['\"]solicitud['\"]\)[\s\S]*?\.update\()/.test(api), false);
  assert.equal(/\.(from\(['\"]lead['\"]\)[\s\S]*?\.update\()/.test(api), false);
});
```

Test SQL: asesor `UPDATE deposito SET estado='confirmado'` → 0 rows / RLS deny.

- [ ] **Step 2: Run tests, verify fail**

Run: `pnpm --filter @gc/web test -- tests/api-mutations.test.ts`  
Expected: FAIL (hoy hay `.update(`).

- [ ] **Step 3: Implement**

Cliente: solo RPC (`deposito_enviar`, `solicitud_transicion`, etc.).  
SQL: policy UPDATE de esas tablas = `false` para `authenticated`, o solo columnas no-estado vía trigger `forbid_estado_update`. Preferir **trigger** que rechace cambio de `estado`/`subestado` si `current_setting('gc.allow_estado', true)` no es `'1'` (las RPC lo setean).

- [ ] **Step 4: Pass + commit**

```bash
git commit -m "fix: block PostgREST updates that skip state-machine RPCs"
```

---

### Task 8: Auth-guard registra + CORS allowlist + `verify_jwt`

**Files:**
- Modify: `supabase/functions/auth-guard/index.ts`
- Modify: `supabase/config.toml` — `[functions.auth-guard] verify_jwt = false` (el guard valida él; documentar), `rastreo-ingesta`/`push-notifications` explícitos
- Modify: `apps/web` / `apps/backoffice` — login llama `auth-guard` **antes** de entrar al chrome
- Create: `supabase/functions/auth-guard/auth_guard_test.ts`

**RequestContext** (índice; no añadir campos):

```ts
export type RequestContext = { requestId: string };
```

Logs: `EdgeLogFields` del índice (`requestId` + `tenantId` + `userId` + `fn` + `outcome`). Auth-guard inserta `public.auth_evento` (RLS: authenticated no SELECT; solo service_role / RPC admin).

CORS fail-closed: allowlist = `{ https://jarguetam.github.io, http://localhost:5173, http://localhost:5174 }`. Variable `ALLOWED_ORIGINS` ausente → no enviar `*`; responder 500 `GC-CORE-001` en OPTIONS. No hay Pages staging.

- [ ] **Step 1: Test Deno** — request sin origin válido → no `Access-Control-Allow-Origin: *`; login fallido incrementa fila `auth_evento`.

- [ ] **Step 2: Implement + commit**

```bash
git commit -m "feat: auth-guard audit log and CORS allowlist"
```

---

### Task 9: `config_rastreo` — asesor no apaga; admin tenant controla

**Files:**
- Create: `supabase/migrations/YYYYMMDDHHMMSS_config_rastreo_admin.sql`
- Create: `supabase/tests/p1_config_rastreo.sql`
- Modify: RPCs de config si existen
- Modify: `apps/web` ConfiguracionPage — toggle solo `rol === 'admin'`
- Mobile se cablea en Gate 4; aquí solo contrato SQL.

**Tabla/JSON canónico** (si aún no existe columna dedicada):

```sql
-- tenant.configuracion->'rastreo'  OR tabla public.config_rastreo
-- Campos: intervalo_seg, accuracy, persistir_offline
-- El flag "asesor puede pausar" NO existe. No añadirlo.
```

RLS: UPDATE de ese objeto solo `rol_actual() = 'admin'`. Supervisor lectura. Asesor lectura (para saber intervalo) sin escritura.

- [ ] **Step 1: pgTAP** — asesor UPDATE config_rastreo → fail; admin → ok.

- [ ] **Step 2: Implement + commit**

```bash
git commit -m "fix: only tenant admin can write config_rastreo"
```

---

### Task 10: Migrar JWT helpers en RLS restante

**Files:**
- Create: `supabase/migrations/YYYYMMDDHHMMSS_rls_jwt_helpers_rest.sql`
- Modify: policies in `deposito`, `solicitud`, `lead`, `integracion`, storage, `configuracion`

Reemplazar `auth.jwt() ->> 'tenant_id'|'rol'` por `public.tenant_id_actual()` / `public.rol_actual()` (ya existen en `20260827230000_jwt_claims_helpers.sql`).

- [ ] **Step 1: grep test** — CI script `! grep -R "auth.jwt()" supabase/migrations/*.sql` de **nuevas** policies; las viejas se reescriben en esta migración.

- [ ] **Step 2: Implement + commit**

```bash
git commit -m "fix: use jwt claim helpers in remaining RLS policies"
```

---

### Task 11: `pdf-solicitud` sin fallback `service_role`

**Files:**
- Modify: `supabase/functions/pdf-solicitud/index.ts`
- Create: `supabase/functions/pdf-solicitud/pdf_authz_test.ts`

**Interfaces:**
- Produces: `generarPdf(req)` usa únicamente el JWT del caller (anon/authenticated). Si RLS oculta la solicitud → 404/403 `GC-SOLI-001`, no retry con service_role.

- [ ] **Step 1: Failing test** — mock client: `select` vacío → no se instancia `createClient(..., SERVICE_ROLE)`.

```ts
Deno.test("pdf-solicitud no usa SERVICE_ROLE si RLS niega", async () => {
  const src = await Deno.readTextFile(new URL("./index.ts", import.meta.url));
  const usesFallback = /service_role|SERVICE_ROLE/.test(src) && /createClient/.test(src);
  if (usesFallback) throw new Error("service_role fallback still present");
});
```

- [ ] **Step 2: Run, expect FAIL** if fallback exists.

Run: `deno test supabase/functions/pdf-solicitud/pdf_authz_test.ts`

- [ ] **Step 3: Delete fallback; map empty RLS to `GC-SOLI-001`.**

- [ ] **Step 4: Pass + commit**

```bash
git commit -m "fix: remove pdf-solicitud service_role fallback"
```

---

### Task 12: `push-notifications` solo service_role o rol explícito

**Files:**
- Modify: `supabase/functions/push-notifications/index.ts`
- Modify: `supabase/config.toml` — `[functions.push-notifications] verify_jwt = true`
- Create: `supabase/functions/push-notifications/push_authz_test.ts`

No decodificar JWT a mano. `verify_jwt = true` + chequeo `auth.jwt() ->> 'role' === 'service_role'` **o** RPC `rol_actual() in ('admin')` si se permite trigger autenticado. Preferir **solo service_role** (cron/notify-jobs). Caller authenticated → 403 `GC-PUSH-010`.

- [ ] **Step 1: Test** request con JWT user → 403 y cero writes a FCM mock.

- [ ] **Step 2: Implement + commit**

```bash
git commit -m "fix: restrict push-notifications to service_role"
```

---

### Task 13: Rate limit login + 429

**Files:**
- Create: `supabase/migrations/YYYYMMDDHHMMSS_auth_evento_rate.sql`
- Create: `supabase/tests/p1_auth_rate.sql`
- Modify: `supabase/functions/auth-guard/index.ts`

```sql
create table public.auth_evento (
  id uuid primary key default gen_random_uuid(),
  creado_en timestamptz not null default now(),
  ip inet,
  email_hash text,
  outcome text not null check (outcome in ('ok','fail','blocked')),
  request_id text
);
-- RLS: no grant to authenticated
```

Umbral canónico: **5** `fail` por `ip` en **10 minutos** → siguiente intento `blocked` + HTTP **429** + `GC-AUTH-040`. IP desde `x-forwarded-for` primer hop, normalizada IPv4/IPv6.

- [ ] **Step 1: Deno test** — 5 fails + 6º = 429.

- [ ] **Step 2: pgTAP** — authenticated no puede `select` `auth_evento`.

- [ ] **Step 3: Commit**

```bash
git commit -m "feat: login rate limit with 429 and auth_evento"
```

---

### Task 14: AAL2 en RPCs de plataforma + `usuario_plataforma`

**Files:**
- Create: `supabase/migrations/YYYYMMDDHHMMSS_plataforma_aal2.sql`
- Create: `supabase/tests/p1_plataforma_aal2.sql`

```sql
create or replace function public.require_plataforma_aal2()
returns void language plpgsql security definer as $$
begin
  if not exists (
    select 1 from public.usuario_plataforma up
    where up.auth_user_id = auth.uid()
  ) then
    raise exception 'GC-AUTH-010';
  end if;
  if auth.jwt() ->> 'aal' is distinct from 'aal2' then
    raise exception 'GC-AUTH-011';
  end if;
end;
$$;
```

Invocar al inicio de RPCs backoffice (tenants, impersonación, billing si existe). Grant execute solo a authenticated; la función misma chequea membresía.

- [ ] **Step 1: pgTAP** — JWT sin fila `usuario_plataforma` → `GC-AUTH-010`; AAL1 → `GC-AUTH-011`.

- [ ] **Step 2: Commit**

```bash
git commit -m "fix: require usuario_plataforma and AAL2 on platform RPCs"
```

UI MFA enroll queda en Gate 3.

---

### Task 15: Tipos Supabase versionados + Auth hook

**Files:**
- Modify: `apps/web/src/types/database.ts` (regenerar)
- Create: `apps/backoffice/src/types/database.ts` if missing (copy/shared)
- Create: `scripts/ops/check-auth-hook.ts`
- Create: `.github/workflows/ci.yml` step later in Gate 2: `supabase gen types typescript --local`

- [ ] **Step 1: Test** — `git diff --exit-code` tras `supabase gen types --local` en CI (Gate 2 lo cablea). Aquí: script que escribe tipos desde local start.

- [ ] **Step 2: `check-auth-hook.ts`** GET Management Auth config; `custom_access_token_enabled === true` o fail `GC-OPS-003`. No imprime JWT secret.

- [ ] **Step 3: Commit tipos + script**

```bash
git commit -m "chore: version Supabase types and auth-hook preflight"
```

---

### Task 16: Firebase API key restringida + buckets privados

**Files:**
- Create: `scripts/ops/restrict-firebase-android-key.ts`
- Create: `supabase/tests/p1_storage_buckets.sql`
- Modify: storage policies if public

Firebase: si existe `GOOGLE_SERVICE_ACCOUNT_KEY`, PATCH key restrictions (API = FCM + Android app SHA). Si no hay credencial: exit `GC-OPS-008` (secret GitHub faltante), no pedir Dashboard. Gate 5 reintenta.

Buckets: `importer`, `pdf`, avatares — `public = false`; policy `tenant_id_actual()`.

- [ ] **Step 1: pgTAP** — `storage.buckets.public = false` para buckets de producto.

- [ ] **Step 2: Commit**

```bash
git commit -m "fix: private storage buckets and firebase key restriction script"
```

---

### Task 17: Rotar HMAC existentes + `verify_jwt` en config.toml

**Files:**
- Modify: `supabase/config.toml` — cada `[functions.<name>] verify_jwt = true|false` explícito (`auth-guard` y `webhook-tenant` = false; resto true)
- Create: `scripts/ops/rotate-all-webhook-secrets.ts` — service_role staging only en este gate (prod en Gate 6)
- Modify: test `hmac.ts` callers usan `timingSafeEqual`

Tras Task 4, un job (manual) rota todos los tenants: RPC `admin_webhook_rotar_secret` por tenant. Guardar plains **una vez** en artifact cifrado o mostrar a admin tenant en UI (Gate 3). No commitear plains.

- [ ] **Step 1: Contract test** — `config.toml` contiene `verify_jwt` para las 8 funciones.

- [ ] **Step 2: Commit**

```bash
git commit -m "fix: explicit verify_jwt and HMAC rotation after vault move"
```

---

### Task 18: Checklist Gate 1 + PR

- [ ] `supabase test db` (todos los `p0_*` `p1_*`) en blanco + replay.
- [ ] `deno check` + `deno test` de funciones tocadas.
- [ ] PR `fix/gate-1-security` → `main`. **No mergear** si Gate 0 preflight rojo.
- [ ] Actualizar `docs/runbooks/production-readiness.md` sección Gate 1.

```bash
git commit -m "docs: gate 1 security checklist"
```

---

## Self-review

| Spec / índice | Task |
|---|---|
| Invite + rollback Auth | 1–2 |
| Importer authz | 3 |
| webhook_secret vault + rotate HMAC | 4, 6, 17 |
| seed_estados | 5 |
| state machines | 7 |
| auth-guard, CORS, verify_jwt | 8, 13, 17 |
| config_rastreo | 9 |
| JWT helpers | 10 |
| pdf-solicitud / push | 11–12 |
| rate limit 429 | 13 |
| AAL2 + usuario_plataforma | 14 |
| tipos + Auth hook | 15 |
| Firebase key + buckets | 16 |

No iOS. No demo (Gate 3). No EAS (Gate 4). No Pages staging.
