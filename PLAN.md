# plug-ahh: The Cross-Platform AI Agent Plugin SDK

## Vision

**Define your plugin once. Ship it everywhere.**

plug-ahh is an open-source SDK that lets developers author AI coding agent plugins from a single source and generate platform-specific outputs for Claude Code, Cursor, OpenCode, Codex, and any future tool that adopts the Agent Skills standard.

Think of it like what Speakeasy does for API SDKs, but for AI agent plugins.

---

## The Problem

Today, building a plugin for AI coding tools means:
- Maintaining 2-4 separate manifest files (`.claude-plugin/plugin.json`, `.cursor-plugin/plugin.json`, `.codex-plugin/plugin.json`)
- Duplicating SKILL.md files across different directory structures
- Writing MCP configs with different auth patterns per platform
- Managing hooks in different formats with different event names
- Creating platform-specific rules (CLAUDE.md vs .cursorrules vs AGENTS.md)
- Building separate install scripts for each platform
- No way to validate cross-platform compatibility

This is what we experienced firsthand building the Megamind plugin — the same content duplicated across `plugin/` (Claude Code) and `plugins/megamind/` (Codex) with different manifests, different MCP auth formats, and no sync mechanism.

---

## The Solution

A single `pluxx.config.ts` (or `.json`/`.yaml`) that defines your plugin canonically, and a CLI that generates all platform targets:

```bash
# Generate all platform outputs
pluxx build

# Generate for specific platforms
pluxx build --target claude-code cursor codex

# Validate your plugin config
pluxx validate

# Initialize a new plugin project
pluxx init

# Watch for changes and rebuild
pluxx dev
```

---

## Architecture

### Core Concepts

```
pluxx.config.ts          (Canonical plugin definition)
       │
       ▼
  ┌─────────┐
  │  Parser  │              Parse + validate config
  └────┬────┘
       │
       ▼
  ┌──────────┐
  │  Schema  │              Normalized internal representation
  └────┬────┘
       │
       ▼
  ┌────────────┐
  │ Generators │            Platform-specific output generators
  └─┬──┬──┬──┬┘
    │  │  │  │
    ▼  ▼  ▼  ▼
  Claude  Cursor  OpenCode  Codex     (Generated outputs)
```

### Config Schema (pluxx.config.ts)

```typescript
import { definePlugin } from 'pluxx'

export default definePlugin({
  // Identity
  name: 'megamind',
  version: '1.0.3',
  description: 'Client intelligence tools powered by Megamind',
  author: { name: 'The Kiln', url: 'https://thekiln.com' },
  repository: 'https://github.com/The-Kiln-Dev/projectmegamind',
  license: 'MIT',
  keywords: ['client-intelligence', 'slack', 'fathom', 'crm'],

  // Brand (used by platforms that support it)
  brand: {
    displayName: 'Megamind',
    shortDescription: 'Client intelligence from synced Slack and Fathom data',
    longDescription: 'Use Megamind to inspect client activity...',
    category: 'Productivity',
    color: '#0F766E',
    icon: './assets/megamind.svg',
    defaultPrompts: [
      'Catch me up on Sendoso using Megamind',
      'Draft a daily update for Cognition',
    ],
  },

  // Skills (shared across all platforms via Agent Skills standard)
  skills: './skills/',

  // MCP servers
  mcp: {
    megamind: {
      url: 'https://megamind.up.railway.app/mcp',
      auth: {
        type: 'bearer',
        envVar: 'MEGAMIND_API_KEY',
      },
    },
  },

  // Hooks (platform-adaptive)
  hooks: {
    sessionStart: [{
      command: '${PLUGIN_ROOT}/scripts/validate-env.sh',
    }],
  },

  // Rules / Instructions
  instructions: './INSTRUCTIONS.md',

  // Agents / Subagents
  agents: './agents/',

  // Commands (legacy, but still supported)
  commands: './commands/',

  // Platform-specific overrides (escape hatch)
  platforms: {
    'claude-code': {
      // Claude-specific skill frontmatter extensions
      skillDefaults: {
        effort: 'high',
      },
    },
    cursor: {
      // Generate .mdc rules from instructions
      rules: [{
        description: 'Megamind conventions',
        alwaysApply: false,
      }],
    },
    codex: {
      // Codex-specific interface metadata
      interface: {
        capabilities: ['Interactive', 'Write'],
        privacyPolicyURL: 'https://thekiln.com/privacy',
      },
    },
    opencode: {
      // Generate programmatic plugin wrapper
      npmPackage: '@thekiln/megamind-opencode',
    },
  },

  // Target platforms to generate (default: all)
  targets: ['claude-code', 'cursor', 'codex', 'opencode'],
})
```

