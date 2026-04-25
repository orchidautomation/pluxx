#!/usr/bin/env bash
set -euo pipefail

if [[ -n "${EXA_API_KEY:-}" ]]; then
  echo "Exa keyed mode: EXA_API_KEY detected. Higher limits and production auth are available."
else
  echo "Exa anonymous mode: EXA_API_KEY is not set. Searches can still run, but rate limits are lower."
fi

echo "Use specialist agents for raw search isolation and keep the final answer compact and cited."
