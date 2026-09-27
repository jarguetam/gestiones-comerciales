# Go-live

Promoción a producción solo con `golive-preflight` en `ready: true`. El SHA
candidato debe tener un push exitoso de CI en `main`. iOS fuera.

## Orden

1. `pnpm ops:golive` (o el step del job) imprime `ready: true` solo con CI y pgTAP
   exitosos para el SHA candidato en `main`, probes productivos recientes y
   configuración Sentry completa. No se aceptan overrides manuales.
2. `supabase-prod.yml` (`workflow_dispatch`, SHA, environment `production` + reviewers): `db push` + `functions deploy`.
3. `pages-prod.yml` ya corre en push a `main` con `VITE_*` de prod.
4. `eas submit` del AAB a Internal Testing (si Gate 0 no marcó Play ausente).
5. Smoke no destructivo:

```bash
bash scripts/ops/pages-smoke.sh https://jarguetam.github.io/gestiones-comerciales/
```

Playwright comprueba el login renderizado en web y backoffice, sin `GC-CORE-001`
ni «Entrar al tablero». Edge `auth-guard` responde 401/400 sin JWT. El smoke
requiere Chromium instalado.

6. Sentry release finalize (`web@SHA`, `backoffice@SHA`) + event `gate6-ping` y borrar.

## NO-GO inmediato

Webhook en `tenant.configuracion`, invite huérfano, importer upload pre-auth, `DEMO_MODE` en `apps/*/src`, APK versionado.

## Rollback

Ver [rollback.md](rollback.md). Sin down-migrations.