### Generated Output Structure

```
dist/
├── claude-code/
│   ├── .claude-plugin/
│   │   └── plugin.json
│   ├── CLAUDE.md
│   ├── skills/
│   │   └── client-intel/
│   │       └── SKILL.md
│   ├── commands/
│   │   └── pulse.md
│   ├── agents/
│   │   └── megamind.md
│   ├── .mcp.json
│   ├── hooks.json
│   └── scripts/
│       └── validate-env.sh
│
├── cursor/
│   ├── .cursor-plugin/
│   │   └── plugin.json
│   ├── .cursor/
│   │   └── rules/
│   │       └── megamind.mdc
│   ├── skills/
│   │   └── client-intel/
│   │       └── SKILL.md
│   ├── mcp.json
│   ├── hooks.json
│   ├── AGENTS.md
│   └── scripts/
│       └── validate-env.sh
│
├── codex/
│   ├── .codex-plugin/
│   │   └── plugin.json
│   ├── skills/
│   │   └── client-intel/
│   │       └── SKILL.md
│   ├── commands/
│   │   └── pulse.md
│   ├── agents/
│   │   ├── megamind.md
│   │   └── openai.yaml
│   ├── .mcp.json
│   ├── hooks.json
│   ├── AGENTS.md
│   ├── assets/
│   │   └── megamind.svg
│   └── scripts/
│       └── validate-env.sh
│
├── opencode/
│   ├── package.json
│   ├── index.ts
│   ├── skills/
│   │   └── client-intel/
│   │       └── SKILL.md
│   └── scripts/
│       └── validate-env.sh
│
└── install/
    ├── install-claude-code.sh
    ├── install-cursor.sh
    ├── install-codex.sh
    └── install-opencode.sh
```

---

## Phased Implementation

### Phase 0: Foundation (Week 1)
- [ ] TypeScript project with Bun
- [ ] Config schema definition with Zod validation
- [ ] `pluxx init` scaffolding command
- [ ] `pluxx validate` config validator
- [ ] Core internal representation (normalized plugin model)

### Phase 1: Generators (Weeks 2-3)
- [ ] Claude Code generator (manifest, .mcp.json, hooks, CLAUDE.md)
- [ ] Cursor generator (manifest, mcp.json, hooks.json, .mdc rules, AGENTS.md)
- [ ] Codex generator (manifest with interface block, .mcp.json, hooks, AGENTS.md, marketplace.json)
- [ ] OpenCode generator (package.json, index.ts wrapper, event mapping)
- [ ] `pluxx build` command
- [ ] Skill passthrough (copy SKILL.md to all targets, inject platform-specific frontmatter)

### Phase 2: Developer Experience (Weeks 3-4)
- [ ] `pluxx dev` watch mode
- [ ] `pluxx diff` — show what changed per platform
- [ ] `pluxx install <platform>` — install locally for testing
- [ ] Platform detection (auto-detect which tools are installed)
- [ ] Skill validation (lint SKILL.md against Agent Skills spec)

### Phase 3: Distribution (Weeks 4-5)
- [ ] `pluxx publish` — push to platform marketplaces
- [ ] Cursor marketplace submission helper
- [ ] npm publish for OpenCode plugins
- [ ] GitHub release generation
- [ ] Install script generation for each platform

