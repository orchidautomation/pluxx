# pluxx

**Build AI agent plugins once. Ship them everywhere.**

pluxx generates native plugin packages for Claude Code, Cursor, Codex, and OpenCode from a single config file. One source of truth &mdash; platform-specific outputs with the right manifests, MCP configs, rules, install scripts, and hook handling for the platforms that support plugin-packaged hooks.

pluxx is Bun-first today. Use `bunx` or run it from a Bun workspace.

```bash
bunx pluxx build
```

```
dist/
  claude-code/   .claude-plugin/plugin.json, .mcp.json, CLAUDE.md, hooks/hooks.json, skills
  cursor/        .cursor-plugin/plugin.json, mcp.json, hooks/hooks.json, AGENTS.md, rules/
  codex/         .codex-plugin/plugin.json, .mcp.json, AGENTS.md, interface metadata
```

## Platform Support

| Platform | Status | Validated |
|----------|--------|-----------|
| **Claude Code** | Primary | `claude plugin validate` PASSED |
| **Cursor** | Primary | Docs-audited, hooks + rules covered in lint |
| **Codex** | Primary | Docs-audited, plugin packaging aligned; hooks remain external Codex config |
| **OpenCode** | Primary | Generates JS/TS wrapper, active docs-parity work |
| GitHub Copilot | Beta | Reuses Claude Code format (confirmed compatible) |
| OpenHands | Beta | Generates .plugin/ manifest, needs live testing |
| Warp | Beta | Generates skills + AGENTS.md |
| Gemini CLI | Beta | Generates gemini-extension.json |
| Roo Code | Beta | Generates .roorules + skills |
| Cline | Beta | Generates .clinerules + skills |
| AMP | Beta | Generates AGENT.md + skills |

**Primary** = first-class launch target, actively maintained.
**Beta** = generated, but less validated against live tool behavior.

## Why?

Tools like `npx skills` install SKILL.md files across agents. That covers **skills**.

But a plugin is more than skills. A plugin bundles:

| Component | What pluxx handles |
|-----------|---------------------|
| **Manifests** | `.claude-plugin/plugin.json` vs `.cursor-plugin/plugin.json` vs `.codex-plugin/plugin.json` |
| **MCP auth** | Claude Code uses `headers`, Codex uses `bearer_token_env_var`, Cursor uses Claude Desktop format |
| **Hooks** | Different event names, different JSON schemas, and in Codex's case a separate runtime config path |
| **Rules** | `CLAUDE.md` vs `rules/*.mdc` vs `AGENTS.md` |
| **Brand metadata** | Codex has icons, colors, screenshots, default prompts. Others don't. |
| **Subagents** | Different formats per platform |

Without pluxx you maintain separate copies for each platform. With pluxx you maintain one.

The launch focus is MCP-first authoring: start from an existing MCP server, generate a maintainable plugin scaffold, then keep shipping from one config.

## Quick Start

```bash
# Scaffold a new plugin
bunx pluxx init my-plugin
cd my-plugin

# Edit pluxx.config.ts, create skills in ./skills/

# Build for all platforms
bunx pluxx build

# Lint against all platform rules (47 checks)
bunx pluxx lint

# Build for specific platforms
bunx pluxx build --target claude-code cursor codex opencode

# Validate your config
bunx pluxx validate
```

## Config

```typescript
// pluxx.config.ts
import { definePlugin } from 'pluxx'

export default definePlugin({
  name: 'my-plugin',
  version: '1.0.0',
  description: 'What your plugin does',
  author: { name: 'Your Name' },

  // Skills (Agent Skills standard — shared across all platforms)
  skills: './skills/',

  // MCP servers (auth format auto-translated per platform)
  mcp: {
    'my-server': {
      url: 'https://my-server.com/mcp',
      auth: {
        type: 'bearer',
        envVar: 'MY_API_KEY',
      },
    },
  },

  // Hooks (generated where the platform supports plugin-packaged hooks;
  // Codex currently keeps hook config in .codex/hooks.json outside plugin bundles)
  hooks: {
    sessionStart: [{
      command: '${PLUGIN_ROOT}/scripts/setup.sh',
    }],
  },

  // Instructions (generates CLAUDE.md, AGENTS.md, or .mdc rules)
  instructions: './INSTRUCTIONS.md',

  // Brand (used by platforms that support rich metadata)
  brand: {
    displayName: 'My Plugin',
    color: '#3B82F6',
    icon: './assets/icon.svg',
    defaultPrompts: ['Try my plugin with this prompt'],
  },

  // Target platforms
  targets: ['claude-code', 'cursor', 'codex', 'opencode'],
})
```

## What Gets Generated

### MCP Config Translation

You write one auth config. pluxx generates the correct format for each platform:

```typescript
// You write:
mcp: {
  server: {
    url: 'https://api.example.com/mcp',
    auth: { type: 'bearer', envVar: 'API_KEY' },
  },
}
```

```jsonc
// Claude Code gets:
{ "headers": { "Authorization": "Bearer ${API_KEY}" } }

// Codex gets:
{ "bearer_token_env_var": "API_KEY" }

// Cursor gets:
{ "headers": { "Authorization": "Bearer ${API_KEY}" } }
```

### Plugin Manifests

Each platform gets its native manifest format:

- **Claude Code**: `.claude-plugin/plugin.json` with skills, commands paths
- **Cursor**: `.cursor-plugin/plugin.json` with explicit `rules/`, `hooks/hooks.json`, and `mcp.json` component paths
- **Codex**: `.codex-plugin/plugin.json` with full `interface` block (brand color, icons, screenshots, default prompts, capabilities) plus external hooks via `.codex/hooks.json`
- **OpenCode**: npm package + JS/TS plugin wrapper

