#!/usr/bin/env bash
set -euo pipefail

source "$(dirname "$0")/load-env.sh"
exec node "$CHANGEOPS_RUNTIME_ROOT/index.js"
