#!/usr/bin/env bash
# Respaldo lógico diario de producción, cifrado antes de salir del runner.
# Complementa PITR; no lo reemplaza. Requiere `supabase link` previo.
set -euo pipefail

if [ -z "${BACKUP_GPG_PUBLIC_KEY:-}" ]; then
  echo "GC-OPS-008: falta BACKUP_GPG_PUBLIC_KEY; no se sube un dump en claro" >&2
  exit 1
fi

OUT="${1:-backup-prod.tar.gpg}"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

supabase db dump --linked --role-only -f "$WORK/roles.sql"
supabase db dump --linked -f "$WORK/schema.sql"
supabase db dump --linked --data-only --use-copy -f "$WORK/data.sql"

export GNUPGHOME="$WORK/gnupg"
mkdir -m 700 "$GNUPGHOME"
printf '%s\n' "$BACKUP_GPG_PUBLIC_KEY" | gpg --batch --import
RECIPIENT="$(gpg --batch --list-keys --with-colons | awk -F: '/^fpr/ {print $10; exit}')"
tar -C "$WORK" -cf - roles.sql schema.sql data.sql \
  | gpg --batch --yes --trust-model always --encrypt --recipient "$RECIPIENT" -o "$OUT"
echo "wrote ${OUT} ($(wc -c < "$OUT") bytes)"
