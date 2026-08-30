# Entornos: local, staging y producción

## Mapa

| Entorno | Supabase | Host de la app | GitHub Environment |
|---|---|---|---|
| `local` | `supabase start` | Vite `http://localhost:5173` / preview `http://127.0.0.1:4173` | — |
| `staging` | proyecto aislado (misma región/major que prod) | Vite en CI (`vite preview`), nunca github.io/staging | `staging` |
| `production` | `xcoeipsnykceorcvjwve` | GitHub Pages (solo este entorno) | `production` |

No existe un site Pages de staging. Las pruebas de staging levantan Vite en el runner con `VITE_SUPABASE_*` del Environment `staging`.

## Secrets por Environment

Los valores **no** van al repo. El agente o un admin los carga con `gh secret set --env <nombre>`.

| Secret | staging | production |
|--------|---------|------------|
| `SUPABASE_PROJECT_REF` | ref del proyecto nuevo | `xcoeipsnykceorcvjwve` |
| `SUPABASE_DB_PASSWORD` | propio | propio / rotado |
| `SUPABASE_ACCESS_TOKEN` | org | org |
| `SUPABASE_ANON_KEY` | staging | prod |
| `SUPABASE_SERVICE_ROLE_KEY` | staging (jobs supabase + e2e) | **solo** job `supabase-prod`; nunca Pages |
| `VITE_SUPABASE_URL` | `https://<staging>.supabase.co` | URL de prod |
| `VITE_SUPABASE_ANON_KEY` | staging anon | prod anon |
| `VITE_SENTRY_DSN` | DSN staging | DSN prod |
| `SENTRY_AUTH_TOKEN` | org | org |
| `E2E_ASESOR_PASSWORD` | sintético | — |
| `E2E_ADMIN_PASSWORD` | sintético | — |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` / `SMTP_ADMIN_EMAIL` | staging | prod |
| `PAGES_PROD_URL` | — | URL pública de Pages |

Verificación (falla cerrado, `GC-OPS-008`):

```bash
node --experimental-strip-types scripts/ci/check-env-secrets.ts staging
node --experimental-strip-types scripts/ci/check-env-secrets.ts production
```

## Promoción

1. PR: CI local (lockfile, lint, typecheck, unit, deno, pgTAP, e2e de fixtures, gitleaks). No toca remotos.
2. Merge a `main`: `supabase-staging.yml` aplica migraciones y Edge; `e2e-staging.yml` corre Playwright contra Vite + usuarios sintéticos.
3. Producción: `supabase-prod.yml` es **solo** `workflow_dispatch` con SHA. Pages (`pages-prod.yml`) exige `VITE_*` de `production` y falla si faltan.

`xcoeipsnykceorcvjwve` no recibe `db push` desde un pull request.

## Datos

Staging usa `supabase/seeds/staging_synthetic.sql` (`Acme Staging`, `asesor@staging.test`, `admin@staging.test`). Nunca se copia PII de producción.
