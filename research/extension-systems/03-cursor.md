# Cursor — Extension Systems (Deep Reference)

> Canonical docs: `cursor.com/docs/*`
> Cursor 2.4+ introduces Skills (SKILL.md), Subagents, and a `/migrate-to-skills` command that converts legacy rules+commands.
> Cursor uses the open **Agent Skills** standard for skills and **AGENTS.md** interoperability with Codex/Claude/others.

---

## 1. Extension surfaces at a glance

| Primitive | Path | Format | Doc |
|---|---|---|---|
| **Project rules** (legacy pattern, still primary) | `.cursor/rules/*.mdc` (nested OK) | `.mdc` (Markdown + YAML frontmatter) | [docs/context/rules](https://cursor.com/docs/context/rules) |
| **`.cursorrules`** (legacy single file) | `<repo>/.cursorrules` | Plain markdown | Deprecated → `.cursor/rules/index.mdc` with `alwaysApply: true` |
| **User rules** | Cursor Settings → Rules (no file) | N/A | applies to every request across all projects |
| **Skills** | Project: `.cursor/skills/<name>/SKILL.md` or `.agents/skills/<name>/SKILL.md` • User: `~/.cursor/skills/` or `~/.agents/skills/` | SKILL.md + supporting files | [docs/skills](https://cursor.com/docs/skills) |
| **Custom slash commands** | `.cursor/commands/*.md` (project), user-level also supported | Markdown prompt files | Mentioned in `/migrate-to-skills`; details sparse in official docs — being migrated into Skills |
| **Subagents** | `.cursor/agents/*.md` (also reads `.claude/agents/` and `.codex/agents/`!) • user: `~/.cursor/agents/` etc. | Markdown + YAML frontmatter | [docs/subagents](https://cursor.com/docs/subagents) |
| **Hooks** | `.cursor/hooks.json` (project), `~/.cursor/hooks.json` (user), managed system path | JSON | [docs/agent/hooks](https://cursor.com/docs/agent/hooks) |
| **MCP servers** | `.cursor/mcp.json` (project), `~/.cursor/mcp.json` (user) | JSON | [docs/context/mcp](https://cursor.com/docs/context/mcp) |
| **AGENTS.md** | `AGENTS.md` at repo root or subdirectories | Markdown | Interop per Agent Skills standard |

---

## 2. Cursor Rules (`.cursor/rules/*.mdc`)

### 2.1 File format: MDC (Markdown + frontmatter)
Despite the `---` fences looking like YAML, the spec treats the body as a **comma-separated list format**, not strict YAML:

```mdc
---
description: Brief, agent-facing hint for when to load this rule
globs: src/**/*.ts, src/**/*.tsx
alwaysApply: false
---

# Rule title and body in plain markdown
```

**Key quirks** (from [forum.cursor.com/t/my-take-on-cursor-rules](https://forum.cursor.com/t/my-take-on-cursor-rules/67535) and community reverse-engineering):
- `globs` is a **comma-separated list**, NOT a YAML array — do not wrap in `[]` or quotes. (Both forms show up across docs; the comma-separated form is what the UI generates.)
- The default `workbench.editorAssociations` setting shows MDC via a custom editor; to edit as plain markdown, add: `"workbench.editorAssociations": { "*.mdc": "default" }`.
- **File extensions**: `.md` and `.mdc` both accepted; `.mdc` is required to carry frontmatter semantics.

### 2.2 Four rule "types" (derived from frontmatter)

| Type | `alwaysApply` | `globs` | `description` | Trigger |
|---|---|---|---|---|
| **Always** | `true` | empty | optional | Injected into every chat |
| **Auto Attached** | `false` | non-empty | empty | Injected when attached/mentioned file in CHAT matches glob (does NOT auto-trigger if agent merely reads a matching file) |
| **Agent Requested** | `false` | empty | required | Agent decides based on semantic description |
| **Manual** | `false` | empty | empty | Only loads on explicit `@rule-name` |

### 2.3 Size guidance
- **Keep under 500 lines** per rule file (official doc).
- Keep `description` under ~200 chars for reliability (community-confirmed — the `description` field functions as an embedding / semantic prompt).

### 2.4 File references within rule bodies
- `@filename.ts` references a file directly (saves tokens vs pasting content).
- `@rule-name` in chat manually invokes a rule.

### 2.5 Nested rules
- `.cursor/rules/` is scanned recursively, so `src/frontend/.cursor/rules/` contains rules scoped to that subtree.
- Subdirectory rules take precedence over higher-level ones (specificity wins on conflicts).

### 2.6 Scope precedence
**Team Rules → Project Rules → User Rules** (earlier wins). User rules are non-file (stored in Cursor Settings), can't reference files.

### 2.7 `.cursorrules` legacy
- Deprecated. Migration path: move content to `.cursor/rules/index.mdc` with `alwaysApply: true`.

---

## 3. Cursor Skills (SKILL.md — Agent Skills open standard)

### 3.1 Paths (search order)
- Project: `.cursor/skills/<name>/SKILL.md` OR `.agents/skills/<name>/SKILL.md` (cross-agent convention).
- User: `~/.cursor/skills/<name>/` OR `~/.agents/skills/<name>/`.

### 3.2 Minimum frontmatter
```yaml
---
name: my-skill              # lowercase + digits + hyphens only
description: What it does and when to use it
---
```

### 3.3 Optional frontmatter
- `license` — license name/file ref.
- `compatibility` — environment requirements.
- `metadata` — custom key-value pairs.
- `disable-model-invocation: true` — only user can trigger (matches Claude Code semantics).
- Plus fields inherited from the Agent Skills open standard: `allowed-tools`, `argument-hint`, etc.

### 3.4 Directory structure
```
.cursor/skills/<name>/
├── SKILL.md       (required)
├── scripts/       (executable code agent may run)
├── references/    (docs loaded progressively on demand)
└── assets/        (templates, images, configs)
```

### 3.5 Invocation
- **Implicit**: Agent matches description against prompt.
- **Explicit**: `/skill-name`.

### 3.6 Built-in skill-management commands
- `/create-skill` — describe and Cursor scaffolds a SKILL.md.
- `/migrate-to-skills` (2.4+) — auto-converts user + workspace rules and commands into skills.

### 3.7 Size/character limits
- Not explicitly published in Cursor docs. Community + Agent Skills open-spec practice: ~500 lines on SKILL.md, progressive disclosure for longer.

---

## 4. Custom Slash Commands (`.cursor/commands/*.md`)

### 4.1 Location
- Project: `.cursor/commands/*.md`
- User-level supported via Cursor Settings.

### 4.2 Format
- Plain markdown prompt files.
- Filename = command name. Invocation: `/<filename-without-ext>`.
- **Frontmatter & argument syntax is not formally documented by Cursor** (the docs lean heavily on Skills now). Community usage: bodies are static prompts without a standardized frontmatter schema.

### 4.3 Migration path
- Cursor 2.4+ `/migrate-to-skills` converts commands → SKILL.md entries automatically. New work is expected to target Skills.

### 4.4 Bottom line
For new work, **write Skills, not commands.** Commands persist for backwards-compat only.

---

## 5. Subagents (`.cursor/agents/*.md`)

### 5.1 Locations (cross-tool)
- Project: `.cursor/agents/`, `.claude/agents/`, `.codex/agents/` — Cursor intentionally reads all three dirs.
- User: `~/.cursor/agents/`, `~/.claude/agents/`, `~/.codex/agents/`.
- Project wins on name collisions.

### 5.2 File format
Markdown + YAML frontmatter (closely mirrors Claude Code's subagent schema):

| Field | Type | Default | Purpose |
|---|---|---|---|
| `name` | string | filename-derived | Display identifier (lowercase + hyphens) |
| `description` | string | — | **Drives delegation decisions.** Cursor docs: "Spend time refining it." |
| `model` | string | `inherit` | `inherit`, `fast`, or specific model ID |
| `readonly` | boolean | `false` | Blocks edits and state-changing commands |
| `is_background` | boolean | `false` | Runs without blocking the parent agent |

Body (below frontmatter) is the subagent's system prompt.

### 5.3 Invocation
1. Slash: `/verifier confirm the auth flow`
2. Natural language: `Use the verifier subagent to…`
3. Automatic delegation (model decides from descriptions)

### 5.4 Parallelism
- Multiple subagents can launch simultaneously via concurrent `Task` tool calls.
- **No published max-thread cap** (unlike Codex's `max_threads = 6`).

### 5.5 Tool inheritance
- Subagents inherit **all** parent tools + MCP servers unless restricted via `readonly: true`.

### 5.6 Cloud vs IDE
- Cloud Agents differ from local subagents; Cloud Agents can be long-running and support launching from the IDE (Dec 2025+).

---

## 6. Hooks (`.cursor/hooks.json`)

### 6.1 Config layer paths
- Project: `<repo>/.cursor/hooks.json`
- User: `~/.cursor/hooks.json`
- Enterprise / managed: macOS `/Library/Application Support/Cursor/hooks.json`, Linux `/etc/cursor/hooks.json`, Windows `C:\ProgramData\Cursor\hooks.json`.
- Team: cloud-distributed (Enterprise only).

### 6.2 Complete event catalog (20 events across Agent + Tab)

**Agent (Cmd+K / Chat):** `sessionStart`, `sessionEnd`, `preToolUse`, `postToolUse`, `postToolUseFailure`, `subagentStart`, `subagentStop`, `beforeShellExecution`, `afterShellExecution`, `beforeMCPExecution`, `afterMCPExecution`, `beforeReadFile`, `afterFileEdit`, `beforeSubmitPrompt`, `preCompact`, `stop`, `afterAgentResponse`, `afterAgentThought`.

**Tab (inline completions):** `beforeTabFileRead`, `afterTabFileEdit`.

### 6.3 Hook types
- **`"command"`** — shell script, JSON via stdin/stdout.
- **`"prompt"`** — LLM-evaluated natural language conditions. Returns `{ ok: boolean, reason?: string }`.

### 6.4 Common input fields
`conversation_id`, `generation_id`, `model`, `hook_event_name`, `cursor_version`, `workspace_roots[]`, `user_email | null`, `transcript_path | null`.

### 6.5 Event-specific schemas (highlights)

| Event | Key input | Key output |
|---|---|---|
| `preToolUse` | `tool_name`, `tool_input`, `tool_use_id`, `cwd`, `model`, `agent_message` | `permission` (`allow`/`deny`), `user_message`, `agent_message`, `updated_input` |
| `postToolUse` | `tool_name`, `tool_input`, `tool_output`, `tool_use_id`, `cwd`, `duration`, `model` | `updated_mcp_tool_output`, `additional_context` |
| `postToolUseFailure` | adds `error_message`, `failure_type` (`error`/`timeout`/`permission_denied`), `is_interrupt` | — |
| `subagentStart` | `subagent_id`, `subagent_type`, `task`, `parent_conversation_id`, `tool_call_id`, `subagent_model`, `is_parallel_worker`, `git_branch?` | `permission`, `user_message` |
| `subagentStop` | `subagent_type`, `status` (`completed`/`error`/`aborted`), `task`, `summary`, `duration_ms`, `message_count`, `tool_call_count`, `loop_count`, `modified_files[]`, `agent_transcript_path` | `followup_message?` |
| `beforeShellExecution` | `command`, `cwd`, `sandbox` | `permission` (`allow`/`deny`/`ask`), `user_message`, `agent_message` |
| `beforeMCPExecution` | `tool_name`, `tool_input`, `cwd` | same as above |
| `afterShellExecution` | `command`, `output`, `duration`, `sandbox` | — |
| `afterMCPExecution` | `tool_name`, `tool_input`, `result_json`, `duration` | — |
| `afterFileEdit` | `file_path`, `edits[{old_string,new_string}]` | — |
| `beforeReadFile` | `file_path`, `content`, `attachments` | `permission`, `user_message` |
| `beforeSubmitPrompt` | `prompt`, `attachments` | `continue`, `user_message` |
| `preCompact` | `trigger` (`auto`/`manual`), `context_usage_percent`, `context_tokens`, `context_window_size`, `message_count`, `messages_to_compact`, `is_first_compaction` | `user_message?` |
| `stop` | `status`, `loop_count` | `followup_message?` |
| `afterAgentResponse` / `afterAgentThought` | `text`, `duration_ms?` | — |
| `sessionStart` | `session_id`, `is_background_agent`, `composer_mode?` | `env` (object), `additional_context` |
| `sessionEnd` | `session_id`, `reason` (`completed`/`aborted`/`error`/`window_close`/`user_close`), `duration_ms`, `final_status`, `error_message?` | — |

### 6.6 Per-hook config options

| Option | Type | Default | Notes |
|---|---|---|---|
| `command` | string | required | Shell script or command |
| `type` | `command`/`prompt` | `command` | — |
| `timeout` | number (seconds) | platform default | — |
| `loop_limit` | number \| null | **5** (Cursor); `null` for Claude Code interop | Per-script auto-follow-up cap |
| `failClosed` | boolean | `false` | Block action on hook failure if true |
| `matcher` | string (regex / literal) | — | Event-specific filter |

### 6.7 Exit codes
- `0` → success (parse JSON stdout)
- `2` → block (deny)
- Other non-zero → **fail-open by default** (opposite of Claude Code). Set `failClosed: true` to invert.

### 6.8 Matcher formats
- Tool events: Tool type (`Shell`, `Read`, `Write`, `MCP:toolname`).
- Subagent events: subagent type (`generalPurpose`, `explore`, `shell`).
- `beforeShellExecution`: regex on command text (e.g., `curl|wget|nc`).
- `beforeSubmitPrompt`: literal `UserPromptSubmit`.
- `stop`/`afterAgentResponse`/`afterAgentThought`: literal match values.

---

## 7. MCP (`.cursor/mcp.json` or `~/.cursor/mcp.json`)

### 7.1 Core config schema
```json
{
  "mcpServers": {
    "linear": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@linear/mcp-server"],
      "env": { "LINEAR_API_KEY": "${env:LINEAR_API_KEY}" },
      "envFile": ".env"
    },
    "figma": {
      "type": "sse",
      "url": "https://figma.com/mcp/sse",
      "headers": { "Authorization": "Bearer ${env:FIGMA}" }
    },
    "remote": {
      "type": "http",
      "url": "https://tools.example.com/mcp",
      "auth": {
        "CLIENT_ID": "abc",
        "CLIENT_SECRET": "xyz",
        "scopes": ["read", "write"]
      }
    }
  }
}
```

### 7.2 Transports
- `stdio` — local subprocess, Cursor-managed.
- `sse` — remote Server-Sent Events.
- `http` — Streamable HTTP (OAuth-capable via `auth` block).

### 7.3 Interpolation variables
`${env:NAME}`, `${userHome}`, `${workspaceFolder}`, `${workspaceFolderBasename}`, `${pathSeparator}` (alias `${/}`).

### 7.4 Add/remove
- Edit `mcp.json` directly.
- One-click install from Cursor Marketplace.
- Toggle via Settings → Features → Model Context Protocol.

### 7.5 Quantity limits
- **Not published.**

---

## 8. AGENTS.md

- Cursor participates in the cross-tool **AGENTS.md** open standard (used by Codex/Windsurf/Amp/Cline/etc.).
- Cursor's official docs focus on `.cursor/rules/` but AGENTS.md is loaded for interop.
- Community consensus: repo-root `AGENTS.md` acts as an always-applied rule when present. For multi-tool teams, put shared guidance in `AGENTS.md` and tool-specific additions in `.cursor/rules/`.

---

## 9. Key gotchas / non-obvious rules

1. **MDC frontmatter is NOT strict YAML.** `globs` is comma-separated, not an array. Brackets or quotes break the parser.
2. Cursor rules default to **"Use them if they seem useful"** — a terse, vague description will cause the agent to ignore the rule even when relevant.
3. **Auto Attached rules fire on CHAT attachments/mentions, not on ambient agent file reads.** If you expect a rule to fire every time the agent reads `src/x.ts`, you need either `alwaysApply` or structure your rule as Agent Requested.
4. Cursor's hooks **fail open by default** — opposite of Claude Code. Set `failClosed: true` to enforce.
5. Default `loop_limit` for hooks is **5** (vs Claude Code's `null`).
6. Subagents inherit **all** parent tools unless flagged `readonly`.
7. Cursor reads `.claude/agents/` and `.codex/agents/` too — can cause cross-tool name collisions.
8. `.cursorrules` is deprecated; migrate to `.cursor/rules/index.mdc` with `alwaysApply: true`.
9. Windows hooks support was "temporarily disabled" per some doc revisions — double-check for your version.
10. No first-class "plugin" or "marketplace" system in Cursor today. Distribution is via sharing SKILL.md dirs or committing `.cursor/` to a repo. Skills can be installed via Vercel's `skills.sh` / community indexes (`npx skills add ...`).
11. `/create-skill` and `/migrate-to-skills` are built-in; there is no documented way to publish a custom skill registry.
12. No documented character/line caps on SKILL.md (defer to Agent Skills standard — ~500 lines is the community convention).

---

## 10. Citations
- https://cursor.com/docs/context/rules
- https://cursor.com/docs/skills
- https://cursor.com/docs/subagents
- https://cursor.com/docs/agent/hooks
- https://cursor.com/docs/context/mcp
- https://cursor.com/help/customization/skills
- https://forum.cursor.com/t/documentation-page-schema-undocumented-for-rules/151461
- https://forum.cursor.com/t/my-take-on-cursor-rules/67535
- https://github.com/justdoinc/justdo/blob/master/.cursor/rules/999-mdc-format.mdc
- https://github.com/dyoshikawa/rulesync/blob/main/docs/tools/cursor.md
- https://www.datacamp.com/tutorial/cursor-rules
- https://rzaeeff.medium.com/mastering-cursor-rules-agent-skills-modes-models-and-best-practices-81908ec4f4a4
