---
name: pluxx-import-mcp
description: Import an MCP into a Pluxx project and validate the first pass.
---

# Pluxx Import MCP

Use this skill when the task is: bring an MCP server into Pluxx, generate the initial scaffold, and prove it works.

## Workflow

1. Identify the MCP source:
   - remote HTTP/SSE URL
   - local stdio command
   - auth requirements, especially env vars or custom headers
2. Prefer a deterministic first pass:
   - use `pluxx init --from-mcp ... --yes`
   - include `--display-name`, `--targets`, `--grouping`, and auth flags when needed
   - include `--approve-mcp-tools` when the user wants the imported MCP tools preapproved in canonical permissions
3. If there is supporting context, prepare the agent pack:
   - `pluxx agent prepare --website ... --docs ...`
4. Show the user what was generated:
   - `pluxx.config.ts`
   - `INSTRUCTIONS.md`
   - `skills/*/SKILL.md`
   - `.pluxx/mcp.json`
5. Validate immediately:
   - `pluxx doctor`
   - `pluxx lint`
   - `pluxx test --target claude-code cursor codex opencode`

## Rules

- Use `--dry-run --json` first when you need to preview changes or explain the plan before writing files.
- Keep the first scaffold deterministic. Do not jump straight into semantic rewrites before the plugin builds and tests.
- When auth is custom-header based, pass explicit `--auth-type header --auth-header ... --auth-template ...` flags.
- If the user wants MCP tool calls preapproved in the generated plugin, prefer `--approve-mcp-tools` during import instead of hand-editing permissions later.
- After import, summarize the generated file tree and any warnings that remain.

## Output

- Tell the user whether the MCP imported successfully.
- Call out the generated plugin structure and the important files.
- State whether Claude, Cursor, Codex, and OpenCode passed or what failed.
