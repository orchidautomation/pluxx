## Docs Ops Plugin

Use Docs Ops when the user wants to inspect a docs surface, rewrite a page, review docs edits, or publish documentation more safely.

This is the flagship depth example for Pluxx.

It is intentionally richer than a thin MCP wrapper and is meant to prove:

- stronger workflow grouping
- supporting files
- bundled scripts
- argument-aware commands
- reviewer/research patterns
- truthful cross-host translation

## What This Plugin Provides

- a Docsalot-style MCP connection for docs workflows
- `/inspect-docs-surface [topic]`
- `/pull-doc-page [page-or-url]`
- `/rewrite-doc-page [page-or-url]`
- `/review-doc-changes [page-or-url]`
- `/publish-docs [scope]`
- `/rollback-doc-change [page-or-release]`

## Current Demo Target

This example is currently wired to Orchid's public Docsalot MCP endpoint:

- `https://orchid-docs.docsalot.dev/api/mcp`

The public Orchid docs surface gives this flagship example a real read-only proof target.

See:

- `ORCHID-READONLY-DEMO.md`

## Important Setup Note

If you want to operate against a different Docsalot surface, replace the configured endpoint with that site's hosted MCP URL.

Docsalot's hosted MCP pattern is:

- `{subdomain}-docs.docsalot.dev/api/mcp`

The official Docsalot docs say this hosted MCP surface is for public documentation.

## Operating Model

The intended workflow is:

1. inspect the docs surface first
2. pull only the page or section that matters
3. rewrite with product and setup context
4. review the changes separately
5. run the bundled checks
6. publish deliberately

Do not jump straight to publishing if the docs surface has not been inspected or reviewed.

## Bundled Scripts

Docs Ops ships helper scripts under `scripts/`:

- `check-docs-ops-setup.sh`
- `find-changed-pages.sh`
- `summarize-diff.sh`
- `check-frontmatter.sh`
- `validate-links.sh`

Use them when the host allows shell execution and when they reduce guesswork.

## Workflow Expectations

- prefer focused page edits over broad undocumented rewrites
- preserve product accuracy over writing flair
- call out assumptions instead of inventing details
- validate before publish
- keep rollback practical and boring

## Good Result

A good Docs Ops run should leave the user with:

- the right page selected
- clearer docs copy
- a concise review summary
- obvious remaining risks, if any
- a safe path to publish or rollback
