# Self-Hosted Pluxx Core-Four Proof

Last updated: 2026-04-23

## Doc Links

- Role: concrete local proof that the self-hosted Pluxx plugin builds, installs, and verifies across the core four
- Related:
  - [docs/start-here.md](./start-here.md)
  - [docs/todo/queue.md](./todo/queue.md)
  - [docs/todo/success-checklist.md](./todo/success-checklist.md)
  - [docs/roadmap.md](./roadmap.md)
  - [docs/pluxx-plugin-surface-audit.md](./pluxx-plugin-surface-audit.md)
  - [docs/core-four-install-update-lifecycle.md](./core-four-install-update-lifecycle.md)
  - [docs/use-pluxx-in-host-agents.md](./use-pluxx-in-host-agents.md)
- Update together:
  - [docs/start-here.md](./start-here.md)
  - [docs/todo/queue.md](./todo/queue.md)
  - [docs/todo/success-checklist.md](./todo/success-checklist.md)
  - [docs/roadmap.md](./roadmap.md)

Use this doc when you want the shortest concrete answer to:

- did the canonical self-hosted plugin source project really work across all four hosts
- what exact commands were run
- what did that proof actually establish

This is the self-hosted Pluxx plugin proof.

It is not the same thing as the flagship Docs Ops proof.

## Source Project Under Test

The canonical source project used for this rerun was:

- `example/pluxx`

That source project targets:

- Claude Code
- Cursor
- Codex
- OpenCode

## Public Command Sequence

If a normal user wanted to run the same sequence with an installed CLI, the shape would be:

```bash
pluxx doctor
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

`doctor` passed.

`build` succeeded for:

- `claude-code`
- `cursor`
- `codex`
- `opencode`

All four `verify-install` checks passed after install.

## Host Result Matrix

| Host | Installed bundle path | Result | Pickup guidance |
| --- | --- | --- | --- |
| Claude Code | `~/.claude/plugins/data/pluxx-local-pluxx/plugins/pluxx -> example/pluxx/dist/claude-code` | PASS | run `/reload-plugins` if Claude is already open |
| Cursor | `~/.cursor/plugins/local/pluxx -> example/pluxx/dist/cursor` | PASS | use `Developer: Reload Window` or restart Cursor |
| Codex | `~/.codex/plugins/pluxx -> example/pluxx/dist/codex` | PASS | use `Plugins > Refresh` if present, otherwise restart Codex |
| OpenCode | `~/.config/opencode/plugins/pluxx -> example/pluxx/dist/opencode` plus `~/.config/opencode/plugins/pluxx.ts` | PASS | restart or reload OpenCode |

## Important Note About Codex

Codex initially passed `verify-install`, but it was still pointing at the previously installed published `pluxx-plugin` bundle.

That was corrected by rerunning:

```bash
node ../../bin/pluxx.js install --target codex --trust
```

After that, Codex was also pointed at:

- `example/pluxx/dist/codex`

That matters because this proof is specifically about the canonical source project, not a prior release artifact.

## What This Proves

- the maintained self-hosted source project in `example/pluxx` still compiles cleanly to the core four
- `pluxx install` still writes host-appropriate local install state for the core four
- `pluxx verify-install` is a real consumer-facing check, not just a paper feature
- the current install/update/reload guidance in [docs/core-four-install-update-lifecycle.md](./core-four-install-update-lifecycle.md) matches observed local behavior closely enough to use as product guidance

## What This Does Not Prove

- it does not replace the flagship Docs Ops proof
- it does not prove polished public distribution UX yet
- it does not prove automatic update behavior inside every host
- it does not replace a fuller pre-release smoke pass that exercises richer in-host interaction, screenshots, and public-facing install docs

## Why This Matters

The self-hosted plugin lane should now be treated as:

- mechanically real across the core four
- past the “does this install path basically work” stage
- ready to focus on polish, distribution UX, metadata, and release automation

That changes the next best work.

The remaining plugin-specific gap is no longer basic cross-host installation proof.

It is making the install surface feel excellent.
