# Pluxx Plugin Surface Audit

## Doc Links

- Role: architecture and coverage audit for the self-hosted Pluxx plugin
- Related:
  - [docs/start-here.md](./start-here.md)
  - [docs/todo/queue.md](./todo/queue.md)
  - [docs/roadmap.md](./roadmap.md)
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
- what CLI workflows are still missing from the plugin surface

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

The self-hosted plugin currently exposes eight core workflows:

1. `pluxx-import-mcp`
2. `pluxx-migrate-plugin`
3. `pluxx-validate-scaffold`
4. `pluxx-refine-taxonomy`
5. `pluxx-rewrite-instructions`
6. `pluxx-review-scaffold`
7. `pluxx-build-install`
8. `pluxx-sync-mcp`

In Codex, those are primarily exposed as:

- plugin metadata
- skills
- starter prompts

In hosts with command surfaces, the canonical source project also defines matching explicit commands:

- `/pluxx:import-mcp`
- `/pluxx:migrate-plugin`
- `/pluxx:validate-scaffold`
- `/pluxx:refine-taxonomy`
- `/pluxx:rewrite-instructions`
- `/pluxx:review-scaffold`
- `/pluxx:build-install`
- `/pluxx:sync-mcp`

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
| `sync` | Yes | Yes | Covered by `pluxx-sync-mcp` |
| `verify-install` | No explicit workflow | Yes | Important now that install verification is a real differentiated Pluxx surface |
| `publish` | No explicit workflow | Yes | Important for the public plugin/distribution story |
| `autopilot` | No explicit workflow | Yes | Important because it is a real user-facing one-shot path now |
| docs/website ingestion / `agent prepare` as a standalone workflow | Partial only | Probably yes | Currently hidden inside taxonomy/instructions flows instead of being a clear workflow |
| `doctor --consumer` | Indirect only | Maybe | Valuable as a troubleshooting workflow after install |
| `uninstall` | No | Maybe | Useful but not urgent for the plugin’s first polished operator surface |
| `mcp proxy --record/--replay` | No | Probably not by default | Useful maintainer/debug flow, but not core plugin UX |
| `dev` | No | No | Maintainer workflow, not product workflow |

## The Real Gaps

The current plugin is good, but it is not comprehensive yet.

The biggest product-facing gaps are:

### 1. `verify-install` is shipped in the CLI but missing as a first-class plugin workflow

That matters because install verification is one of the cleanest reasons Pluxx is more than a thin generator.

The plugin should have a clear operator flow for:

- install
- verify installed state
- explain host-specific follow-up if the host still looks wrong

### 2. `publish` is real in the CLI but not surfaced in the plugin

That matters because the self-hosted plugin story now includes:

- release assets
- host-specific install scripts
- release-driven distribution

If the plugin does not surface publish at all, the operator story stops short of a real lifecycle.

### 3. `autopilot` exists but is not visible in the plugin surface

That matters because some users want:

- one-shot import
- one-shot refinement
- one-shot verification

If we believe `autopilot` is a real product surface, the plugin should acknowledge it directly.

### 4. Docs/context preparation is still too hidden

Right now the plugin uses `pluxx agent prepare` inside taxonomy and instructions workflows.

That works, but it hides an important capability:

- website ingestion
- docs ingestion
- context-pack preparation

This should probably become a named workflow instead of staying an invisible implementation detail.

### 5. Consumer troubleshooting is undersurfaced

The CLI now has stronger installed-bundle validation.

The plugin should likely have a more obvious troubleshooting workflow for:

- install looks wrong
- host cannot see the bundle
- runtime shape does not match expectation

## Recommended Next Additions

In priority order:

### 1. `pluxx-verify-install`

Job:

- verify that a built and installed target is actually visible and healthy in the host

CLI it should orchestrate:

- `pluxx verify-install --target ...`
- optionally `pluxx doctor --consumer --target ...` when deeper diagnosis is needed

### 2. `pluxx-publish-plugin`

Job:

- package the current plugin for release distribution and explain the install outputs

CLI it should orchestrate:

- `pluxx publish`

### 3. `pluxx-autopilot`

Job:

- run the one-shot import/refine/verify path deliberately

CLI it should orchestrate:

- `pluxx autopilot --from-mcp ...`

### 4. `pluxx-prepare-context`

Job:

- ingest website/docs/local context and prepare the agent pack before semantic refinement

CLI it should orchestrate:

- `pluxx agent prepare ...`

### 5. `pluxx-troubleshoot-install`

Job:

- diagnose why a host does not see or trust the installed plugin

CLI it should orchestrate:

- `pluxx verify-install --target ...`
- `pluxx doctor --consumer --target ...`

This could be merged with `pluxx-verify-install`, but the user intent is different enough that separate flows may be cleaner.

## What Should Stay CLI-First

Not every command needs a plugin workflow.

These are probably better left as CLI-first or maintainer-only:

- `dev`
- `mcp proxy --record/--replay`
- low-level debug/admin flows that do not improve the normal product story

The plugin should feel comprehensive around the real lifecycle, not bloated around every internal command.

## Current Conclusion

The plugin architecture is right:

- thin plugin
- CLI as engine
- canonical source project in `example/pluxx`

But the surface is not complete yet.

The shortest honest summary is:

```text
good operator shell
not yet full lifecycle coverage
```

The most important next move is not changing the architecture.

It is closing the workflow coverage gap so the plugin itself can honestly represent the full modern Pluxx lifecycle:

- import
- refine
- validate
- build
- install
- verify
- publish
- one-shot autopilot
