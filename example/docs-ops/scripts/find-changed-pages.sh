#!/usr/bin/env bash
set -euo pipefail

git diff --name-only -- '*.md' '*.mdx' 'docs/**' 'site/**' 2>/dev/null || true
