---
description: Build installable plugins and optionally install requested targets locally
argument-hint: "[targets optional]"
---

Use the Pluxx build and install workflow.

Arguments: $ARGUMENTS

## What To Do

1. Use the `pluxx-build-install` skill.
2. Prefer `pluxx test --install` when the user wants the strongest local proof in one command.
3. Otherwise validate first when the scaffold changed materially.
4. Build the requested targets.
5. Install only if the user wants local testing.
6. Surface trust requirements, reload steps, and `pluxx doctor --consumer` when the installed host still looks wrong.

Return what was built, what was installed, and any host-specific follow-up steps.
