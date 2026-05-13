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
| **Hooks** | `~/.codex/hooks.json`, `<repo>/.codex/hooks.json` | JSON | Feature-gated (`hooks` and `codex_hooks` both exist under `[features]`; `codex exec --help` now exposes `--enable <FEATURE>` instead of `--enable-hooks`; maintained local probes on May 13, 2026 timed out without a project-local hook side effect under either config flag or under `--enable hooks`, and the local runtime deprecated `codex_hooks`) | [hooks](https://developers.openai.com/codex/hooks) |
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

### 5.7 Observed custom-agent invocation in local Pluxx probes (2026-05-13)
- The maintained `bun scripts/probe-codex-agents-runtime.ts --json` probe now runs isolated authenticated headless `codex exec` checks against project-local `.codex/agents/*.toml` files by copying only `auth.json` into a temporary `CODEX_HOME` and stripping desktop thread-coupling env vars.
- On local Codex CLI `0.130.0`, the explicit-agent scenario emitted `spawn_agent` then `wait` `collab_tool_call` events, populated `receiver_thread_ids`, surfaced the child result under `agents_states.*.message`, and returned `CUSTOM_AGENT_PROOF` as the final parent `agent_message`.
- The negative-control scenario (`Reply only with OK.`) returned `OK` with no `spawn_agent` or `wait` events.
- A project-local `.codex/agents/explorer.toml` override also emitted `spawn_agent` plus `wait` and returned `CUSTOM_EXPLORER_OVERRIDE ...`, which live-proves the documented built-in-name override path for `explorer`.
- A project-local `.codex/agents/proof.toml` beat a same-name user-local `~/.codex/agents/proof.toml` by returning `PROJECT_AGENT_PROOF ...` from the child and parent final messages, which shows project-local precedence over ambient user-local agent definitions for the same name.
- The maintained sandbox scenarios also exposed a sharper runtime caveat: a child agent declared with `sandbox_mode = "read-only"` still emitted `spawn_agent` plus `wait`, returned `SANDBOX_WRITE_PROOF`, and wrote `sandbox-proof.txt`, while the `workspace-write` control wrote its expected side effect.
- The maintained skill scenarios now split discovery from config semantics more clearly. On May 13, 2026, a project-local `.agents/skills/proof-skill/SKILL.md` was inherited cleanly by a custom agent and returned `SKILL_PROOF_TOKEN_PROJECT_DISCOVERY` with no pre-spawn local work from the parent. In the same maintained headless suite, a parent `.codex/config.toml` `[[skills.config]] enabled = false` entry for that discovered skill was ignored by the runtime and still returned `SKILL_PROOF_TOKEN_DISABLED_IGNORED`, while an agent-local `[[skills.config]] path = "./skills/proof-skill/SKILL.md"` entry did not preload an undiscovered `skills/` path and fell back to `SKILL_PROOF_MISSING`.
- A targeted maintained invalid-model rerun on May 13, 2026 also showed that an agent-local `model = "definitely-not-a-real-codex-model"` is honored strongly enough to affect live runtime: Codex still emitted `spawn_agent` plus `wait`, and the parent surfaced `The proof agent errored: ... model is not supported when using Codex with a ChatGPT account.` while stderr logged both `Unknown model definitely-not-a-real-codex-model is used` and a `startup websocket prewarm setup failed` warning.
- Targeted maintained live reruns on May 13, 2026 now also closed the two model-precedence cases that were previously only in source/test coverage: `project-no-model-does-not-inherit-user-invalid-model` returned `PROJECT_NO_MODEL_PROOF`, which shows a project-local same-name agent without an explicit `model` did not inherit the user-local invalid model, and `project-valid-model-overrides-user-invalid-model` returned `PROJECT_VALID_MODEL_PROOF`, which shows an explicit valid project-local model overrode the same-name user-local invalid model.
- The maintained `bun scripts/probe-codex-agents-interactive-runtime.ts --json` probe now gives isolated trusted interactive evidence too. On local Codex CLI `0.130.0`, the `sandbox-readonly-trusted` scenario surfaced `proofToken = SANDBOX_WRITE_PROOF`, wrote `sandbox-proof.txt` with `interactive-readonly`, and ended `expectationStatus = "mismatched"`, while the `sandbox-workspace-write-trusted` control kept `sideEffectOutput = "interactive-writable"` with `expectationStatus = "matched"`.
- The maintained `bun scripts/probe-codex-mcp-runtime.ts --json` probe now also covers headless MCP behavior across default project `.codex/config.toml`, default user `CODEX_HOME/config.toml`, inline custom-agent `mcp_servers`, `agent-inline-approve`, `project-config-root-approve`, `user-config-root-approve`, `project-config-agent-inherit-approve`, and `user-config-agent-inherit-approve`. On local Codex CLI `0.130.0` on May 13, 2026, the three default scenarios all reached `initialize`, `notifications/initialized`, and `tools/list`, but only the root-scoped defaults emitted a real `mcp_tool_call` item, and both of those default root paths still failed it with `user cancelled MCP tool call`; the default inline custom-agent path still returned `MCP_PROOF_MARKER_MISSING` after `spawn_agent` plus `wait`. In the same maintained suite, `project-config-root-approve`, `user-config-root-approve`, `agent-inline-approve`, `project-config-agent-inherit-approve`, and `user-config-agent-inherit-approve` all reached real server-side `tools/call` and returned `MCP_PROOF_MARKER_ALLOWED` once explicit `[mcp_servers.probe.tools.get_allowed_marker] approval_mode = "approve"` was present in the relevant root or agent-local layer. All three approved custom-agent paths still avoided a root `mcp_tool_call` item in the parent `codex exec --json` stream and instead surfaced child `agents_states` moving through `pending_init` to `completed`; the project-scoped server still did not appear in `codex mcp list`, while the user-scoped server did.
- Practical implication for Pluxx: project-local Codex custom-agent invocation, built-in-name override, project-local precedence over same-name user-local agents, discovered `.agents/skills` inheritance, the invalid agent-local model failure path, and the two same-name user-local model precedence cases are now live-proven, but advanced config depth is still uneven. `sandbox_mode` is documented and generated, yet both the current headless runtime and the maintained trusted interactive probe still ignored a `read-only` child sandbox in local probes. `skills.config` is also not uniformly trustworthy in the current headless runtime: disabling a discovered skill via parent config was ignored, and pointing an agent-local `skills.config` entry at an undiscovered `skills/` path did not preload it. MCP is now sharper too: default headless Codex reaches startup and `tools/list` for project, user, and inline-agent MCP config; default root MCP still auto-cancels a real `mcp_tool_call` before server `tools/call`; default inline-agent MCP still falls back quietly without approval; explicit per-tool `approval_mode = "approve"` is now maintained as a proven unlock path for project-scoped root MCP, user-scoped root MCP, agent-local inline MCP, and delegated inherited-root MCP from either project or user config; and Pluxx now compiles the live-proven root allow-path into `.codex/config.generated.toml` when top-level canonical `MCP(...)` rules are concrete enough to materialize per-tool approvals.

---

## 6. Hooks (feature-gated — mixed `codex_hooks` / `hooks` contract)

### 6.1 Enable
```toml
[features]
hooks = true
```

Current Codex config surfaces still expose both `hooks` and `codex_hooks` under `[features]`. Current `codex exec --help` also exposes `--enable <FEATURE>`, which means the current CLI path for hooks is `--enable hooks`, not `--enable-hooks`. In maintained local May 13, 2026 probes, trusted interactive `UserPromptSubmit` timed out without a project-local hook side effect under either config flag, the `codex_hooks` prompt path emitted `"[features].codex_hooks is deprecated. Use [features].hooks instead."`, and the optional maintained CLI-flag scenarios still no-op under `--enable hooks`.

The maintained interactive probe now also has a targeted reviewed `SessionStart` rerun on May 13, 2026 via `--include-reviewed-session-start`, and that rerun still ended `runner-timed-out` with no project-local hook side effect and no `/hooks` review gate. So the current local reviewed interactive path remains negative evidence rather than an unrerun placeholder.

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

### 6.8 Observed activation gates in local Pluxx probes (2026-05-13)
- The maintained `bun scripts/probe-codex-hooks-runtime.ts --json` probe now runs isolated authenticated headless `codex exec` checks against project-local hooks by copying only `auth.json` into a temporary `CODEX_HOME` and stripping desktop thread-coupling env vars.
- On local Codex CLI `0.130.0`, that probe reported `headless-response-no-hook` for `hooks-no-trust`, `hooks-trusted`, and `codex-hooks-trusted`: `codex exec` returned the final response, emitted `turn.completed`, and never executed the corrected `SessionStart` hook command.
- In an interactive TTY probe, Codex persisted trusted-project state under `[projects."<path>"].trust_level = "trusted"` in the user config, which narrowed the gap from “bundle shape” to “runtime activation.”
- Even after trust was persisted, Codex still blocked execution with `1 hook needs review before it can run. Open /hooks to review it.`
- The maintained `bun scripts/probe-codex-hooks-interactive-runtime.ts --json` probe now checks four trusted interactive scenarios against project-local `.codex/hooks.json`: `UserPromptSubmit` with `codex_hooks`, `UserPromptSubmit` with `hooks`, `SessionStart` with `codex_hooks`, and `SessionStart` with `hooks`.
- On local Codex CLI `0.130.0` on May 13, 2026, all four maintained interactive scenarios timed out without a hook side effect and without surfacing the old `/hooks` review gate message.
- The `codex_hooks` prompt scenario emitted `"[features].codex_hooks is deprecated. Use [features].hooks instead."` in the interactive transcript.
- The optional `bun scripts/probe-codex-hooks-runtime.ts --include-enable-hooks-cli` scenario `enable-hooks-trusted` still returned `OK` with no hook side effect, and the optional `bun scripts/probe-codex-hooks-interactive-runtime.ts --include-enable-hooks-cli` scenarios `user-prompt-submit-enable-hooks-trusted` and `session-start-enable-hooks-trusted` both still timed out without a hook side effect or `/hooks` review gate.
- Practical implication for Pluxx: current Codex hook proof needs four distinct checks, not one:
  - official nested hook schema in `hooks/hooks.json`
  - a `[features]` activation flag, with `hooks` now the preferred spelling and `codex_hooks` only a compatibility alias, even though current local probes still no-op under both config spellings and under the current CLI feature path `--enable hooks`
  - trusted project entry in the user Codex config
  - pending-hook review state, even though the maintained interactive probe no longer reproduces the older `/hooks` gate observation and the current slash-command docs still do not list `/hooks`
- Remaining open question: whether reviewed hooks can ever fire under non-interactive `codex exec` at all, and why the current local reviewed interactive path no longer reproduces either successful hook execution or the older ad hoc `/hooks` review gate on current Codex builds.

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

### 7.4 Observed MCP behavior in local Pluxx probes (2026-05-13)
- The maintained `bun scripts/probe-codex-mcp-runtime.ts --json` probe now runs isolated authenticated headless `codex exec` checks against:
  - project-scoped `.codex/config.toml` MCP config
  - user-scoped `CODEX_HOME/config.toml` MCP config
  - inline custom-agent `mcp_servers` TOML config
- On local Codex CLI `0.130.0`, the default project-scoped, default user-scoped, and default inline-agent scenarios all reached `initialize`, `notifications/initialized`, and `tools/list`.
- The default project-scoped and default user-scoped root paths each emitted a real `mcp_tool_call` item for `get_allowed_marker`, but both failed it with `user cancelled MCP tool call` even with `approval_policy = "never"`.
- The default inline custom-agent path still returned `MCP_PROOF_MARKER_MISSING` after `spawn_agent` plus `wait` and never emitted a root `mcp_tool_call` item.
- The maintained `project-config-root-approve`, `user-config-root-approve`, `agent-inline-approve`, `project-config-agent-inherit-approve`, `project-config-agent-empty-mcp-override-approve`, and `user-config-agent-inherit-approve` controls all reached server-side `tools/call` and returned `MCP_PROOF_MARKER_ALLOWED` once explicit `[mcp_servers.probe.tools.get_allowed_marker] approval_mode = "approve"` was present in the relevant root or agent-local layer.
- In the same maintained suite, the `project-config-agent-empty-mcp-override-approve` scenario still reached `tools/call` and returned `MCP_PROOF_MARKER_ALLOWED` even though the custom agent explicitly set `mcp_servers = {}`, which means the attempted empty override did not block inherited approved root MCP in the current local runtime.
- The four approved custom-agent controls still did not emit a root `mcp_tool_call` item in the parent `codex exec --json` stream, even though all four returned `MCP_PROOF_MARKER_ALLOWED`, reached real server-side `tools/call`, and surfaced child `agents_states` moving through `pending_init` to `completed`.
- `codex mcp list` exposed the user-scoped server but did not expose the project-scoped server, even though headless `codex exec` still touched the project-scoped server.
- Practical implication for Pluxx: current headless Codex MCP proof is no longer just “startup and listing reached, but root auto-cancelled before `tools/call`.” The maintained suite now also proves that explicit per-tool `approval_mode = "approve"` can unlock project-scoped root MCP, user-scoped root MCP, agent-local inline MCP, delegated inherited-root MCP from either project or user config, and even a custom agent that explicitly sets `mcp_servers = {}`. That narrows the remaining gap to default root policy behavior, delegated event-stream visibility, and how far Pluxx should generate or preserve those approval surfaces explicitly.

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
| `hooks` | off | stable in current CLI feature listing (enables hooks) |

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

Observed May 13, 2026 caveat: both the maintained headless custom-agent probe and the maintained trusted interactive probe still let a child agent declared with `sandbox_mode = "read-only"` create `sandbox-proof.txt`, so the field currently has stronger documentation support than maintained enforcement proof.

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
4. **Hooks are feature-gated and still require a feature flag** + **no Windows** currently. Maintained local probes on May 13, 2026 showed both `hooks` and `codex_hooks` timing out without a project-local hook side effect in trusted interactive `UserPromptSubmit` and `SessionStart` scenarios, the current CLI feature path `--enable hooks` still no-oping in maintained headless and interactive probes, and the local runtime deprecating `codex_hooks` in favor of `hooks`.
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
