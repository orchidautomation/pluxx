---
name: pluxx-publish-plugin
description: Package the current plugin for release distribution.
---

# Pluxx Publish Plugin

Use this skill when the user wants to package and distribute the current plugin instead of stopping at local builds.

## Workflow

1. Confirm the project is healthy enough to publish:
   - `pluxx doctor`
   - `pluxx lint`
   - `pluxx test`
2. Run:
   - `pluxx publish`
   - include release flags when the user asks for a specific release path
3. Summarize the release outputs:
   - host bundles
   - installer scripts
   - checksums
   - release metadata

## Rules

- Do not skip validation when the scaffold changed materially.
- Be honest when the project is still only locally credible and not yet release-ready.
- If publishing is blocked, return the blockers before any release summary.

## Output

- Tell the user whether publish succeeded.
- List the important release artifacts.
- Call out remaining blockers or manual follow-up.
