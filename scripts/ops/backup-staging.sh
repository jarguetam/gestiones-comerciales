#!/usr/bin/env bash
# Dump semanal de staging (complemento de PITR, no lo reemplaza).
set -euo pipefail

if [ -z "${SUPABASE_PROJECT_REF:-}" ] || [ -z "${SUPABASE_DB_PASSWORD:-}" ]; then
  echo "GC-OPS-008: faltan SUPABASE_PROJECT_REF o SUPABASE_DB_PASSWORD" >&2
  exit 1
fi

OUT="${1:-backup-staging.dump}"
npx --yes supabase db dump --project-ref "$SUPABASE_PROJECT_REF" -f "$OUT"
echo "wrote ${OUT}"