### Instructions to Platform-Native Rules

Your single `INSTRUCTIONS.md` becomes:
- `CLAUDE.md` for Claude Code
- `AGENTS.md` for Codex and Cursor
- `.mdc` rule files in `rules/` for Cursor (with frontmatter) when you specify rules in platform overrides

### 47 Lint Checks

`pluxx lint` catches platform-specific gotchas before you ship:

- Codex rejects SKILL.md descriptions over 1024 characters
- Claude Code silently truncates descriptions at 250 characters
- Cursor and Cline require skill names to match their directory names
- Codex allows max 3 default prompts, 128 chars each
- Claude Code hook events must be PascalCase (26 valid events)
- Manifest paths must start with `./` and cannot contain `../`
- Plugin directories must be at root, not inside `.claude-plugin/`
- Version must follow semver format
- And 39 more checks across all platforms

### Platform Overrides

For the 10% of cases where platforms diverge:

```typescript
platforms: {
  'claude-code': {
    skillDefaults: { effort: 'high' },
  },
  cursor: {
    rules: [{
      description: 'My conventions',
      alwaysApply: false,
    }],
  },
  codex: {
    interface: {
      capabilities: ['Interactive', 'Write'],
      privacyPolicyURL: 'https://example.com/privacy',
    },
  },
}
```

## Real-World Examples

### Megamind (client intelligence plugin)

The [example/megamind](./example/megamind) directory contains a full plugin that was previously hand-maintained as two separate copies. With pluxx, one config generates outputs for all platforms.

```bash
cd example/megamind
bunx pluxx build
```

### Prospeo (sales intelligence MCP)

The [examples/prospeo-mcp](./examples/prospeo-mcp) directory wraps a real MCP server into a multi-platform plugin with 4 skills:

```bash
cd examples/prospeo-mcp
bunx pluxx build   # 52 files across 7 platforms
bunx pluxx lint    # Catches real platform gotchas
```

## Testing Locally

```bash
# Build and install to Claude Code
bunx pluxx build
bunx pluxx install --target claude-code

# Validate with Claude Code's own validator
claude plugin validate ~/.claude/plugins/my-plugin
# ✓ Validation passed
```

## Hook Trust Model

Hook commands are shell commands that execute on your machine when hook events fire. If you install a third-party plugin with hooks, you are trusting that plugin author with local command execution.

`pluxx install` now warns when the plugin config contains command hooks and prints each event/command pair before install proceeds.

Use `--trust` to bypass the confirmation prompt (useful in CI/non-interactive environments):

```bash
bunx pluxx install --trust
```

## CLI Commands

| Command | What it does |
|---------|-------------|
| `pluxx init` | Interactive scaffold with MCP, hooks, brand prompts |
| `pluxx build` | Generate plugin packages for all target platforms |
| `pluxx lint` | 47 checks against all platform rules |
| `pluxx validate` | Validate your config schema |
| `pluxx install` | Symlink built plugins for local testing (prompts when hook commands exist) |
| `pluxx install --trust` | Bypass hook trust confirmation |
| `pluxx uninstall` | Remove symlinked plugins |
| `pluxx dev` | Watch mode with auto-rebuild on file changes |
| `pluxx migrate <path>` | Import an existing single-platform plugin |

## How It Works

```
pluxx.config.ts          <- You define your plugin once
       |
       v
  +---------+
  |  Parse  |              Zod schema validation
  +----+----+
       |
       v
  +--------+
  |  Lint  |               47 platform-specific checks
  +----+---+
       |
       v
  +----------+
  | Generate |             Platform-specific generators
  +-+--+--+--+
    |  |  |
    v  v  v
  Claude  Cursor  Codex    + 8 beta platforms
  Code
```

## Comparison

| | pluxx | npx skills | SkillKit |
|---|:---:|:---:|:---:|
| Install skills to multiple agents | - | Yes | Yes |
| Generate plugin manifests | Yes | - | - |
| MCP config with auth translation | Yes | - | - |
| Hook generation per platform | Yes | - | - |
| Brand/interface metadata | Yes | - | - |
| Rules/instructions generation | Yes | - | Translate only |
| Cross-platform lint (47 checks) | Yes | - | - |
| Subagent configs | Yes | - | - |

**pluxx builds plugins. The others install skills.** They're complementary — use `npx skills` to distribute your skills, use pluxx to build the full plugin package.

## Built On

- [Agent Skills](https://agentskills.io/) open standard (skills are pass-through, never modified)
- [Zod](https://zod.dev/) for config validation with full TypeScript inference
- [Bun](https://bun.sh/) for fast builds and TypeScript-native execution

## Roadmap

- [x] Core schema with Zod validation
- [x] Generators: Claude Code, Cursor, Codex (fully supported) + 8 beta platforms
- [x] CLI: `build`, `validate`, `init`, `lint`, `install`, `uninstall`, `dev`, `migrate`
- [x] MCP auth normalization across platforms
- [x] 47 lint checks from official docs (Firecrawl-verified)
- [x] Real-world examples (Megamind + Prospeo)
- [ ] `pluxx lint --fix` — auto-apply suggested fixes
- [ ] `pluxx init --from-mcp` — auto-scaffold plugins from existing MCP servers
- [ ] `pluxx publish` — push to platform marketplaces
- [ ] `pluxx diff` — show what changed per platform
- [ ] Plugin analytics dashboard
- [ ] CI/CD GitHub Action
- [ ] Promote beta platforms to fully supported

## License

MIT
