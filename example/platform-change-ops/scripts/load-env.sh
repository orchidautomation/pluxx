#!/usr/bin/env bash
set -euo pipefail

export CHANGEOPS_RUNTIME_ROOT="${CHANGEOPS_RUNTIME_ROOT:-$(cd "$(dirname "$0")/../passthrough/runtime" && pwd)}"
export CHANGEOPS_STATE_DIR="${CHANGEOPS_STATE_DIR:-$CHANGEOPS_RUNTIME_ROOT/state}"
mkdir -p "$CHANGEOPS_STATE_DIR"
