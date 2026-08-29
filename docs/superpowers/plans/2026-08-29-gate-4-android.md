# Gate 4 — Android interno Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** App de campo en Play Internal Testing (AAB via EAS) + APK preview instalable. El asesor **no puede apagar** el rastreo. Sin permisos de ubicación, el campo se bloquea (solo logout + ajustes del sistema).

**Architecture:** Expo 51 / RN 0.74. EAS projectId real. Rastreo: ventana/intervalo desde `config_rastreo`. TaskManager — no `setInterval`. iOS **fuera**. Preview APK → staging; AAB → production.

**Tech Stack:** EAS Build, expo-location, expo-task-manager, expo-secure-store, Sentry React Native, Detox, Play Internal Testing.

**Spec:** Gate 4 del diseño  
**Índice:** `docs/superpowers/plans/2026-08-29-production-hardening-index.md`

## Global Constraints

- iOS fuera: ningún profile `ios` ni `eas submit --platform ios`.
- Preview = staging only; production AAB = prod only.
- `requirePublicConfig` / `EXPO_PUBLIC_*`; build falla con `GC-CORE-001`.
- Asesor sin switch de rastreo. Admin tenant via `config_rastreo`.
- No commitear APK/AAB. No `git filter-repo` (fuera de alcance).
- Node 22.14.0; Expo SDK alineado (Doctor).
- Sentry sin coordenadas.

---

## File structure

```
apps/mobile/app.json / app.config.ts
apps/mobile/eas.json
apps/mobile/src/screens/AjustesScreen.tsx
apps/mobile/src/services/rastreoServicio.ts
apps/mobile/src/services/permisosCampo.ts
apps/mobile/src/navigation/*
apps/mobile/src/lib/env.ts
apps/mobile/.gitignore                    # quitar excepción APK
releases/*.apk                            # delete from git
.github/workflows/eas-preview.yml
.github/workflows/eas-internal.yml
```

---

### Task 1: EAS projectId + quitar APKs del git

**Files:**
- Modify: `apps/mobile/app.json` — `extra.eas.projectId` (UUID de expo.dev; Gate 0 lo crea o lee)
- Modify: `apps/mobile/eas.json` — profiles `preview` (APK) y `production` (AAB)
- Modify: `.gitignore` — **borrar** las líneas `!apps/mobile/releases/*.apk` y `!releases/*.apk`
- Delete from git (keep local untracked): `apps/mobile/releases/*.apk`, `releases/*.apk`

- [ ] **Step 1: Failing test**

```ts
// apps/mobile/tests/eas-config.test.ts
test("app.json tiene extra.eas.projectId no vacío", () => {
  const j = JSON.parse(readFileSync("apps/mobile/app.json", "utf8"));
  assert.ok(j.expo.extra.eas.projectId.length > 10);
});

test("gitignore no exceptúa APKs", () => {
  const g = readFileSync(".gitignore", "utf8");
  assert.equal(g.includes("!apps/mobile/releases/*.apk"), false);
});
```

Expected: FAIL (`extra.eas: {}`, gitignore exceptúa).

- [ ] **Step 2: Implement. No commitear APKs.** Usar `git rm --cached` en los binarios.

- [ ] **Step 3: Commit**

```bash
git commit -m "chore: set EAS projectId and stop tracking debug APKs"
```

---

### Task 2: Env móvil obligatorio (sin demo)

**Files:**
- Create: `apps/mobile/src/lib/env.ts`
- Modify: `app.config.ts` to inject `EXPO_PUBLIC_SUPABASE_URL` / `ANON_KEY` / `SENTRY_DSN`
- EAS secrets: mismos nombres en expo.dev + GitHub env `eas-android`

```ts
export function requireMobileEnv() {
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("GC-CORE-001");
  return { url, key, sentryDsn: process.env.EXPO_PUBLIC_SENTRY_DSN };
}
```

- [ ] **Step 1: Unit test throw / pass**

- [ ] **Step 2: Quitar cualquier `DEMO_MODE` / seed local de agenda**

- [ ] **Step 3: Commit**

```bash
git commit -m "fix: require Supabase env in the mobile app"
```

---

### Task 3: Quitar switch de rastreo del asesor

