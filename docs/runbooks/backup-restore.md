# Backup y restore

## PITR

Retención mínima: **7 días**. Objetivo RPO 1 h / RTO 4 h.

```bash
SUPABASE_ACCESS_TOKEN=... SUPABASE_PROJECT_REF=... \
node --experimental-strip-types scripts/ops/enable-pitr.ts
```

Si la API no expone PITR o el token no tiene `projects:write`: exit ≠ 0 con `GC-OPS-006` y el permiso exacto. No se pide Dashboard.

El restore drill real se ejecuta en Gate 6 (staging).

## Dump semanal de staging

Complemento, no reemplaza PITR. Workflow `ops-backup-staging.yml` (domingos 06:00 UTC) sube `backup-staging.dump` como artifact 14 días.

```bash
SUPABASE_PROJECT_REF=... SUPABASE_DB_PASSWORD=... bash scripts/ops/backup-staging.sh
```

## Restore (staging)

1. Proyecto staging vacío o branch.
2. `supabase db push` de migraciones.
3. Restore PITR a un timestamp (Management / CLI si está disponible).
4. Smoke: login, una visita, una Edge.
