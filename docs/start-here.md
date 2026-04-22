# Start Here

Last updated: 2026-04-22

## Doc Links

- Role: repo orientation
- Related:
  - [docs/todo/queue.md](./todo/queue.md)
  - [docs/todo/master-backlog.md](./todo/master-backlog.md)
- [docs/roadmap.md](./roadmap.md)
- [docs/oss-wedge-and-trust-layer.md](./oss-wedge-and-trust-layer.md)
- [docs/flagship-docs-ops-plugin.md](./flagship-docs-ops-plugin.md)
- [README.md](../README.md)
- Update together:
  - [docs/todo/queue.md](./todo/queue.md)
  - [docs/todo/master-backlog.md](./todo/master-backlog.md)
  - [docs/roadmap.md](./roadmap.md)

If you are new to Pluxx, read this file first.

This is the shortest accurate explanation of what Pluxx is, what is already real, what is not the product yet, and where to look next.

## What Pluxx Is

Pluxx turns raw MCPs or strong host-native agent plugins into one maintained source project that can ship native plugin outputs for:

- Claude Code
- Cursor
- Codex
- OpenCode

Pluxx exists because raw MCP access is usually not enough.

Most products still need:

- better workflow grouping
- stronger instructions
- hooks and commands
- clearer auth and setup guidance
- installable native packaging per host
- repeatable validation and install verification

Pluxx is the authoring, maintenance, and compilation layer for that work.

## The Product In One Sentence

Pluxx helps teams maintain one plugin source project and ship installable, opinionated native experiences across Claude Code, Cursor, Codex, and OpenCode.

## The Two-Layer Model

Pluxx has two layers.

### 1. OSS Authoring Substrate

This is the product that is real today.

It includes:

- `init`
- `autopilot`
- `doctor`
- `lint`
- `eval`
- `build`
- `test`
- `install`
- `verify-install`
- `migrate`
- `sync`
- `mcp proxy`

The goal of this layer is simple:

> Make Pluxx the default way to author and maintain a real cross-host plugin from one source project.

### 2. Later Trust / Distribution Layer

This is a plausible later product, not the current build center.

Potential surfaces:

- organization-wide rollout
- managed distribution
- version channels
- policy and approval controls
- adoption analytics
- runtime health and governance

This is important strategically, but it should not drive the near-term roadmap.

## Who Pluxx Is For Right Now

The current best-fit users are:

- MCP vendors who have a raw MCP and need a better native agent experience
- teams that already have one good host-native plugin and want core-four portability
- advanced plugin authors who want one maintained source of truth

The strongest design-partner audience for the later trust layer is:

- internal AI platform teams
- DevEx / productivity teams
- engineering orgs standardizing internal agent workflows across multiple hosts

## What Is Already Real

The repo already proves a lot.

- `@orchid-labs/pluxx` is published on npm
- the public website is live at `https://pluxx.dev`
- the docs site is live at `https://docs.pluxx.dev`
- the published CLI runs on Node `>=18`
- the core-four compiler work is materially shipped
- `verify-install` exists and is tested
- consumer-side `doctor --consumer` exists and is tested
- `migrate`, `eval`, and `mcp proxy --record/--replay` are shipped
- the self-hosted Pluxx plugin exists as a real source project in `example/pluxx`
- the repo-local Codex dogfood plugin exists in `plugins/pluxx`
- the flagship `example/docs-ops` source project exists and is wired to a live public Orchid Docsalot MCP endpoint for read-only proof
- docs/website ingestion has a provider model and writes deterministic artifacts:
  - `.pluxx/sources.json`
  - `.pluxx/docs-context.json`
- release smoke exists for the core four

## What Pluxx Is Not Yet

Do not confuse the current product with the future company.

Pluxx is not yet:

- a hosted AI control plane
- an enterprise governance suite
- a marketplace business
- a private registry product
- an org analytics platform
- a “support every host equally” framework

The prime-time path is still:

- Claude Code
- Cursor
- Codex
- OpenCode

Other generators can exist, but they are not the main story.

## Current Build Priorities

These are the current near-term priorities, in order.

### 1. Product Clarity

Make the repo, docs, README, TODO, and Linear all tell the same story.

That includes:

- one clear project brief
- cleaner public framing
- fewer stale planning artifacts
- truthful public metadata and links

### 2. Flagship Depth Example

Build one maximal reference plugin that proves Pluxx handles richer host surfaces, not just basic `SKILL.md` scaffolds.

The chosen first flagship example is:

- a Docsalot-style `docs-ops` plugin built from one maintained source project

This should exercise advanced features like:

- supporting files
- scripts
- stronger command surfaces
- advanced Claude skill behavior
- hooks
- richer agent/subagent patterns where the host allows them

See [docs/flagship-docs-ops-plugin.md](./flagship-docs-ops-plugin.md).

The read-only Orchid Docsalot proof is documented in:

- `example/docs-ops/ORCHID-READONLY-DEMO.md`

### 3. Docs Ingestion Proof

Turn docs ingestion from “implemented” into “obviously useful.”

That means:

- rerunning fixture evals with a real Firecrawl key
- capturing a live before/after demo
- documenting what changed in the resulting scaffold

### 4. Release-Grade Pluxx Plugin

Make the self-hosted Pluxx plugin feel like a real install surface, not just dogfood.

### 5. Customer Discovery

Run two lanes in parallel:

- MCP vendor lane
- internal AI platform / design-partner lane

### 6. Next Release

Cut the next npm release after the story, examples, and plugin surfaces are coherent enough to ship together.

## Working Rules

Use these rules when deciding what to build.

### Rule 1

If it makes Pluxx a better OSS authoring substrate for real plugin authors, it is probably near-term roadmap material.

### Rule 2

If it mostly assumes a hosted trust/business layer that does not exist yet, it is probably not near-term roadmap material.

### Rule 3

Do not widen the promise faster than the repo can prove it.

### Rule 4

Keep GTM-sensitive material out of the public repo.

## Repo Map

Use this map if you are trying to orient quickly.

- `src/`
  - CLI, config loading, generators, validation, compilation logic
- `example/pluxx/`
  - canonical self-hosted Pluxx plugin source project
- `example/docs-ops/`
  - flagship docs-ops source project scaffold for the rich host-depth example
  - includes a live Orchid read-only Docsalot demo target
- `plugins/pluxx/`
  - repo-local Codex dogfood plugin surface
- `tests/`
  - CLI, package, generator, migrate, install, verify-install, release-smoke coverage
- `docs/`
  - source-of-truth product, strategy, and operational docs
- `apps/web/`
  - public website

## Which Doc To Read Next

After this file:

- read [docs/todo/queue.md](./todo/queue.md) for the short operational queue
- read [docs/todo/master-backlog.md](./todo/master-backlog.md) for the broadest repo-native backlog
- read [roadmap.md](./roadmap.md) for execution direction
- read [oss-wedge-and-trust-layer.md](./oss-wedge-and-trust-layer.md) for product framing
- read [enterprise-adoption-thesis.md](./enterprise-adoption-thesis.md) for the stronger future enterprise thesis
- read [status-quo-vs-pluxx-story.md](./status-quo-vs-pluxx-story.md) for the broader positioning narrative
- read [Linear](https://linear.app/orchid-automation) for ticket-level detail and current execution state

## External Metadata Rule

Keep public repo metadata aligned with this brief:

- GitHub About description
- GitHub About homepage URL
- README top section
