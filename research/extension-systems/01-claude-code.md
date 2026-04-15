# Claude Code — Extension Systems (Deep Reference)

> Canonical docs: https://code.claude.com/docs/en/plugins-reference
> All citations are the `code.claude.com/docs/en/*` pages unless stated otherwise.
> Model note: Claude Code also runs outside plugins (standalone `.claude/` directory).

---

## 1. Extension primitives at a glance

| Primitive | Lives in (standalone) | Lives in (plugin) | File type | Primary doc |
|---|---|---|---|---|
| **CLAUDE.md / memory** | `./CLAUDE.md`, `./.claude/CLAUDE.md`, `~/.claude/CLAUDE.md`, managed path, `CLAUDE.local.md` | n/a (use skills/agents) | Markdown + `@imports` | [memory](https://code.claude.com/docs/en/memory) |
| **Path rules** | `.claude/rules/*.md` (recursive), `~/.claude/rules/` | n/a | Markdown + `paths:` YAML frontmatter | [memory#rules](https://code.claude.com/docs/en/memory#organize-rules-with-claude/rules/) |
| **Skills** | `.claude/skills/<name>/SKILL.md`, `~/.claude/skills/<name>/SKILL.md` | `<plugin>/skills/<name>/SKILL.md` | Directory with `SKILL.md` + optional supporting files | [skills](https://code.claude.com/docs/en/skills) |
| **Slash commands (legacy)** | `.claude/commands/*.md` | `<plugin>/commands/*.md` | Flat markdown (same frontmatter as skills) | [slash-commands](https://code.claude.com/docs/en/slash-commands) |
| **Subagents** | `.claude/agents/*.md`, `~/.claude/agents/*.md` | `<plugin>/agents/*.md` | Markdown + YAML frontmatter | [sub-agents](https://code.claude.com/docs/en/sub-agents) |
| **Hooks** | `.claude/settings.json`, `.claude/settings.local.json`, `~/.claude/settings.json`, managed settings | `<plugin>/hooks/hooks.json` OR inline in `plugin.json` | JSON | [hooks](https://code.claude.com/docs/en/hooks) |
| **MCP servers** | `~/.claude.json` (user), `.mcp.json` (project), CLI `claude mcp add` | `<plugin>/.mcp.json` OR inline in `plugin.json` | JSON | [mcp](https://code.claude.com/docs/en/mcp) |
| **LSP servers** | n/a (plugin-only feature) | `<plugin>/.lsp.json` OR inline in `plugin.json` | JSON | [plugins-reference#lsp-servers](https://code.claude.com/docs/en/plugins-reference#lsp-servers) |
| **Output styles** | `.claude/output-styles/` | `<plugin>/output-styles/` | Markdown | [plugins-reference](https://code.claude.com/docs/en/plugins-reference#component-path-fields) |
| **Monitors** | n/a | `<plugin>/monitors/monitors.json` | JSON | [plugins-reference](https://code.claude.com/docs/en/plugins-reference#component-path-fields) |
| **Executables** | n/a | `<plugin>/bin/` | Any executable | [plugins-reference](https://code.claude.com/docs/en/plugins-reference#file-locations-reference) |
| **Channels** (Telegram/Slack-style injection) | n/a | declared in `plugin.json` `channels[]` | JSON | [plugins-reference#channels](https://code.claude.com/docs/en/plugins-reference#channels) |

**Precedence order when names collide:** enterprise/managed > user (`~/.claude`) > project (`.claude/`). Plugin components are namespaced `<plugin>:<name>` so they never collide with standalone.

---

## 2. Skills — full spec

### 2.1 File layout
- One skill = one **directory**; entrypoint is `SKILL.md` (required, case-sensitive).
- Supporting files optional: `reference.md`, `examples.md`, `scripts/*`, anything else.
- Author guidance: **keep `SKILL.md` under 500 lines.**

### 2.2 Frontmatter (YAML between `---` fences, all fields optional)

| Field | Type | Notes & limits |
|---|---|---|
| `name` | string | lowercase + digits + hyphens, **max 64 chars**. Omitted → uses directory name. |
| `description` | string | **Hard cap 1,536 chars combined with `when_to_use`** in the skill listing (newer docs also reference a 250-char truncation for skills page). Front-load the key use case. |
| `when_to_use` | string | Appended to description; counts against 1,536-char cap. |
| `argument-hint` | string | Autocomplete hint, e.g. `[issue-number]`. |
| `disable-model-invocation` | bool | `true` = only user can invoke via `/`; description not put in context. |
| `user-invocable` | bool | `false` = hides from `/` menu; Claude can still invoke. |
| `allowed-tools` | string or list | Space-separated tool names or permission rules like `Bash(git add *)`. Pre-approves tools while skill is active. |
| `model` | string | Override model for this skill. |
| `effort` | enum | `low` / `medium` / `high` / `max` (Opus-only). |
| `context` | enum | `fork` = run in a forked subagent context. |
| `agent` | string | Subagent type when `context: fork`. Options: `Explore`, `Plan`, `general-purpose`, or any custom `.claude/agents/*` name. |
| `hooks` | object | Hooks scoped to this skill's lifecycle (same schema as plugin hooks). |
| `paths` | string or list | Glob patterns that auto-activate the skill on matching files. |
| `shell` | enum | `bash` (default) or `powershell` (needs `CLAUDE_CODE_USE_POWERSHELL_TOOL=1`). |

### 2.3 Context / budgeting (the _nitty_ nitty grits)
- **Skill description listing** scales to 1% of the context window; fallback **8,000 chars total** across all skills. Override with `SLASH_COMMAND_TOOL_CHAR_BUDGET`.
- **Each entry capped at 1,536 chars** (or 250 chars per [slash-commands page](https://code.claude.com/docs/en/slash-commands#frontmatter-reference) — discrepancy between the two canonical pages).
- On invocation the full SKILL.md is injected as **one message** and stays for the session. Claude Code does **not** re-read on later turns.
- After `/compact`: re-attaches most recent invocation of each skill, **first 5,000 tokens** kept per skill, **25,000-token combined budget** across re-attached skills.

### 2.4 String substitutions
- `$ARGUMENTS` — full argument string as typed.
- `$ARGUMENTS[N]` — 0-indexed arg (shell-style quoted).
- `$N` — shorthand for `$ARGUMENTS[N]`.
- `${CLAUDE_SESSION_ID}` — current session id.
- `${CLAUDE_SKILL_DIR}` — absolute path of skill directory. Plugin skills: subdir within plugin, not plugin root.

### 2.5 Dynamic context injection
- Inline: `` !`command` `` — runs shell command; stdout replaces placeholder **before** Claude sees anything.
- Block form: ```` ```! ```` fenced block runs multi-line script.
- Kill switch (managed): `"disableSkillShellExecution": true` in settings replaces every `!` with `[shell command execution disabled by policy]`. Bundled and managed skills are exempt.

### 2.6 Permission control
- `Skill` tool deny = blocks all skill invocation.
- `Skill(name)` exact match; `Skill(name *)` prefix-with-args.
- `user-invocable: false` only hides from menu — does **not** block Skill tool.
- To actually block model use: `disable-model-invocation: true`.

### 2.7 Slash-commands/Skills equivalence
- `.claude/commands/deploy.md` and `.claude/skills/deploy/SKILL.md` both create `/deploy`.
- Skill wins if both exist (skill has precedence).

### 2.8 Nested / monorepo discovery
- Claude Code auto-discovers `.claude/skills/` in subdirectories as you open files there.
- `--add-dir` directories: **skills are loaded** (exception to the usual "add-dir grants access not config" rule). Subagents/commands/output-styles from `--add-dir` are **not** loaded.

---

## 3. Slash commands (legacy = flat-file skills)
- Same frontmatter as skills (see 2.2).
- Live at `.claude/commands/*.md`.
- Still supported — deprecated in favor of skills.
- Cite: [slash-commands](https://code.claude.com/docs/en/slash-commands)

---

## 4. Subagents — full spec

### 4.1 Location
- Personal: `~/.claude/agents/<name>.md`
- Project: `.claude/agents/<name>.md`
- Plugin: `<plugin>/agents/<name>.md`

### 4.2 Frontmatter fields (Markdown file with YAML + body that is the system prompt)

| Field | Plugin-allowed? | Notes |
|---|---|---|
| `name` | yes | lowercase + hyphens |
| `description` | yes | when Claude should invoke it |
| `model` | yes | e.g. `sonnet`, `opus`, `haiku` |
| `effort` | yes | `low`/`medium`/`high`/`max` |
| `maxTurns` | yes | integer |
| `tools` | yes | allowed tool list |
| `disallowedTools` | yes | blocklist |
| `skills` | yes | preload skills into subagent (full content injected at startup) |
| `memory` | yes | enable persistent per-subagent auto memory |
| `background` | yes | run in background |
| `isolation` | yes | **only** `"worktree"` |
| `hooks` | **NO (plugin-shipped)** | user-level only |
| `mcpServers` | **NO (plugin-shipped)** | user-level only |
| `permissionMode` | **NO (plugin-shipped)** | user-level only |

### 4.3 Skill-vs-Subagent matrix
- Skill with `context: fork` → uses **agent type's** system prompt, **SKILL.md** is the task, CLAUDE.md loaded.
- Subagent with `skills:` field → uses **subagent body** as system prompt, delegation msg is the task, preloaded skills + CLAUDE.md loaded.

---

## 5. Hooks — full spec

### 5.1 Where hooks live
- `~/.claude/settings.json` (user)
- `.claude/settings.json` (project, committed)
- `.claude/settings.local.json` (gitignored)
- Managed settings (admin, non-overridable)
- `<plugin>/hooks/hooks.json` — bundled with plugin
- Inline in skill/agent YAML `hooks:` field (scoped to component lifetime)

### 5.2 All 26 event names (case-sensitive)
`SessionStart`, `InstructionsLoaded`, `UserPromptSubmit`, `PreToolUse`, `PermissionRequest`, `PermissionDenied`, `PostToolUse`, `PostToolUseFailure`, `Notification`, `SubagentStart`, `SubagentStop`, `TaskCreated`, `TaskCompleted`, `Stop`, `StopFailure`, `TeammateIdle`, `ConfigChange`, `CwdChanged`, `FileChanged`, `WorktreeCreate`, `WorktreeRemove`, `PreCompact`, `PostCompact`, `Elicitation`, `ElicitationResult`, `SessionEnd`.

### 5.3 Matcher grammar
- `"*"`, `""`, or omitted → match all.
- Letters/digits/`_`/`|` only → exact string or `|`-alternation (e.g. `Write|Edit`, `mcp__memory__.*`).
- Any other char → full JavaScript regex.
- MCP tools use naming `mcp__<server>__<tool>`.
- **No matcher support** for: `CwdChanged`, `UserPromptSubmit`, `Stop`, `TeammateIdle`, `TaskCreated`, `TaskCompleted`, `WorktreeCreate`, `WorktreeRemove`.

### 5.4 Hook handler types
| Type | Purpose | Default timeout |
|---|---|---|
| `command` | Shell command; JSON on stdin, JSON on stdout | **600 s** |
| `http` | POST event JSON to URL; JSON body in response | 30 s |
| `prompt` | Single-turn LLM evaluation via `$ARGUMENTS` | 30 s |
| `agent` | Agentic verifier with tool access | 60 s |

Handler shared fields: `type` (required), `if` (permission-rule filter, tool events only), `timeout` (seconds), `statusMessage` (spinner text), `once` (skills only). Command-specific: `async`, `asyncRewake`, `shell`. HTTP-specific: `url`, `headers`, `allowedEnvVars`.

### 5.5 Exit code contract (command hooks)
- **0** → parse stdout as JSON (most events); UserPromptSubmit/SessionStart echo stdout to transcript.
- **2** → **blocking error**. Stderr surfaced to Claude/user. Blocks action for `PreToolUse`, `PermissionRequest`, `UserPromptSubmit`, `Stop`, `SubagentStop`, `TeammateIdle`, `TaskCreated`, `TaskCompleted`, `ConfigChange`, `PreCompact`, `WorktreeCreate`. Non-blocking for Post*, Notification, Session*, CwdChanged, FileChanged, InstructionsLoaded, StopFailure, Elicitation*, WorktreeRemove, PermissionDenied.
- **Any other non-zero** → non-blocking error; first line of stderr shown in transcript.
- **Exit code 1 is NOT blocking** — must use 2.

### 5.6 JSON output (exit 0) schema
Universal: `continue` (false = stop Claude entirely), `stopReason`, `suppressOutput`, `systemMessage`.

Event-specific via `hookSpecificOutput`:
- **PreToolUse**: `permissionDecision` (`allow`/`deny`/`ask`/`defer`), `permissionDecisionReason`, `updatedInput`, `additionalContext`. Precedence across multiple hooks: `deny` > `defer` > `ask` > `allow`.
- **PermissionRequest**: `decision.behavior`, `decision.updatedInput`, `decision.updatedPermissions[]`, `decision.message`, `decision.interrupt`.
- **PermissionDenied**: `retry: true` (tells model it may retry).
- **PostToolUse**: `additionalContext`, `updatedMCPToolOutput`.
- **PostToolUseFailure**: `additionalContext`.
- **Elicitation/ElicitationResult**: `action` (`accept`/`decline`/`cancel`), `content`.
- **WorktreeCreate** (command): print path to stdout; (http): `hookSpecificOutput.worktreePath`.
- **Stop / SubagentStop / TeammateIdle / TaskCreated / TaskCompleted / UserPromptSubmit / PostToolUse / Stop**: top-level `decision: "block"` + `reason`.

**Output size limit: 10,000 chars** (excess saved to file with preview shown).

### 5.7 Disable / global
- `"disableAllHooks": true` in a settings layer kills hooks at that layer.
- Only managed settings can disable managed hooks.

### 5.8 Environment variables for hook scripts
`CLAUDE_ENV_FILE` (SessionStart/CwdChanged/FileChanged only — append `export VAR=...` for Bash persistence), `CLAUDE_PROJECT_DIR`, `CLAUDE_PLUGIN_ROOT`, `CLAUDE_PLUGIN_DATA`, `CLAUDE_CODE_REMOTE`.

---

## 6. MCP — full spec

### 6.1 Config locations
- User (global): `~/.claude.json` (via `claude mcp add -s user`).
- Project committed: `.mcp.json` at repo root.
- Project local: via CLI `claude mcp add -s local`.
- Plugin: `<plugin>/.mcp.json` or inline `"mcpServers": {...}` in `plugin.json`.

### 6.2 Transport types
- **stdio** — local subprocess (`command`, `args`, `env`, `cwd`).
- **http** — remote Streamable HTTP (`url`, `headers`).
- **sse** — remote Server-Sent Events (`url`, `headers`).

### 6.3 Auth
- Local: env vars inside `env` (e.g. `${API_KEY}`).
- Remote: OAuth flow via `/mcp` command, tokens persisted in OS keychain.
- Plugin: `userConfig.sensitive: true` values stored in keychain (~2 KB total limit shared with OAuth tokens).

### 6.4 CLI management
```
claude mcp add <name> [-s user|project|local] -- <command> [args...]
claude mcp add --transport http <name> <url>
claude mcp add --transport sse  <name> <url>
claude mcp list | remove | get
claude mcp add-from-claude-desktop
```

### 6.5 Plugin-scoped features
- `${CLAUDE_PLUGIN_ROOT}` and `${CLAUDE_PLUGIN_DATA}` substituted inline.
- Plugin MCP servers start when plugin enabled, stop when disabled.
- Full registry listing fetched from `https://api.anthropic.com/mcp-registry/v0/servers`.

---

## 7. Plugin manifest (`.claude-plugin/plugin.json`)

### 7.1 Complete schema (from [plugins-reference#complete-schema](https://code.claude.com/docs/en/plugins-reference#complete-schema))

```json
{
  "name": "plugin-name",
  "version": "1.2.0",
  "description": "Brief plugin description",
  "author": { "name": "...", "email": "...", "url": "..." },
  "homepage": "...",
  "repository": "...",
  "license": "MIT",
  "keywords": ["..."],
  "skills": "./custom/skills/",
  "commands": ["./custom/commands/special.md"],
  "agents": "./custom/agents/",
  "hooks": "./config/hooks.json",
  "mcpServers": "./mcp-config.json",
  "outputStyles": "./styles/",
  "lspServers": "./.lsp.json",
  "monitors": "./monitors.json",
  "userConfig": { "KEY": { "description": "...", "sensitive": true } },
  "channels": [ { "server": "telegram", "userConfig": { ... } } ]
}
```

### 7.2 Field rules
- **Only `name` is required** (if manifest present at all — manifest itself is optional).
- `name` = kebab-case, no spaces, unique. Drives namespacing (`pluginname:skillname`).
- All component paths must be **relative + start with `./`**.
- Custom path **replaces** default for `skills`, `commands`, `agents`, `outputStyles`, `monitors`. To keep the default + add more, include default in array.
- `hooks`, `mcpServers`, `lspServers` can be **string** (path), **array** (paths), or **object** (inline).

### 7.3 Standard directory layout
```
plugin/
├── .claude-plugin/plugin.json       (only file inside .claude-plugin/)
├── skills/<name>/SKILL.md
├── commands/*.md                    (legacy flat skills)
├── agents/*.md
├── hooks/hooks.json
├── .mcp.json
├── .lsp.json
├── monitors/monitors.json
├── output-styles/*.md
├── bin/<executable>                 (added to Bash PATH when enabled)
├── settings.json                    (only `agent` + `subagentStatusLine` keys honored)
├── scripts/                         (hook + utility scripts)
```
**Common trap:** never put `skills/ commands/ agents/ hooks/` inside `.claude-plugin/`.

### 7.4 Path traversal rule
- Installed plugins **cannot reference files outside plugin root**. `../shared` will fail because plugins are copied to `~/.claude/plugins/cache`.
- Workaround: **symlinks** inside the plugin dir are preserved in the cache.

### 7.5 Persistent data directory
- `${CLAUDE_PLUGIN_DATA}` → `~/.claude/plugins/data/<id>/` (chars outside `[a-zA-Z0-9_-]` become `-`).
- Survives updates. Directory created first time variable is referenced.
- Deleted on last uninstall unless `--keep-data` flag passed.

### 7.6 User configuration prompts
- Declared in `userConfig`.
- Non-sensitive → `settings.json` `pluginConfigs[<plugin-id>].options`.
- Sensitive → OS keychain (~2 KB total keychain budget shared with OAuth).
- Substituted as `${user_config.KEY}` in MCP/LSP configs, hook commands, (non-sensitive only) skill/agent content.
- Exported as `CLAUDE_PLUGIN_OPTION_<KEY>` env var to subprocesses.

---

## 8. Plugin marketplace (`.claude-plugin/marketplace.json`)

### 8.1 Required marketplace fields
- `name` (kebab-case, **reserved names blocked**: `claude-code-marketplace`, `claude-code-plugins`, `claude-plugins-official`, `anthropic-marketplace`, `anthropic-plugins`, `agent-skills`, `knowledge-work-plugins`, `life-sciences`, plus impersonation patterns).
- `owner.name` (required); `owner.email` optional.
- `plugins[]` — each entry needs `name` + `source`.

Optional: `metadata.description`, `metadata.version`, `metadata.pluginRoot` (prepended to relative paths).

### 8.2 Plugin entry — marketplace-only fields
`source`, `category`, `tags`, `strict` (default `true` — plugin.json is authority; `false` = marketplace entry is authoritative and plugin must not duplicate).

### 8.3 Plugin source types
| `source` | Fields | Notes |
|---|---|---|
| relative string `"./plugins/x"` | — | resolves from marketplace root, not `.claude-plugin/`. Must start with `./`. |
| `{ source: "github", repo, ref?, sha? }` | `ref`=branch/tag, `sha`=40-char commit | |
| `{ source: "url", url, ref?, sha? }` | any git URL (https/ssh, .git optional) | |
| `{ source: "git-subdir", url, path, ref?, sha? }` | sparse partial clone | |
| `{ source: "npm", package, version?, registry? }` | installed via `npm install` | |

**Marketplace source vs plugin source:** marketplace source (`ref` only, no `sha`); plugin source (both `ref` and `sha`).

### 8.4 CLI
```
claude plugin marketplace add <src> [--scope user|project|local] [--sparse dir ...]
claude plugin marketplace list [--json]
claude plugin marketplace remove|rm <name>   # also uninstalls its plugins
claude plugin marketplace update [name]
claude plugin install <plugin>[@marketplace] [--scope ...]
claude plugin uninstall|remove|rm <plugin> [--scope ...] [--keep-data]
claude plugin enable|disable|update <plugin> [--scope ...]
claude plugin validate <path>
```

### 8.5 Managed-settings controls
- `strictKnownMarketplaces` in managed settings: `undefined` (default/no limit), `[]` (lockdown), list with exact/`hostPattern`/`pathPattern` allow rules.
- `extraKnownMarketplaces` pre-registers marketplaces.
- `enabledPlugins` pre-enables specific `plugin@marketplace` entries.

### 8.6 Seed directory (containers / CI)
- `CLAUDE_CODE_PLUGIN_SEED_DIR` — read-only pre-populated `~/.claude/plugins/` structure.
- `CLAUDE_CODE_PLUGIN_CACHE_DIR` — override cache path at build time.
- `CLAUDE_CODE_PLUGIN_KEEP_MARKETPLACE_ON_FAILURE=1` — don't wipe cache on git pull failure (airgapped envs).
- `CLAUDE_CODE_PLUGIN_GIT_TIMEOUT_MS` — default 120,000.

### 8.7 Private auth (background updates)
`GITHUB_TOKEN`/`GH_TOKEN`, `GITLAB_TOKEN`/`GL_TOKEN`, `BITBUCKET_TOKEN`.

### 8.8 Reserved marketplace names
Listed in 8.1.

---

## 9. Settings / scopes

| Scope | Path | Share? |
|---|---|---|
| Managed | macOS `/Library/Application Support/ClaudeCode/managed-settings.json`, Linux `/etc/claude-code/managed-settings.json`, Windows `C:\ProgramData\ClaudeCode\managed-settings.json` | Org-wide, read-only from user |
| User | `~/.claude/settings.json` | No |
| Project shared | `.claude/settings.json` | Yes (git) |
| Project local | `.claude/settings.local.json` | No (gitignored) |

Plugin scope flags: `user` (default), `project`, `local`, `managed`.

---

## 10. CLAUDE.md / memory

### 10.1 Locations + order
1. Managed policy: macOS `/Library/Application Support/ClaudeCode/CLAUDE.md`, Linux/WSL `/etc/claude-code/CLAUDE.md`, Windows `C:\Program Files\ClaudeCode\CLAUDE.md`.
2. Project: `./CLAUDE.md` or `./.claude/CLAUDE.md`.
3. User: `~/.claude/CLAUDE.md`.
4. Local: `./CLAUDE.local.md` (gitignore it).

Loaded by walking upward from cwd; all concatenated (more specific appended last, so it wins conflicts).

### 10.2 Imports
- Syntax: `@path/to/file` (relative or absolute, `~` allowed).
- Max recursion depth: **5 hops**.
- First external import triggers approval dialog (one-time per project).

### 10.3 Rules (`.claude/rules/*.md`)
- Any `.md` anywhere under `.claude/rules/` (recursive).
- Optional `paths:` YAML frontmatter (glob list) → path-scoped, loads on-demand when a matching file is read.
- No `paths:` → same priority as `.claude/CLAUDE.md`.
- User-level: `~/.claude/rules/`. Loaded **before** project rules (project rules win).
- Symlinks supported + cycle-safe.

### 10.4 Size guidance
- Target **< 200 lines per CLAUDE.md file**.
- Block-level HTML comments `<!-- ... -->` are stripped before injection (don't count against tokens).
- `claudeMdExcludes` (settings key, merges across layers, managed path can't be excluded) — glob list matched against absolute paths.

### 10.5 Auto memory
- Default: on. Disable via `autoMemoryEnabled: false` or `CLAUDE_CODE_DISABLE_AUTO_MEMORY=1`.
- Storage: `~/.claude/projects/<project>/memory/` (per git repo; worktrees share one dir).
- `MEMORY.md` is the index; **first 200 lines OR 25 KB (whichever first)** loaded every session. Topic files loaded on demand.
- `autoMemoryDirectory` setting can redirect; NOT accepted from project settings (only policy/local/user).
- Requires Claude Code **v2.1.59+**.

### 10.6 `AGENTS.md`
- Claude Code does **not** read `AGENTS.md` natively. Workaround: `CLAUDE.md` containing `@AGENTS.md`.

---

## 11. Tool reference (constants you'll want)

- Built-in `Bash` timeout: up to 600 s (command tool cap).
- `SLASH_COMMAND_TOOL_CHAR_BUDGET` env var — override skill-description budget.
- Hook stdout limit: **10,000 chars**.
- Plugin cache path: `~/.claude/plugins/cache/<marketplace>/<plugin>/<version>/`.
- Plugin data path: `~/.claude/plugins/data/<id>/`.
- Orphan version TTL: **7 days**.

---

## 12. Key gotchas / non-obvious rules

1. `commands/` inside `.claude-plugin/` does **not** work — components must be at plugin root. Only `plugin.json` lives in `.claude-plugin/`.
2. Skill description char caps **differ across docs pages**: 1,536 chars on skills page; 250 on slash-commands page. Front-load key use case either way.
3. Exit code **1** from a hook is NOT blocking — you must use **2**.
4. Plugin agents forbid `hooks`, `mcpServers`, `permissionMode` frontmatter (security).
5. Plugin `isolation` field only accepts `"worktree"`.
6. MCP keychain budget ~2 KB total (shared with OAuth tokens). Keep secrets small.
7. `--add-dir` loads `.claude/skills/` but NOT subagents/commands/output-styles/CLAUDE.md (unless `CLAUDE_CODE_ADDITIONAL_DIRECTORIES_CLAUDE_MD=1`).
8. Marketplace update wipes cache on failed `git pull` by default — set `CLAUDE_CODE_PLUGIN_KEEP_MARKETPLACE_ON_FAILURE=1` in airgapped envs.
9. Setting version in both `plugin.json` and marketplace entry → `plugin.json` wins silently. For relative-path plugins, put version in the marketplace entry; everywhere else in `plugin.json`.
10. `user-invocable: false` only hides from menu — use `disable-model-invocation: true` to actually block Claude from using it.
11. `strictKnownMarketplaces: []` (empty) = full lockdown; `undefined` = no restriction.

---

## 13. Citations

- https://code.claude.com/docs/en/plugins-reference
- https://code.claude.com/docs/en/plugins
- https://code.claude.com/docs/en/plugin-marketplaces
- https://code.claude.com/docs/en/skills
- https://code.claude.com/docs/en/slash-commands
- https://code.claude.com/docs/en/hooks
- https://code.claude.com/docs/en/mcp
- https://code.claude.com/docs/en/sub-agents
- https://code.claude.com/docs/en/settings
- https://code.claude.com/docs/en/memory
- https://code.claude.com/docs/en/commands
