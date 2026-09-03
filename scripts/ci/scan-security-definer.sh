#!/usr/bin/env bash
# Falla si una función SECURITY DEFINER nueva no está en allowlist.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"
test -f supabase/tests/security_definer_allowlist.txt
node --experimental-strip-types scripts/ci/scan-security-definer.ts
