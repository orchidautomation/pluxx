# Permissions Mapping

Pluxx supports a canonical `permissions` primitive:

```ts
permissions: {
  allow: ["Bash(git status)"],
  ask: ["Bash(git commit *)"],
  deny: ["Bash(rm -rf *)"],
}
```

Each rule should use `Tool(pattern)` format.

## Current Mapping Contract

- `claude-code`
  - emits `permissions.allow[]` and `permissions.deny[]` into `.claude-plugin/plugin.json`
  - does not emit `ask` (Claude manifest permissions are allow/deny)
- `cursor`
  - no direct generated mapping yet
  - enforce with hook-based policy (`preToolUse`) until mapping is implemented
- `codex`
  - no direct generated mapping yet
  - configure runtime approval and permission rules in Codex config
- `opencode`
  - no direct generated mapping yet
  - configure per-agent `permission` blocks directly in OpenCode plugin code

## Lint Coverage

`pluxx lint` now validates canonical permission contracts:

- `permission-rule-conflict` when the same rule appears in both `allow` and `deny`
- `permission-rule-redundant-ask` when the same rule appears in `ask` and another bucket
- `permission-rule-duplicate` when a bucket contains duplicate rules
- `permission-rule-format` when a rule is not in `Tool(pattern)` form
- target warnings when a selected platform has no direct mapping yet:
  - `permission-ask-unsupported-claude-code`
  - `permission-unmapped-cursor`
  - `permission-unmapped-codex`
  - `permission-unmapped-opencode`
