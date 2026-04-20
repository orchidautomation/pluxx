---
name: pluxx-migrate-plugin
description: Bring an existing Claude, Cursor, Codex, or OpenCode plugin into Pluxx.
---

# Pluxx Migrate Plugin

Use this skill when the user already has a host-native plugin and wants to convert it into a canonical Pluxx project instead of rewriting it by hand.

## Workflow

1. Identify the source plugin:
   - local path
   - current host shape
   - any local runtime folders or auth assumptions
2. Run the migration:
   - `pluxx migrate <plugin-path>`
3. Inspect the generated source project:
   - `pluxx.config.ts`
   - `INSTRUCTIONS.md`
   - `skills/*/SKILL.md`
   - `.pluxx/mcp.json`
4. Validate the migrated baseline:
   - `pluxx doctor`
   - `pluxx lint`
   - `pluxx eval`
   - `pluxx test`

## Rules

- Preserve the migrated project as the new source of truth instead of editing the old host-native plugin directly.
- Call out any host-native semantics that were translated, degraded, or dropped.
- Do not promise perfect parity when the source host used surfaces the other targets do not support directly.
- If the source plugin includes local runtimes or helper folders, verify they were carried into the Pluxx project correctly.

## Output

- Explain what was imported successfully.
- Call out any translation caveats.
- State whether the migrated project now validates and builds cleanly.
