---
description: Build installable plugins and optionally install requested targets locally
argument-hint: "[targets optional]"
---

Use the Pluxx build and install workflow.

Arguments: $ARGUMENTS

## What To Do

1. Use the `pluxx-build-install` skill.
2. Validate first when the scaffold changed materially.
3. Build the requested targets.
4. Install only if the user wants local testing.
5. Surface trust requirements and reload steps clearly.

Return what was built, what was installed, and any host-specific follow-up steps.
