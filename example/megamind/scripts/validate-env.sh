#!/bin/bash
set -euo pipefail

if [ -z "${MEGAMIND_API_KEY:-}" ]; then
  echo "Megamind plugin: MEGAMIND_API_KEY is not set." >&2
  echo "Set it before launching so the Megamind MCP server can authenticate." >&2
  exit 1
fi
