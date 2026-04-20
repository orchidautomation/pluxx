---
name: pluxx-sync-mcp
description: Refresh an MCP-derived Pluxx scaffold and preserve custom sections.
---

# Pluxx Sync MCP

Use this skill when an existing MCP-derived scaffold needs to be refreshed without losing the user’s custom notes.

## Workflow

1. Preview first when the impact is unclear:
   - `pluxx sync --dry-run --json`
2. Run the real sync when safe:
   - `pluxx sync`
   - or `pluxx sync --from-mcp <override>`
3. Summarize:
   - updated files
   - preserved files
   - removed files
   - warnings
4. If the MCP changed materially, refresh the agent pack and rerun taxonomy or instructions work.
5. Verify:
   - `pluxx doctor`
   - `pluxx lint`
   - `pluxx test`

## Rules

- Preserve mixed-ownership Markdown boundaries.
- Call out when old custom notes were preserved on removed skills so the user can decide whether to merge them.
- Do not silently delete user-authored content.

## Output

- Explain what changed and what stayed preserved.
- Recommend follow-up refinement when the MCP’s shape changed enough to affect taxonomy or instructions.
