---
name: pluxx-build-install
description: Use when the user wants to build native target outputs from a Pluxx scaffold and optionally install one or more of them locally for testing.
---

# Pluxx Build Install

Use this skill when the user is ready to turn the current Pluxx source project into host-native bundles and test one or more targets locally.

## Workflow

1. If the scaffold has changed materially, validate first:
   - `pluxx doctor`
   - `pluxx lint`
   - `pluxx test`
2. Build the requested targets:
   - `pluxx build`
   - or `pluxx build --target <platforms...>`
3. Install only when the user wants local testing:
   - `pluxx install --target <platforms...>`
   - add `--trust` when the plugin defines hook commands and the user has opted in
4. Tell the user what was built and what was installed.

## Rules

- Prefer target subsets when the user only cares about one host.
- Do not hide trust requirements for hook-enabled installs.
- Remind the user about host-specific reload steps when they matter.
- Never hand-edit `dist/`; rebuild instead.

## Output

- Say which targets were built.
- Say which targets were installed.
- Call out any remaining manual reload or trust steps.
