#!/usr/bin/env bash
set -euo pipefail

TARGET="${1:-}"

if [ -n "$TARGET" ]; then
  git diff -- "$TARGET" 2>/dev/null || true
  exit 0
fi

git diff -- '*.md' '*.mdx' 'docs/**' 'site/**' 2>/dev/null || true
