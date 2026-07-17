---
name: pluxx-build-install
description: Build installable plugins from a Pluxx scaffold and optionally install one.
---

# Pluxx Build Install

Use this skill when the user is ready to turn the current Pluxx source project into host-native bundles and test one or more targets locally.

## Workflow

1. Prefer `pluxx test --install` when the user wants the strongest deterministic local proof in one command.
2. Otherwise, if the scaffold has changed materially, validate first:
   - `pluxx doctor`
   - `pluxx lint`
   - `pluxx test`
3. Build the requested targets:
   - `pluxx build`
   - or `pluxx build --target <platforms...>`
4. Install only when the user wants local testing:
   - `pluxx install --target <platforms...>`
   - add `--trust` when the plugin defines hook commands and the user has opted in
5. If a host still looks wrong after install, use:
   - `pluxx doctor --consumer <installed-path>`
6. For release installers with expensive platform-native dependencies, consider the source-config primitive:
   - `sharedRuntime.bootstrap`: the bundle-relative deterministic bootstrap script
   - `sharedRuntime.inputs`: every bundle-relative file that can change the runtime output
   - `sharedRuntime.output`: the generated directory, commonly `node_modules`
   - use it only when output is deterministic from those inputs plus OS, architecture, and Node ABI
7. Tell the user what was built and what was installed.

## Rules

- Prefer target subsets when the user only cares about one host.
- Do not hide trust requirements for hook-enabled installs.
- Remind the user about host-specific reload steps when they matter.
- Never hand-edit `dist/`; rebuild instead.
- A shared-runtime lock timeout or unavailable symlink deliberately falls back to host-local bootstrap; report that fallback, but do not classify a successful install as failed.

## Output

- Say which targets were built.
- Say which targets were installed.
- Call out any remaining manual reload or trust steps.
