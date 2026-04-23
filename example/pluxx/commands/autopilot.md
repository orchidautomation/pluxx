---
description: Run the one-shot Pluxx import, refinement, and verification path
argument-hint: "[mcp-source or existing project context]"
---

Use the Pluxx autopilot workflow.

Arguments: $ARGUMENTS

## What To Do

1. Use the `pluxx-autopilot` skill.
2. Treat the first argument as the MCP source when one is provided.
3. Prefer `pluxx autopilot --from-mcp ... --yes` for a real one-shot import path.
4. Make the mode, review behavior, and verification behavior explicit.
5. Summarize what autopilot changed, what it skipped, and what still needs human follow-up.

Return the important created or updated files, the refinement passes that ran, and the verification result.
