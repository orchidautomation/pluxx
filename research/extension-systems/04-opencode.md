# OpenCode — Extension Systems (Deep Reference)

> Canonical docs: `opencode.ai/docs/*`
> Design stance: **Claude-Code-compatible by default.** OpenCode reads `CLAUDE.md`, `.claude/skills/`, `.claude/agents/` natively. Also reads `.agents/skills/` (cross-tool) and its own `.opencode/*` paths.
> Distinct from Codex: plugins are **JavaScript/TypeScript modules** loaded at runtime, not JSON bundles.

---

## 1. Extension surfaces at a glance

| Primitive | Location (project) | Location (global) | Format | Doc |
|---|---|---|---|---|
| **Rules** (project instructions) | `AGENTS.md` in project root (walked upward); `CLAUDE.md` fallback | `~/.config/opencode/AGENTS.md`; `~/.claude/CLAUDE.md` fallback | Markdown | [docs/rules](https://opencode.ai/docs/rules/) |
| **Remote / glob instructions** | `instructions` field in `opencode.json` | same | markdown URL or glob | [docs/rules](https://opencode.ai/docs/rules/) |
| **Agents** (primary + subagent) | `.opencode/agents/<name>.md` | `~/.config/opencode/agents/<name>.md`; plus reads `.claude/agents/`, `~/.claude/agents/`, `.agents/` | Markdown + YAML frontmatter OR JSON-in-`opencode.json` | [docs/agents](https://opencode.ai/docs/agents/) |
| **Commands** (custom slash) | `.opencode/commands/<name>.md` | `~/.config/opencode/commands/<name>.md` | Markdown + YAML frontmatter; also JSON block in `opencode.json` | [docs/commands](https://opencode.ai/docs/commands/) |
| **Skills** | `.opencode/skills/<name>/SKILL.md` | `~/.config/opencode/skills/<name>/SKILL.md`; ALSO `.claude/skills/`, `~/.claude/skills/`, `.agents/skills/`, `~/.agents/skills/` | SKILL.md (Agent Skills open standard) | [docs/skills](https://opencode.ai/docs/skills/) |
| **Plugins** (JS/TS code) | `.opencode/plugins/*.{js,ts}` + optional `.opencode/package.json` | `~/.config/opencode/plugins/*.{js,ts}` + npm packages declared in `opencode.json` `plugin[]` | ES module exporting a factory function | [docs/plugins](https://opencode.ai/docs/plugins/) |
| **Hooks** | folded into **plugins** (no standalone hooks.json) | same | plugin returns a hooks object | [docs/plugins](https://opencode.ai/docs/plugins/) |
| **MCP servers** | `opencode.json` → `mcp` object | same | JSON | [docs/mcp-servers](https://opencode.ai/docs/mcp-servers/) |
| **Config** | `opencode.json` / `opencode.jsonc` (repo root) | `~/.config/opencode/opencode.json`; `OPENCODE_CONFIG` env override | JSON / JSONC | [docs/config](https://opencode.ai/docs/config/) |

---

## 2. Rules (AGENTS.md)

### 2.1 Discovery order (first match wins per tier)
1. Walk **upward from cwd** looking for `AGENTS.md` then `CLAUDE.md` (for Claude Code compatibility).
2. Global: `~/.config/opencode/AGENTS.md`.
3. Global legacy: `~/.claude/CLAUDE.md`.

### 2.2 `instructions` key in `opencode.json`
- Supports **glob patterns** and **remote URLs**.
- Remote URL load timeout: **5 seconds**.
- Merges with `AGENTS.md` contents.

### 2.3 Claude-Code compat
- Honored unless you set `OPENCODE_DISABLE_CLAUDE_CODE=1` (or related env vars).
- No size cap documented (Claude Code's 32 KiB cap is Codex-specific).

---

## 3. Agents (`*.md` + frontmatter OR JSON)

### 3.1 Locations
- Project: `.opencode/agents/<name>.md`
- Global: `~/.config/opencode/agents/<name>.md`
- Also accepts `.claude/agents/` and `~/.claude/agents/` for interop.
- Filename → agent identifier.

### 3.2 Frontmatter fields

| Field | Type | Values | Purpose |
|---|---|---|---|
| `description` | string | **required** | Triggers agent selection |
| `mode` | enum | `primary` / `subagent` / `all` | Usage context |
| `model` | string | `provider/model-id` | Model override |
| `temperature` | float | 0.0–1.0 | Randomness |
| `top_p` | float | 0.0–1.0 | Alt randomness |
| `prompt` | string or file path | — | Custom system prompt |
| `tools` | object (bool per tool) | — | **DEPRECATED** — use `permission` |
| `permission` | object | `allow`/`ask`/`deny` per tool | Fine-grained tool access |
| `steps` | integer | positive | Max agentic iterations before text-only |
| `color` | string | hex or theme token | UI |
| `hidden` | boolean | — | Hide from `@` autocomplete (subagents only) |

### 3.3 Primary vs Subagent
- **Primary**: cycled via Tab / `switch_agent` keybind. Build (full tools), Plan (restricted) are built-ins.
- **Subagent**: auto-delegated by primary, or manually invoked with `@agent-name help ...`. `@mention` is the canonical invocation.
- `mode: all` exposes the agent in both roles.

### 3.4 JSON alternative
Define inside `opencode.json` under `agent`:
```json
{
  "agent": {
    "review": {
      "description": "Code reviewer",
      "mode": "subagent",
      "permission": { "edit": "deny" }
    }
  }
}
```

### 3.5 Child session navigation
Keybinds: `session_child_first`, `session_child_cycle`, `session_parent`.

---

## 4. Commands (`.opencode/commands/*.md`)

### 4.1 Location
- Project: `.opencode/commands/<name>.md`
- Global: `~/.config/opencode/commands/<name>.md`
- Also in `opencode.json` under `command` key.

### 4.2 Frontmatter (all optional)
- `description` — shown in TUI
- `agent` — which agent executes it
- `model` — LLM override
- `subtask` — bool; forces subagent invocation

Only the **template body** is required.

### 4.3 Placeholder syntax (matches Claude Code!)
- `$ARGUMENTS` — all args
- `$1`, `$2`, `$3`, … — positional
- `` !`command` `` — bash injection (runs in project root)
- `@path/to/file` — file reference

### 4.4 Override behavior
- Custom commands **can override built-ins**: `/init`, `/undo`, `/redo`, `/share`, `/help`.

### 4.5 No character limits published.

---

## 5. Skills (SKILL.md — Agent Skills open standard)

### 5.1 Locations (search order)
- Project: `.opencode/skills/<name>/SKILL.md`
- Global: `~/.config/opencode/skills/<name>/SKILL.md`
- Claude-interop: `.claude/skills/<name>/SKILL.md` + `~/.claude/skills/<name>/SKILL.md`
- Cross-tool: `.agents/skills/<name>/SKILL.md` + `~/.agents/skills/<name>/SKILL.md`

### 5.2 Required frontmatter
```yaml
---
name: my-skill       # kebab-case, 1–64 chars, MUST match directory name
description: ...     # 1–1024 chars
---
```

### 5.3 Optional frontmatter
- `license`
- `compatibility`
- `metadata` — custom string-to-string key-value pairs

### 5.4 Name constraints (strict)
Regex: `^[a-z0-9]+(-[a-z0-9]+)*$`
- 1–64 chars
- lowercase alphanumeric + single hyphens between groups
- no leading/trailing/consecutive hyphens
- must equal directory name containing SKILL.md

### 5.5 Description
- **1–1024 chars** (cap).

### 5.6 Loading mechanism
- Native `skill` tool is exposed to agents.
- Tool's description lists all discovered skills (name + description only).
- Agents invoke via `skill({ name: "skill-name" })`.

### 5.7 Permission control
Pattern rules in `opencode.json` with wildcards:
- `allow` → load immediately
- `deny` → hide from agents
- `ask` → prompt user

Disable skills entirely per agent: `skill: false` on the agent.

### 5.8 Distribution
- No formal registry / marketplace. Share via `.opencode/` in repo, or community packages (e.g., `zenobi-os/opencode-skillful`).

---

## 6. Plugins (JavaScript/TypeScript modules)

### 6.1 Locations
- Project: `.opencode/plugins/*.{js,ts}`
- Global: `~/.config/opencode/plugins/*.{js,ts}`
- npm packages declared in `opencode.json` `plugin` array (regular + scoped OK).

### 6.2 Load order
1. Global config
2. Project config
3. Global plugins
4. Project plugins

Duplicate npm packages load once; local + npm with similar names load separately.

### 6.3 Module shape
```typescript
import type { Plugin } from "@opencode-ai/plugin";

export const MyPlugin: Plugin = async (ctx) => {
  const { project, client, $, directory, worktree } = ctx;
  return {
    "session.created": async (e) => { /* ... */ },
    "tool.execute.before": async (e) => { /* ... */ },
    // ...
  };
};
```

### 6.4 Context object
| Prop | Purpose |
|---|---|
| `project` | project metadata |
| `directory` | cwd |
| `worktree` | git worktree path |
| `client` | SDK client (AI interactions) |
| `$` | Bun shell API |

### 6.5 Complete hook event catalog (≈ 28 events)

**Command**: `command.executed`
**File**: `file.edited`, `file.watcher.updated`
**Installation**: `installation.updated`
**LSP**: `lsp.client.diagnostics`, `lsp.updated`
**Message**: `message.part.removed`, `message.part.updated`, `message.removed`, `message.updated`
**Permission**: `permission.asked`, `permission.replied`
**Server**: `server.connected`
**Session**: `session.created`, `session.compacted`, `session.deleted`, `session.diff`, `session.error`, `session.idle`, `session.status`, `session.updated`
**Todo**: `todo.updated`
**Shell**: `shell.env`
**Tool**: `tool.execute.before`, `tool.execute.after`
**TUI**: `tui.prompt.append`, `tui.command.execute`, `tui.toast.show`
**Experimental**: `experimental.session.compacting`

### 6.6 Dependencies
- Project plugin needing npm deps? Create `.opencode/package.json`.
- OpenCode runs `bun install` at startup.
- npm plugin cache: `~/.cache/opencode/node_modules/`.

### 6.7 Distribution
- Local files committed to repo.
- npm packages — install automatically on first run via Bun.
- No centralized marketplace.

---

## 7. MCP servers

### 7.1 Config (JSON)
```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "linear": {
      "type": "local",
      "command": ["npx", "-y", "@linear/mcp-server"],
      "environment": { "LINEAR_API_KEY": "..." },
      "timeout": 5,
      "enabled": true
    },
    "figma": {
      "type": "remote",
      "url": "https://figma.com/mcp",
      "headers": { "Authorization": "Bearer ..." },
      "oauth": { "...": "..." }
    }
  }
}
```

### 7.2 Transports
- **`local`** — subprocess (`command[]` + optional `environment`).
- **`remote`** — HTTP endpoint (`url`, optional `headers`, optional `oauth`).

### 7.3 Timeouts
- Default: **5 seconds**.
- Tunable per server.

### 7.4 Disable
- Remove entry, OR `"enabled": false`.

---

## 8. `opencode.json` reference

### 8.1 Top-level keys
`model`, `small_model`, `provider`, `agent`, `default_agent`, `tools`, `server`, `autoupdate`, `snapshot`, `share`, `theme`, `keybinds`, `command`, `formatter`, `permission`, `mcp`, `plugin`, `instructions`, `compaction`, `watcher`, `disabled_providers`, `enabled_providers`, `experimental`.

### 8.2 Config merge order (later wins)
1. Global: `~/.config/opencode/opencode.json`
2. Project: `./opencode.json`
3. `OPENCODE_CONFIG` file

All layers **merge**, not replace.

### 8.3 Schema URLs
- Main: `https://opencode.ai/config.json`
- TUI: `https://opencode.ai/tui.json`
- JSONC supported.

### 8.4 `share` modes
`manual` (default) / `auto` / `disabled`.

---

## 9. Key gotchas / non-obvious rules

1. **OpenCode is Claude-Code-compatible by default** — it reads `CLAUDE.md`, `.claude/skills/`, `.claude/agents/`. Disable with `OPENCODE_DISABLE_CLAUDE_CODE=1`.
2. **Hooks are plugins.** There is no standalone `hooks.json`. To write a hook, you write a JS/TS plugin module.
3. Plugins run in **Bun's runtime** — you get `$` for shell out of the box, and `bun install` manages deps.
4. Skill `name` is **strictly regex-validated** (`^[a-z0-9]+(-[a-z0-9]+)*$`) and **must equal its directory name**.
5. Skill `description` is **capped at 1,024 chars** (hard limit per OpenCode docs).
6. Agents' `tools` field is deprecated — use `permission` (`allow`/`ask`/`deny` per tool).
7. Custom commands can override `/init`, `/undo`, `/redo`, `/share`, `/help`.
8. Remote `instructions` timeout is 5 s.
9. npm plugin cache is `~/.cache/opencode/node_modules/` (for cleanup/debugging).
10. `mode: all` on an agent exposes it as both primary and subagent simultaneously.
11. No marketplace / registry — distribute plugins via npm packages + skills via shared Git repos.
12. `subtask: true` on a command forces the prompt to run inside a subagent context (new session window).

---

## 10. Citations
- https://opencode.ai/docs/agents/
- https://opencode.ai/docs/commands/
- https://opencode.ai/docs/skills/
- https://opencode.ai/docs/plugins/
- https://opencode.ai/docs/mcp-servers/
- https://opencode.ai/docs/config/
- https://opencode.ai/docs/rules/
- https://github.com/zenobi-os/opencode-skillful (community Agent Skills impl)
- https://github.com/frap129/opencode-rules (community rules system)
