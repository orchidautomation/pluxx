#!/usr/bin/env bash
set -euo pipefail

PLUGIN_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CONFIG_FILE="$PLUGIN_ROOT/.pluxx-user.json"

have_authoring_url=0
have_authoring_token=0

if [ -n "${DOCSALOT_AUTHORING_URL:-}" ]; then
  have_authoring_url=1
fi

if [ -n "${DOCSALOT_AUTHORING_TOKEN:-}" ]; then
  have_authoring_token=1
fi

if [ -f "$CONFIG_FILE" ]; then
  if grep -q '"DOCSALOT_AUTHORING_URL"' "$CONFIG_FILE"; then
    have_authoring_url=1
  fi
  if grep -q '"DOCSALOT_AUTHORING_TOKEN"' "$CONFIG_FILE"; then
    have_authoring_token=1
  fi
fi

if [ "$have_authoring_url" -eq 1 ] && [ "$have_authoring_token" -eq 1 ]; then
  exit 0
fi

echo "docs-ops: publish requires a separate authenticated Docsalot authoring path." >&2
echo "docs-ops: the public Orchid MCP endpoint is read-only and is not enough for write/publish flows." >&2
echo "docs-ops: provide DOCSALOT_AUTHORING_URL and DOCSALOT_AUTHORING_TOKEN, or reinstall the plugin with those userConfig values." >&2
exit 1
