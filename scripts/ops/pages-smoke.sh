#!/usr/bin/env bash
# Smoke no destructivo de Pages: login visible, sin demo.
set -euo pipefail

URL="${1:-${PAGES_PROD_URL:-https://jarguetam.github.io/gestiones-comerciales/}}"
export PLAYWRIGHT_BASE_URL="$URL"
export PLAYWRIGHT_NO_SERVER=1
export E2E_SUITE=production
if command -v pnpm >/dev/null 2>&1; then
  pnpm --filter @gc/web exec playwright test tests/production-smoke.spec.ts --reporter=line
else
  pnpm.cmd --filter @gc/web exec playwright test tests/production-smoke.spec.ts --reporter=line
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
