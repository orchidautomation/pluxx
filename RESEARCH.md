# Cross-Platform AI Agent Plugin Research

> Research compiled April 2, 2026. Sources: Official docs from Claude Code, Cursor, OpenCode, Codex; agentskills.io open standard; existing megamind plugin implementation.

## Executive Summary

There are now 4+ major AI coding tools that support plugins, and they're converging on shared concepts but with incompatible formats. An **Agent Skills** open standard (agentskills.io, started by Anthropic) standardizes SKILL.md but does NOT cover the full plugin packaging story: manifests, MCP config, hooks, rules, distribution, and testing remain fragmented.

**The gap**: No tool exists to define a plugin once and generate/maintain it for all platforms.

---

## 1. Platform Extension Points — Complete Map

### 1.1 Claude Code

| Concept | Format | Location | Notes |
|---------|--------|----------|-------|
| **Plugin manifest** | `.claude-plugin/plugin.json` | Plugin root | name, version, description, author, commands, skills |
| **Skills** | `SKILL.md` (YAML frontmatter + markdown) | `.claude/skills/<name>/SKILL.md` | Agent Skills standard + extensions |
| **Commands** | Markdown files | `.claude/commands/<name>.md` | Legacy, merged into skills |
| **MCP config** | `.mcp.json` | Plugin root or project root | `{ mcpServers: { name: { type, url, headers } } }` |
| **Hooks** | JSON in settings.json or hooks.json | `.claude/settings.json` or plugin hooks | Events: SessionStart, PreToolUse, PostToolUse, etc. |
| **Rules/Instructions** | `CLAUDE.md` | Project root, `~/.claude/`, plugin root | Markdown, hierarchical (enterprise > personal > project) |
| **Subagents** | Markdown files | `.claude/agents/<name>.md` | Custom agent configs with system prompts |
| **Distribution** | Git clone, --add-dir, managed settings | Plugin dirs, npm (future) | No marketplace yet |

**Claude Code skill frontmatter fields:**
- `name` — Display name (lowercase, hyphens, max 64 chars)
- `description` — What it does, when to use (recommended, max 250 chars displayed)
- `argument-hint` — Autocomplete hint, e.g. `[issue-number]`
- `disable-model-invocation` — `true` = manual-only via `/name`
- `user-invocable` — `false` = hidden from `/` menu, Claude-only
- `allowed-tools` — Tools allowed without permission when active
- `model` — Model override when active
- `effort` — Effort level override (low/medium/high/max)
- `context` — `fork` to run in isolated subagent
- `agent` — Subagent type when `context: fork` (Explore, Plan, general-purpose, or custom)
- `hooks` — Hooks scoped to this skill's lifecycle
- `paths` — Glob patterns limiting auto-activation
- `shell` — `bash` (default) or `powershell`

**Claude Code-specific features:**
- `!`command`` syntax for dynamic context injection (shell commands run before prompt)
- `$ARGUMENTS`, `$ARGUMENTS[N]`, `$N` substitution
- `${CLAUDE_SESSION_ID}`, `${CLAUDE_SKILL_DIR}` variables
- Supporting files (scripts/, references/, assets/)
- Subagent execution with `context: fork` + `agent: <type>`

---

### 1.2 Cursor

| Concept | Format | Location | Notes |
|---------|--------|----------|-------|
| **Plugin manifest** | `.cursor-plugin/plugin.json` | Plugin root | name, description, version, author |
| **Skills** | `SKILL.md` (YAML frontmatter + markdown) | `.agents/skills/`, `.cursor/skills/`, `~/.cursor/skills/` | Agent Skills standard |
| **Rules** | `.mdc` or `.md` files with frontmatter | `.cursor/rules/` | Types: Always, Intelligent, File-specific, Manual |
| **MCP config** | `mcp.json` | `.cursor/mcp.json` or plugin root | Same format as Claude Desktop |
| **Hooks** | `hooks.json` | `.cursor/hooks.json` or `~/.cursor/hooks.json` | Rich event system, prompt-based hooks |
| **Instructions** | `AGENTS.md` | Project root + nested subdirs | Plain markdown, no frontmatter |
| **Subagents** | Custom agent configs | Plugin or project | Similar to Claude Code |
| **Distribution** | Cursor Marketplace, Team Marketplaces | cursor.com/marketplace | Manual review required |

