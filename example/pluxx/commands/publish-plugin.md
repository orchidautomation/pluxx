---
description: Package the current plugin for release distribution
argument-hint: "[release options optional]"
---

Use the Pluxx publish workflow.

Arguments: $ARGUMENTS

## What To Do

1. Use the `pluxx-publish-plugin` skill.
2. Validate that the current project is healthy enough to publish.
3. Run `pluxx publish --dry-run --json` first and report the factual plan.
4. Run `pluxx publish` with the requested release options only when the user explicitly approves a real publish.
5. Summarize the planned or produced release artifacts and installer scripts.
6. Call out anything that still blocks an actual release.

Return what was published, what artifacts were generated, and any remaining release caveats.
