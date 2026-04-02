# plugahh

**Build AI agent plugins once. Ship them everywhere.**

plugahh generates native plugin packages for Claude Code, Cursor, OpenCode, and Codex from a single config file. One source of truth &mdash; four platform-specific outputs with correct manifests, MCP configs, hooks, rules, and install scripts.

```bash
npx plugahh build
```

```
dist/
  claude-code/   .claude-plugin/plugin.json, .mcp.json, CLAUDE.md, hooks, skills
  cursor/        .cursor-plugin/plugin.json, mcp.json, hooks.json, AGENTS.md, rules
  codex/         .codex-plugin/plugin.json, .mcp.json, hooks, AGENTS.md, interface metadata
  opencode/      package.json, index.ts (programmatic plugin wrapper), skills
```

## Why?

Tools like `npx skills` install SKILL.md files across agents. That covers **skills**.

But a plugin is more than skills. A plugin bundles:

| Component | What plugahh handles |
|-----------|---------------------|
| **Manifests** | `.claude-plugin/plugin.json` vs `.cursor-plugin/plugin.json` vs `.codex-plugin/plugin.json` |
| **MCP auth** | Claude Code uses `headers`, Codex uses `bearer_token_env_var`, Cursor uses Claude Desktop format |
| **Hooks** | Different event names, different JSON schemas, different path conventions |
| **Rules** | `CLAUDE.md` vs `.cursor/rules/*.mdc` vs `AGENTS.md` |
| **Brand metadata** | Codex has icons, colors, screenshots, default prompts. Others don't. |
| **Subagents** | Different formats per platform |
| **OpenCode** | Needs a generated JS/TS module, not just config files |

Without plugahh you maintain 2-4 copies of the same plugin. With plugahh you maintain one.

## Quick Start

```bash
# Scaffold a new plugin
npx plugahh init my-plugin
cd my-plugin

# Edit plugahh.config.ts, create skills in ./skills/

# Build for all platforms
npx plugahh build

# Build for specific platforms
npx plugahh build --target claude-code cursor

# Validate your config
npx plugahh validate
```

## Config

```typescript
// plugahh.config.ts
import { definePlugin } from 'plugahh'

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

  // Hooks (mapped to each platform's event system)
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

One auth config, four correct outputs:

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

// OpenCode gets:
// env var validation in generated plugin wrapper
```

### Plugin Manifests

Each platform gets its native manifest format:

- **Claude Code**: `.claude-plugin/plugin.json` with skills, commands paths
- **Cursor**: `.cursor-plugin/plugin.json` with marketplace-compatible schema
- **Codex**: `.codex-plugin/plugin.json` with full `interface` block (brand color, icons, screenshots, default prompts, capabilities)
- **OpenCode**: `package.json` + generated `index.ts` wrapping your config into the programmatic `Plugin` API

### Instructions → Platform-Native Rules

Your single `INSTRUCTIONS.md` becomes:
- `CLAUDE.md` for Claude Code
- `AGENTS.md` for Codex and Cursor
- `.mdc` rule files for Cursor (with frontmatter) when you specify rules in platform overrides

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

## Real-World Example

The [example/megamind](./example/megamind) directory contains a full plugin that was previously hand-maintained as two separate copies ([source](https://github.com/The-Kiln-Dev/projectmegamind)). With plugahh, one `plugahh.config.ts` generates **34 files across 4 platforms**.

```bash
cd example/megamind
npx plugahh build
# Generated: 34 files across claude-code/, cursor/, codex/, opencode/
```

## Testing Locally

After building, test on any platform:

```bash
# Claude Code
claude --plugin-dir ./dist/claude-code

# Cursor
ln -s $(pwd)/dist/cursor ~/.cursor/plugins/local/my-plugin

# Codex
ln -s $(pwd)/dist/codex ~/plugins/my-plugin

# OpenCode
# Add to opencode.json: { "plugin": ["./dist/opencode"] }
```

## How It Works

```
plugahh.config.ts          ← You define your plugin once
       │
       ▼
  ┌─────────┐
  │  Parser  │              Zod schema validation
  └────┬────┘
       │
       ▼
  ┌────────────┐
  │ Generators │            Platform-specific output generators
  └─┬──┬──┬──┬┘
    │  │  │  │
    ▼  ▼  ▼  ▼
  Claude  Cursor  Codex  OpenCode
  Code
```

Each generator knows the exact file structure, manifest schema, MCP auth format, hook events, and conventions for its platform. Skills are passed through using the [Agent Skills](https://agentskills.io/) open standard.

## Comparison

| | plugahh | npx skills | SkillKit |
|---|:---:|:---:|:---:|
| Install skills to multiple agents | - | Yes | Yes |
| Generate plugin manifests | Yes | - | - |
| MCP config with auth translation | Yes | - | - |
| Hook generation per platform | Yes | - | - |
| Brand/interface metadata | Yes | - | - |
| Rules/instructions generation | Yes | - | Translate only |
| OpenCode plugin wrapper | Yes | - | - |
| Subagent configs | Yes | - | - |

**plugahh builds plugins. The others install skills.** They're complementary — use `npx skills` to distribute your skills, use plugahh to build the full plugin package.

## Built On

- [Agent Skills](https://agentskills.io/) open standard (skills are pass-through, never modified)
- [Zod](https://zod.dev/) for config validation with full TypeScript inference
- [Bun](https://bun.sh/) for fast builds and TypeScript-native execution

## Roadmap

- [x] Core schema with Zod validation
- [x] Generators: Claude Code, Cursor, Codex, OpenCode
- [x] CLI: `build`, `validate`, `init`
- [x] MCP auth normalization across platforms
- [x] Real-world example (Megamind plugin)
- [ ] `plugahh install <platform>` — auto-symlink for local testing
- [ ] `plugahh dev` — watch mode with auto-rebuild
- [ ] `plugahh migrate` — import existing single-platform plugin
- [ ] `plugahh diff` — show what changed per platform
- [ ] `plugahh publish` — push to platform marketplaces
- [ ] Plugin analytics dashboard
- [ ] CI/CD GitHub Action
- [ ] Additional generators (Windsurf, Zed, Gemini CLI)

## License

MIT
