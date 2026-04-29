#!/usr/bin/env bash
set -euo pipefail

CONFIG_FILE="${PLUGIN_ROOT:-.}/pluxx.config.ts"

if [ ! -f "$CONFIG_FILE" ]; then
  exit 0
fi

if grep -q "https://crm.example.com/mcp" "$CONFIG_FILE"; then
  echo "closed-won-outbound: replace the placeholder MCP URLs in pluxx.config.ts before treating this as a live workflow." >&2
fi

MISSING_VARS=()

for env_var in \
  PLUXX_CRM_MCP_TOKEN \
  PLUXX_LEAD_MCP_TOKEN \
  PLUXX_RESEARCH_MCP_TOKEN \
  PLUXX_PIPELINE_MCP_TOKEN
do
  if [[ -z "${!env_var:-}" ]]; then
    MISSING_VARS+=("$env_var")
  fi
done

if (( ${#MISSING_VARS[@]} > 0 )); then
  echo "closed-won-outbound: adapter auth is not fully configured (${MISSING_VARS[*]})." >&2
else
  echo "closed-won-outbound: adapter auth env vars detected."
fi

echo "Keep the workflow honest: native Pluxx structure is real; provider runtime proof still depends on the backing adapters."
