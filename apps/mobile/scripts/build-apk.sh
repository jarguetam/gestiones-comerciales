#!/usr/bin/env bash
# Compila el APK preview. Si hay URL+anon (env, .env o VITE_*), las inyecta
# como EXPO_PUBLIC_*. Sin esas variables el runtime lanza GC-CORE-001.
# Nunca imprime la anon key.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
MOBILE="$(cd "$(dirname "$0")/.." && pwd)"

cargar_env() {
  local f="$1"
  if [ -f "$f" ]; then
    set -a
    # shellcheck disable=SC1090
    . "$f"
    set +a
    echo "Leído $f"
  fi
}

cargar_env "$ROOT/.env"
cargar_env "$MOBILE/.env"
cargar_env "$MOBILE/.env.local"

: "${EXPO_PUBLIC_SUPABASE_URL:=${VITE_SUPABASE_URL:-}}"
: "${EXPO_PUBLIC_SUPABASE_ANON_KEY:=${VITE_SUPABASE_ANON_KEY:-}}"

export EXPO_PUBLIC_SUPABASE_URL EXPO_PUBLIC_SUPABASE_ANON_KEY

if [ -z "${EXPO_PUBLIC_SUPABASE_URL:-}" ] || [ -z "${EXPO_PUBLIC_SUPABASE_ANON_KEY:-}" ]; then
  echo "WARN: build DEMO — faltan EXPO_PUBLIC_SUPABASE_URL y/o EXPO_PUBLIC_SUPABASE_ANON_KEY."
  echo "      El APK dirá que no está conectado al backend."
else
  echo "Build con backend ${EXPO_PUBLIC_SUPABASE_URL} (anon key ${#EXPO_PUBLIC_SUPABASE_ANON_KEY} chars)."
fi

cd "$MOBILE"
if [ ! -d android ]; then
  echo "Generando proyecto Android (expo prebuild)…"
  npx expo prebuild --platform android --non-interactive
fi

cd android
./gradlew assembleRelease

DEST="$ROOT/releases/gestiones-campo-preview.apk"
mkdir -p "$ROOT/releases"
cp -f app/build/outputs/apk/release/app-release.apk "$DEST"
echo "APK listo: $DEST ($(wc -c < "$DEST") bytes)"
