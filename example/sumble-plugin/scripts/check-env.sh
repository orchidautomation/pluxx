#!/usr/bin/env bash
set -euo pipefail

if [ -z "${SUMBLE_API_KEY:-}" ]; then
  echo "pluxx: SUMBLE_API_KEY is not set. Export it before using this plugin." >&2
  exit 1
fi
