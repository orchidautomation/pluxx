---
name: docs-publish
description: Validate and publish docs changes deliberately. Use when the user explicitly wants to publish.
arguments: [scope]
disable-model-invocation: true
allowed-tools: Read Write Bash(git status *) Bash(git diff *)
---

# Docs Publish

Use this skill only when the user explicitly wants to publish docs.

## What To Load

- Publishing sequence: [references/publishing-checklist.md](references/publishing-checklist.md)

## Workflow

1. Determine the publish scope:
   - changed pages
   - one page
   - a release batch
2. Validate that the separate authenticated authoring path is configured before going further:
   - `scripts/check-publish-auth.sh`
3. Run the bundled checks when shell execution is practical:
   - `scripts/check-frontmatter.sh`
   - `scripts/validate-links.sh`
   - `scripts/summarize-diff.sh`
4. Summarize any remaining risk before proceeding.
5. If the checks are not clean, stop and explain why.

## Rules

- The public Orchid Docsalot MCP endpoint is read-only proof, not the authoring path.
- Treat `DOCSALOT_AUTHORING_URL` and `DOCSALOT_AUTHORING_TOKEN` as required for true publish work.
- Do not publish automatically because the docs merely look better.
- Favor a cautious path over a fast path.
