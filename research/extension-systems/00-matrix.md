# Extension Systems Comparison Matrix — Claude Code, Codex, Cursor, OpenCode

> **Scope**: hooks, plugins, MCPs, slash commands, skills, subagents, project instructions.
> Research date: April 2026.
> Accompanying files:
> - [01-claude-code.md](./01-claude-code.md)
> - [02-codex-cli.md](./02-codex-cli.md)
> - [03-cursor.md](./03-cursor.md)
> - [04-opencode.md](./04-opencode.md)

---

## 1. Big-picture design philosophy

| | Claude Code | Codex CLI | Cursor | OpenCode |
|---|---|---|---|---|
| Packaging unit | **Plugin** (`.claude-plugin/plugin.json` + marketplaces) | **Plugin** (`.codex-plugin/plugin.json` + local/curated marketplace) | Share `.cursor/` dir via git; no plugin spec | **Plugin** (JS/TS module) + share `.opencode/` dir |
| Standalone-to-plugin ratio | Both first-class; skills merged w/ commands | Skills = authoring; plugins = distribution | Standalone `.cursor/` dominates; `/migrate-to-skills` bridges | Config merges all layers; plugins carry code |
| Plugin distribution | GitHub / git / git-subdir / npm / relative; managed marketplaces | Local `marketplace.json`, curated (public publishing **not yet public**) | None formal; Cursor Marketplace for MCPs only | npm packages + local files |
| Marketplace lockdown | `strictKnownMarketplaces` managed setting | Admin `requirements.toml` | N/A | N/A |
| Extensibility mindset | "Everything is a skill" | Open Agent Skills spec cross-tool | Rules-first, migrating to Skills | Claude-Code-compatible by default |

---

## 2. Project instructions (CLAUDE.md / AGENTS.md / rules)

| | Claude Code | Codex CLI | Cursor | OpenCode |
|---|---|---|---|---|
| Primary file | `CLAUDE.md` | `AGENTS.md` | `.cursor/rules/*.mdc` | `AGENTS.md` (also reads `CLAUDE.md`) |
| Override file | `CLAUDE.local.md` (gitignored) | `AGENTS.override.md` at same level | N/A | N/A |
| Global / user | `~/.claude/CLAUDE.md` | `~/.codex/AGENTS.md` | Cursor Settings → Rules (no file) | `~/.config/opencode/AGENTS.md` |
| Managed / org | macOS: `/Library/Application Support/ClaudeCode/CLAUDE.md`; Linux: `/etc/claude-code/CLAUDE.md`; Windows: `C:\Program Files\ClaudeCode\CLAUDE.md` | Admin `requirements.toml` | Team Rules (enterprise) | Not documented |
| Nested discovery | Walks up cwd, concatenates all | Walks from git root down to cwd, merges | Nested `.cursor/rules/` recursive | Walks up cwd |
| @-imports | `@path` up to **5 hops** | N/A (but `project_doc_fallback_filenames`) | `@filename.ts` inside rule body | `instructions` field in config + manual markdown links |
| **Size cap** | Suggest **<200 lines**; skill descriptions 1,536 / 250 chars | **32 KiB (`project_doc_max_bytes`)** — silent truncation | **<500 lines per rule** (guideline) | Not documented |
| Path-scoped rules | `.claude/rules/*.md` with `paths:` YAML glob | Subdirectory-level `AGENTS.md` | Per-rule `globs` frontmatter | Glob patterns in `instructions` field |
| Auto memory | Yes (`~/.claude/projects/<repo>/memory/MEMORY.md`) — **first 200 lines or 25 KB** | No | No | No |
| HTML comments stripped | Yes (`<!-- maintainer notes -->` stripped) | No | No | No |
| Exclude list | `claudeMdExcludes` (glob) | N/A | N/A | N/A |

---

## 3. Skills

