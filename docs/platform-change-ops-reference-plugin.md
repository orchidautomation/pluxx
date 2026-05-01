# Platform Change Ops Reference Plugin

Last updated: 2026-05-01

## Doc Links

- Role: concrete spec and status note for the maximal enterprise reference plugin
- Related:
  - [docs/start-here.md](./start-here.md)
  - [docs/todo/queue.md](./todo/queue.md)
  - [docs/todo/master-backlog.md](./todo/master-backlog.md)
  - [docs/roadmap.md](./roadmap.md)
  - [docs/primitive-compiler-hardening-architecture.md](./primitive-compiler-hardening-architecture.md)
  - [docs/flagship-docs-ops-plugin.md](./flagship-docs-ops-plugin.md)
- Update together:
  - [docs/start-here.md](./start-here.md)
  - [docs/todo/queue.md](./todo/queue.md)
  - [docs/todo/master-backlog.md](./todo/master-backlog.md)
  - [docs/roadmap.md](./roadmap.md)

This is the repo's maximal enterprise reference plugin.

It lives in:

- `example/platform-change-ops`

## What It Exists To Pressure

Unlike `docs-ops` or `exa-plugin`, this example is not primarily about one product workflow.

It exists to pressure all eight compiler buckets in one source project:

- instructions
- skills
- commands
- agents
- hooks
- permissions
- runtime
- distribution

## Example Shape

The domain is internal AI platform / DevEx change operations:

- change intake
- blast-radius inspection
- external impact research
- risk and policy review
- publish or release gating
- rollout comms
- rollback planning
- installed-state verification

The runtime shape is intentionally rich:

- multiple remote MCP servers
- one bundled local stdio MCP runtime
- runtime readiness dependencies and gates
- matcher-based pre-tool and post-tool hooks
- prompt-entry gating
- explicit `allow` / `ask` / `deny` permissions
- delegated specialist agents
- rich install and listing metadata

## Why It Matters

This example closes a hole the repo had for too long:

- `docs-ops` proved workflow depth
- `exa-plugin` proved branded research + agents
- `sumble-plugin` proved matcher-based mutation hooks
- `prospeo-mcp` proved bundled stdio runtime packaging

But no single example previously combined all of those surfaces.

## Current Truth

`platform-change-ops` now exists as the most demanding maintained source project in the repo.

It already proves:

- shared-skill-parser-backed source reading can support a richer example set
- runtime readiness is no longer fixture-only in the repo examples
- local stdio runtime packaging can coexist with policy hooks, delegated agents, and install-time config
- the warning-heavy preserve / translate / degrade story can be exposed intentionally instead of hiding in synthetic tests

It does not yet prove:

- a real authenticated mutation target
- a live publish plus rollback against a safe private endpoint
- a polished public proof page at the same level as `docs-ops`
