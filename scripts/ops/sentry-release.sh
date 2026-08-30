#!/usr/bin/env bash
# Crea o finaliza un release de Sentry. Sin red si SENTRY_DRY_RUN=1.
set -euo pipefail

NAME="${1:-}"
if [ -z "$NAME" ]; then
  echo "usage: sentry-release.sh <release-name>" >&2
  exit 1
fi

if [ "${SENTRY_DRY_RUN:-}" = "1" ]; then
  echo "dry-run: sentry-cli releases new ${NAME}"
  exit 0
fi

if [ -z "${SENTRY_AUTH_TOKEN:-}" ]; then
  echo "GC-OPS-008: falta SENTRY_AUTH_TOKEN" >&2
  exit 1
fi

ORG="${SENTRY_ORG:-}"
PROJECT="${SENTRY_PROJECT:-}"
if [ -z "$ORG" ] || [ -z "$PROJECT" ]; then
  echo "GC-OPS-008: faltan SENTRY_ORG o SENTRY_PROJECT" >&2
  exit 1
fi

if ! command -v sentry-cli >/dev/null 2>&1; then
  echo "GC-OPS-008: falta sentry-cli en el PATH" >&2
  exit 1
fi

sentry-cli releases new "$NAME"
sentry-cli releases set-commits "$NAME" --auto || true
sentry-cli releases finalize "$NAME"
echo "sentry release ${NAME} finalized"