| | Claude Code | Codex CLI | Cursor | OpenCode |
|---|---|---|---|---|
| Path (project) | `.claude/skills/<name>/SKILL.md` | `.agents/skills/<name>/SKILL.md` | `.cursor/skills/<name>/SKILL.md` OR `.agents/skills/<name>/SKILL.md` | `.opencode/skills/<name>/SKILL.md` (+ reads `.claude/skills/`, `.agents/skills/`) |
| Path (user) | `~/.claude/skills/<name>/SKILL.md` | `~/.agents/skills/<name>/` | `~/.cursor/skills/` OR `~/.agents/skills/` | `~/.config/opencode/skills/` (+ reads `~/.claude/skills/`, `~/.agents/skills/`) |
| Admin path | via managed settings | `/etc/codex/skills/` | N/A | N/A |
| **Name regex/constraint** | lowercase + digits + hyphens, **max 64 chars** | Per Agent Skills spec | lowercase + hyphens only | **Regex `^[a-z0-9]+(-[a-z0-9]+)*$`, 1–64 chars, MUST match directory name** |
| **Description cap** | **1,536 chars** (also listed as 250) | Per Agent Skills spec | Keep short (community: ≤200 chars) | **Hard 1,024-char cap** |
| **Body-size guideline** | < **500 lines** | "Keep SKILL.md focused" | Not published | Not published |
| Listing budget | 1% of context window, fallback **8,000 chars**, override via `SLASH_COMMAND_TOOL_CHAR_BUDGET` | Progressive disclosure | Not published | Not published |
| Full-content load | Per invocation (one message for session); post-compact **first 5,000 tokens** per skill, **25,000-token** combined | Progressive (metadata at startup, body on-demand) | Agent Skills standard | Native `skill` tool loads on demand |
| Frontmatter extras | `name`, `description`, `when_to_use`, `argument-hint`, `disable-model-invocation`, `user-invocable`, `allowed-tools`, `model`, `effort`, `context` (`fork`), `agent`, `hooks`, `paths`, `shell` | `name`, `description`, `argument-hint`, `allowed-tools`; plus `agents/openai.yaml` for interface/policy/dependencies | `name`, `description`, `license`, `compatibility`, `metadata`, `disable-model-invocation` | `name`, `description`, `license`, `compatibility`, `metadata` |
| Supporting files | `scripts/`, `reference.md`, etc. | `scripts/`, `references/`, `assets/`, `agents/openai.yaml` | `scripts/`, `references/`, `assets/` | same |
| Arguments | `$ARGUMENTS`, `$0..$N`, `${CLAUDE_SESSION_ID}`, `${CLAUDE_SKILL_DIR}` | Docs don't confirm $ARGUMENTS (legacy custom prompts used it) | Per Agent Skills standard | Exposed via `skill` tool call |
| Dynamic bash injection | `` !`cmd` `` + ```` ```! ```` blocks | No (bash goes in scripts/) | Not published | No (use scripts in skill dir) |
| Implicit vs explicit | Both; `/skill-name` or auto | Both (`$skill-name` mention or auto) | Both (`/skill-name` or auto) | Both (`skill` tool) |
| Block user/model | `disable-model-invocation`, `user-invocable` | `policy.allow_implicit_invocation` in openai.yaml | `disable-model-invocation` | `skill: false` per agent |
| Permission filter | `Skill(name)`, `Skill(name *)` rules | — | — | `allow`/`deny`/`ask` pattern rules |
| Cross-tool portability | Open Agent Skills spec | Same — highly portable | Same | Same; actively reads other tools' skills |

---

## 4. Slash commands / custom commands

| | Claude Code | Codex CLI | Cursor | OpenCode |
|---|---|---|---|---|
| Canonical | `.claude/commands/*.md` **(merged into Skills)** | `~/.codex/prompts/*.md` (**DEPRECATED** → Skills) | `.cursor/commands/*.md` (community-documented; migrate to Skills) | `.opencode/commands/<name>.md` |
| Status | Legacy alongside skills; skills win on collision | Deprecated; Codex must be restarted to reload | Being migrated; `/migrate-to-skills` command | First-class |
| Arg syntax | Same as skills (`$ARGUMENTS`, `$N`, `${CLAUDE_*}`) | `$1..$9`, `$FILE`, `$KEY=value`, `$ARGUMENTS`, `$$` literal | Not documented | `$ARGUMENTS`, `$1..$N`, `` !`cmd` ``, `@path/to/file` |
| Frontmatter | Same as skills | `description`, `argument-hint` | Not documented | `description`, `agent`, `model`, `subtask` |
| Recursive dirs | — | **Top-level only** (no nested dirs scanned) | — | — |
| Built-in override | Skills take precedence over commands | — | — | Can override `/init`, `/undo`, `/redo`, `/share`, `/help` |

---

## 5. Subagents

| | Claude Code | Codex CLI | Cursor | OpenCode |
|---|---|---|---|---|
| File format | Markdown + YAML | **TOML** | Markdown + YAML | Markdown + YAML (or JSON in `opencode.json`) |
| Project path | `.claude/agents/*.md` | `.codex/agents/*.toml` | `.cursor/agents/*.md` (+ reads `.claude/agents/`, `.codex/agents/`) | `.opencode/agents/*.md` (+ reads `.claude/agents/`) |
| User path | `~/.claude/agents/` | `~/.codex/agents/` | `~/.cursor/agents/` etc. | `~/.config/opencode/agents/` etc. |
| Key frontmatter | `name`, `description`, `model`, `effort`, `maxTurns`, `tools`, `disallowedTools`, `skills`, `memory`, `background`, `isolation`=`worktree` | `name`, `description`, `developer_instructions`, `nickname_candidates`, `model`, `model_reasoning_effort`, `sandbox_mode`, `mcp_servers`, `skills.config` | `name`, `description`, `model`, `readonly`, `is_background` | `description`, `mode` (`primary`/`subagent`/`all`), `model`, `temperature`, `top_p`, `prompt`, `permission`, `steps`, `color`, `hidden` |
| Plugin-shipped restrictions | Forbids `hooks`, `mcpServers`, `permissionMode` | — | — | — |
| Max parallelism | — (implicit) | `max_threads = 6` (default), `max_depth = 1` | Not published | Multi-session via child-session keybinds |
| Invocation | `/agents`, Task tool | `/agent` picker, user request | `/agent-name …`, natural language, auto | `@agent-name …` |
| Built-in / overridable | `Explore`, `Plan`, `general-purpose` | `default`, `worker`, `explorer` (overridable by matching name) | — | `Build`, `Plan` (primaries); `General`, `Explore` (subagents) |
| Memory | Per-subagent auto-memory supported | — | — | Per-session (shared) |
| Runtime sandbox | Worktree isolation option | `sandbox_mode` inheritance | `readonly` flag | Via `permission` + agent `tools` list |

---

## 6. Hooks

| | Claude Code | Codex CLI | Cursor | OpenCode |
|---|---|---|---|---|
| Canonical config | `settings.json` hooks block + plugin `hooks/hooks.json` + inline skill/agent `hooks:` | `hooks.json` next to active config layers | `.cursor/hooks.json` (project/user/enterprise) | **No config** — plugins register hooks via TS/JS module |
| Stability | Stable | **EXPERIMENTAL** — needs `[features] codex_hooks = true` | Stable (Windows may be disabled) | Stable |
| Event count | **26** | **5** | **20** | **~28** |
| Events | SessionStart, InstructionsLoaded, UserPromptSubmit, PreToolUse, PermissionRequest, PermissionDenied, PostToolUse, PostToolUseFailure, Notification, SubagentStart, SubagentStop, TaskCreated, TaskCompleted, Stop, StopFailure, TeammateIdle, ConfigChange, CwdChanged, FileChanged, WorktreeCreate, WorktreeRemove, PreCompact, PostCompact, Elicitation, ElicitationResult, SessionEnd | SessionStart, PreToolUse, PostToolUse, UserPromptSubmit, Stop | sessionStart, sessionEnd, preToolUse, postToolUse, postToolUseFailure, subagentStart, subagentStop, beforeShellExecution, afterShellExecution, beforeMCPExecution, afterMCPExecution, beforeReadFile, afterFileEdit, beforeSubmitPrompt, preCompact, stop, afterAgentResponse, afterAgentThought, beforeTabFileRead, afterTabFileEdit | command.executed, file.edited, file.watcher.updated, installation.updated, lsp.client.diagnostics, lsp.updated, message.part.(removed/updated), message.(removed/updated), permission.(asked/replied), server.connected, session.(created/compacted/deleted/diff/error/idle/status/updated), todo.updated, shell.env, tool.execute.(before/after), tui.prompt.append, tui.command.execute, tui.toast.show, experimental.session.compacting |
| Hook types | `command`, `http`, `prompt`, `agent` | `command` | `command`, `prompt` | JS/TS function in-process |
| Stdin/stdout | JSON both ways | JSON both ways | JSON both ways | Direct function args + return |
| Default timeout | 600 s (command), 30 s (prompt), 60 s (agent) | 600 s | Platform default | Plugin in-process, no timeout |
| Exit 0 JSON | Universal `continue`, `stopReason`, `suppressOutput`, `systemMessage` + per-event `hookSpecificOutput` | `continue`, `stopReason`, `systemMessage`, `suppressOutput` | `permission`, `user_message`, `agent_message`, `updated_input`, `additional_context`, etc. | N/A — return values from fn |
| Exit 2 | Blocks event (many events) | Block/deny with stderr | Block (deny) | Throw/return to block |
| Exit !0/!2 | Non-blocking error | Non-blocking error | **Fail-open by default** (opposite of Claude Code); set `failClosed:true` | N/A |
| Stdout size cap | **10,000 chars** (excess saved to file) | Not published | Not published | N/A |
| Matcher grammar | `*`/empty; safe chars → exact/\|-list; other → JS regex | tool name / source | Regex / literal depending on event | Per event — match via code |
| Disable-all | `disableAllHooks: true` per settings layer | Toggle feature flag | Managed settings | Don't load plugin |
| PreToolUse precedence | `deny > defer > ask > allow` | `0 ok` / `2 block` | `allow / deny / ask` | in-code |
| `loop_limit` default | **null** (unlimited) | — | **5** | — |
| Env vars | `CLAUDE_PROJECT_DIR`, `CLAUDE_PLUGIN_ROOT`, `CLAUDE_PLUGIN_DATA`, `CLAUDE_ENV_FILE` (SessionStart/CwdChanged/FileChanged only), `CLAUDE_CODE_REMOTE` | Standard shell env | Standard | `$` Bun shell API, plugin ctx |
| Platform quirks | — | **No Windows** | Windows "temporarily disabled" note | Bun runtime required |

---

## 7. MCP servers

| | Claude Code | Codex CLI | Cursor | OpenCode |
|---|---|---|---|---|
| Config file(s) | `~/.claude.json`, `.mcp.json`, CLI `claude mcp add`; plugin `.mcp.json` | `[mcp_servers.<id>]` in `config.toml` | `.cursor/mcp.json`, `~/.cursor/mcp.json` | `mcp` object in `opencode.json` |
| Format | JSON | TOML | JSON | JSON |
| Transports | `stdio`, `http`, `sse` | `stdio`, `sse` | `stdio`, `sse`, `streamable http` | `local` (subprocess), `remote` (HTTP) |
| Fields | `command`, `args`, `env`, `cwd`, `url`, `headers`, `type`, `transport` | `command`, `args`, `env`, `url`, `enabled`, `enabled_tools`, `disabled_tools`, `scopes`, `startup_timeout_sec`, `supports_parallel_tool_calls`, per-tool `approval_mode` | `command`, `args`, `env`, `envFile`, `type`, `url`, `headers`, `auth.{CLIENT_ID, CLIENT_SECRET, scopes}` | `type`, `command[]`, `environment`, `url`, `headers`, `oauth`, `timeout`, `enabled` |
| Interpolation | `${VAR}`, plugin `${CLAUDE_PLUGIN_ROOT}/...`, `${user_config.KEY}` | `${VAR}` | `${env:NAME}`, `${userHome}`, `${workspaceFolder}`, `${workspaceFolderBasename}`, `${pathSeparator}` / `${/}` | `${VAR}` |
| OAuth | Yes — tokens in OS keychain (~2 KB budget shared with secrets) | Yes; `mcp_oauth_callback_port` | Yes via `auth` block | Yes |
| Per-tool allow/deny | Via permission rules | `enabled_tools` / `disabled_tools` | — | Via `permission` |
| Admin allowlist | Managed settings | `requirements.toml` `mcp_servers.<id>.identity` | Enterprise | — |
| Quantity limits | — | — | — | Default timeout 5 s |
| Registry | MCP registry at `api.anthropic.com/mcp-registry/v0/servers` | — | Cursor Marketplace (one-click) | — |

---

## 8. Plugin / marketplace spec

| | Claude Code | Codex CLI | Cursor | OpenCode |
|---|---|---|---|---|
| Manifest path | `.claude-plugin/plugin.json` | `.codex-plugin/plugin.json` | **No plugin manifest** | no manifest; `opencode.json` `plugin[]` |
| Required fields | only `name` | `name`, `version`, `description` | — | — |
| Component paths | `skills`, `commands`, `agents`, `hooks`, `mcpServers`, `outputStyles`, `lspServers`, `monitors`, `userConfig`, `channels` | `skills`, `mcpServers`, `apps`, `interface` block | — | Plugin is a code module; no components |
| Namespacing | `plugin:skill` | — | — | — |
| Marketplace JSON | `.claude-plugin/marketplace.json` | `.agents/plugins/marketplace.json` (+ user + official) | Cursor Marketplace (web, not JSON) | None |
| Marketplace source types | relative, `github`, `url`, `git-subdir`, `npm` | `source.path`, `policy.installation`, `policy.authentication`, `category` | — | npm |
| Reserved names | Yes (e.g., `claude-code-marketplace`, `anthropic-*`, …) | — | — | — |
| Strict mode | `strict: false` = marketplace entry is authoritative | — | — | — |
| Admin allowlist | `strictKnownMarketplaces` | `requirements.toml` | — | — |
| Seed dir (CI) | `CLAUDE_CODE_PLUGIN_SEED_DIR` | — | — | — |
| Keep-on-failure flag | `CLAUDE_CODE_PLUGIN_KEEP_MARKETPLACE_ON_FAILURE=1` | — | — | — |
| Git timeout env | `CLAUDE_CODE_PLUGIN_GIT_TIMEOUT_MS` (default 120 s) | — | — | — |
| Private auth tokens | `GITHUB_TOKEN`, `GL_TOKEN`, `BITBUCKET_TOKEN` | GitHub/GitLab/etc credential helpers | — | npm registry auth |
| Plugin data | `${CLAUDE_PLUGIN_DATA}` → `~/.claude/plugins/data/<id>/`, persists across updates | `~/.codex/plugins/cache/` | — | `~/.cache/opencode/node_modules/` |
| Plugin root | `${CLAUDE_PLUGIN_ROOT}` → `~/.claude/plugins/cache/...` | — | — | — |
| Version mgmt | semver; CLAUDE_CODE auto-update in background | semver | — | — |
| User config prompts | `userConfig` block in manifest (keychain for sensitive) | — | — | — |
| Path traversal | Plugins cannot `../` outside root (cache copy); symlinks preserved | — | — | — |

---

## 9. Scopes / precedence

| | Claude Code | Codex CLI | Cursor | OpenCode |
|---|---|---|---|---|
| Managed/enterprise path | macOS / Linux / Windows managed-settings paths + `managed-settings.json` | Admin `requirements.toml` | Enterprise team rules/hooks cloud | — |
| User | `~/.claude/settings.json` | `~/.codex/config.toml` | Cursor Settings (cloud-synced) | `~/.config/opencode/opencode.json` |
| Project shared | `.claude/settings.json` | `.codex/config.toml` walked up | `.cursor/` tree | `opencode.json` |
| Project local | `.claude/settings.local.json` (gitignored) | — | `.cursor/` but gitignore manually | `.opencode/` |
| Precedence | managed > user > project > local (for many keys; scopes vary) | closer to cwd wins for config; trusted-project gate | Team > Project > User | All layers merge, **not replace** |
| `OPENCODE_CONFIG` env | — | `CODEX_HOME` env | — | `OPENCODE_CONFIG` env |

---

## 10. Headline differences you'd miss on a skim

1. **Skills are one standard, four dialects.** All four tools implement the Agent Skills spec (SKILL.md + description + scripts). Cursor/Codex/OpenCode intentionally read `.agents/skills/` and/or `.claude/skills/` for cross-tool portability. Claude Code does NOT read `.agents/` or `.codex/` paths.

2. **Hooks vocabularies are not equivalent.** Claude Code has the richest (26 events incl. InstructionsLoaded, Worktree*, Compact, Elicitation). Codex has a tiny experimental set (5). Cursor and OpenCode have wide but differently-named vocabularies. Porting hooks between tools is ≈ a partial rewrite.

3. **Cursor hooks fail OPEN by default; Claude Code hooks fail CLOSED on exit code 2 only.** Opposite enforcement posture. `failClosed: true` in Cursor inverts it.

4. **Codex AGENTS.md silently truncates at 32 KiB** (`project_doc_max_bytes`). Known issue. No size cap documented for Claude Code's CLAUDE.md (stated: target <200 lines, but there's no published hard cap).

5. **Codex prompts (`~/.codex/prompts/*.md`) are scanned top-level only** — nested directories ignored.

6. **OpenCode has no hooks.json.** Hooks = TypeScript plugins. If your team wants JSON-defined hooks, OpenCode is the odd one out.

7. **Codex subagents are TOML**, everyone else uses Markdown + YAML frontmatter.

8. **Only Claude Code ships `LSP servers` as a plugin primitive.** Only Claude Code ships `Monitors`, `Channels`, `Output styles`, `bin/`, and `userConfig` in its plugin schema.

9. **Claude Code is the only tool with a formal plugin marketplace spec** (`.claude-plugin/marketplace.json` + reserved name list + `strictKnownMarketplaces` lockdown). Codex has a local-only marketplace.json with "public publishing coming soon". Cursor and OpenCode have no marketplace for extensions (Cursor's Marketplace is MCP-only).

10. **OpenCode auto-reads Claude Code assets.** Set `OPENCODE_DISABLE_CLAUDE_CODE=1` to turn off. Convenient for porting; surprising if you don't expect it.

11. **Cursor's `.mdc` "frontmatter" is not strict YAML.** `globs` is comma-separated, no brackets or quotes. The field doubles as a semantic prompt for Agent Requested rules.

12. **Hook stdout payload cap (Claude Code): 10,000 chars.** Excess saved to file with preview. Other tools don't publish a cap.

13. **Skill description caps differ per tool**: Claude Code 1,536 (skills page) / 250 (slash-commands page), Cursor ≤200 (community guidance), Codex per-spec, **OpenCode hard 1,024 chars**.

14. **Codex hooks require `[features] codex_hooks = true`** and **don't run on Windows**.

15. **Claude Code's hooks work at the skill/agent level, too** — you can inline `hooks:` in SKILL.md/agent frontmatter. Other tools scope hooks globally.

16. **Plugin file layouts are superficially similar, invisibly different.** Claude Code components must be at the plugin root (NOT inside `.claude-plugin/`). Codex puts `plugin.json` in `.codex-plugin/` similarly. OpenCode ships plugin files anywhere under `.opencode/plugins/`. Cursor has no plugin.

---

## 11. Quick-start decision table

| You want to… | Best choice |
|---|---|
| Ship a reusable team workflow | **Skill** (SKILL.md in `.agents/skills/` for cross-tool) |
| Block a dangerous tool call | Claude Code / Cursor / OpenCode hook with `PreToolUse` → deny (Codex too but experimental) |
| Add persistent org-wide context | Claude Code managed `CLAUDE.md` (OS-level path) or AGENTS.md deployed via MDM |
| Publish extensions to external users | Claude Code plugin + GitHub marketplace (most mature) |
| Wire code-level automation (TS/JS) | OpenCode plugin module |
| Enforce per-tool approval rules | Codex `approval_policy` / Codex `mcp_servers.*.tools.*.approval_mode` or Claude Code permission rules |
| Run skills in isolated sub-context | Claude Code `context: fork` OR Cursor `is_background: true` OR Codex subagent |
| Pin an exact plugin version | Claude Code marketplace `sha` (40-char commit) |
| Hide rules unless user opts in | Cursor Manual rule (empty description + empty globs) OR Claude Code `disable-model-invocation` |
| Bundle a language server | Claude Code `lspServers` in plugin.json (only tool that supports this) |

---

## 12. Citations summary

- **Claude Code**: [plugins-reference](https://code.claude.com/docs/en/plugins-reference), [plugins](https://code.claude.com/docs/en/plugins), [plugin-marketplaces](https://code.claude.com/docs/en/plugin-marketplaces), [skills](https://code.claude.com/docs/en/skills), [hooks](https://code.claude.com/docs/en/hooks), [mcp](https://code.claude.com/docs/en/mcp), [sub-agents](https://code.claude.com/docs/en/sub-agents), [memory](https://code.claude.com/docs/en/memory), [settings](https://code.claude.com/docs/en/settings).
- **Codex CLI**: [config-reference](https://developers.openai.com/codex/config-reference), [config-advanced](https://developers.openai.com/codex/config-advanced), [skills](https://developers.openai.com/codex/skills), [plugins/build](https://developers.openai.com/codex/plugins/build), [hooks](https://developers.openai.com/codex/hooks), [subagents](https://developers.openai.com/codex/subagents), [custom-prompts](https://developers.openai.com/codex/custom-prompts), [cli/slash-commands](https://developers.openai.com/codex/cli/slash-commands), [guides/agents-md](https://developers.openai.com/codex/guides/agents-md), [concepts/customization](https://developers.openai.com/codex/concepts/customization).
- **Cursor**: [docs/context/rules](https://cursor.com/docs/context/rules), [docs/skills](https://cursor.com/docs/skills), [docs/subagents](https://cursor.com/docs/subagents), [docs/agent/hooks](https://cursor.com/docs/agent/hooks), [docs/context/mcp](https://cursor.com/docs/context/mcp), plus community refs in [03-cursor.md](./03-cursor.md).
- **OpenCode**: [docs/agents](https://opencode.ai/docs/agents/), [docs/commands](https://opencode.ai/docs/commands/), [docs/skills](https://opencode.ai/docs/skills/), [docs/plugins](https://opencode.ai/docs/plugins/), [docs/mcp-servers](https://opencode.ai/docs/mcp-servers/), [docs/config](https://opencode.ai/docs/config/), [docs/rules](https://opencode.ai/docs/rules/).
