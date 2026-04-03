#!/bin/bash
set -euo pipefail

if [ -z "${PROSPEO_API_KEY:-}" ]; then
  echo "Prospeo plugin: PROSPEO_API_KEY is not set." >&2
  echo "Get your API key at https://app.prospeo.io/api" >&2
  exit 1
fi
