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
- Codex: do not pretend plugin parity exists; warn and document external/runtime config as the real enforcement path.
- Cursor: compile canonical rules into generated hook decisions across `preToolUse`, `beforeShellExecution`, `beforeReadFile`, and `beforeMCPExecution`.
- OpenCode: compile coarse tool-level rules into native agent `permission`; warn when fine-grain selectors are downgraded.

## Current Mapping Contract

| Host | Current generated output | Notes |
|---|---|---|
| Claude Code | `hooks/pluxx-permissions.mjs` + `hooks/hooks.json` `PreToolUse` | Full canonical `allow/ask/deny` decisions flow through generated hook output. |
| Cursor | `hooks/pluxx-permissions.mjs` + hook entries for tool/shell/read/MCP interception | This is the main portable enforcement path outside Claude. |
| Codex | `.codex/permissions.generated.json` mirror artifact | `pluxx lint` warns that enforcement still lives in Codex runtime/admin config or external hooks. |
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
- `permissions-skill-selector-limited` when `Skill(...)` selectors must degrade on non-Claude hosts
- `permissions-opencode-downgrade` when OpenCode falls back to coarse tool permissions

## Decision

Adopt `permissions.{allow,ask,deny}` as the canonical schema for this slice, with explicit per-host downgrade/fallback behavior and warnings for non-portable precision.