**Files:**
- Modify: `apps/mobile/src/screens/AjustesScreen.tsx` (L78–90 hoy switch)
- Create: `apps/mobile/src/screens/ajustesRastreo.test.ts` — si hay tests de copy
- Create: `apps/mobile/src/components/RastreoEstado.tsx` — solo lectura: “Activo · cada N min” o “Bloqueado: activá Ubicación”

**No** `Switch` / `Toggle` para rastreo. Admin cambia intervalo en web (`config_rastreo`, Gate 1 Task 9).

- [ ] **Step 1: Test**

```ts
test("AjustesScreen no renderiza switch de rastreo", () => {
  const src = readFileSync("apps/mobile/src/screens/AjustesScreen.tsx", "utf8");
  assert.equal(/rastreo[\s\S]{0,80}Switch/i.test(src), false);
});
```

Expected: FAIL.

- [ ] **Step 2: Implement + commit**

```bash
git commit -m "fix: remove advisor tracking toggle from Ajustes"
```

---

### Task 4: Motor de rastreo nativo + bloqueo de campo

**Files:**
- Rewrite: `apps/mobile/src/services/rastreoServicio.ts` (`setInterval` → `TaskManager.defineTask` + `Location.startLocationUpdatesAsync`)
- Create: `apps/mobile/src/services/permisosCampo.ts`
- Modify: navigation / agenda / check-in screens

```ts
export type CampoAccess = "ok" | "blocked_location";

export async function resolveCampoAccess(): Promise<CampoAccess> {
  const { status, canAskAgain } = await Location.getForegroundPermissionsAsync();
  if (status === "granted") return "ok";
  return "blocked_location";
}
```

Si `blocked_location`:
- Agenda, check-in, sync, captura: **no** interactivos.
- Pantalla bloqueo: copy + botón “Abrir ajustes” (`Linking.openSettings`) + “Cerrar sesión”.
- Logout **sí** permitido.

Background: Android foreground service notification “Gestiones Comerciales está registrando la ruta” (texto no amenazante). `accuracy` e `intervalo` desde `config_rastreo` (lectura RLS asesor OK).

`onAuthStateChange`: al `SIGNED_OUT` stop updates; al `SIGNED_IN` start si permisos ok.

- [ ] **Step 1: Unit tests** de `resolveCampoAccess` con Location mock

- [ ] **Step 2: Test** `rastreoServicio.ts` no usa `setInterval` como scheduler principal

```ts
assert.equal(src.includes("setInterval"), false);
```

- [ ] **Step 3: Implement + commit**

```bash
git commit -m "feat: native location task and lock field without GPS permission"
```

---

### Task 5: Sesión — onAuthStateChange + refresh

**Files:**
- Modify: mobile auth provider / `supabase` client
- Create: `apps/mobile/src/lib/sesion.test.ts`

Hoy no hay `onAuthStateChange`. Añadir: token refresh, logout remoto, rehidratar perfil.

- [ ] **Step 1: Test** — mock events `SIGNED_IN` / `SIGNED_OUT` actualizan estado

- [ ] **Step 2: Commit**

```bash
git commit -m "fix: subscribe to onAuthStateChange on mobile"
```

---

### Task 6: Sentry RN + source maps EAS

**Files:**
- `apps/mobile/src/lib/sentry.ts`
- `eas.json` hook `sentry-expo` / `@sentry/react-native` plugin
- Secret `SENTRY_AUTH_TOKEN` en EAS

- [ ] **Step 1: Test init no crashea sin DSN en test env; crashea build prod sin DSN**

- [ ] **Step 2: Commit**

```bash
git commit -m "feat: Sentry React Native with EAS source maps"
```

---

### Task 7: Workflows EAS preview + internal

**Files:**
- Create: `.github/workflows/eas-preview.yml` — PR labeled `android-preview` → `eas build --platform android --profile preview --non-interactive`
- Create: `.github/workflows/eas-internal.yml` — `workflow_dispatch` / tag `android-*` → `eas build --platform android --profile production` + `eas submit --platform android --latest` (Internal Testing track)

Environment: `eas-android`. Secrets: `EXPO_TOKEN`, Play JSON key (`GOOGLE_SERVICE_ACCOUNT_KEY`).

**No iOS profiles.**

- [ ] **Step 1: Contract test** — yaml no contiene `ios` submit

- [ ] **Step 2: Commit**

```bash
git commit -m "ci: EAS Android preview APK and Play Internal AAB"
```

