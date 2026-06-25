# Install Reference Syntax

Last updated: 2026-06-25

This document defines the parser-backed install reference contract for follow-on distribution work.

It does not mean `pluxx install <reference>` is shipped today. Current local installs still run from a Pluxx source project after build:

```bash
pluxx build
pluxx install --target codex
pluxx verify-install --target codex
```

The goal of install references is to give future install links, release assets, ownership records, and team distribution docs one short, stable identifier shape instead of ad hoc paths or package names.

## Syntax

```text
<scheme>:<locator>[@<version>][#<target>]
```

Supported schemes:

| Scheme | Purpose | Example | Current status |
|---|---|---|---|
| `local` | Local source or built bundle path | `local:../dist/codex#codex` | Parser-backed contract only; current CLI still uses source-project `pluxx install --target ...` |
| `github` | GitHub release-backed plugin bundle | `github:acme/docs-ops@v1.2.3#claude-code` | Parser-backed contract for release-link work |
| `npm` | npm package-backed plugin wrapper | `npm:@acme/docs-ops-opencode@1.2.3#opencode` | Parser-backed contract; closest current shipped lane is npm-backed OpenCode publishing |
| `team` | Reserved team-scoped distribution namespace | `team:acme/docs-ops@stable#cursor` | Reserved for future team distribution; not a hosted registry claim |

Targets use the normal Pluxx target slugs:

- `claude-code`
- `cursor`
- `codex`
- `opencode`
- beta target slugs are accepted by the parser, but they do not become release-smoked install fronts by syntax alone

## Rules

- The scheme is required.
- The locator is required.
- `github` and `team` locators use `<owner-or-team>/<plugin-or-repo>`.
- `npm` locators use npm package syntax, including scoped packages such as `@scope/name`.
- Version targeting is optional and uses the final `@`.
- Target selection is optional and uses `#<target>`.
- Scoped npm packages do not treat the leading `@scope` as a version.
- `team:` references are intentionally parseable but not installable until a later team distribution surface exists.

## Examples

```text
local:../dist/codex#codex
github:orchidautomation/docs-ops@v1.2.3#claude-code
npm:@orchid-labs/docs-ops-opencode@1.2.3#opencode
team:orchid/docs-ops@stable#cursor
```

## Non-Goals

This contract does not ship:

- marketplace submission APIs
- a private or paid registry
- team install authorization
- fleet rollout
- automatic rollback or prune behavior
- `pluxx install <reference>` as an executable install flow

Those are separate implementation slices. The reference parser only creates a shared, validated string contract they can build on.
