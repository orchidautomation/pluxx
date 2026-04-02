# plugahh Landing Page Copy

## Hero
**Headline**: Build AI agent plugins once. Ship them everywhere.
**Subhead**: One config generates native plugin packages for Claude Code, Cursor, Codex, OpenCode, GitHub Copilot, and more. Stop maintaining 7 copies of the same plugin.

**CTA**: `npx plugahh init`
**Secondary CTA**: View on GitHub

## Terminal Demo (show this as animated/static code block)
```
$ npx plugahh build

Loading config...
Building for: claude-code, cursor, codex, opencode, github-copilot, openhands, warp

  dist/claude-code/    .claude-plugin/plugin.json, .mcp.json, CLAUDE.md, hooks, skills
  dist/cursor/         .cursor-plugin/plugin.json, mcp.json, hooks.json, AGENTS.md
  dist/codex/          .codex-plugin/plugin.json, .mcp.json, interface metadata
  dist/opencode/       package.json, index.ts plugin wrapper
  dist/github-copilot/ plugin.json, .mcp.json, hooks, skills
  dist/openhands/      .plugin/plugin.json, .mcp.json, skills
  dist/warp/           AGENTS.md, mcp.json, skills

Done! 60 files generated across 7 platforms.
```

## Agent Grid Section
**Headline**: Works with all your favourite agents
**Subhead**: plugahh generates native plugin packages for these AI coding tools. More coming every week.

Agents (with logos):
- Claude Code
- Cursor
- Codex (OpenAI)
- OpenCode
- GitHub Copilot
- OpenHands
- Warp
- (Coming soon: Gemini CLI, Qwen Code, Roo Code, Cline, Kilo Code, AMP, Kimi CLI, OpenClaw)

## Problem Section
**Headline**: The plugin fragmentation problem
**Subhead**: Every AI coding tool has its own plugin format. Building for all of them means maintaining separate manifests, MCP configs, hooks, and rules.

| What changes | Claude Code | Cursor | Codex | OpenCode |
|---|---|---|---|---|
| Manifest | `.claude-plugin/plugin.json` | `.cursor-plugin/plugin.json` | `.codex-plugin/plugin.json` | `package.json` + code |
| MCP auth | `headers: { Authorization }` | `headers: { Authorization }` | `bearer_token_env_var` | env validation |
| Hooks | `settings.json` PascalCase | `hooks.json` camelCase | `hooks.json` PascalCase | JS event handlers |
| Rules | `CLAUDE.md` | `.mdc` + `AGENTS.md` | `AGENTS.md` | Config |
| Brand | Basic | Basic | Rich (colors, icons, screenshots) | None |

## Solution Section
**Headline**: One config to rule them all
**Subhead**: Define your plugin in `plugahh.config.ts`. We handle the rest.

Show the config file with syntax highlighting, then arrows to each platform output.

## MCP Translation Section
**Headline**: MCP auth translated automatically

```typescript
// You write once:
mcp: {
  server: {
    url: 'https://api.example.com/mcp',
    auth: { type: 'bearer', envVar: 'API_KEY' },
  },
}
```

→ Claude Code: `{ "headers": { "Authorization": "Bearer ${API_KEY}" } }`
→ Codex: `{ "bearer_token_env_var": "API_KEY" }`  
→ Cursor: `{ "headers": { "Authorization": "Bearer ${API_KEY}" } }`
→ OpenCode: env var validation in generated wrapper

## How It Works
1. `npx plugahh init` — scaffold your plugin config
2. Add your skills, MCP servers, hooks, and brand metadata
3. `npx plugahh build` — generate for all platforms
4. `npx plugahh install` — symlink for local testing
5. Ship it.

## Open Source
**Headline**: Open source. MIT licensed.
**Subhead**: The CLI is free forever. Build and test plugins locally with zero restrictions.

**Coming soon**: plugahh.dev — publish to all marketplaces, analytics dashboard, team plugin registries.

## Footer CTA
**Headline**: Start building in 30 seconds
```
npx plugahh init my-plugin
```
GitHub | Docs | Discord
