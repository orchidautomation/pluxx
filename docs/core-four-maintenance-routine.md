# Core-Four Maintenance Routine

Last updated: 2026-04-23

## Doc Links

- Role: repeatable maintainer routine for host truth, proof, docs, and release decisions
- Related:
  - [docs/core-four-provider-docs-audit.md](./core-four-provider-docs-audit.md)
  - [docs/core-four-install-update-lifecycle.md](./core-four-install-update-lifecycle.md)
  - [docs/compatibility.md](./compatibility.md)
  - [docs/core-four-primitive-matrix.md](./core-four-primitive-matrix.md)
  - [docs/todo/queue.md](./todo/queue.md)
  - [docs/todo/success-checklist.md](./todo/success-checklist.md)
- Update together:
  - [docs/core-four-provider-docs-audit.md](./core-four-provider-docs-audit.md)
  - [docs/core-four-install-update-lifecycle.md](./core-four-install-update-lifecycle.md)
  - [docs/compatibility.md](./compatibility.md)
  - [docs/core-four-primitive-matrix.md](./core-four-primitive-matrix.md)
  - [docs/todo/queue.md](./todo/queue.md)
  - [docs/todo/success-checklist.md](./todo/success-checklist.md)

Use this doc as the repeatable maintenance loop for the core four:

- Claude Code
- Cursor
- Codex
- OpenCode

This is the routine that keeps Pluxx from drifting back into:

- stale host assumptions
- stale proof
- stale lifecycle guidance
- stale release decisions

## When To Run This Routine

Run this routine when any of these happen:

- a host ships a meaningful plugin, skills, hooks, MCP, or lifecycle change
- Pluxx changes the machine-readable platform rules
- install/update behavior changes in a host UI or official docs
- the flagship proof surfaces change
- the self-hosted Pluxx plugin changes materially
- the team is considering a release

## The Routine

### 1. Re-audit official host docs

Read or refresh the first-party docs for:

- plugins
- skills
- commands
- agents or subagents
- hooks
- MCP
- instructions or rules
- install/update/reload behavior

Record any meaningful changes in:

- [docs/core-four-provider-docs-audit.md](./core-four-provider-docs-audit.md)

### 2. Update the machine-readable rules first

Apply the audit to:

- [src/validation/platform-rules.ts](../src/validation/platform-rules.ts)

Do this before touching summary docs.

The repo should derive compatibility truth from the rules file, not the other way around.

### 3. Regenerate and refresh the compatibility docs

After the rules change:

- regenerate [docs/compatibility.md](./compatibility.md)
- update [docs/core-four-primitive-matrix.md](./core-four-primitive-matrix.md) if the conceptual mapping changed
- update [docs/core-four-install-update-lifecycle.md](./core-four-install-update-lifecycle.md) if install/update/reload behavior changed

### 4. Rerun proof

Rerun the relevant proof surfaces:

- self-hosted Pluxx plugin across the core four
- flagship `docs-ops` proof where applicable
- install/update flows if lifecycle behavior changed

Capture any real friction as:

- product gap
- intentional degrade
- docs clarification
- release blocker

### 5. Refresh user-facing docs

If the compatibility truth or proof changed, refresh:

- high-traffic docs like [docs/how-it-works.md](./how-it-works.md)
- host-facing operator docs like [docs/use-pluxx-in-host-agents.md](./use-pluxx-in-host-agents.md)
- planning docs if the change alters what matters next

### 6. Update planning and Linear if the change matters strategically

If the change affects:

- product truth
- proof state
- release readiness
- priority order

then update:

- [docs/start-here.md](./start-here.md)
- [docs/todo/queue.md](./todo/queue.md)
- [docs/todo/master-backlog.md](./todo/master-backlog.md)
- [docs/roadmap.md](./roadmap.md)
- the relevant Linear issue or project

### 7. Make the release decision deliberately

After the audit and proof rerun, decide explicitly:

- release now
- release after one short fix block
- no release yet

The release decision should be based on:

- host truth
- proof quality
- install/update clarity
- public docs coherence

not just the number of changes merged.

## Expected Outputs

A healthy run of this routine should leave:

- the provider audit current
- the platform rules current
- the generated compatibility doc current
- the primitive matrix current
- the lifecycle matrix current
- the flagship proof state understood
- the planning docs updated if priorities changed
- a clear release or no-release decision

## Short Version

The maintenance loop is:

```text
official host docs
  ->
provider audit
  ->
platform rules
  ->
compatibility + lifecycle docs
  ->
proof rerun
  ->
planning refresh
  ->
release decision
```

If Pluxx keeps doing that consistently, the product story stays truthful even while the hosts move underneath it.
