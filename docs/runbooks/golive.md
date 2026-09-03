# Go-live

Promoción a producción solo con `golive-preflight` en `ready: true`. SHA candidato = el que pasó staging post-merge. iOS fuera. Play = Internal Testing, no production track.

## Orden

1. `pnpm ops:golive` (o el step del job) imprime `ready: true`.
   Si falta evidencia, override temporal solo en runner: `GOLIVE_CI_CONCLUSION`, `GOLIVE_PGTAP_CONCLUSION`, `GOLIVE_STAGING_HEALTH`, `GOLIVE_SENTRY_RELEASE`.
2. `supabase-prod.yml` (`workflow_dispatch`, SHA, environment `production` + reviewers): `db push` + `functions deploy`.
3. `pages-prod.yml` ya corre en push a `main` con `VITE_*` de prod.
4. `eas submit` del AAB a Internal Testing (si Gate 0 no marcó Play ausente).
5. Smoke no destructivo:

```bash
bash scripts/ops/pages-smoke.sh https://jarguetam.github.io/gestiones-comerciales/
```

Login visible, **sin** «Entrar al tablero». Edge `auth-guard` 401/400 sin JWT.

6. Sentry release finalize (`web@SHA`, `backoffice@SHA`) + event `gate6-ping` y borrar.

## NO-GO inmediato

Webhook en `tenant.configuracion`, invite huérfano, importer upload pre-auth, `DEMO_MODE` en `apps/*/src`, APK versionado.

## Rollback

Ver [rollback.md](rollback.md). Sin down-migrations.
