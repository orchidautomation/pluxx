---
description: Package the current plugin for release distribution
argument-hint: "[release options optional]"
---

Use the Pluxx publish workflow.

Arguments: $ARGUMENTS

## What To Do

1. Use the `pluxx-publish-plugin` skill.
2. Validate that the current project is healthy enough to publish.
3. Run `pluxx publish` with the requested release options when appropriate.
4. Summarize the release artifacts and install scripts that were produced.
5. Call out anything that still blocks an actual release.

Return what was published, what artifacts were generated, and any remaining release caveats.
