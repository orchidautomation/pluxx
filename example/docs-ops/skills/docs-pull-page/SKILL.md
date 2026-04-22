---
name: docs-pull-page
description: Pull one docs page or a small focused set of pages for a rewrite or review workflow.
arguments: [page]
---

# Docs Pull Page

Use this skill when the task is: fetch one page or a small set of related pages without pulling the entire docs site into context.

## What To Load

- For page-selection guidance, see [references/page-selection.md](references/page-selection.md).

## Workflow

1. Treat `$page` as the target slug, page path, or URL.
2. Pull only the primary page first.
3. If context is obviously missing, add only the minimum neighboring pages needed.
4. Surface:
   - page title
   - setup/auth/workflow sections
   - stale or unclear areas

## Rules

- Do not broaden to the whole docs site unless the user explicitly asks.
- Prefer a tight working set so the rewrite stays focused.
