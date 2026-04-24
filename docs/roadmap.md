# Roadmap

Last updated: 2026-04-23

## Doc Links

- Role: execution direction
- Related:
  - [docs/start-here.md](./start-here.md)
  - [docs/todo/queue.md](./todo/queue.md)
  - [docs/todo/master-backlog.md](./todo/master-backlog.md)
  - [docs/todo/success-checklist.md](./todo/success-checklist.md)
  - [docs/oss-wedge-and-trust-layer.md](./oss-wedge-and-trust-layer.md)
  - [docs/flagship-docs-ops-plugin.md](./flagship-docs-ops-plugin.md)
  - [docs/docs-ops-core-four-proof.md](./docs-ops-core-four-proof.md)
  - [docs/pluxx-plugin-surface-audit.md](./pluxx-plugin-surface-audit.md)
  - [docs/pluxx-self-hosted-core-four-proof.md](./pluxx-self-hosted-core-four-proof.md)
  - [docs/core-four-provider-docs-audit.md](./core-four-provider-docs-audit.md)
  - [docs/core-four-translation-hit-list.md](./core-four-translation-hit-list.md)
  - [docs/core-four-maintenance-routine.md](./core-four-maintenance-routine.md)
  - [Linear](https://linear.app/orchid-automation)
- Update together:
  - [docs/start-here.md](./start-here.md)
  - [docs/todo/queue.md](./todo/queue.md)
  - [docs/todo/master-backlog.md](./todo/master-backlog.md)

This doc is direction, not the day-to-day execution queue.

If you are new to the repo, read [start-here.md](./start-here.md) first.
For the live operational queue, use [docs/todo/queue.md](./todo/queue.md).
For the broadest repo-native backlog, use [docs/todo/master-backlog.md](./todo/master-backlog.md).
For the broadest completeness checklist, use [docs/todo/success-checklist.md](./todo/success-checklist.md).
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
- the audit-to-implementation closure plan in [docs/core-four-translation-hit-list.md](./core-four-translation-hit-list.md)

The closure plan is now narrower than it was before:

- row-level translation docs are done
- hook translation explainability and fixture closure are materially stronger
- build and doctor now explain non-preserve mappings with more native-surface detail
- the remaining P0 rows are richer skill fixtures, remaining runtime/MCP fixtures, and instruction-intent proof

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
- it now builds, installs, and passes `verify-install` across Claude Code, Cursor, Codex, and OpenCode:
  - `docs/docs-ops-core-four-proof.md`
- it now includes a concrete Orchid Accordion before/after rewrite artifact
- it has now been installed and used in Codex through the local plugin surface
- it now also completes the same read-only inspect and rewrite workflow through the official Claude Code, Cursor, Codex, and OpenCode CLIs:
  - `docs/docs-ops-core-four-proof.md`
- the next proof steps are packaging that cross-host workflow proof cleanly, capturing at least one polished in-app walkthrough beyond Codex, then separating the write/publish auth path

This is the strongest next proof surface for:

- product credibility
- docs
- demos
- regression fixtures
- outbound proof

### 3. Docs and website ingestion proof

Turn docs ingestion from “implemented” into “obviously useful.”

The current focus is:

- connector-backed Firecrawl proof now captured:
  - `docs/strategy/firecrawl-connector-docs-ingestion-proof.md`
- keyed local Firecrawl harness snapshot now captured:
  - `docs/strategy/docs-ingestion-fixture-eval.md`
- live before/after demo now captured:
  - `docs/strategy/docs-ingestion-scaffold-before-after.md`
- better extracted signal quality

### 4. Release-grade Pluxx plugin

Make the self-hosted Pluxx plugin feel polished, real, and easy to install.

The plugin should stay thin.
The CLI should stay the execution engine.

The plugin workflow coverage gap is now closed in the maintained source project and the repo-local Codex dogfood plugin.

Use [docs/pluxx-plugin-surface-audit.md](./pluxx-plugin-surface-audit.md) as the concrete reference.

The latest local self-hosted core-four proof is documented in:

- [docs/pluxx-self-hosted-core-four-proof.md](./pluxx-self-hosted-core-four-proof.md)

The next plugin-specific work is:

- keep `example/pluxx`, `plugins/pluxx`, and the published `pluxx-plugin` repo aligned
- improve install/update clarity and release distribution UX
- treat [docs/proof-and-install.md](./proof-and-install.md) as the first repo-native public proof/install landing page, then push it into a cleaner visual public asset
- evaluate whether a `gh skill`-compatible export belongs as an additional distribution channel for the skills-only slice of Pluxx output
- keep the plugin/autopilot story honest: starting from a raw MCP should already aim for the strongest native mix of skills, commands, arguments, and specialist agents/subagents, not just a flat skill dump

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
- use the row-level appendices in:
  - [docs/core-four-primitive-matrix.md](./core-four-primitive-matrix.md)
  - [docs/core-four-branding-metadata-audit.md](./core-four-branding-metadata-audit.md)
  as the current translation contract
- do not imply equal support where the repo cannot prove it
- use [docs/core-four-provider-docs-audit.md](./core-four-provider-docs-audit.md) to refresh the machine-readable rules and generated compatibility docs after each major host-doc review
- use [docs/core-four-translation-hit-list.md](./core-four-translation-hit-list.md) to close the remaining registry, generator, explainability, and proof work for every mapped row

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
