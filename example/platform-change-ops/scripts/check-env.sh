#!/usr/bin/env bash
set -euo pipefail

echo "Platform Change Ops setup check"
echo "Environment: ${CHANGEOPS_ENVIRONMENT:-unset}"
echo "Approval mode: ${CHANGEOPS_APPROVAL_MODE:-unset}"
