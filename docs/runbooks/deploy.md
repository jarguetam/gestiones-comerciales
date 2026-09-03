# Deploy

1. CI verde en el SHA (`ci.yml`: contratos, lint, OWASP, pgTAP, Deno, e2e).
2. Staging: `supabase-staging.yml` + `e2e-staging.yml` (Vite en el runner, nunca Pages).
3. Producción Supabase: **solo** `workflow_dispatch` (`supabase-prod.yml`), Environment `production`.
4. Pages: push a `main` → `pages-prod.yml`. Exige `VITE_SUPABASE_URL` y anon. Tras el deploy, Sentry `web@SHA` y `backoffice@SHA`.
5. Android: EAS preview (label) / Internal (tag) — Gate 4.

Fail-closed: falta de secret = `GC-OPS-008`. No continuar con warnings.
