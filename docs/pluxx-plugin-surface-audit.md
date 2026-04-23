# Pluxx Plugin Surface Audit

## Doc Links

- Role: architecture and coverage audit for the self-hosted Pluxx plugin
- Related:
  - [docs/start-here.md](./start-here.md)
  - [docs/todo/queue.md](./todo/queue.md)
  - [docs/roadmap.md](./roadmap.md)
  - [docs/pluxx-self-hosted-core-four-proof.md](./pluxx-self-hosted-core-four-proof.md)
  - [docs/use-pluxx-in-host-agents.md](./use-pluxx-in-host-agents.md)
  - [docs/strategy/pluxx-plugin-operating-model.md](./strategy/pluxx-plugin-operating-model.md)
  - [docs/strategy/pluxx-plugin-distribution-strategy.md](./strategy/pluxx-plugin-distribution-strategy.md)
- Update together:
  - [docs/start-here.md](./start-here.md)
  - [docs/todo/queue.md](./todo/queue.md)
  - [docs/todo/master-backlog.md](./todo/master-backlog.md)
  - [docs/roadmap.md](./roadmap.md)

Use this doc when you want the blunt answer to:

- how the Pluxx plugin actually works
- what is in the plugin today
- how the plugin surface maps to the CLI today

## Short Answer

The Pluxx plugin is a thin operator layer over the Pluxx CLI.

It is not:

- a second compiler
- a hidden runtime fork
- a separate implementation of the Pluxx engine

The architecture is:

```text
user in Claude/Cursor/Codex/OpenCode
  ->
host-native Pluxx skill or command
  ->
agent follows the Pluxx workflow instructions
  ->
agent runs deterministic `pluxx ...` CLI commands
  ->
CLI writes and validates the actual project on disk
  ->
agent summarizes what happened
```

So the real execution engine is still:

- local `pluxx` on `PATH`
- or `npx @orchid-labs/pluxx`

## The Three Layers

### 1. Pluxx engine

This is the deterministic system of record.

Today that means the CLI in `@orchid-labs/pluxx`.

### 2. Pluxx plugin

This is the host-native operator surface.

Its job is to expose:

- good skills
- good commands where the host supports them
- polished prompts and metadata
- a clear routing layer into the CLI underneath

### 3. Canonical plugin source project

This is the maintained cross-host source of truth for the plugin itself:

- `example/pluxx`

That source project compiles to:

- Claude Code
- Cursor
- Codex
- OpenCode

The repo-local Codex dogfood surface is:

- `plugins/pluxx`

That local plugin is useful, but it is not the canonical source project.

## What The Plugin Contains Today

The self-hosted plugin now exposes twelve core workflows:

1. `pluxx-import-mcp`
2. `pluxx-migrate-plugin`
3. `pluxx-validate-scaffold`
4. `pluxx-prepare-context`
5. `pluxx-refine-taxonomy`
6. `pluxx-rewrite-instructions`
7. `pluxx-review-scaffold`
8. `pluxx-build-install`
9. `pluxx-verify-install`
10. `pluxx-sync-mcp`
11. `pluxx-autopilot`
12. `pluxx-publish-plugin`

In Codex, those are primarily exposed as:

- plugin metadata
- skills
- starter prompts

In hosts with command surfaces, the canonical source project also defines matching explicit commands:

- `/pluxx:autopilot`
- `/pluxx:build-install`
- `/pluxx:import-mcp`
- `/pluxx:migrate-plugin`
- `/pluxx:prepare-context`
- `/pluxx:publish-plugin`
- `/pluxx:validate-scaffold`
- `/pluxx:refine-taxonomy`
- `/pluxx:rewrite-instructions`
- `/pluxx:review-scaffold`
- `/pluxx:sync-mcp`
- `/pluxx:verify-install`

## How The Current Plugin Actually Works

The current plugin generally follows this model:

```text
host command or skill
  ->
Pluxx workflow instructions
  ->
run `pluxx ...` commands
  ->
summarize the result
```

For example:

- `pluxx-import-mcp`
  - runs `pluxx init --from-mcp ...`
  - then `pluxx doctor`
  - then `pluxx lint`
  - then `pluxx test`

- `pluxx-build-install`
  - runs `pluxx build`
  - optionally `pluxx install --target ...`

