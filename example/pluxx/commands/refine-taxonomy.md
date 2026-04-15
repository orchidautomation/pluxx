---
description: Improve the skill taxonomy for an existing Pluxx scaffold
argument-hint: "[website-docs-or-context optional]"
---

Use the Pluxx taxonomy refinement workflow.

Arguments: $ARGUMENTS

## What To Do

1. Use the `pluxx-refine-taxonomy` skill.
2. Assume the current scaffold already imports and validates.
3. Refresh the agent pack with relevant context if the argument includes docs, website, or local context hints.
4. Run the taxonomy pass and keep edits inside Pluxx-managed boundaries.
5. Re-run:
   - `pluxx lint`
   - `pluxx test`

Explain what changed in the taxonomy, why it improved the product surface, and what still feels weak.
