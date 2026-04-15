---
description: Rewrite INSTRUCTIONS.md so a Pluxx scaffold explains itself clearly
argument-hint: "[website-docs-or-context optional]"
---

Use the Pluxx instructions rewrite workflow.

Arguments: $ARGUMENTS

## What To Do

1. Use the `pluxx-rewrite-instructions` skill.
2. Refresh the agent pack with docs, website, or local context when the argument provides it.
3. Limit edits to the generated block in `INSTRUCTIONS.md`.
4. Keep the result concise, operational, and product-shaped.
5. Re-run:
   - `pluxx lint`
   - `pluxx test`

Summarize the rewritten instructions and call out any setup or auth caveats that still need manual confirmation.
