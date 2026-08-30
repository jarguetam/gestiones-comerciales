# Migraciones expand/contract

## Regla

Las migraciones son forwards-only y compatibles con el binario anterior. No hay down-migrations.

1. **Expand:** agregar columna/tabla/función nullable o con default. Desplegar Edge/RPC que aún leen el shape viejo.
2. **Soak en staging:** `supabase db push` vía `.github/workflows/supabase-staging.yml` → e2e staging → observar errores `GC-*`.
3. **Contract:** quitar columnas/funciones viejas en una migración posterior, solo cuando staging y el cliente ya no las usan.
4. **Prod:** `workflow_dispatch` de `.github/workflows/supabase-prod.yml` con el SHA que pasó staging. Reviewers del Environment `production`.

## Comandos

```bash
# Local
supabase start
supabase db reset --yes
supabase test db

# Replay (el job pgtap de CI)
bash scripts/ci/pgtap.sh
```

CI falla si `supabase test db` no corre en blanco y otra vez tras replay.

## Drift

`pnpm ops:preflight` compara las migraciones versionadas con el remoto. `GC-OPS-007` detiene la promoción. No se aplica `db push` a producción para “igualar” drift no versionado.

## SECURITY DEFINER

Toda función `SECURITY DEFINER` nueva debe listarse en `supabase/tests/security_definer_allowlist.txt`. El job `security-definer` falla si aparece una no listada.
