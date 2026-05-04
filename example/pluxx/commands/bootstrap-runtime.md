---
description: Install, upgrade, or verify the local Pluxx CLI runtime before deeper plugin work
argument-hint: "[version or install mode optional]"
---

Use the Pluxx runtime bootstrap workflow.

Arguments: $ARGUMENTS

## What To Do

1. Use the `pluxx-bootstrap-runtime` skill.
2. Check whether local `pluxx` is already available.
3. If it is missing or stale, explain the smallest safe next command:
   - `pluxx upgrade`
   - `pluxx upgrade --version x.y.z`
   - or `npm install -g @orchid-labs/pluxx@latest`
4. Explain when `npx @orchid-labs/pluxx` is the better fallback.
5. Return the current runtime state and the exact next command.
