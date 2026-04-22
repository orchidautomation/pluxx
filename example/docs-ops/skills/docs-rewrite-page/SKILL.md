---
name: docs-rewrite-page
description: Rewrite a docs page with stronger product, setup, and workflow context while staying faithful to the actual product.
arguments: [page]
allowed-tools: Read Write Edit MultiEdit
---

# Docs Rewrite Page

Use this skill when the task is: rewrite documentation without losing product truth.

## What To Load

- Voice guidance: [references/voice-and-tone.md](references/voice-and-tone.md)
- Structure guidance: [references/style-guide.md](references/style-guide.md)
- Example rewrite shape: [examples/before-after.md](examples/before-after.md)

## Workflow

1. Read the target page and identify what is weak:
   - unclear setup
   - weak product framing
   - missing workflow guidance
   - too much chrome and not enough signal
2. Rewrite for:
   - fast comprehension
   - clear setup
   - concrete workflow value
   - faithful product truth
3. Preserve details that are actually correct even if the phrasing is weak.
4. If local docs files are being edited, use the bundled `scripts/summarize-diff.sh` helper after rewriting when that is practical.

## Rules

- Do not invent product capabilities.
- Do not broaden scope from one page into a site-wide rewrite unless the user explicitly asks.
- Prefer fewer, stronger edits over decorative rewriting.

## Output

- the rewritten page
- a short note on the biggest improvements
- any unresolved factual questions
