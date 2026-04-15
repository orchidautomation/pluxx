---
description: Refresh an existing Pluxx scaffold from its MCP source
argument-hint: "[override-mcp-source optional]"
---

Use the Pluxx MCP sync workflow.

Arguments: $ARGUMENTS

## What To Do

1. Use the `pluxx-sync-mcp` skill.
2. If an override MCP source is provided, use it; otherwise sync from the scaffold's current MCP config.
3. Preview first with `pluxx sync --dry-run --json` when the impact is unclear.
4. Run the real sync when safe.
5. Summarize:
   - updated files
   - preserved files
   - removed files
   - any follow-up taxonomy or instructions work
6. Re-run:
   - `pluxx doctor`
   - `pluxx lint`
   - `pluxx test`

Explain what changed, what stayed preserved, and whether more semantic cleanup is needed afterward.
