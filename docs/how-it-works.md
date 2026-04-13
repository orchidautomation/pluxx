# How pluxx Works

## The Problem

Every AI coding tool has its own plugin format. If you want your tool inside Claude Code, Cursor, Codex, OpenCode, and GitHub Copilot, you need to maintain separate manifests, MCP configs, hooks, and rules for each one.

```
Claude Code wants: .claude-plugin/plugin.json + headers auth + CLAUDE.md + PascalCase hooks
Cursor wants:      .cursor-plugin/plugin.json + headers auth + AGENTS.md + rules/ + hooks/hooks.json
Codex wants:       .codex-plugin/plugin.json + bearer_token_env_var + AGENTS.md + external hooks in .codex/hooks.json
OpenCode wants:    package.json + index.ts wrapper + dot.notation events
```

Each platform also has its own validation rules that only surface at runtime — Codex rejects skill descriptions over 1024 characters, Claude Code silently truncates at 250, Cursor requires skill names to match directory names. Discovering these gotchas is trial and error.

## The Solution

pluxx lets you define your plugin once and generates correct, validated output for every platform.

Runtime today: Bun. Use `bunx pluxx ...` or install the npm package on machines that already have Bun available.

```
pluxx.config.ts          ← You write one config
       │
       ▼
  ┌─────────┐
  │  Parse   │            Zod schema validation
  └────┬────┘
       │
       ▼
  ┌──────────┐
  │  Lint    │            47 checks across all platforms
  └────┬────┘
       │
       ▼
  ┌────────────┐
  │ Generate  │            11 platform-specific generators
  └─┬──┬──┬──┬┘
    │  │  │  │
    ▼  ▼  ▼  ▼
  Claude  Cursor  Codex  OpenCode  +7 more
  Code
```

## How You Use It

### Step 1: Define your plugin

You can either author from scratch or scaffold directly from a live MCP server:

```bash
$ bunx pluxx init --from-mcp https://example.com/mcp
```

That flow introspects the server, reads its tool metadata, and drafts workflow-oriented skills instead of mirroring raw tool names one-to-one whenever the tool set supports a clearer grouping.

For automation or CI-style setup, the same flow supports headless flags:

```bash
$ bunx pluxx init --from-mcp https://example.com/mcp --yes --name acme --display-name "Acme" --author "Acme" --targets claude-code,codex --grouping workflow --hooks safe --json
```

Generated `INSTRUCTIONS.md` and MCP-derived `SKILL.md` files now use a mixed-ownership format: Pluxx owns the generated block, and a separate custom section is preserved across `pluxx sync --from-mcp`.

Those generated skills also include deterministic example requests based on the discovered tool names and required input fields, so the scaffold is immediately usable before any manual or AI-assisted rewriting.

```typescript
// pluxx.config.ts
import { definePlugin } from 'pluxx'

export default definePlugin({
  name: 'my-plugin',
  description: 'What your plugin does',
  author: { name: 'Your Name' },

  // MCP server (auth format auto-translated per platform)
  mcp: {
    'my-server': {
      url: 'https://api.example.com/mcp',
      auth: { type: 'bearer', envVar: 'API_KEY' },
    },
  },

  // Skills (Agent Skills standard, shared across all platforms)
  skills: './skills/',

  // Hooks (mapped to each platform's event system)
  hooks: {
    sessionStart: [{
      command: '${PLUGIN_ROOT}/scripts/setup.sh',
    }],
  },

  // Brand metadata (used by platforms that support it)
  brand: {
    displayName: 'My Plugin',
    color: '#6366f1',
    icon: './assets/icon.svg',
  },

  // Target platforms
  targets: ['claude-code', 'cursor', 'codex', 'opencode'],
})
```

### Step 2: Build

```bash
$ bunx pluxx build

Building for: claude-code, cursor, codex, opencode, github-copilot, openhands, warp

  dist/claude-code/    .claude-plugin/plugin.json, .mcp.json, CLAUDE.md, hooks/hooks.json
  dist/cursor/         .cursor-plugin/plugin.json, mcp.json, hooks/hooks.json, rules/
  dist/codex/          .codex-plugin/plugin.json, .mcp.json, AGENTS.md, interface metadata
  dist/opencode/       package.json, index.ts wrapper
  ...

Done! 85 files generated across 11 platforms.
```

