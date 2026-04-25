---
name: exa-source-review
description: Review a research result set for source quality, duplicated claims, weak evidence, and ranking mistakes. Use when the answer needs a credibility pass before shipping.
---

# Exa Source Review

## What To Load

- For source-quality heuristics, see [references/source-quality.md](references/source-quality.md).

## Workflow

1. Use `source-auditor` to separate keep vs drop decisions.
2. Use `synthesis-reviewer` if the final answer still feels bloated or under-argued.
3. Make the ranking or filtering criteria explicit.
4. Prefer practitioner signal over commentary noise.

## Output

- strongest sources
- weakest sources or claims to remove
- what the user should trust most and why
