---
name: docs-inspect-surface
description: Inspect a Docsalot-style documentation surface, map the important pages, and identify the best page or section before editing.
arguments: [topic]
context: fork
agent: Explore
---

# Docs Inspect Surface

Use this skill when the task is: understand a docs surface before making changes.

## What To Load

- For the Docsalot MCP shape and constraints, see [references/docsalot-mcp.md](references/docsalot-mcp.md).

## Workflow

1. Start by mapping the docs surface:
   - list pages
   - search docs
   - identify setup, auth, quickstart, and troubleshooting surfaces
2. If the user passed a topic, use it to rank the best candidate pages.
3. Prefer focused page selection over broad crawling.
4. If local docs files are available, run the bundled `scripts/find-changed-pages.sh` helper when shell execution is practical.
5. Return:
   - the best page or section to edit
   - nearby related pages
   - obvious gaps or risks

## Output

- one recommended target page
- 1-3 secondary candidate pages
- a concise explanation of why that page is the right place to work