### Step 3: Lint

```bash
$ bunx pluxx lint

  ✓ Plugin name is valid kebab-case
  ✓ Version follows semver format
  ✓ Skills directory found with 3 skills

  ⚠ warning: Description will be truncated in claude-code (display limit: 250)
  ✗ error: Description exceeds codex max of 1024 characters
  ✗ error: Skill name "My-Skill" doesn't match directory "my-skill" (required by cursor, codex, cline)
  ⚠ warning: Hook event "afterFileEdit" (as "AfterFileEdit") is not a recognized Claude Code hook event

  2 errors, 2 warnings
```

### Step 4: Test locally

```bash
$ bunx pluxx install --target claude-code

  claude-code -> ~/.claude/plugins/my-plugin

Installed 1 plugin(s). Restart Claude Code to pick it up.

$ claude plugin validate ~/.claude/plugins/my-plugin

  ✓ Validation passed
```

### Step 5: Ship

Deploy to whichever marketplaces you want, with correct manifests already generated.

## What pluxx Handles

### MCP Auth Translation

You write one auth config. pluxx generates the correct format for each platform:

| Platform | Generated auth format |
|----------|----------------------|
| Claude Code | `"headers": { "Authorization": "Bearer ${API_KEY}" }` |
| Codex | `"bearer_token_env_var": "API_KEY"` |
| Cursor | `"headers": { "Authorization": "Bearer ${API_KEY}" }` |
| OpenCode | Env var validation in generated TypeScript wrapper |

### Hook Event Translation

Pluxx maps canonical hook names for plugin-packaged hook targets and validates Codex compatibility for external Codex hook config.

| Your config | Claude Code | Cursor | Codex external config |
|-------------|-------------|--------|------------------------|
| `sessionStart` | `SessionStart` | `sessionStart` | `SessionStart` |
| `preToolUse` | `PreToolUse` | `preToolUse` | `PreToolUse` |
| `beforeSubmitPrompt` | `UserPromptSubmit` | `beforeSubmitPrompt` | `UserPromptSubmit` |

### Instructions Generation

Your single `INSTRUCTIONS.md` becomes the right file for each platform:

| Platform | Generated file |
|----------|----------------|
| Claude Code | `CLAUDE.md` |
| Cursor | `AGENTS.md` + `rules/*.mdc` |
| Codex | `AGENTS.md` |
| Warp | `AGENTS.md` |
| Gemini CLI | `GEMINI.md` |
| Roo Code | `.roorules` |
| Cline | `.clinerules` |
| AMP | `AGENT.md` |

### 47 Lint Checks

pluxx catches platform-specific gotchas before you ship:

- Codex rejects SKILL.md descriptions over 1024 characters
- Claude Code silently truncates descriptions at 250 characters
- Cursor and Cline require skill names to match their directory names
- Codex manifest allows max 3 default prompts, 128 chars each
- Claude Code hook events must be PascalCase (26 valid events)
- Manifest paths must start with `./` and cannot contain `../`
- Plugin directories must be at root, not inside `.claude-plugin/`
- And 40 more checks across all 11 platforms

## Supported Platforms

| Platform | Manifest | Skills | MCP | Hooks | Rules |
|----------|:--------:|:------:|:---:|:-----:|:-----:|
| Claude Code | `.claude-plugin/` | Yes | Yes | Yes | CLAUDE.md |
| Cursor | `.cursor-plugin/` | Yes | Yes | Yes | .mdc + AGENTS.md |
| Codex | `.codex-plugin/` | Yes | Yes | External (`.codex/hooks.json`) | AGENTS.md |
| OpenCode | JS/TS module | Yes | Yes | Yes | AGENTS.md |
| GitHub Copilot | `.claude-plugin/` | Yes | Yes | Yes | AGENTS.md |
| OpenHands | `.plugin/` | Yes | Yes | Yes | AGENTS.md |
| Warp | Skills only | Yes | Yes | No | AGENTS.md |
| Gemini CLI | `gemini-extension.json` | Yes | Yes | Yes | GEMINI.md |
| Roo Code | Config files | Yes | Yes | No | .roorules |
| Cline | Config files | Yes | Yes | Yes | .clinerules |
| AMP | Config files | Yes | Yes | Yes | AGENT.md |
