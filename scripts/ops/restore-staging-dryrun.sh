#!/usr/bin/env bash
# Ensayo de restore en staging. Por defecto dry-run con fixture `select 1`.
# No corre contra producción.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
FIXTURE="${RESTORE_FIXTURE:-$ROOT/scripts/ops/fixtures/restore-dryrun.sql}"

if [ ! -f "$FIXTURE" ]; then
  echo "GC-OPS-008: falta fixture $FIXTURE" >&2
  exit 1
fi

if ! grep -qi 'select 1' "$FIXTURE"; then
  echo "GC-OPS-009: el fixture de dry-run debe contener SELECT 1" >&2
  exit 1
fi

if [ "${RESTORE_DRY_RUN:-1}" = "1" ]; then
  echo "dry-run: restore staging con fixture $(basename "$FIXTURE")"
  echo "sql: $(tr '\n' ' ' < "$FIXTURE")"
  echo "ok: no se tocó ningún proyecto remoto"
  exit 0
fi

if [ -z "${SUPABASE_PROJECT_REF:-}" ] || [ "$SUPABASE_PROJECT_REF" = "xcoeipsnykceorcvjwve" ]; then
  echo "GC-OPS-009: restore real exige SUPABASE_PROJECT_REF de staging (nunca prod)" >&2
  exit 1
fi

echo "restore real no implementado en este dry-run; use artifact de ops-backup-staging"
exit 1
