#!/usr/bin/env bash
# pgTAP sobre base en blanco y replay de migraciones.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"
LOG="${PGTAP_LOG:-/tmp/pgtap.log}"
exec > >(tee -a "$LOG") 2>&1

echo "==> supabase start"
supabase start

echo "==> blank: db reset + test db"
supabase db reset --yes
supabase test db

echo "==> replay: db reset + test db"
supabase db reset --yes
supabase test db

echo "OK: pgTAP blank + replay"
