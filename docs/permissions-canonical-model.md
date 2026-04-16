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

- Claude Code: compile rules directly to native permission rules.
- Codex: compile fine-grained rules to hooks; document optional user/admin policy tuning (`approval_policy`, sandbox, prefix rules).
- Cursor: compile rules to hook matchers + `permission` decisions.
- OpenCode: compile tool-level rules to agent `permission`; use hook fallback when rule is argument/path specific.

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

Add lint warnings for compile downgrades:

- Rule downgraded from argument/path-level to tool-level.
- Rule requiring hooks on a target where hooks are disabled/unavailable.
- Ambiguous rule ordering conflicts (`deny` should always win).

## Decision

Adopt `permissions.{allow,ask,deny}` as the canonical schema for this slice, with explicit per-host downgrade/fallback behavior and warnings for non-portable precision.
