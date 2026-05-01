#!/usr/bin/env bash
set -euo pipefail

source "$(dirname "$0")/load-env.sh"
node "$(dirname "$0")/risk-score.mjs" bootstrap >/dev/null