**Cursor skill frontmatter fields:**
- `name` — Required, must match folder name
- `description` — Required, used for relevance matching
- `license` — License name or reference
- `compatibility` — Environment requirements
- `metadata` — Arbitrary key-value pairs
- `disable-model-invocation` — Same as Claude Code

**Cursor compatibility directories** (loads skills from all of these):
- `.agents/skills/` (canonical)
- `.cursor/skills/`
- `.claude/skills/`
- `.codex/skills/`
- `~/.cursor/skills/`, `~/.claude/skills/`, `~/.codex/skills/`

**Cursor rules frontmatter:**
- `description` — Used for intelligent application
- `globs` — File pattern matching
- `alwaysApply` — Boolean, always include in context

**Cursor hook events (superset of Claude Code):**
- Session: `sessionStart`, `sessionEnd`
- Tools: `preToolUse`, `postToolUse`, `postToolUseFailure`
- Shell: `beforeShellExecution`, `afterShellExecution`
- MCP: `beforeMCPExecution`, `afterMCPExecution`
- Files: `beforeReadFile`, `afterFileEdit`
- Prompt: `beforeSubmitPrompt`
- Subagent: `subagentStart`, `subagentStop`
- Tab: `beforeTabFileRead`, `afterTabFileEdit`
- Agent: `afterAgentResponse`, `afterAgentThought`
- Other: `preCompact`, `stop`

**Cursor-specific features:**
- Prompt-based hooks (LLM-evaluated conditions!)
- Team Rules (dashboard-managed, enforced across org)
- Remote rules from GitHub repos
- `matcher` field for filtering hook triggers
- `failClosed` option for security-critical hooks
- `loop_limit` for stop/subagentStop follow-ups
- Team Marketplaces with distribution groups (required vs optional)

---

### 1.3 OpenCode

| Concept | Format | Location | Notes |
|---------|--------|----------|-------|
| **Plugins** | JS/TS modules (exported functions) | `.opencode/plugins/` or `~/.config/opencode/plugins/` | Also npm packages |
| **Skills** | `SKILL.md` | `.agents/skills/` | Agent Skills standard |
| **Config** | `opencode.json` | Project root | JSON with `$schema` |
| **MCP** | Built-in MCP support | Config | Integrated |
| **Custom tools** | `tool()` helper in plugins | Plugin code | Zod schema for args |
| **Distribution** | npm packages, local files | npm registry, local dirs | `bun install` at startup |

**OpenCode plugin structure:**
```typescript
import type { Plugin } from "@opencode-ai/plugin"

export const MyPlugin: Plugin = async ({ project, client, $, directory, worktree }) => {
  return {
    // Event handlers
    "tool.execute.before": async (input, output) => { ... },
    "tool.execute.after": async (input, output) => { ... },
    
    // Custom tools
    tool: {
      mytool: tool({
        description: "...",
        args: { foo: tool.schema.string() },
        async execute(args, context) { return "result" }
      })
    },
    
    // Event subscriptions
    event: async ({ event }) => { ... }
  }
}
```

**OpenCode events:**
- Command: `command.executed`
- File: `file.edited`, `file.watcher.updated`
- Installation: `installation.updated`
- LSP: `lsp.client.diagnostics`, `lsp.updated`
- Message: `message.part.removed/updated`, `message.removed/updated`
- Permission: `permission.asked/replied`
- Server: `server.connected`
- Session: `session.created/compacted/deleted/diff/error/idle/status/updated`
- Todo: `todo.updated`
- Shell: `shell.env`
- Tool: `tool.execute.before/after`
- TUI: `tui.prompt.append`, `tui.command.execute`, `tui.toast.show`
- Experimental: `experimental.session.compacting`

**OpenCode-specific features:**
- Full programmatic plugin API (JS/TS, not just config)
- npm distribution (published packages auto-installed via bun)
- Custom tools with Zod schema validation
- Bun shell API (`$`) for command execution
- Compaction hooks (inject context or replace compaction prompt)
- `client` SDK for interacting with the AI
- TypeScript-first with `@opencode-ai/plugin` types

---

### 1.4 Codex (OpenAI)

