---
description: "Handle broad search and query workflows when there is not a more specific product surface match."
argument-hint: "[reason] [company]"
---

<!-- pluxx:generated:start -->
Use this command when the user asks to work on broad search and query workflows when there is not a more specific product surface match.

Arguments: $ARGUMENTS

Primary tools:
- `FindOrganizations`
- `FindPeople`
- `Query`

Workflow:

1. Interpret `$ARGUMENTS` as the user request for this workflow.
2. Choose the most specific tool in this surface.
3. Ask for missing required inputs only if the request does not already provide them.
4. Return a concise task-focused answer instead of raw JSON unless the user asks for it.
<!-- pluxx:generated:end -->

## Custom Notes

<!-- pluxx:custom:start -->
Add custom guidance, examples, or caveats here. This section is preserved across `pluxx sync --from-mcp`.
<!-- pluxx:custom:end -->
