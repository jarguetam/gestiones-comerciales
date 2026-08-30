# Production readiness

Checklist vivo. Cada gate marca su sección.

## Gate 0 — Inventario

- [x] Preflight de solo lectura (`pnpm ops:preflight`, job CI).
- [x] Node `22.14.0` / pnpm `9.15.9` anclados (`.nvmrc`, `packageManager`).
- [ ] Token con permiso para crear/administrar staging (`canCreateProject`). Si falta: `GC-OPS-006`.

## Gate 1 — Contención de seguridad

Ver PR `cursor/gate-1-security-9de6`. Este checklist no bloquea Gate 2.

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

## Gate 3+ — pendiente

Demo runtime y Android interno están en PRs #42 y #43. Gate 5 (este) cubre observabilidad y operación.

## Gate 5 — Observabilidad y operación

- [x] `request_id` en las 8 Edge Functions.
- [x] Releases Sentry en Pages (`web@` / `backoffice@`); workflow `ops-sentry-release.yml`.
- [x] Probes cada 15 min (`ops-health.yml`) + runbook de incidentes.
- [x] Rotación HMAC script + runbook (staging primero).
- [x] PITR assert 7d + dump semanal staging.
- [x] `auth_evento_stats` sobre `auth_attempts` (Gate 1 traerá `auth_evento`).
- [x] Purga GPS 180d + compactación anual de auditoría.
- [x] Política de privacidad + SMTP Auth (sin `emailer`).
- [x] `SECURITY.md`, `CODEOWNERS`, Dependabot.
- [ ] PITR verificado en el proyecto real (`enable-pitr.ts` con token).
- [ ] Probe cron verde en production.
- [ ] Merge de Gate 3 y Gate 4 (builds reales) antes de cerrar el gate.