| Concept | Format | Location | Notes |
|---------|--------|----------|-------|
| **Plugin manifest** | `.codex-plugin/plugin.json` | Plugin root | Rich interface metadata |
| **Skills** | `SKILL.md` | `skills/<name>/SKILL.md` | Agent Skills standard |
| **Agents** | YAML files | `agents/<name>.yaml` or `.md` | Agent configs with interface metadata |
| **MCP config** | `.mcp.json` | Plugin root | `bearer_token_env_var` pattern |
| **Hooks** | `hooks.json` | Plugin root | SessionStart events |
| **Instructions** | `AGENTS.md` | Project root | Same as Cursor |
| **Config** | `~/.codex/config.toml` | User home | TOML format |
| **Marketplace** | `marketplace.json` | `~/.agents/plugins/marketplace.json` | Local marketplace registry |
| **Distribution** | `codex mcp add`, install scripts | CLI + scripts | Symlink or copy mode |

**Codex plugin.json fields:**
```json
{
  "name": "...",
  "version": "...",
  "description": "...",
  "author": { "name": "...", "url": "..." },
  "homepage": "...",
  "repository": "...",
  "license": "...",
  "keywords": [],
  "skills": "./skills/",
  "hooks": "./hooks.json",
  "mcpServers": "./.mcp.json",
  "interface": {
    "displayName": "...",
    "shortDescription": "...",
    "longDescription": "...",
    "developerName": "...",
    "category": "Productivity",
    "capabilities": ["Interactive", "Write"],
    "websiteURL": "...",
    "privacyPolicyURL": "...",
    "termsOfServiceURL": "...",
    "defaultPrompt": ["..."],
    "brandColor": "#0F766E",
    "composerIcon": "./assets/icon.svg",
    "logo": "./assets/logo.svg",
    "screenshots": []
  }
}
```

**Codex MCP config format:**
```json
{
  "mcpServers": {
    "name": {
      "url": "https://...",
      "bearer_token_env_var": "API_KEY_ENV_VAR"
    }
  }
}
```

