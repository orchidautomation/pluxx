#!/usr/bin/env bash
set -euo pipefail

CONFIG_FILE="${PLUGIN_ROOT:-.}/pluxx.config.ts"

if [ ! -f "$CONFIG_FILE" ]; then
  exit 0
fi

if grep -q "https://example-docs.docsalot.dev/api/mcp" "$CONFIG_FILE"; then
  echo "docs-ops: replace the placeholder Docsalot MCP URL in pluxx.config.ts before shipping this plugin." >&2
fi

exit 0
