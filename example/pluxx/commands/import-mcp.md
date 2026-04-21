---
description: Scaffold a new Pluxx plugin from an MCP source
argument-hint: "[mcp-url-or-stdio-command]"
---

Use the Pluxx MCP import workflow.

Arguments: $ARGUMENTS

## What To Do

1. Use the `pluxx-import-mcp` skill.
2. Treat the first argument as the MCP source:
   - remote HTTP/SSE URL
   - or local stdio command
3. If auth details are missing, ask only for the auth shape and env var names, not raw secret values.
4. Prefer a deterministic first pass with `pluxx init --from-mcp ... --yes`.
5. If the user wants imported MCP tool calls preapproved, include `--approve-mcp-tools`.
6. After import, summarize the generated scaffold and run:
   - `pluxx doctor`
   - `pluxx lint`
   - `pluxx test --target claude-code cursor codex opencode`

Return the important generated files, any quality warnings, and whether validation passed.
