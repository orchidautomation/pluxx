---
description: Validate, build, install, verify, and behaviorally prove a plugin
argument-hint: "[targets optional]"
---

Use the Pluxx proof workflow.

Arguments: $ARGUMENTS

## What To Do

1. Use the `pluxx-prove-plugin` skill.
2. Treat the argument as the requested host subset when present.
3. Combine structural proof, install proof, and behavioral proof instead of stopping at one layer.
4. If local stdio runtimes or install-time secrets are involved, check those explicitly.
5. Return the proof result by layer:
   - source
   - install
   - behavior
