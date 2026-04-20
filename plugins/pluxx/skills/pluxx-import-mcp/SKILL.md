---
name: pluxx-import-mcp
description: Use when the user wants to scaffold a Pluxx plugin from an MCP server, inspect what was generated, or validate the first-pass plugin across Claude Code, Cursor, Codex, and OpenCode.
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
- After import, summarize the generated file tree and any warnings that remain.

## Output

- Tell the user whether the MCP imported successfully.
- Call out the generated plugin structure and the important files.
- State whether the core four passed or what failed.
