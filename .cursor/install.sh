#!/usr/bin/env bash
# Bootstrap idempotente del entorno de desarrollo de Gestiones Comerciales.
# Se ejecuta tras el checkout del repo. Debe poder correr varias veces.
set -euo pipefail

cd "$(dirname "$0")/.."

# --- Deno: runtime de las Edge Functions de Supabase (supabase/functions/*) ---
# Necesario para `deno check` y `deno test` (paridad con el job "validate" de CI).
export DENO_INSTALL="${DENO_INSTALL:-$HOME/.deno}"
if [ ! -x "$DENO_INSTALL/bin/deno" ] && ! command -v deno >/dev/null 2>&1; then
  echo "Instalando Deno en $DENO_INSTALL..."
  curl -fsSL https://deno.land/install.sh | sh
fi
# Exponer Deno en shells interactivos (terminales del agente).
if ! grep -q 'DENO_INSTALL' "$HOME/.bashrc" 2>/dev/null; then
  {
    echo 'export DENO_INSTALL="$HOME/.deno"'
    echo 'export PATH="$DENO_INSTALL/bin:$PATH"'
  } >> "$HOME/.bashrc"
fi

# --- Dependencias del workspace (pnpm) ---
# El repo no versiona pnpm-lock.yaml; CI también usa --no-frozen-lockfile.
corepack enable >/dev/null 2>&1 || true
pnpm install --no-frozen-lockfile

echo "Entorno listo: web (5173), backoffice (5174), Deno para Edge Functions."
