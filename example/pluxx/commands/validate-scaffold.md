---
description: Run deterministic health and quality checks on the current Pluxx scaffold
argument-hint: "[targets optional]"
---

Use the Pluxx scaffold validation workflow.

Arguments: $ARGUMENTS

## What To Do

1. Use the `pluxx-validate-scaffold` skill.
2. Run:
   - `pluxx doctor`
   - `pluxx lint`
   - `pluxx eval`
   - `pluxx test`
3. If the argument names targets, scope `test` to that subset when appropriate.

Return the important failures or warnings first, then the smallest sensible next step.
