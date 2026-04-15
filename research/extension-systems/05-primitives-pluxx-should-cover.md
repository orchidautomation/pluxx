# Primitives Pluxx's Generator Matrix Should Cover (Beyond Today's Core Five)

> **Context**: Pluxx today compiles skills, commands, agents, hooks, MCP servers, and rules/instructions into native packages for Claude Code, Cursor, Codex, and OpenCode. This file catalogs the *other* primitives these four tools expose and grades each by how much Pluxx benefits from supporting it.
>
> Scoring legend:
> - ⭐⭐⭐ = bring this into the canonical schema soon; real author asks will land on it.
> - ⭐⭐ = worth designing a compatibility shim; only one tool implements it today but it's high-impact or portable in spirit.
> - ⭐ = tool-specific UX sugar; document and pass through but don't abstract yet.
> - ⛔ = not a distributable primitive; skip.

---

## 1. `userConfig` (install-time secret/config prompts) — ⭐⭐⭐

**Source**: Claude Code plugin spec only. [plugins-reference#user-configuration](https://code.claude.com/docs/en/plugins-reference#user-configuration).

**What it does**: Plugin manifest declares values the user is prompted for on install. Non-sensitive → `settings.json`; sensitive → OS keychain (~2 KB shared with OAuth). Values substitute as `${user_config.KEY}` in MCP/LSP configs, hook commands, and skill/agent content; exported as `CLAUDE_PLUGIN_OPTION_<KEY>` env var.

**Why Pluxx needs it**: every cross-tool plugin that calls a remote MCP or third-party API needs secrets. Today an author hand-rolls per-tool docs telling users "set `FOO_API_KEY`." A canonical `userConfig` schema lets Pluxx:
- emit CC's native `userConfig` block,
- generate `.env.example` + README snippets for tools without install-time prompts (Codex, Cursor, OpenCode),
- plumb the substitution token (`${user_config.X}` → `${env:X}` in Cursor, `${X}` in Codex TOML, `${process.env.X}` in OpenCode TS plugin).

**Compile targets**:
| Target | Output |
|---|---|
| Claude Code | native `userConfig` block in `plugin.json` |
| Codex | README install step + env var reference in `.agents/plugins/marketplace.json` `defaultPrompt` |
| Cursor | README + `.cursor/mcp.json` `env` key with `${env:X}` |
| OpenCode | README + `opencode.json` `mcp.<name>.environment.X` |

---

## 2. Permission / access rules (canonical expression) — ⭐⭐⭐

**Source**: all four tools, very different grammars:
- Claude Code: `permissions.allow/deny`, rules like `Bash(git *)`, `Edit(*.ts)`, `Skill(deploy *)`.
- Codex: `approval_policy`, per-server `tools.<tool>.approval_mode`, `requirements.toml` `rules.prefix_rules`.
- Cursor: hook `preToolUse` returning `permission: allow|deny|ask`, plus `readonly: true` on subagents.
- OpenCode: agent `permission: { tool: allow|ask|deny }`.

**Why Pluxx needs it**: authors constantly hit "let this skill run `git *` without approval." Today that's a snowflake per tool. A canonical `permissions:` schema lets Pluxx codegen the right thing everywhere.

**Design sketch**:
```ts
permissions: {
  allow: ["Bash(git status)", "Bash(git diff)"],
  ask:   ["Bash(git commit *)"],
  deny:  ["Bash(rm *)", "Edit(.env)"],
}
```
Compile target-by-target: CC → `permissions.allow[]`; Codex → `permissions.<profile>.filesystem` + per-tool `approval_mode`; Cursor → a `preToolUse` hook with literal allow-list; OpenCode → per-agent `permission`.

---

## 3. Build-time validation of size/format caps — ⭐⭐⭐

**Source**: documented limits across tools.

Pluxx should warn (or fail) when a shared artifact would blow a target's cap:
| Artifact | Cap | Target |
|---|---|---|
| `AGENTS.md` combined | **32 KiB** (silently truncated) | Codex |
| Skill `description` | **1,024 chars** hard cap | OpenCode |
| Skill `description` + `when_to_use` listing | **1,536 chars** | Claude Code (also 250-char variant per slash-commands page) |
| Skill listing budget | **8,000 chars** fallback / 1% context | Claude Code |
| Hook stdout | **10,000 chars** (excess file-dumped) | Claude Code |
| Skill `name` regex | `^[a-z0-9]+(-[a-z0-9]+)*$`, 1–64 chars, must equal dir | OpenCode |
| Keychain total (userConfig secrets) | ~2 KB | Claude Code |
| Plugin marketplace reserved names | list of ~8 reserved | Claude Code |
| Cursor rule body | **<500 lines** guideline | Cursor |

**Implementation**: a `pluxx validate` / `pluxx build --strict` that runs per-target linters. This is probably the single highest-leverage thing for stopping "worked locally, broke on Codex" bugs.

---

## 4. Output styles — ⭐⭐

**Source**: Claude Code plugin primitive. `output-styles/*.md` in plugin root; `outputStyles` key in `plugin.json`. Let plugin authors ship a named "terse" / "kid-explainer" / "pr-reviewer" persona.

**Why Pluxx cares**: there's no direct equivalent in Codex/Cursor/OpenCode, but the *intent* (ship a curated response style) maps to:
- **Codex**: `model_instructions_file` + a "personality" (feature flag).
- **Cursor**: an Always rule that just sets tone.
- **OpenCode**: an agent with `prompt` set to the style.

**Scoring**: worth a thin adapter — CC users already expect this, and the fallback (emit an always-applied rule) is cheap.

---

## 5. LSP servers — ⭐⭐

**Source**: Claude Code only. `.lsp.json` or inline `lspServers` in `plugin.json`. Bundles gopls/pyright/rust-analyzer configuration so Claude sees diagnostics live.

**Why Pluxx cares**: if you're a plugin author shipping, say, a "Go accessibility kit," ignoring LSP leaves CC's biggest code-intelligence differentiator on the table. No portable fallback, but the CC output is high-value on its own.

**Scoring**: add to canonical schema; no-op in non-CC targets with a build-time note.

---

## 6. `bin/` executables (PATH-scoped helpers) — ⭐⭐

**Source**: Claude Code only. Files in `<plugin>/bin/` become invokable as bare commands in any Bash tool call while the plugin is enabled.

**Why Pluxx cares**: lots of authors bundle a CLI helper (Deepline-style). Pluxx already ships scripts — a tiny extension:
- CC: drop into `bin/`.
- Codex/Cursor/OpenCode: emit a README install step + symlink/install script.

**Scoring**: low effort, author-facing delight.

---

## 7. Monitors (background auto-arming tasks) — ⭐⭐

**Source**: Claude Code only. `monitors/monitors.json`. Auto-arms on session start or when a skill in the plugin is invoked. Polls / watches / schedules.

**Why Pluxx cares**: OpenCode equivalent is a `session.created` hook plus a Bun timer, Cursor can do `sessionStart` hook, Codex has `SessionStart` hook. So "monitor" is a portable concept even though only CC has a dedicated primitive.

**Scoring**: define canonical `monitors:` → CC native, others via generated hook with polling loop.

---

## 8. Channels (message injection — Telegram/Slack/Discord style) — ⭐⭐

**Source**: Claude Code only. `channels[]` in `plugin.json`, binds to an MCP server in the same plugin; `userConfig` nested per channel for bot tokens etc.

**Why Pluxx cares**: cross-tool this is "MCP server + hook that listens for remote messages." Canonical `channels:` + compile: CC native; other tools → MCP + `sessionStart` hook that polls or connects.

**Scoring**: niche but useful — agents-that-chat-back is a big use case.

---

## 9. Codex Apps (ChatGPT connectors) — ⭐⭐

**Source**: Codex only. `.app.json` alongside plugin, referenced from `plugin.json` `apps`. Distinct from MCP — these are ChatGPT's native connector graph (Gmail, GitHub, Slack etc.).

**Why Pluxx cares**: if an author wants "use Gmail" portable, Pluxx should:
- Codex: emit `apps` entry.
- CC/Cursor/OpenCode: emit equivalent MCP server (often `npx -y @google/gmail-mcp`).

**Scoring**: adapter is the interesting part. Declaring it once means Pluxx picks the best native surface per target.

---

## 10. Statuslines — ⭐

**Source**:
- Claude Code: `statusline` key in settings; `subagentStatusLine` in plugin `settings.json`.
- Codex: `/statusline` command + `tui` section of `config.toml`.
- OpenCode: `tui.json` for theme.

**Why Pluxx cares**: marginal for shipping plugins, but plugin authors sometimes want to override the status line to announce plugin state. Document + pass-through.

---

## 11. Profiles — ⭐

**Source**: Codex only. `[profiles.<name>]` in `config.toml`. Named presets for model / effort / approval. Not a plugin-shipped thing, but a plugin *consumer* often wants "run with this plugin under `deep-review` profile."

**Why Pluxx cares**: mostly documentation. Possibly a `pluxx use <target> --profile <name>` wrapper that patches `config.toml` with the right defaults.

---

## 12. Plugin data dir / persistent state — ⭐⭐

**Source**:
- Claude Code: `${CLAUDE_PLUGIN_DATA}` → `~/.claude/plugins/data/<id>/`, survives updates.
- OpenCode: npm cache at `~/.cache/opencode/node_modules/`.
- Codex / Cursor: no explicit persistent data dir.

**Why Pluxx cares**: if a plugin installs `node_modules`, a Python venv, or a SQLite cache, you want it to survive updates. Canonical `pluxxDataDir` → CC `${CLAUDE_PLUGIN_DATA}`; Codex/Cursor/OpenCode → conventional `~/.<tool>/pluxx/<plugin-id>/` with install hook.

**Scoring**: important for anything beyond pure-text skills.

---

## 13. Marketplace metadata generation — ⭐⭐⭐

**Source**:
- Claude Code: `.claude-plugin/marketplace.json` — rich (sources: `github`, `url`, `git-subdir`, `npm`, relative; `strict` mode; `sha` pinning).
- Codex: `.agents/plugins/marketplace.json` (local, "public publishing coming soon").
- Cursor: no plugin marketplace; MCP marketplace is separate and web-only.
- OpenCode: none — npm distribution.

**Why Pluxx cares**: Pluxx can auto-emit marketplace entries for each target so authors don't hand-maintain them. Especially valuable now that `publish` is in scope (per `TODO.md` PLUXX-66).

**Scoring**: prime candidate — one `pluxx publish` that writes CC marketplace entry + Codex marketplace entry + npm `package.json` for OpenCode + CC installation snippet.

---

## 14. Worktree isolation — ⭐

**Source**: Claude Code `isolation: "worktree"` on subagents + `WorktreeCreate`/`WorktreeRemove` hooks. Codex has sandbox modes but not worktrees.

**Why Pluxx cares**: already reachable if Pluxx supports agent frontmatter. Just document that it's CC-only; don't abstract.

---

## 15. Agent teams (Claude Code) — ⭐

**Source**: Claude Code `agent-teams` doc — multi-session coordination, distinct from single-session subagents. Managed via `TeammateIdle`, `TaskCreated`, `TaskCompleted` hooks.

**Why Pluxx cares**: if a plugin ships a "team" (implementer + reviewer + tester), no portable analogue. CC-only; document.

---

## 16. Cloud / background agents — ⭐

**Source**: Cursor Cloud Agents, Claude Code `background: true` frontmatter, OpenCode `is_background`.

**Why Pluxx cares**: partial overlap. Add a `background: true` field on the agent schema and compile per target. Easy win.

---

## 17. Keybindings / themes — ⛔

User-level UX, not plugin-distributable. Skip.

---

## 18. Custom model providers — ⛔

User-level config (API keys, endpoints). Not something a plugin author ships in 99% of cases. Skip.

---

## 19. Auto memory / MEMORY.md — ⛔

Machine-local and agent-written. Plugin authors don't seed this. Skip.

---

## 20. Sandbox modes — ⛔

Environment-level policy, not plugin-shipped. Codex's `sandbox_mode` is a user/admin choice; document as a README recommendation per-target, don't model it.

---

## Priority queue for Pluxx roadmap

| Rank | Primitive | Why now |
|---|---|---|
| 1 | **`userConfig` canonical** | Every MCP-using plugin needs it; unlocks install UX parity |
| 2 | **Permission rules canonical** | Today's pain point — authors duplicate allow/deny rules per target |
| 3 | **Build-time cap validation** | Cheap to implement; stops silent breakage (especially Codex 32 KiB + OpenCode 1,024-char) |
| 4 | **Marketplace entry codegen** | Pairs with PLUXX-66 release-confidence work |
| 5 | **Output styles + LSP + bin/** | CC-native polish; no-ops elsewhere |
| 6 | **Monitors + Channels** | Cross-compile via hooks+MCP; unlocks "always-on" plugins |
| 7 | **Apps (Codex)** | Needed to advertise Gmail/GitHub-style integrations portably |
| 8 | **Plugin data dir** | Needed before shipping anything with native deps |
| 9 | **Statuslines, background-agent flag** | Nice-to-have, low cost |

## Primitives to explicitly punt

`keybindings`, `themes`, `custom model providers`, `auto-memory`, `sandbox_mode` — all user/admin scope, not plugin-author scope. Document in "what Pluxx does NOT handle" to keep the mental model clean.

---

## Suggested schema additions (sketch)

```ts
// pluxx.config.ts excerpt

defineConfig({
  // existing
  name, version, skills, commands, agents, hooks, mcpServers, instructions,

  // additions
  userConfig: {
    API_KEY: { description: "Your API key", sensitive: true }
  },
  permissions: {
    allow: ["Bash(git status)"],
    deny:  ["Bash(rm -rf *)"]
  },
  outputStyles: ["./styles/terse.md"],
  lsp: {
    go: { command: "gopls", args: ["serve"], extensionToLanguage: { ".go": "go" } }
  },
  bin: ["./bin/deepline"],
  monitors: [{ type: "poll", interval: 300, script: "./scripts/watch.sh" }],
  channels: [{ server: "telegram", userConfig: { bot_token: { sensitive: true } } }],
  apps: ["gmail", "github"],           // resolves to Codex apps or equivalent MCP servers
  dataDir: "pluxx-cache",              // survives plugin updates
  background: false,                   // default agent mode
})
```

Every new field has a well-defined compile target (or a documented no-op) per the 4 tools covered in `00-matrix.md`.
