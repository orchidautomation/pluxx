# pluxx Landing Page Copy

## Hero
**Headline**: Build AI agent plugins once. Ship the core four.
**Subhead**: One config generates native plugin packages for Claude Code, Cursor, Codex, and OpenCode. The current proof stack now covers self-hosting, install verification, a live Docsalot flagship workflow, and a separate authenticated publish lane.

**CTA**: `npx @orchid-labs/pluxx init`
**Hero note**: Published CLI and maintainer flows run on Node 18+.
**Secondary CTA**: View on GitHub

## Terminal Demo (show this as animated/static code block)
```
$ npx @orchid-labs/pluxx test --install --trust

Building for: claude-code, cursor, codex, opencode
Installing local bundles...

  PASS claude-code    installed bundle verified
  PASS cursor         installed bundle verified
  PASS codex          installed bundle verified
  PASS opencode       installed bundle verified

Ready for a real workflow run in the host you actually use.
```

## Agent Grid Section
**Headline**: Prime-time on the core four
**Subhead**: pluxx generates native plugin packages for Claude Code, Cursor, Codex, and OpenCode, with additional generators available as beta.

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
**Subhead**: Define your plugin in `pluxx.config.ts`. We handle the rest.

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
1. `npx @orchid-labs/pluxx init` — scaffold your plugin config
2. Add your skills, MCP servers, hooks, and brand metadata
3. `npx @orchid-labs/pluxx build` — generate for all platforms
4. `npx @orchid-labs/pluxx test --install` — build, install, and verify local targets
5. `npx @orchid-labs/pluxx verify-install` — inspect the host-visible installed state
6. Ship it.

## Open Source
**Headline**: Open source. MIT licensed.
**Subhead**: The CLI is free forever. Build and test plugins locally with zero restrictions.

**Later direction**: release-driven install surfaces, stronger proof packaging, and a cleaner public install experience.

## Footer CTA
**Headline**: Start building in 30 seconds
```
npx @orchid-labs/pluxx init my-plugin
```
GitHub | Docs | Discord
