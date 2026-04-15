# OpenAI Codex CLI — Extension Systems (Deep Reference)

> Canonical docs: `developers.openai.com/codex/*`
> CLI repo: `github.com/openai/codex`
> Notes: As of ~2026, Codex exposes **AGENTS.md**, **Skills** (SKILL.md), **Custom Prompts** (deprecated → Skills), **Plugins** (`.codex-plugin/plugin.json`), **Subagents** (TOML), **Hooks** (experimental, feature-flagged), **MCP** (stdio + http/SSE), and a rich `config.toml`.

---

## 1. Extension surfaces at a glance

| Primitive | Location | File type | Stability | Doc |
|---|---|---|---|---|
| **AGENTS.md** (project instructions) | `$CODEX_HOME/AGENTS.md` or `~/.codex/AGENTS.md` (global) + `AGENTS.md` walking up from cwd to git root | Markdown | Stable | [guides/agents-md](https://developers.openai.com/codex/guides/agents-md) |
| **AGENTS.override.md** | Same locations as AGENTS.md — wins over AGENTS.md at the same directory | Markdown | Stable | same |
| **Skills** | User: `~/.agents/skills/<name>/` • Project: `.agents/skills/<name>/` • Admin: `/etc/codex/skills/` | Dir w/ SKILL.md (+ optional `scripts/`, `references/`, `assets/`, `agents/openai.yaml`) | Stable | [codex/skills](https://developers.openai.com/codex/skills) |
| **Custom prompts** (legacy slash commands) | `~/.codex/prompts/*.md` (top-level only, not recursive) | Markdown + YAML frontmatter | **Deprecated** → replaced by Skills | [custom-prompts](https://developers.openai.com/codex/custom-prompts) |
| **Subagents** | User: `~/.codex/agents/*.toml` • Project: `.codex/agents/*.toml` | TOML | Stable | [subagents](https://developers.openai.com/codex/subagents) |
| **Hooks** | `~/.codex/hooks.json`, `<repo>/.codex/hooks.json` | JSON | **Experimental** (requires `[features] codex_hooks = true`) | [hooks](https://developers.openai.com/codex/hooks) |
| **MCP servers** | `[mcp_servers.<id>]` in `config.toml` | TOML | Stable | [config-reference](https://developers.openai.com/codex/config-reference) |
| **Plugins** | `<plugin>/.codex-plugin/plugin.json` | JSON | Stable (distribution surface); Public marketplace "coming soon" | [plugins/build](https://developers.openai.com/codex/plugins/build) |
| **Marketplace** | `$REPO_ROOT/.agents/plugins/marketplace.json`, `~/.agents/plugins/marketplace.json`, official curated catalog | JSON | Stable | [plugins/build](https://developers.openai.com/codex/plugins/build) |
| **`config.toml`** | `~/.codex/config.toml`, walked-up `.codex/config.toml` (closer wins) | TOML | Stable | [config-reference](https://developers.openai.com/codex/config-reference) |
| **Admin `requirements.toml`** | system-managed | TOML | Stable | [config-reference](https://developers.openai.com/codex/config-reference) |

---

## 2. AGENTS.md

### 2.1 Discovery order (root → cwd; concatenated; later wins)
1. Global: `$CODEX_HOME/AGENTS.override.md` → else `$CODEX_HOME/AGENTS.md` (first non-empty wins).
2. Project scope: walk **from git root down to cwd**. In each directory: `AGENTS.override.md` first, then `AGENTS.md`, then any name in `project_doc_fallback_filenames`. Max **one file per directory**.
3. Search halts once the current working directory is reached.

### 2.2 Size limit
- **`project_doc_max_bytes` default = 32 KiB** combined.
- **Silent truncation once limit hit** (known issue — filed as github.com/openai/codex issue #13386). Instructions past the cap are dropped.

### 2.3 Fallback filenames
- `project_doc_fallback_filenames` in `config.toml` — array of alt names (e.g., `["TEAM_GUIDE.md", ".agents.md"]`).

### 2.4 Merge semantics
- Files concatenate root→cwd, with closer files appearing later so they win on conflicts.
- Nested subdirectories: drop an `AGENTS.override.md` at `services/payments/` to scope overrides.
- Cross-tool: **AGENTS.md is the open standard used by Cursor, Copilot, Amp, Jules, Gemini CLI, Windsurf, Cline, Aider, Zed, Claude Code (indirectly via `CLAUDE.md` import)**.

### 2.5 Practical env
- `CODEX_HOME` — overrides `~/.codex` (default state dir).
- `$CODEX_HOME/AGENTS.md` travels as personal/global guidance.

---

## 3. Skills (SKILL.md)

### 3.1 Locations (search order)
1. `.agents/skills/` under cwd (walked **upward** from cwd to repo root; all found dirs loaded).
2. `$HOME/.agents/skills/` (user).
3. `/etc/codex/skills/` (admin / system-wide).

Note: Codex uses `.agents/skills/`, NOT `.codex/skills/` — shared filesystem with other agents (cross-tool design).

### 3.2 Required SKILL.md frontmatter
```yaml
---
name: <skill-name>         # kebab-case identifier
description: <...>         # trigger scope + boundaries (used for implicit match)
---
```

Plus (optionally):
- `argument-hint`, `allowed-tools` — per open Agent Skills spec; Codex respects the base standard.
- Character/size guidance: **follow the Agent Skills open standard** (not formally capped in docs; practice is keep SKILL.md under ~500 lines with progressive disclosure).

### 3.3 Directory structure
```
skills/<skill-name>/
├── SKILL.md              (required)
├── scripts/              (optional: executable code)
├── references/           (optional: documentation)
├── assets/               (optional: templates/resources)
└── agents/openai.yaml    (optional: metadata + dependencies)
```

### 3.4 `agents/openai.yaml` (Codex-specific metadata)
```yaml
interface:
  display_name: ...
  short_description: ...
  icons: ...
  brand_color: ...
  default_prompt: ...
policy:
  allow_implicit_invocation: true    # default true
dependencies:
  tools:
    - type: mcp
      value: ...
      description: ...
      transport: sse
      url: ...
```

### 3.5 Invocation
- **Implicit**: Codex matches `description` against the prompt.
- **Explicit**: `$skill-name` mention in chat, OR `/skills` browser picker.
- **Arguments**: docs do **not** mention `$ARGUMENTS` for skills (that pattern belongs to legacy custom prompts).

### 3.6 Progressive disclosure
- At startup Codex loads only **name + description** for each skill.
- Full SKILL.md loaded on demand. After task, context released.

### 3.7 Cross-platform portability
- The Agent Skills spec is filesystem-based. Codex skills run unchanged in Claude Code, Cursor, Copilot, Gemini CLI, and others. Vercel's `skills.sh` CLI handles multi-agent installation.

---

## 4. Custom prompts — legacy slash commands (DEPRECATED)

### 4.1 File spec
- **Path**: `~/.codex/prompts/*.md` (**top-level only, not recursive**).
- Markdown file with YAML frontmatter:
```yaml
---
description: <brief>
argument-hint: [PARAM=<type>] [OPTIONAL="<hint>"]
---
```

### 4.2 Argument substitutions
- `$1`..`$9` — positional space-separated args.
- `$FILE`, `$TICKET_ID`, etc. — uppercase placeholders bound via `KEY=value`.
- `$ARGUMENTS` — raw full arg string.
- `$$` — literal `$`.

Example: `/prompts:draftpr FILES="src/x.astro" PR_TITLE="Add animation"`

### 4.3 Status
- **Deprecated** — migrate to [Skills](#3-skills-skillmd). Listed as superseded on the custom-prompts page.
- Codex must be **restarted** to pick up new/edited prompt files.

---

## 5. Subagents (TOML-defined)

### 5.1 File location + format
- User: `~/.codex/agents/<name>.toml`
- Project: `.codex/agents/<name>.toml`
- **One agent per file**, TOML.

### 5.2 Required keys
| Key | Type | Purpose |
|---|---|---|
| `name` | string | Identifier used when spawning |
| `description` | string | Model guidance for when to pick it |
| `developer_instructions` | string | Core system-prompt-like behavioral instructions |

### 5.3 Optional keys (inherit from parent session if omitted)
- `nickname_candidates` (string[])
- `model`
- `model_reasoning_effort`
- `sandbox_mode` — `read-only` / `workspace-write` / `danger-full-access`
- `mcp_servers` — inline list / reference
- `skills.config` — skill definitions to preload

### 5.4 Global controls (in `config.toml`)
```toml
[agents]
max_threads = 6              # default concurrent subagent cap
max_depth = 1                # nesting depth; 0 = root session
job_max_runtime_seconds = 1800
```

Per-agent config: `[agents.<name>]` blocks with `config_file = "..."` and `description = "..."`.

### 5.5 Built-ins and overrides
- Built-in agent names `default`, `worker`, `explorer`. Declaring a custom TOML file with a matching name **overrides** them.

### 5.6 Invocation
- User-driven only: ask Codex to spawn, or `/agent` to switch threads.
- Approval requests surface from inactive threads too.

---

## 6. Hooks (experimental — `codex_hooks` flag)

### 6.1 Enable
```toml
[features]
codex_hooks = true
```

### 6.2 Config files (all loaded; higher layers don't *replace*)
- `~/.codex/hooks.json`
- `<repo>/.codex/hooks.json`

### 6.3 Event catalog (as of current docs)
| Event | Scope | Matcher | Purpose |
|---|---|---|---|
| `SessionStart` | Session | `source` (`startup` / `resume`) | Session lifecycle init |
| `UserPromptSubmit` | Turn | none | Modify or log prompts |
| `PreToolUse` | Turn | `tool_name` | Block / modify tool call |
| `PostToolUse` | Turn | `tool_name` | Review tool results |
| `Stop` | Turn | none | Control continuation |

**No** `SessionEnd`, `Notification`, `SubagentStart`, compact, file-change, etc. (much smaller event set than Claude Code's 26).

### 6.4 JSON input (common fields)
`session_id`, `transcript_path`, `cwd`, `hook_event_name`, `model`, and `turn_id` (turn-scoped events only).

Event-specific:
- **SessionStart**: `source`.
- **PreToolUse**: `tool_name`, `tool_use_id`, `tool_input.*`.
- **PostToolUse**: `tool_name`, `tool_use_id`, `tool_input`, `tool_response`.
- **UserPromptSubmit**: `prompt`.
- **Stop**: `stop_hook_active`, `last_assistant_message`.

### 6.5 Stdin / stdout / exit contract
- **Stdin**: single JSON object.
- **Stdout**:
  - plain text → appended as developer-role context (ignored for `Stop`).
  - JSON → structured response. Common: `continue`, `stopReason`, `systemMessage`, `suppressOutput`.
- **Exit codes**:
  - `0` → success (optionally parse stdout JSON).
  - `2` → block/deny with reason in stderr.
  - any other non-zero → non-blocking error.
- **Default timeout**: 600 s (configurable `timeout` / `timeoutSec`).
- Runs from session `cwd`.
- Matching hooks run **concurrently**.
- **Windows support is temporarily disabled.**

### 6.6 Documented size limits
- Not specified in docs. (Known unknown.)

### 6.7 Schema source
- Generated JSON schemas: `github.com/openai/codex/tree/main/codex-rs/hooks/schema/generated`.

---

## 7. MCP servers

### 7.1 Config (TOML)
```toml
[mcp_servers.linear]
type = "stdio"                       # or "sse" (HTTP streamable)
command = "npx"
args = ["-y", "@linear/mcp-server"]
env = { LINEAR_API_KEY = "${LINEAR_API_KEY}" }
enabled = true
enabled_tools = ["create_issue"]     # allowlist
disabled_tools = []                  # denylist
scopes = ["write:issues"]            # OAuth scope requirements
startup_timeout_sec = 10             # default 10
supports_parallel_tool_calls = true

[mcp_servers.linear.tools.create_issue]
approval_mode = "approve"

[mcp_servers.figma]
type = "sse"
url = "https://figma.com/mcp/sse"
```

### 7.2 OAuth callback
- `mcp_oauth_callback_port` in config.toml — fix the port.

### 7.3 Admin allowlisting
- `mcp_servers.<id>.identity` under `requirements.toml` allowlists specific MCP servers.

---

## 8. Plugins

### 8.1 Directory layout
```
my-plugin/
├── .codex-plugin/
│   └── plugin.json       (manifest — required)
├── skills/<name>/SKILL.md
├── .app.json             (app integration mapping)
├── .mcp.json             (MCP server config)
└── assets/               (logos, screenshots)
```

### 8.2 `plugin.json` schema

**Required:**
- `name` (kebab-case)
- `version` (semver)
- `description`

**Component pointers:**
- `skills` — relative path
- `mcpServers` — path to MCP config file
- `apps` — path to app integration file

**Publisher metadata:**
- `author` (`name`, `email`, `url`)
- `homepage`, `repository`, `license`, `keywords`

**`interface` block** (marketplace UI):
- `displayName`, `shortDescription`, `longDescription`
- `developerName`, `category`, `capabilities`
- `defaultPrompt` (array of example prompts)
- `brandColor`, `composerIcon`, `logo`, `screenshots`
- `websiteURL`, `privacyPolicyURL`, `termsOfServiceURL`

### 8.3 What plugins bundle
1. **Skills** — reusable workflows (authoring format).
2. **Apps** — ChatGPT connectors.
3. **MCP servers** — external tools.

> "Skills remain the authoring format; plugins are the installable distribution unit."

### 8.4 Marketplace (`marketplace.json`)
- Official curated catalog (public publishing "coming soon").
- Per-repo: `$REPO_ROOT/.agents/plugins/marketplace.json`.
- Personal: `~/.agents/plugins/marketplace.json`.

**Entry fields:** `source.path` (starts with `./`), `policy.installation`, `policy.authentication`, `category`. Plugin manifests referenced by path.

### 8.5 Installation flow
1. `/plugins` in Codex CLI opens the browser.
2. Select → install → OAuth/app auth if needed → new thread to use.
3. Local cache: `~/.codex/plugins/cache/`.

### 8.6 Uninstall
- Plugin bundle removed; bundled apps stay installed in ChatGPT until manually removed.

---

## 9. `config.toml` — full reference (from developers.openai.com/codex/config-reference)

### 9.1 Top-level sections that ship
`model`, `model_provider`, `[model_providers.<id>]`, `model_context_window`, `model_instructions_file`, `model_reasoning_effort` (`minimal`/`low`/`medium`/`high`/`xhigh`), `model_verbosity`, `sandbox_mode`, `approval_policy`, `approvals_reviewer` (`user`/`guardian_subagent`), `default_permissions`, `[agents.<name>]`, `[agents]` global, `[mcp_servers.<id>]`, `project_doc_fallback_filenames`, `project_doc_max_bytes` (default 32 KiB), `project_root_markers`, `[projects.<path>]` with `trust_level`, `[features]`, `profile`, `[profiles.<name>]`, `web_search` (`disabled`/`cached`/`live`), `[tools.web_search]`, `[tools.view_image]`, `[shell_environment_policy]` (`inherit`: `all`/`core`/`none`), `allow_login_shell`, `[permissions.<name>]` with filesystem + network rules, `[apps._default]`, `[apps.<id>]`, `[tui]` (`animations`, `notifications`, `theme`, `alternate_screen`), `file_opener` (`vscode`/`cursor`/`windsurf`/`none`), `[otel]`, `log_dir`, `[history]`, `cli_auth_credentials_store` (`file`/`keyring`/`auto`), `forced_login_method` (`chatgpt`/`api`), `mcp_oauth_callback_port`.

### 9.2 `[features]` flags
| Flag | Default | Status |
|---|---|---|
| `multi_agent` | on | stable |
| `unified_exec` | on (non-Windows) | stable |
| `shell_tool` | on | stable |
| `fast_mode` | on | stable |
| `personality` | on | stable |
| `prevent_idle_sleep` | off | experimental |
| `smart_approvals` | off | experimental |
| `undo` | off | stable |
| `apps` | — | experimental |
| `codex_hooks` | off | experimental (enables hooks) |

### 9.3 `requirements.toml` (admin enforcement)
- `allowed_sandbox_modes`, `allowed_approval_policies`, `allowed_web_search_modes`.
- `features.<name>` — pin on/off.
- `mcp_servers.<id>.identity` — allowlist.
- `rules.prefix_rules` — command prefix allow / forbid / prompt.

### 9.4 Profiles
```toml
profile = "deep-review"           # default

[profiles.deep-review]
model = "gpt-5-pro"
model_reasoning_effort = "high"
approval_policy = "never"
```
- Selectable at runtime via `--profile <name>`.
- **Not supported in the IDE extension** (CLI-only).

### 9.5 Env vars Codex honors
- `CODEX_HOME` (state dir override)
- `CODEX_SQLITE_HOME` (state DB override)
- `CODEX_CA_CERTIFICATE` (custom CA, precedence over `SSL_CERT_FILE`)
- `SSL_CERT_FILE`
- `PLAYWRIGHT_MCP_EXTENSION_TOKEN` (for Playwright MCP bridge)
- Anything referenced via `${VAR}` substitution in config values.
- Provider-specific keys (via `env_key` in custom provider configs).

### 9.6 Schema reference
- JSON schema at `https://developers.openai.com/codex/config-schema.json`.
- VS Code autocompletion: `#:schema https://developers.openai.com/codex/config-schema.json` as first line of `config.toml`.

---

## 10. Sandbox + approval model (not an extension surface but gates everything)

### 10.1 `sandbox_mode`
`read-only` | `workspace-write` (default) | `danger-full-access`.

### 10.2 `approval_policy`
`untrusted` | `on-request` (default) | `never` | granular mode with per-category subcategories.

---

## 11. Built-in slash commands (not user-extensible, but comprehensive list)

`/permissions`, `/sandbox-add-read-dir`, `/agent`, `/apps`, `/plugins`, `/clear`, `/compact`, `/copy`, `/diff`, `/exit`, `/experimental`, `/feedback`, `/init`, `/logout`, `/mcp`, `/mention`, `/model`, `/fast`, `/plan`, `/skills`, `/status`, `/debug-config`, `/statusline`, `/review`, `/fork`, `/ps`, `/personality`, `/prompts` (invokes legacy custom prompts), `/quit`.

Source: [developers.openai.com/codex/cli/slash-commands](https://developers.openai.com/codex/cli/slash-commands)

---

## 12. Key gotchas

1. **AGENTS.md truncates silently at 32 KiB.** Raise with `project_doc_max_bytes`.
2. **Custom prompts (`~/.codex/prompts/`) are deprecated** — use Skills going forward.
3. Custom prompts are **top-level only** (no nested directories scanned).
4. **Hooks are experimental + require feature flag** + **no Windows** currently.
5. Codex hooks expose **only 5 events** (Claude Code has 26).
6. Subagents are **TOML**, not markdown.
7. Skills path is `.agents/skills/` (shared cross-agent convention), not `.codex/skills/`.
8. Plugins use `.codex-plugin/plugin.json` (note: `.codex-plugin/`, distinct from Claude Code's `.claude-plugin/`).
9. Codex's MCP config lives in `config.toml` (TOML), unlike Claude Code's `.mcp.json`.
10. Profiles don't work in the IDE extension.
11. `project_doc_fallback_filenames` lets you rename/fall-back to `.agents.md` etc., but **default `AGENTS.md` is still checked first** per directory.
12. `AGENTS.override.md` wins over `AGENTS.md` **at the same directory level** — do not mix the two files to avoid confusion.
13. Codex restarts are needed after editing `~/.codex/prompts/*.md` (not hot-reloaded).
14. Plugin marketplace publishing **is not yet public**; distribute via repo-level or personal `marketplace.json` for now.

---

## 13. Citations
- https://developers.openai.com/codex/skills
- https://developers.openai.com/codex/plugins
- https://developers.openai.com/codex/plugins/build
- https://developers.openai.com/codex/subagents
- https://developers.openai.com/codex/hooks
- https://developers.openai.com/codex/custom-prompts
- https://developers.openai.com/codex/cli/slash-commands
- https://developers.openai.com/codex/config-reference
- https://developers.openai.com/codex/config-advanced
- https://developers.openai.com/codex/guides/agents-md
- https://developers.openai.com/codex/concepts/customization
- https://github.com/openai/codex (for hook schemas: `codex-rs/hooks/schema/generated`)
- https://openai.com/index/unrolling-the-codex-agent-loop/ (harness / instruction merge order)
