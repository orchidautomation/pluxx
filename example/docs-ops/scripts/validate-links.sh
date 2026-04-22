#!/usr/bin/env bash
set -euo pipefail

status=0

while IFS= read -r file; do
  [ -z "$file" ] && continue
  while IFS= read -r link; do
    case "$link" in
      http://*|https://*)
        ;;
      *)
        target="$(dirname "$file")/$link"
        if [ ! -e "$target" ]; then
          echo "docs-ops: unresolved local link '$link' in $file" >&2
          status=1
        fi
        ;;
    esac
  done < <(grep -oE '\]\(([^)#]+)' "$file" | sed 's/](//')
done < <(git diff --name-only -- '*.md' '*.mdx' 'docs/**' 'site/**' 2>/dev/null || true)

exit "$status"
