# Canonical Permissions Model (Primary Hosts)

Issue: `PLUXX-117`

## Goal

Define the smallest truthful permissions contract Pluxx owns across Claude Code, Codex, Cursor, and OpenCode.

## Recommendation

Keep a portable 3-state model in schema:

- `allow`
- `ask`
- `deny`

Recommended config shape:

```ts
permissions?: {
  allow?: PermissionRule[]
  ask?: PermissionRule[]
  deny?: PermissionRule[]
}

type PermissionRule = string
```

Use a canonical string DSL so plugin authors express intent once:

- `Bash(<command-pattern>)`
- `Edit(<path-glob>)`
- `Read(<path-glob>)`
- `MCP(<server>.<tool>|<server>.*)`
- `Skill(<name-pattern>)`

Examples:

```ts
permissions: {
  allow: ["Bash(git status)", "Bash(git diff)", "Read(src/**)"],
  ask: ["Bash(git commit *)", "MCP(linear.*)"],
  deny: ["Bash(rm -rf *)", "Edit(.env)"]
}
```

## Primary Host Inventory

| Host | Native permission surface | Coverage vs canonical model |
|---|---|---|
| Claude Code | Native permission rules and hook decisions (`allow/ask/deny`) | Strong native match |
| Codex | Approval/sandbox policy and optional hook decisions; policy is mostly user/admin config | Partial (native for coarse policy, hooks for fine rules) |
| Cursor | Hook-based decisions (`allow/ask/deny`) in `preToolUse`/`beforeShellExecution` | Hook fallback required |
| OpenCode | Agent `permission` map (`allow/ask/deny` per tool) | Partial (tool-level native; fine-grain needs hooks) |

## Compilation Strategy

- Claude Code: compile canonical rules into a generated `PreToolUse` permission hook.
- Codex: do not pretend plugin parity exists; keep external/runtime config as the real enforcement path, but generate `.codex/config.generated.toml` for the live-proven top-level MCP allow-path when Pluxx can materialize per-tool approval stanzas. Also treat Codex custom agents as inheriting root MCP by default unless you intentionally move MCP into an agent-local native shape.
- Cursor: compile canonical rules into generated hook decisions across `preToolUse`, `beforeShellExecution`, `beforeReadFile`, and `beforeMCPExecution`.
- OpenCode: compile coarse tool-level rules into native agent `permission`; warn when fine-grain selectors are downgraded.

## Current Mapping Contract

| Host | Current generated output | Notes |
|---|---|---|
| Claude Code | `hooks/pluxx-permissions.mjs` + `hooks/hooks.json` `PreToolUse` | Full canonical `allow/ask/deny` decisions flow through generated hook output. |
| Cursor | `hooks/pluxx-permissions.mjs` + hook entries for tool/shell/read/MCP interception | This is the main portable enforcement path outside Claude. |
| Codex | `.codex/permissions.generated.json` mirror artifact + optional `.codex/config.generated.toml` starter snippet | `pluxx lint` still warns that enforcement lives in active Codex runtime/admin config or external hooks, materializes the live-proven MCP allow-path as per-tool `approval_mode = "approve"` TOML when top-level canonical rules are concrete enough, and now also warns when canonical `agents/` plus root MCP config would rely on inherited agent MCP with no documented reliable opt-out, including the locally proven `mcp_servers = {}` custom-agent ceiling. |
| OpenCode | Native `config.permission` map in generated plugin wrapper | Tool-level only; path- and argument-specific selectors are intentionally downgraded, and `Skill(...)` rules stay docs-only there. |

## Unsupported or Docs-Only Combinations

These should be explicit in docs and validator warnings, not expanded into canonical schema:

- Host runtime policy knobs (`sandbox_mode`, global `approval_policy`, enterprise allowlists).
- Conditional rules based on session state/user identity/time.
- Guarantees of identical prompt UX across hosts for `ask`.
- Fine argument/path matching on hosts that only support tool-level native permissions.

## Schema vs Docs Boundary

Belongs in schema:

- Author intent: `allow` / `ask` / `deny` rules.
- Portable rule selectors (Bash/Edit/Read/MCP/Skill).

Belongs in docs-only guidance:

- Host-specific policy hardening profiles.
- Codex MCP approval materialization caveats, including wildcard expansion limits when `.pluxx/mcp.json` tool inventory is unavailable or ambiguous.
- Enterprise/admin controls and managed settings.
- UX caveats when a host can only emulate a rule via hooks.

## Validation Guidance

Add validator coverage for compile downgrades:

- Rule downgraded from argument/path-level to tool-level.
- Rule requiring hooks on a target where hooks are disabled/unavailable.
- Ambiguous rule ordering conflicts (`deny` should always win).
- Duplicate rules inside the same permission bucket.

## Current Lint Coverage

Config validation and `pluxx lint` currently surface:

- `config-invalid` if a rule does not use canonical `Tool(pattern)` syntax
- `permissions-duplicate` for duplicate rules in the same bucket
- `permissions-conflict` when the same selector lands in multiple actions
- `codex-permissions-external-config` when Codex is a target
- `codex-agent-mcp-inheritance` when a Codex target combines canonical `agents/` plus root MCP config and would otherwise imply least-privilege agent isolation that current Codex does not document; maintained local proof now includes an explicit `mcp_servers = {}` custom-agent scenario that still inherited approved root MCP
- `permissions-skill-selector-limited` when `Skill(...)` selectors must degrade on non-Claude hosts
- `permissions-opencode-downgrade` when OpenCode falls back to coarse tool permissions

## Decision

Adopt `permissions.{allow,ask,deny}` as the canonical schema for this slice, with explicit per-host downgrade/fallback behavior and warnings for non-portable precision.
