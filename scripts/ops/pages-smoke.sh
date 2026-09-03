#!/usr/bin/env bash
# Smoke no destructivo de Pages: login visible, sin demo.
set -euo pipefail

URL="${1:-${PAGES_PROD_URL:-https://jarguetam.github.io/gestiones-comerciales/}}"

if [ -n "${SMOKE_HTML_FILE:-}" ]; then
  html="$(cat "$SMOKE_HTML_FILE")"
else
  html="$(curl -fsSL "$URL")"
fi

if ! printf '%s' "$html" | grep -q 'Ingresar'; then
  echo "GC-OPS-009: login form no visible (falta Ingresar) en $URL" >&2
  exit 1
fi

if printf '%s' "$html" | grep -q 'Entrar al tablero'; then
  echo "GC-OPS-009: HTML contiene Entrar al tablero" >&2
  exit 1
fi

if printf '%s' "$html" | grep -q 'Backend conectado'; then
  echo "GC-OPS-009: HTML contiene copy de demo (Backend conectado)" >&2
  exit 1
fi

EDGE_URL="${SMOKE_EDGE_URL:-${VITE_SUPABASE_URL:-}}"
if [ -n "$EDGE_URL" ]; then
  code="$(curl -sS -o /dev/null -w '%{http_code}' -X POST "${EDGE_URL%/}/functions/v1/auth-guard" \
    -H 'Content-Type: application/json' \
    -d '{}')"
  if [ "$code" != "401" ] && [ "$code" != "400" ]; then
    echo "GC-OPS-009: auth-guard sin JWT esperaba 401/400, obtuvo $code" >&2
    exit 1
  fi
fi

echo "ok: pages-smoke $URL"
