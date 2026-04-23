---
description: Ingest docs, website, and local context into the Pluxx agent pack
argument-hint: "[website-or-docs-or-context optional]"
---

Use the Pluxx context preparation workflow.

Arguments: $ARGUMENTS

## What To Do

1. Use the `pluxx-prepare-context` skill.
2. Treat the arguments as hints for website URLs, docs URLs, or local context files.
3. Run `pluxx agent prepare` with the richest safe context available.
4. Summarize what sources were ingested and what artifacts were written.
5. Point to the next best follow-up workflow:
   - taxonomy
   - rewrite instructions
   - review

Return the selected sources, the generated context artifacts, and the next recommended refinement step.
