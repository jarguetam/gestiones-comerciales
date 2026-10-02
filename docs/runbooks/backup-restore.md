# Backup y restore

## PITR

Retención mínima: **7 días**. Objetivo RPO 1 h / RTO 4 h.

```bash
SUPABASE_ACCESS_TOKEN=... SUPABASE_PROJECT_REF=... \
node --experimental-strip-types scripts/ops/enable-pitr.ts
```

Si la API no expone PITR o el token no tiene `projects:write`: exit ≠ 0 con `GC-OPS-006` y el permiso exacto. No se pide Dashboard.

## Ensayo Gate 6

Dry-run (obligatorio en CI, no toca remotos):

```bash
RESTORE_DRY_RUN=1 bash scripts/ops/restore-staging-dryrun.sh
```

El fixture `scripts/ops/fixtures/restore-dryrun.sql` es `select 1`. El restore real se hace contra un scratch/staging-clone (nunca `xcoeipsnykceorcvjwve`): artifact de `ops-backup-staging.yml`, replay, smoke `select count(*) from tenant`, borrar scratch. Adjuntar el log al PR de go-live.

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

## Dump diario de producción

`ops-backup-prod.yml` (07:10 UTC, Environment `production`) corre
`scripts/ops/backup-prod.sh`: roles, schema y datos, empaquetados y cifrados con
`BACKUP_GPG_PUBLIC_KEY` antes de subir el artifact (14 días). Sin la clave
pública falla con `GC-OPS-008`; nunca sube un dump en claro. La clave privada
vive fuera de GitHub, con el responsable técnico y una copia custodiada.

Generar el par una vez (fuera del repo):

```bash
gpg --quick-gen-key "gc-backup <ops@empresa>" default default never
gpg --armor --export ops@empresa   # → secret BACKUP_GPG_PUBLIC_KEY (env production)
```

## Restore real (drill)

Nunca contra `xcoeipsnykceorcvjwve`. Proyecto scratch de la misma región/major:

```bash
gh run download <run-id> -n backup-prod-<run-id>
gpg --decrypt backup-prod.tar.gpg | tar -xf -
psql "$SCRATCH_DB_URL" -f roles.sql
psql "$SCRATCH_DB_URL" -f schema.sql
psql "$SCRATCH_DB_URL" -c 'set session_replication_role = replica' -f data.sql
psql "$SCRATCH_DB_URL" -c 'select count(*) from public.tenant; select count(*) from public.usuario; select count(*) from public.visita;'
```

Registrar en el PR de go-live: run id, hora de inicio y fin (RTO real contra
4 h), conteos contra producción y el borrado del scratch.