**Codex-specific features:**
- Rich interface metadata (brand color, icons, screenshots, default prompts)
- `bearer_token_env_var` for MCP auth (vs Claude Code's `headers` approach)
- Marketplace registry (`marketplace.json`) with install policies
- Agent YAML configs with `interface` block
- Symlink-based install for live development
- `codex mcp add --url ... --bearer-token-env-var` CLI

---

## 2. Cross-Platform Feature Comparison Matrix

| Feature | Claude Code | Cursor | OpenCode | Codex |
|---------|:-----------:|:------:|:--------:|:-----:|
| **Plugin manifest** | `.claude-plugin/plugin.json` | `.cursor-plugin/plugin.json` | `opencode.json` (config) | `.codex-plugin/plugin.json` |
| **Agent Skills standard** | Yes + extensions | Yes | Yes | Yes |
| **SKILL.md format** | Yes | Yes | Yes | Yes |
| **Skills discovery dirs** | `.claude/skills/` | `.agents/skills/` + `.claude/skills/` + `.codex/skills/` | `.opencode/plugins/` + `.agents/skills/` | `.codex/skills/` + `.agents/skills/` |
| **Slash commands** | `/skill-name` | `/skill-name` | TUI commands | `/skill-name` |
| **MCP servers** | `.mcp.json` (headers auth) | `.cursor/mcp.json` (Claude Desktop format) | Config-based | `.mcp.json` (bearer_token_env_var) |
| **Hooks format** | JSON (settings.json) | `hooks.json` | JS/TS event handlers | `hooks.json` |
| **Hook events count** | ~5 | ~20+ | ~25+ | ~3 |
| **Prompt-based hooks** | No | Yes | No | No |
| **Rules/instructions** | `CLAUDE.md` | `.cursor/rules/*.mdc` + `AGENTS.md` | Config-based | `AGENTS.md` |
| **Custom tools** | Via MCP only | Via MCP only | Native `tool()` API | Via MCP only |
| **Subagents** | `.claude/agents/*.md` | Subagent configs | N/A (programmatic) | `agents/*.yaml` or `.md` |
| **Marketplace** | None (planned) | cursor.com/marketplace | npm registry | Local marketplace.json |
| **Team distribution** | Managed settings | Team Marketplaces | npm | Manual |
| **Brand metadata** | Basic | Basic | None | Rich (color, icons, screenshots) |
| **Install mechanism** | `--add-dir`, `--plugin-dir` | Marketplace, local dir | npm install, local files | Install script, CLI |
| **Dynamic context** | `` !`command` `` injection | No | Compaction hooks | No |
| **Argument substitution** | `$ARGUMENTS`, `$0`, `$1` | No | No | No |
| **Subagent execution** | `context: fork` | Via subagents | Programmatic | Via agents |
| **Tool restrictions** | `allowed-tools` in frontmatter | No | No | No |
| **Model override** | `model` in frontmatter | No | No | No |
| **Path-scoped activation** | `paths` in frontmatter | `globs` in rules | No | No |

---

## 3. The Agent Skills Open Standard

**URL:** agentskills.io  
**Origin:** Developed by Anthropic, released as open standard  
**Adopters (30+):** Claude Code, Cursor, OpenCode, Codex, GitHub, Gemini CLI, VS Code, Goose, Roo Code, OpenHands, Kiro, Spring AI, Databricks, Junie, Amp, Factory, Snowflake, Letta, and more.

**Core format:**
```
skill-name/
├── SKILL.md           # Required — YAML frontmatter + markdown instructions
├── scripts/           # Optional — executable code
├── references/        # Optional — docs loaded on demand
└── assets/            # Optional — templates, configs, data
```

**Standard frontmatter fields:**
- `name` (required)
- `description` (required)
- `license`
- `compatibility`
- `metadata`
- `disable-model-invocation`

**What the standard covers:** SKILL.md format, directory structure, discovery locations  
**What the standard does NOT cover:** Plugin packaging, manifests, MCP config, hooks, rules, distribution, installation, testing

---

## 4. Speakeasy & Stainless Assessment

### Speakeasy (speakeasy.com)
Generates production SDKs, Terraform providers, and MCP servers from OpenAPI specs. Focus: API consumption tooling. **Not relevant** to plugin authoring for AI coding tools.

### Stainless (stainless.com)
Same category as Speakeasy — generates SDKs from API specs (used by OpenAI, Anthropic, Stripe). Also building docs platform and MCP server generation. **Not relevant** to this project.

**Both are inspirational as "define once, generate for many targets" but solve a completely different problem** (API client SDKs vs AI agent plugins).

---

## 5. What the Existing Megamind Implementation Reveals

The project-megamind repo contains **two hand-maintained plugin variants**:

1. **`plugin/`** — Claude Code target
   - `.claude-plugin/plugin.json` manifest
   - `CLAUDE.md` for instructions
   - Skills in `skills/<name>/SKILL.md`
   - Commands in `commands/<name>.md`
   - `.mcp.json` with `headers.Authorization` pattern
   - `hooks/hooks.json` with `${CLAUDE_PLUGIN_ROOT}` var

2. **`plugins/megamind/`** — Codex target
   - `.codex-plugin/plugin.json` manifest (with rich `interface` block)
   - `agents/megamind.md` and `agents/openai.yaml`
   - Skills in `skills/<name>/SKILL.md` (same content!)
   - Commands in `commands/<name>.md` (same content!)
   - `.mcp.json` with `bearer_token_env_var` pattern
   - `hooks.json` (different path format)

**Pain points visible in the implementation:**
- Same SKILL.md content duplicated across both targets
- Same commands duplicated
- Different MCP auth patterns require separate configs
- Different hook formats
- Different manifest schemas
- No validation that both targets stay in sync
- Install script (`install-codex-plugin.sh`) is Codex-specific
- Marketplace registration is platform-specific

**This is exactly the problem plug-ahh should solve.**

---

## 6. Key Insights for the SDK

1. **Skills are already standardized** — SKILL.md is the same across all platforms. The SDK should treat skills as a shared asset, only generating platform-specific frontmatter extensions when needed.

2. **Plugin manifests are the biggest divergence** — Each platform has a different JSON schema. This is the core value of the SDK: one canonical manifest that generates all variants.

3. **MCP config is almost the same** — The underlying MCP protocol is identical; only the auth config format differs. Easy to abstract.

4. **Hooks are the wild west** — Cursor has 20+ events, OpenCode has 25+ programmatic events, Claude Code has ~5, Codex has ~3. The SDK should provide a common hook abstraction that degrades gracefully.

5. **Rules/instructions are fragmented** — CLAUDE.md, AGENTS.md, .cursorrules, .mdc files. The SDK should generate the right format for each target from a single source.

6. **OpenCode is the outlier** — It uses programmatic JS/TS plugins, not declarative config. The SDK should generate an OpenCode plugin wrapper that adapts declarative config into the programmatic API.

7. **Distribution varies wildly** — Cursor has a marketplace, Codex has local marketplace.json, Claude Code uses file paths, OpenCode uses npm. The SDK should generate install scripts and registry entries for each.

8. **The Agent Skills standard is the foundation** — Build on it, don't fight it. Extend where platforms extend, but keep the core portable.