- `pluxx-refine-taxonomy`
  - runs `pluxx agent prepare`
  - then taxonomy prompt/runner commands
  - then `pluxx lint`
  - then `pluxx test`

So yes, the plugin is largely skills-and-commands orchestrating the CLI.

It is not mostly scripts orchestrating scripts.

## Coverage Audit

This is the important table.

| CLI surface | Plugin coverage today | Should it be first-class in the plugin? | Notes |
| --- | --- | --- | --- |
| `init --from-mcp` | Yes | Yes | Covered by `pluxx-import-mcp` |
| `migrate` | Yes | Yes | Covered by `pluxx-migrate-plugin` |
| `doctor` / `lint` / `eval` / `test` | Yes | Yes | Covered by `pluxx-validate-scaffold` |
| `agent prepare` + taxonomy pass | Yes | Yes | Covered by `pluxx-refine-taxonomy` |
| `agent prepare` + instructions pass | Yes | Yes | Covered by `pluxx-rewrite-instructions` |
| review pass | Yes | Yes | Covered by `pluxx-review-scaffold` |
| `build` + `install` | Yes | Yes | Covered by `pluxx-build-install` |
| `verify-install` | Yes | Yes | Covered by `pluxx-verify-install` |
| `sync` | Yes | Yes | Covered by `pluxx-sync-mcp` |
| `publish` | Yes | Yes | Covered by `pluxx-publish-plugin` |
| `autopilot` | Yes | Yes | Covered by `pluxx-autopilot` |
| docs/website ingestion / `agent prepare` as a standalone workflow | Yes | Yes | Covered by `pluxx-prepare-context` |
| `doctor --consumer` | Indirect only | Maybe | Valuable as a troubleshooting workflow after install |
| `uninstall` | No | Maybe | Useful but not urgent for the plugin’s first polished operator surface |
| `mcp proxy --record/--replay` | No | Probably not by default | Useful maintainer/debug flow, but not core plugin UX |
| `dev` | No | No | Maintainer workflow, not product workflow |

## What Changed

The plugin workflow coverage gap is now closed across the maintained source project and the repo-local Codex dogfood plugin.

That means the plugin surface now covers the full modern Pluxx lifecycle:

- import
- migrate
- validate
- prepare context
- refine
- rewrite
- review
- build
- install
- verify
- sync
- autopilot
- publish

The latest local build/install/verify rerun across Claude Code, Cursor, Codex, and OpenCode is documented in:

- [docs/pluxx-self-hosted-core-four-proof.md](./pluxx-self-hosted-core-four-proof.md)

## Remaining Thin Spots

The plugin surface is now meaningfully comprehensive, but a few things are still thinner than they should be:

### 1. Cross-host proof is now locally real, but it should become a cleaner public proof asset

The self-hosted plugin now has a real local core-four proof:

- Claude Code
- Cursor
- Codex
- OpenCode

That closes the “does the canonical source project actually install and verify across the core four” question.

The remaining work is:

- keep that proof current after major compatibility and lifecycle changes
- turn it into a cleaner public-facing install proof asset
- keep it easy for a new user to understand without reading internal repo context

### 2. `doctor --consumer` is still secondary

We currently surface consumer troubleshooting through:

- `pluxx-verify-install`
- selective `pluxx doctor --consumer`

That is probably enough for now, but install troubleshooting may deserve a more explicit operator path later if users keep getting stuck there.

### 3. Distribution and update UX still matter more than more workflows

The next plugin-specific improvements are not more skills.

They are:

- polished install/update docs
- release automation that is less manual
- clearer host-specific reload/update guidance
- one-click install surfaces where the hosts allow it

## What Should Stay CLI-First

Not every command needs a plugin workflow.

These are probably better left as CLI-first or maintainer-only:

- `dev`
- `mcp proxy --record/--replay`
- low-level debug/admin flows that do not improve the normal product story

The plugin should feel comprehensive around the real lifecycle, not bloated around every internal command.

## Current Conclusion

The plugin architecture is still right:

- thin plugin
- CLI as engine
- canonical source project in `example/pluxx`

And now the surface is materially closer to the real lifecycle.

The shortest honest summary is:

```text
full lifecycle coverage is present
polish and distribution still need work
```

The most important next moves are not new workflows.

They are:

- keeping `example/pluxx`, `plugins/pluxx`, and the published plugin repo aligned
- verifying the self-hosted plugin path across the core four
- making install, update, and release distribution feel simpler