---

### Task 8: Expo Doctor + vulnerabilidades de deps

**Files:**
- Modify: `apps/mobile/package.json` — alinear react/RN/expo a SDK soportado
- Create: `.github/workflows/eas-preview.yml` step `npx expo-doctor`
- Create: `docs/ops/expo-audit-exceptions.md` only if a high no llega al APK

- [ ] **Step 1: CI job** `expo-doctor` exit 0.

- [ ] **Step 2: `pnpm --filter @gc/mobile audit --prod`**. Si falla por tooling: excepción documentada + `overrides` si el paquete sí viaja al binario.

- [ ] **Step 3: Commit**

```bash
git commit -m "fix: align Expo SDK dependencies and record audit exceptions"
```

---

### Task 9: Limpieza de sesión/cola + FCM

**Files:**
- Create: `apps/mobile/src/lib/logoutCleanup.ts`
- Create: `apps/mobile/src/lib/logoutCleanup.test.ts`
- Modify: push token registration

```ts
export async function logoutCleanup(userId: string): Promise<void> {
  await SecureStore.deleteItemAsync('supabase.session')
  await clearCola(userId) // solo partición de ese userId/tenant
  await invalidateFcmToken()
}
```

FCM: registrar token al `SIGNED_IN`; `remove` al logout; Edge `push-notifications` marca inválidos (`GC-PUSH-014`). Rotar: nuevo token reemplaza fila.

Cola: key = `${tenantId}:${userId}`; test que user B no lee cola de A.

- [ ] **Step 1: Tests** partición + `logoutCleanup` borra session y cola.

- [ ] **Step 2: Commit**

```bash
git commit -m "fix: partition offline queue and rotate FCM tokens on logout"
```

---

### Task 10: Recuperación de contraseña móvil + deep links

**Files:**
- Create: `apps/mobile/src/screens/RecuperarPasswordScreen.tsx`
- Modify: `app.json` `scheme` + intent filters Android

Mismo `resetPasswordForEmail` que Gate 3; redirect `gc://recuperar`. Probar: notificación tap, persistencia tras kill (Documentar Detox Task 11).

- [ ] **Step 1: Test** screen no tiene switch demo.

- [ ] **Step 2: Commit**

```bash
git commit -m "feat: mobile password recovery and Android deep link scheme"
```

---

### Task 11: Detox — permisos, offline, sesión, cola

**Files:**
- Create: `apps/mobile/.detoxrc.js`
- Create: `apps/mobile/e2e/rastreoPermisos.test.ts`
- Create: `apps/mobile/e2e/sesionOffline.test.ts`
- Create: `.github/workflows/detox-android.yml` (emulator API 34, no iOS)

Casos obligatorios del spec:
1. Permiso concedido → agenda usable, TaskManager activo.
2. Denegado → campo bloqueado, logout ok.
3. Revocado en ajustes → al volver a foreground bloquea.
4. Restaurado → desbloquea.
5. Background + kill → cola se reenvía al volver online.
6. Logout limpia cola/sesión.

- [ ] **Step 1: Un test Detox mínimo que falle (app no arranca perfil preview).

- [ ] **Step 2: Implement suite + CI (puede ser `workflow_dispatch` si el runner no tiene emulator; entonces DoD = verde en emulador local documentado).

- [ ] **Step 3: Commit**

```bash
git commit -m "test: Detox Android coverage for tracking permissions and offline queue"
```

---

### Task 12: Checklist Gate 4 + runbook

**Files:**
- Create: `docs/runbooks/android-internal.md`

Manual:
1. APK preview en emulador API 34 → staging.
2. Denegar ubicación → bloqueo; logout ok.
3. Conceder → rastreo sin switch.
4. AAB Internal (`eas submit`) o dry-run si Gate 0 marcó Play ausente.

```bash
git commit -m "docs: Android internal testing runbook and Gate 4 checklist"
```

---

## Self-review

| Spec / índice | Task |
|---|---|
| EAS / APK git | 1, 7 |
| no demo + env | 2 |
| sin switch asesor | 3 |
| TaskManager + bloqueo | 4 |
| onAuthStateChange | 5 |
| Sentry RN | 6 |
| Expo Doctor / audit | 8 |
| cola / FCM | 9 |
| password + deep links | 10 |
| Detox | 11 |
