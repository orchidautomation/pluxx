---
description: Verify that an installed host bundle is actually visible and healthy
argument-hint: "[targets optional]"
---

Use the Pluxx install verification workflow.

Arguments: $ARGUMENTS

## What To Do

1. Use the `pluxx-verify-install` skill.
2. Run `pluxx verify-install --target ...` for the requested host or hosts.
3. If the install still looks wrong, use `pluxx doctor --consumer` when it materially improves diagnosis.
4. Return findings before reassurance.
5. Make the next step obvious:
   - reload host
   - trust hooks
   - reinstall
   - publish

Return the installed-target verification result and the smallest sensible next step.
