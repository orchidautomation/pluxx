---
name: docs-review-changes
description: Review documentation edits before publish and return findings first.
arguments: [page]
context: fork
agent: Explore
---

# Docs Review Changes

Use this skill when the task is: review docs edits critically before publish.

## What To Load

- Review standard: [references/review-checklist.md](references/review-checklist.md)

## Workflow

1. Compare the original and changed content.
2. Look for:
   - factual drift
   - broken setup sequencing
   - missing caveats
   - unclear auth or install guidance
   - unnecessary verbosity
3. If local docs files are available, use:
   - `scripts/check-frontmatter.sh`
   - `scripts/validate-links.sh`
   when shell execution is practical.
4. Return findings first, ordered by severity.

## Output

- findings
- open questions
- publish recommendation: ready, ready with caveats, or not ready
