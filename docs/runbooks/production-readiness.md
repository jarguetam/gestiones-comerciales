# Production readiness

Checklist vivo. Cada gate marca su sección.

## Gate 0 — Inventario

- [x] Preflight de solo lectura (`pnpm ops:preflight`, job CI).
- [x] Node `22.14.0` / pnpm `9.15.9` anclados (`.nvmrc`, `packageManager`).
- [ ] Token con permiso para crear/administrar staging (`canCreateProject`). Si falta: `GC-OPS-006`.

## Gate 1 — Contención de seguridad

### Checklist

| Área | Verificación |
|------|----------------|
| Invitaciones | Solo `usuario_plataforma.es_superadmin` + AAL2; rollback Auth en fallo |
| Importer | Autorización antes de Storage; allowlist GC-* |
| Webhook HMAC | Secreto en Vault; `hmac_eq` timing-safe; rotación UI last4 |
| `seed_solicitud_estados` | Revocado para authenticated |
| Máquinas de estado | Columnas `estado` bloqueadas; transiciones vía RPC |
| Login | `auth-guard` centralizado; `auth_evento` 5 fails/10 min → 429 `GC-AUTH-040` |
| `config_rastreo` | Escritura solo admin tenant |
| RLS helpers | `tenant_id_actual()` / `rol_actual()` en deposito, solicitud, storage |
| PDF / Push | Sin fallback service_role; push solo service_role |
| Plataforma | `require_plataforma_aal2()` en RPCs backoffice |
| Storage | Buckets `firmas`, `documentos`, `importes` privados |
| `verify_jwt` | Explícito en las 8 Edge Functions (`config.toml`) |
| Auth hook | `node --experimental-strip-types scripts/ops/check-auth-hook.ts` |

### Comandos locales

```bash
pnpm -r typecheck
pnpm -r test
deno test --allow-read supabase/functions/
node --experimental-strip-types --test scripts/ops/*.test.ts
# pgTAP (requiere Docker):
# supabase test db
```

### Scripts ops

| Script | Uso |
|--------|-----|
| `scripts/ops/check-auth-hook.ts` | Valida `custom_access_token` en Management API |
| `scripts/ops/rotate-all-webhook-secrets.ts` | Rotación masiva staging (service_role) |
| `scripts/ops/restrict-firebase-android-key.ts` | Restricción API key Android FCM |

### Post-merge

- Rotar HMAC en staging con `rotate-all-webhook-secrets.ts`; entregar plaintext una vez al admin.
- Gate 3: MFA enroll UI backoffice.
- Gate 6: rotación prod.

## Gate 2 — CI/CD y entornos

- [x] CI: Node `22.14.0`, `--frozen-lockfile`, lint, typecheck, unit, deno, pgTAP blank+replay, gitleaks, audit `--prod --audit-level=high`, allowlist `SECURITY DEFINER`.
- [x] Pages solo producción (`.github/workflows/pages-prod.yml`). Sin site `/staging/` en github.io.
- [x] Staging: `supabase-staging.yml` + `e2e-staging.yml` (Vite en el runner).
- [x] Prod Supabase: solo `workflow_dispatch` (`.github/workflows/supabase-prod.yml`).
- [x] `requirePublicConfig` (`GC-CORE-001`) y contrato anti-ref hardcodeada.
- [x] Seeds sintéticos (`Acme Staging`). Contraseñas e2e en secrets, no en SQL.
- [ ] GitHub Environments `staging` y `production` con la tabla de secrets de `docs/runbooks/environments.md`.
- [ ] Proyecto Supabase staging creado (misma región/major que prod). El script falla `GC-OPS-006` si el token no puede.
- [ ] SMTP configurado en ambos proyectos (`scripts/ops/configure-supabase-project.ts`; ausencia = `GC-OPS-008`).

## Gate 3+ — completados

- [x] Gate 3 — Runtime web y backoffice (sin demo). PR #42 mergeado.
- [x] Gate 4 — Android interno (EAS, rastreo, sin demo). PR #43 mergeado.

## Gate 5 — Observabilidad y operación

- [x] `request_id` en las 8 Edge Functions.
- [x] Releases Sentry en Pages (`web@` / `backoffice@`); workflow `ops-sentry-release.yml`.
- [x] Probes cada 15 min (`ops-health.yml`) + runbook de incidentes.
- [x] Rotación HMAC script + runbook (staging primero).
- [x] PITR assert 7d + dump semanal staging.
- [x] `auth_evento_stats` sobre `auth_evento`.
- [x] Purga GPS 180d + compactación anual de auditoría.
- [x] Política de privacidad + SMTP Auth (sin `emailer`).
- [x] `SECURITY.md`, `CODEOWNERS`, Dependabot.
- [ ] PITR verificado en el proyecto real (`enable-pitr.ts` con token).
- [ ] Probe cron verde en production.

## Gate 6 — Go-live

- [x] `golive-preflight` + `pages-smoke.sh` + runbooks (`golive.md`, rollback, ensayo restore dry-run).
- [ ] Restore drill **real** en scratch/staging (log adjunto).
- [ ] Environments `staging`/`production` con la tabla de `environments.md`.
- [ ] `pnpm ops:golive` → `ready: true` en el SHA candidato.
- [ ] Promoción `supabase-prod.yml` (reviewers) + smoke Pages.

### Tabla GO / NO-GO

| Gate | PR | CI run | Fecha | ready |
|------|----|--------|-------|-------|
| 0 Inventario | #39 | merge | 2026-08-29 | código sí; `canCreateProject` pendiente |
| 1 Seguridad | #40 | merge | 2026-08-29 | sí (rotación HMAC prod pendiente) |
| 2 CI/CD | #41 | merge | 2026-08-30 | código sí; staging/SMTP/secrets env pendientes |
| 3 Web runtime | #42 | merge | 2026-08-30 | sí (Pages redeploy 2026-09-03) |
| 4 Android | #43 | merge | 2026-08-30 | sí (Play Internal opcional) |
| 5 Ops | #44 | merge | 2026-08-30 | código sí; PITR real + probes cron pendientes |
| 6 Go-live | — | — | — | **NO-GO** hasta preflight `ready: true` |

**GO** solo si: preflight verde, staging migrado desde cero y desde schema prod, pgTAP, e2e/Detox, probes 8 Edge, PITR + restore log, privacidad, smoke prod sin writes, cero modo demo en `apps/*/src`, iOS fuera.

**NO-GO** si reaparece P0: webhook en `configuracion`, invite huérfano, importer upload pre-auth.
