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

Demo runtime, APK/AAB, Sentry/PITR y go-live se cierran en Gates 3–6.
