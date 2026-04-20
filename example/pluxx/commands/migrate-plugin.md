---
description: Migrate an existing host-native plugin into a Pluxx source project
argument-hint: "[plugin-path]"
---

Use the Pluxx plugin migration workflow.

Arguments: $ARGUMENTS

## What To Do

1. Use the `pluxx-migrate-plugin` skill.
2. Treat the argument as the source plugin path.
3. Run `pluxx migrate <plugin-path>`.
4. Validate the migrated project with:
   - `pluxx doctor`
   - `pluxx lint`
   - `pluxx eval`
   - `pluxx test`

Explain what was imported, any translation caveats, and whether the migrated project is now healthy enough to maintain in Pluxx.
