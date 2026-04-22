#!/usr/bin/env bash
set -euo pipefail

status=0

while IFS= read -r file; do
  [ -z "$file" ] && continue
  if head -n 1 "$file" | grep -q '^---$'; then
    count="$(grep -c '^---$' "$file" || true)"
    if [ "$count" -lt 2 ]; then
      echo "docs-ops: missing closing frontmatter fence in $file" >&2
      status=1
    fi
  fi
done < <(git diff --name-only -- '*.md' '*.mdx' 'docs/**' 'site/**' 2>/dev/null || true)

exit "$status"
