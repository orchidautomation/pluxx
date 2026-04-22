# Roadmap

Last updated: 2026-04-22

## Doc Links

- Role: execution direction
- Related:
  - [docs/start-here.md](./start-here.md)
  - [docs/todo/queue.md](./todo/queue.md)
  - [docs/todo/master-backlog.md](./todo/master-backlog.md)
  - [docs/oss-wedge-and-trust-layer.md](./oss-wedge-and-trust-layer.md)
  - [docs/flagship-docs-ops-plugin.md](./flagship-docs-ops-plugin.md)
  - [Linear](https://linear.app/orchid-automation)
- Update together:
  - [docs/start-here.md](./start-here.md)
  - [docs/todo/queue.md](./todo/queue.md)
  - [docs/todo/master-backlog.md](./todo/master-backlog.md)

This doc is direction, not the day-to-day execution queue.

If you are new to the repo, read [start-here.md](./start-here.md) first.
For the live operational queue, use [docs/todo/queue.md](./todo/queue.md).
For the broadest repo-native backlog, use [docs/todo/master-backlog.md](./todo/master-backlog.md).
For the product strategy behind this roadmap, use [OSS wedge and trust layer](./oss-wedge-and-trust-layer.md).

## Product Frame

Pluxx has two layers:

1. an OSS authoring substrate
2. a later trust / distribution layer

The current build center is the OSS authoring substrate.

That means Pluxx should become excellent at:

- import
- scaffold
- refine
- lint
- doctor
- eval
- build
- test
- install
- sync

before it spends serious energy on an operated control plane.

## Current Priority Order

### 1. Product clarity and source-of-truth coherence

Make the repo front door and planning surfaces tell the same story.

This includes:

- start-here
- queue
- master backlog
- roadmap
- README
- site hero and metadata
- Linear

### 2. Flagship reference plugin

Build one maximal reference plugin that proves Pluxx handles rich native host depth, not just basic MCP wrappers.

The chosen first example is:

- a Docsalot-style `docs-ops` plugin
- built from one maintained source project
- used to prove supporting files, scripts, richer commands, reviewer/research patterns, and truthful cross-host translation

Use [docs/flagship-docs-ops-plugin.md](./flagship-docs-ops-plugin.md) as the concrete spec.

The current status is stronger than a pure scaffold:

- `example/docs-ops` exists
- it is wired to Orchid's public Docsalot MCP endpoint for read-only proof
- it now includes a concrete Orchid Accordion before/after rewrite artifact
- it has now been installed and used in Codex through the local plugin surface
- the next proof step is the separate write/publish auth path

This is the strongest next proof surface for:

- product credibility
- docs
- demos
- regression fixtures
- outbound proof

### 3. Docs and website ingestion proof

Turn docs ingestion from “implemented” into “obviously useful.”

The current focus is:

- real Firecrawl comparison
- live before/after demo
- better extracted signal quality

### 4. Release-grade Pluxx plugin

Make the self-hosted Pluxx plugin feel polished, real, and easy to install.

The plugin should stay thin.
The CLI should stay the execution engine.

### 5. Customer discovery and GTM learning

Run two learning lanes in parallel:

- MCP vendors
- internal AI platform / DevEx teams

This is for learning and proof, not for prematurely building the full trust layer.

### 6. Next release

Ship the next npm cut after the story, plugin, and proof surfaces are coherent enough to ship together.

## What This Roadmap Is Optimizing For

The near-term question is no longer whether Pluxx is mechanically credible.

The near-term question is whether Pluxx can become the default way to maintain one plugin source project and ship native outputs across the core four.

## Next OSS Leverage After The Current Block

These matter, but they are not the immediate center:

### Import and discovery depth

- import beyond plain `tools/list`
- better use of MCP resources and resource templates
- more product-shaped imported scaffolds

### Auth depth

- more truthful remote MCP auth handling
- OAuth-ready scaffold support
- clearer auth hints and validation

### Eval and regression confidence

- stronger `pluxx eval` coverage
- more stable fixtures around prompt-pack quality
- reference-plugin and docs-ingestion fixtures

### Migration and sync depth

- stronger `pluxx migrate`
- safer `pluxx sync`
- clearer change visibility after sync

### Compatibility truthfulness

- keep the core-four matrix current
- keep preserve/translate/degrade/drop visible
- do not imply equal support where the repo cannot prove it

## Strategic Horizon: Trust / Distribution Layer

This is strategically important, but it is not the current execution queue.

Potential surfaces:

- organization-wide rollout
- managed distribution
- signing / provenance / attestations
- compatibility verification artifacts
- runtime health and adoption visibility
- approval and policy controls

This is the clearest plausible paid extension of the OSS wedge.

But Pluxx should earn the right to build it by first becoming the best OSS authoring substrate.

## Explicitly Deferred

These may become important later, but they should not drive the roadmap now:

- plugin marketplace / commerce
- private registry complexity beyond initial design
- skill-pack economy bets
- deep enterprise governance before real demand exists
- trying to support every host equally

## Linear Note

Use [Linear](https://linear.app/orchid-automation) for issue-by-issue sequencing, ownership, and project-level detail.