### Phase 4: Advanced (Weeks 5+)
- [ ] Hook translation layer (map common events across platforms)
- [ ] Template library (starter templates for common plugin types)
- [ ] `pluxx migrate` — import existing single-platform plugin
- [ ] CI/CD integration (GitHub Actions for multi-platform builds)
- [ ] Plugin testing framework (dry-run skills, validate MCP connections)
- [ ] Community plugin registry / directory

---

## Key Design Decisions

### 1. Skills are pass-through, not generated
Skills follow the Agent Skills standard. The SDK copies them to each target, only injecting platform-specific frontmatter extensions (like Claude Code's `allowed-tools` or `context: fork`). The skill content itself is never modified.

### 2. Config is TypeScript-first
`pluxx.config.ts` gives autocomplete, type checking, and the ability to compute values. Also supports `.json` and `.yaml` for simpler cases.

### 3. OpenCode gets a generated wrapper
Since OpenCode uses programmatic JS/TS plugins (not declarative config), the SDK generates an `index.ts` that wraps the declarative config into OpenCode's API:
```typescript
// Generated: dist/opencode/index.ts
import type { Plugin } from "@opencode-ai/plugin"

export const MegamindPlugin: Plugin = async ({ project, client, $, directory }) => {
  return {
    "shell.env": async (input, output) => {
      // Validate MEGAMIND_API_KEY on session start
      if (!process.env.MEGAMIND_API_KEY) {
        await client.app.log({ body: { level: "warn", message: "MEGAMIND_API_KEY not set" } })
      }
    },
  }
}
```

### 4. Platform overrides are an escape hatch, not the norm
The `platforms` block in config lets you set platform-specific values, but 90% of plugins shouldn't need it. The SDK applies sensible defaults for each platform.

### 5. MCP auth is normalized
One auth config, translated per platform:
- Claude Code: `headers: { Authorization: "Bearer ${ENV_VAR}" }`
- Codex: `bearer_token_env_var: "ENV_VAR"`
- Cursor: Same as Claude Desktop format
- OpenCode: Config-based

### 6. Hooks degrade gracefully
Not all platforms support all hook events. The SDK maps common events to platform-specific equivalents where possible, and warns when a hook can't be translated.

---

## Tech Stack

| Component | Choice | Why |
|-----------|--------|-----|
| Runtime | Bun | Fast, TypeScript-native, great for CLI tools |
| CLI framework | `citty` or `commander` | Lightweight, good DX |
| Schema validation | Zod | TypeScript-first, great error messages |
| Config loading | `c12` or `unconfig` | Supports .ts/.json/.yaml, merging |
| File generation | Direct fs writes | Simple, no template engine needed |
| Testing | `bun:test` | Built-in, fast |
| Build | `bun build` | Single binary output possible |

---

## Competitive Landscape

| Tool | What it does | Relation to plug-ahh |
|------|-------------|---------------------|
| Agent Skills (agentskills.io) | Open standard for SKILL.md | **Foundation** — we build on this |
| Speakeasy | API SDK generation from OpenAPI | **Inspiration** for "define once, generate many" |
| Stainless | API SDK generation from OpenAPI | Same category as Speakeasy |
| cursor.directory | Community rules/MCP directory | **Potential integration** for distribution |
| awesome-opencode | Community plugin directory | **Potential integration** |

---

## Name Options

- **plug-ahh** (current) — playful, memorable
- **plugkit** — straightforward
- **agentplug** — descriptive
- **skillforge** — evokes creation
- **xplug** — cross-platform plug

---

## Success Metrics

1. **Plugin authors can go from 0 to multi-platform in < 10 minutes** with `pluxx init` + `pluxx build`
2. **The Megamind plugin can be fully generated** from a single config, eliminating the current duplication
3. **Community adoption** — 3rd party plugins use plug-ahh for cross-platform distribution
4. **Platform parity** — when a new platform adopts Agent Skills, adding a generator is < 1 day of work
