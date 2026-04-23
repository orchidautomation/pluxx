# Docs Ops Core-Four Proof

Last updated: 2026-04-23

## Doc Links

- Role: concrete proof that the flagship `docs-ops` source project builds, installs, and verifies across the core four
- Related:
  - [docs/start-here.md](./start-here.md)
  - [docs/todo/queue.md](./todo/queue.md)
  - [docs/todo/success-checklist.md](./todo/success-checklist.md)
  - [docs/roadmap.md](./roadmap.md)
  - [docs/flagship-docs-ops-plugin.md](./flagship-docs-ops-plugin.md)
  - [docs/proof-and-install.md](./proof-and-install.md)
  - [docs/orchid-docs-ops-codex-walkthrough.md](./orchid-docs-ops-codex-walkthrough.md)
  - [docs/core-four-install-update-lifecycle.md](./core-four-install-update-lifecycle.md)
  - [example/docs-ops/ORCHID-READONLY-DEMO.md](../example/docs-ops/ORCHID-READONLY-DEMO.md)
- Update together:
  - [docs/start-here.md](./start-here.md)
  - [docs/todo/queue.md](./todo/queue.md)
  - [docs/todo/success-checklist.md](./todo/success-checklist.md)
  - [docs/roadmap.md](./roadmap.md)
  - [docs/flagship-docs-ops-plugin.md](./flagship-docs-ops-plugin.md)

Use this doc when you want the shortest concrete answer to:

- did the flagship `docs-ops` source project really build, install, and pass `verify-install` across all four hosts
- what exact commands were run
- what this proves beyond the narrower live Codex walkthrough

This is the flagship mechanical core-four proof.

It is not the same thing as the user-facing Codex workflow proof.

## Source Project Under Test

The source project used for this rerun was:

- `example/docs-ops`

That source project targets:

- Claude Code
- Cursor
- Codex
- OpenCode

Its live public MCP backend is:

- `https://orchid-docs.docsalot.dev/api/mcp`

## Public Command Sequence

If a normal user wanted to rerun the same proof with an installed CLI, the shape would be:

```bash
pluxx doctor
pluxx lint
pluxx build

pluxx install --target claude-code --trust
pluxx install --target cursor --trust
pluxx install --target codex --trust
pluxx install --target opencode --trust

pluxx verify-install --target claude-code
pluxx verify-install --target cursor
pluxx verify-install --target codex
pluxx verify-install --target opencode
```

## Maintainer Commands Actually Run In This Repo

Because this proof was run from the Pluxx monorepo against the checked-out local CLI, the commands actually executed were:

```bash
node ../../bin/pluxx.js doctor
node ../../bin/pluxx.js lint
node ../../bin/pluxx.js build

node ../../bin/pluxx.js install --target claude-code --trust
node ../../bin/pluxx.js install --target cursor --trust
node ../../bin/pluxx.js install --target codex --trust
node ../../bin/pluxx.js install --target opencode --trust

node ../../bin/pluxx.js verify-install --target claude-code
node ../../bin/pluxx.js verify-install --target cursor
node ../../bin/pluxx.js verify-install --target codex
node ../../bin/pluxx.js verify-install --target opencode
```

## Result

`doctor` passed with the expected trust warning because the example still defines a hook-oriented surface.

`lint` reported:

- `0` errors
- `13` warnings

Those warnings are the honest cross-host translation story, not a failure:

- Cursor weakens richer skill frontmatter such as `arguments`, `context`, `agent`, and `allowed-tools`
- Codex keeps hook intent but emits it as external hook guidance instead of a fully bundled native hook surface

`build` succeeded for:

- `claude-code`
- `cursor`
- `codex`
- `opencode`

All four `verify-install` checks passed after install.

## Host Result Matrix

| Host | Installed bundle path | Result | Pickup guidance |
| --- | --- | --- | --- |
| Claude Code | `~/.claude/plugins/data/pluxx-local-docs-ops/plugins/docs-ops` | PASS | run `/reload-plugins` if Claude is already open |
| Cursor | `~/.cursor/plugins/local/docs-ops` | PASS | use `Developer: Reload Window` or restart Cursor |
| Codex | `~/.codex/plugins/docs-ops` | PASS | use `Plugins > Refresh` if present, otherwise restart Codex |
| OpenCode | `~/.config/opencode/plugins/docs-ops` | PASS | reload or restart OpenCode |

## What This Proves

- the flagship `docs-ops` example is not only a Codex-specific curiosity; it now has a real core-four build/install/verify proof
- the live Orchid Docsalot MCP wiring survives the host-native compilation path across all four targets
- the current install/update/reload guidance in [docs/core-four-install-update-lifecycle.md](./core-four-install-update-lifecycle.md) matches observed local behavior well enough to use as product guidance
- the current degrade story is visible in practice:
  - Cursor weakens some richer skill semantics
  - Codex separates hook packaging from the installed plugin bundle
- the flagship lane is now past the basic “does this even install outside Codex?” stage

## Observed Preserve / Translate / Degrade Snapshot

This example now shows the high-level bucket mapping clearly enough to use as a real proof surface:

| Bucket | Claude Code | Cursor | Codex | OpenCode |
| --- | --- | --- | --- | --- |
| Instructions | preserve | preserve | preserve | translate |
| Commands | preserve | preserve | degrade | preserve |
| Hooks | preserve | preserve | translate | translate |
| Distribution | translate | preserve | preserve | translate |

Concrete examples from this rerun:

- Cursor preserves the workflow taxonomy, but degrades richer skill frontmatter like `arguments`, `context`, `agent`, and `allowed-tools`
- Codex preserves the installed plugin and operator pack, but translates hook behavior into external Codex hook guidance and weakens command semantics compared with richer slash-command hosts
- OpenCode preserves the docs-ops operator pack, but relies on more config/runtime translation around instructions, hooks, and distribution

That is the honest current claim:

- the flagship example now demonstrates preserve / translate / degrade behavior materially
- the user-facing story can still be clearer and more visual

## What This Does Not Prove

- it does not replace the live user-facing Codex workflow proof in [docs/orchid-docs-ops-codex-walkthrough.md](./orchid-docs-ops-codex-walkthrough.md)
- it does not yet prove the same obvious inspect / pull / rewrite workflow inside Claude Code, Cursor, and OpenCode
- it does not prove the private authenticated write/publish path yet
- it does not replace a cleaner visual public demo asset for the flagship example

## Why This Matters

The `docs-ops` proof stack is now more honest and more useful:

- [example/docs-ops/ORCHID-READONLY-DEMO.md](../example/docs-ops/ORCHID-READONLY-DEMO.md)
  - proves the live Orchid public Docsalot MCP surface and the first real rewrite opportunity
- [docs/docs-ops-core-four-proof.md](./docs-ops-core-four-proof.md)
  - proves the flagship source project builds, installs, and verifies across Claude Code, Cursor, Codex, and OpenCode
- [docs/orchid-docs-ops-codex-walkthrough.md](./orchid-docs-ops-codex-walkthrough.md)
  - proves one host-native live workflow end to end in Codex

That means the next best flagship work is no longer basic cross-host installation proof.

It is:

- repeat the user-facing workflow proof in Claude Code, Cursor, and OpenCode
- document the preserve / translate / degrade behavior more clearly in this example
- separate and test the authenticated write/publish path
