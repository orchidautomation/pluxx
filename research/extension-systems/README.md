# Extension Systems Research — Claude Code · Codex · Cursor · OpenCode

Deep reference for hooks / plugins / MCPs / slash commands / skills / subagents / project-instructions across the four major agentic coding tools.

Research date: April 2026. Sources cited inline in each file.

## Files

- **[00-matrix.md](./00-matrix.md)** — side-by-side comparison matrix + headline differences + decision table.
- **[01-claude-code.md](./01-claude-code.md)** — Claude Code: plugins, skills, hooks (26 events), MCP, subagents, marketplaces, CLAUDE.md, auto memory.
- **[02-codex-cli.md](./02-codex-cli.md)** — OpenAI Codex: AGENTS.md (32 KiB cap), skills, plugins, subagents (TOML), hooks (experimental), MCP, config.toml.
- **[03-cursor.md](./03-cursor.md)** — Cursor: `.cursor/rules/*.mdc`, skills, subagents, hooks (20 events), MCP.
- **[04-opencode.md](./04-opencode.md)** — OpenCode: AGENTS.md + Claude Code interop, agents, commands, skills (1,024-char description cap), plugins (JS/TS modules), MCP.

## How to read

If you just need the punchline, read `00-matrix.md`. For implementation detail (character limits, frontmatter fields, exit codes, file paths), open the per-tool file.

## Nuances you'll want to remember

1. Skills follow **one open standard** with four implementation dialects.
2. Cursor hook exit behavior is **fail-open by default** — opposite of Claude Code.
3. Codex `AGENTS.md` **silently truncates at 32 KiB** (`project_doc_max_bytes`).
4. OpenCode plugins are **TypeScript/JavaScript modules**, not JSON.
5. Only Claude Code ships a formal plugin **marketplace** spec today.
