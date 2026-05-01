#!/usr/bin/env bash
set -euo pipefail

if [[ "${CHANGEOPS_APPROVAL_MODE:-strict}" == "strict" ]]; then
  echo "Strict approval mode enabled: require explicit human approval before opening change window."
fi
