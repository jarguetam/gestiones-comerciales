#!/usr/bin/env bash
# Sondea las Edge Functions del proyecto (anon key pública).
set -euo pipefail
BASE="${SUPABASE_URL:-https://xcoeipsnykceorcvjwve.supabase.co}"
KEY="${SUPABASE_ANON_KEY:?Falta SUPABASE_ANON_KEY}"
ok=0
fail=0
probe() {
  local fn="$1"
  local code
  code=$(curl -sS -o /tmp/gc_fn -w "%{http_code}" -X POST "$BASE/functions/v1/$fn" \
    -H "apikey: $KEY" -H "Authorization: Bearer $KEY" -H "Content-Type: application/json" -d '{}')
  local body
  body=$(head -c 180 /tmp/gc_fn)
  if [[ "$code" == "404" ]]; then
    echo "FALTA  $fn  HTTP $code  $body"
    fail=$((fail + 1))
  else
    echo "OK     $fn  HTTP $code  $body"
    ok=$((ok + 1))
  fi
}
for fn in auth-guard importer webhook-tenant rastreo-ingesta push-notifications pdf-solicitud notify-jobs invitar-usuario; do
  probe "$fn"
done
echo "Desplegadas: $ok  ausentes: $fail"
[[ "$fail" -eq 0 ]]
