#!/usr/bin/env bash
# Despliega todas las Edge Functions al proyecto GestionesComercialesApp.
# Requiere SUPABASE_ACCESS_TOKEN (personal access token de supabase.com).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
REF="${SUPABASE_PROJECT_REF:-xcoeipsnykceorcvjwve}"
if [[ -z "${SUPABASE_ACCESS_TOKEN:-}" ]]; then
  echo "Falta SUPABASE_ACCESS_TOKEN. Creá un token en https://supabase.com/dashboard/account/tokens"
  echo "y un secret de GitHub SUPABASE_ACCESS_TOKEN para el job deploy-edge."
  exit 1
fi
npx --yes supabase@latest functions deploy --project-ref "$REF"
