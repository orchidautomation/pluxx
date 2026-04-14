# How pluxx Works

## The Problem

Every AI coding tool has its own plugin format. If you want your tool inside Claude Code, Cursor, Codex, OpenCode, and GitHub Copilot, you need to maintain separate manifests, MCP configs, hooks, and rules for each one.

```
Claude Code wants: .claude-plugin/plugin.json + headers auth + CLAUDE.md + PascalCase hooks
Cursor wants:      .cursor-plugin/plugin.json + headers auth + AGENTS.md + rules/ + hooks/hooks.json
Codex wants:       .codex-plugin/plugin.json + .mcp.json (`bearer_token_env_var` / `env_http_headers` / `http_headers`) + AGENTS.md + external hooks in .codex/hooks.json
OpenCode wants:    package.json + index.ts wrapper + dot.notation events
```

Each platform also has its own validation rules that only surface at runtime — Codex rejects skill descriptions over 1024 characters, Claude Code silently truncates at 250, Cursor requires skill names to match directory names. Discovering these gotchas is trial and error.

## The Solution

pluxx lets you define your plugin once and generates correct, validated output for every platform.

The product now has two intentional layers:

- `Core`: deterministic scaffolding, linting, build, install, and sync
- `Agent`: prompt packs and context packs for Claude Code / Codex to semantically refine the scaffold

Pluxx is intentionally the plugin authoring/distribution layer, not the MCP hosting layer. You still deploy and operate your MCP backend service.

See [Agent Mode](./agent-mode.md) for the semantic-authoring layer.
See [Architecture](./architecture.md) for the system view and [Customer Journey](./customer-journey.md) for the end-to-end user path.
See [Practical handbook](./practical-handbook.md) for the operational command-by-command workflow.

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

That import flow supports:

- remote HTTP MCP servers
- legacy SSE MCP servers via `--transport sse`
- local stdio MCP commands such as `bunx pluxx init --from-mcp "npx -y @acme/mcp"`

A common production transition is:

1. Start from local stdio MCP during development.
2. Build and validate the generated plugin repo.
3. Repoint sync to the deployed remote MCP endpoint: `bunx pluxx sync --from-mcp https://mcp.example.com/mcp`.

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

### Step 4: Diagnose and test locally

```bash
$ bunx pluxx doctor

SUCCESS bun-version Supported Bun runtime detected
SUCCESS config-valid Config parsed successfully
WARNING hooks-trust-required Hook commands require install trust

Doctor summary: 0 error(s), 1 warning(s), 1 info message(s)
```

`pluxx doctor` is read-only. It checks runtime health, config validity, configured paths, MCP auth/transport shape, scaffold metadata, and trust advisories.

```bash
$ bunx pluxx test

Config: my-plugin@0.1.0
Lint: 0 error(s), 0 warning(s)
Build: claude-code, cursor, codex, opencode -> ./dist
PASS claude-code: .claude-plugin/plugin.json
PASS cursor: .cursor-plugin/plugin.json
PASS codex: .codex-plugin/plugin.json
PASS opencode: package.json
pluxx test passed.
```

### Step 5: Install locally

```bash
$ bunx pluxx install --target claude-code

  claude-code -> ~/.claude/plugins/my-plugin

Installed 1 plugin(s). Restart Claude Code to pick it up.

$ claude plugin validate ~/.claude/plugins/my-plugin

  ✓ Validation passed
```

### Step 6: Sync later

```bash
$ bunx pluxx sync --dry-run --json
```

The sync flow refreshes MCP-derived scaffold content while preserving the custom sections in generated Markdown files.

### Step 7: Hand it to the host agent

```bash
$ bunx pluxx autopilot --from-mcp https://example.com/mcp --runner codex --yes --name acme --display-name "Acme" --author "Acme"
```

Or step through Agent Mode manually:

```bash
$ bunx pluxx agent prepare
$ bunx pluxx agent prompt taxonomy
$ bunx pluxx agent run taxonomy --runner claude
$ bunx pluxx agent run taxonomy --runner cursor
$ bunx pluxx agent run taxonomy --runner codex
```

That generates:

- `.pluxx/agent/context.md`
- `.pluxx/agent/plan.json`
- `.pluxx/agent/*-prompt.md`

The intent is simple: Pluxx owns the structure and write boundaries, while the host agent uses those files to refine the generated scaffold without drifting into auth wiring or platform config. `pluxx agent run` is just a thin adapter over that same pack. The current supported runners are `claude`, `cursor`, `opencode`, and `codex`.

If you want durable Agent Mode customization, create `pluxx.agent.md` at the project root. Pluxx will pull extra context paths, product/setup hints, grouping guidance, and prompt additions from that file without requiring edits to generated `.pluxx/agent/*.md` files.

For complex MCPs, steer prompt behavior directly in that file:

- `## Taxonomy Guidance`: avoid misleading/lexical labels and merge tiny singleton/admin-only skills unless justified.
- `## Instructions Guidance`: enforce branded product wording over raw MCP identifiers and clarify setup/admin/account/runtime boundaries.

### Step 8: Ship

Pluxx prepares the correct plugin bundles and manifests, then your team ships them through your own channels.

Typical flow:

1. Commit/version the generated plugin source repo.
2. Build bundles with `bunx pluxx build`.
3. Publish/share those bundles through release artifacts or platform-specific distribution paths.

Pluxx does not deploy the MCP backend service; it keeps plugin distribution and maintenance consistent as that backend evolves.

## What pluxx Handles

### MCP Auth Translation

You write one auth config. pluxx generates the correct format for each platform:

| Platform | Generated auth format |
|----------|----------------------|
| Claude Code | `"headers": { "Authorization": "Bearer ${API_KEY}" }` |
| Codex | `"bearer_token_env_var": "API_KEY"` or `"env_http_headers": { "X-API-Key": "API_KEY" }"` |
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

The generated source of truth for support status and verification coverage is [docs/compatibility.md](./compatibility.md).

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
