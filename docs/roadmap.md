# Roadmap

Last updated: 2026-04-17

This doc is direction, not the day-to-day execution queue.

For the live operational queue, use [TODO](../TODO.md).
For the product strategy behind this roadmap, use [OSS wedge and trust layer](./oss-wedge-and-trust-layer.md).

## Product Frame

Pluxx now has two distinct layers:

1. an OSS authoring substrate
2. a later operated trust layer

The current build priority is the OSS substrate.

That means:

- import
- scaffold
- refine
- lint
- doctor
- test
- build
- install
- sync

must become excellent for real MCP vendors and plugin authors before Pluxx spends serious energy on a hosted control plane.

## Shipped Foundation

The core product-contract layer is already in place:

- `PLUXX-50` publish / npm / GitHub release flow
- `PLUXX-113` canonical `userConfig`
- `PLUXX-114` canonical permissions
- `PLUXX-115` build-time cap validation

The first real MCP dogfood-quality batch is also landed:

- `PLUXX-125` product-brand baseline and launch asset system
- `PLUXX-126` Claude command-first slash UX without losing semantic skills
- `PLUXX-127` saved agent-pack freshness after taxonomy rerenders
- `PLUXX-128` better deterministic scaffold metadata and branding defaults
- `PLUXX-129` better generated examples and command blurbs
- `PLUXX-130` better autopilot prompt quality and regression coverage

So the remaining question is not whether Pluxx is mechanically credible.

The remaining question is whether Pluxx can become the default OSS substrate for real cross-host plugin authoring.

## Active Direction

### `PLUXX-79` Core + Agent Coherence

- status: `In Progress`
- role: umbrella
- job:
  - keep the deterministic Core layer and semantic Agent layer coherent
  - prevent MCP-derived scaffolds from feeling generic or stale

### `PLUXX-61` Import Beyond `tools/list`

- role: umbrella
- child issues:
  - `PLUXX-67` scaffold from MCP resources and resource templates
  - `PLUXX-68` scaffold prompt-aware plugin content from MCP prompt templates
- goal:
  - make generated plugins reflect more than tool metadata

### `PLUXX-62` Auth And Discovery Depth

- role: umbrella
- child issues:
  - `PLUXX-43` OAuth 2.1 auth type to schema and generators
  - `PLUXX-69` richer MCP auth discovery and OAuth-ready scaffold support
- goal:
  - make auth/import behavior more truthful for real remote MCPs

## Next OSS Leverage Bets

These are the highest-signal new bets after the current discovery/auth work:

### `PLUXX-132` First-Class Evals

Goal:

- turn scaffold and autopilot quality into measurable regression tests

Why it matters:

- prompt quality is now a product surface
- Agent Mode needs more than "looks good" review loops

Current baseline:

- shipped via `pluxx eval`
- included in `pluxx test`
- checks deterministic scaffold surfaces plus taxonomy/instructions/review prompt-pack contracts

### `PLUXX-131` `pluxx migrate`

Goal:

- import an existing host-native plugin into a Pluxx source project

Why it matters:

- this is the cleanest adoption unlock left in the product

Current baseline:

- shipped via `pluxx migrate`
- synthesizes `.pluxx/taxonomy.json` and `.pluxx/mcp.json` for migrated projects so Agent Mode and `pluxx eval` still work

### `PLUXX-133` MCP Dev Proxy With Record/Replay

Goal:

- create a deterministic local dev and CI loop for MCP-backed plugins

Why it matters:

- real MCP integrations are flaky enough that record/replay is now leverage, not polish

Current baseline:

- shipped via `pluxx mcp proxy --from-mcp <source> --record <tape.json>`
- replayed via `pluxx mcp proxy --replay <tape.json>` for deterministic stdio MCP sessions

### `PLUXX-134` Consumer-Side `pluxx doctor`

Goal:

- help installed-plugin users diagnose auth, env, and host wiring issues

Why it matters:

- current `doctor` is author-first
- real support load eventually lands on installed plugin health

Current baseline:

- shipped via `pluxx doctor --consumer`
- validates built or installed platform bundles directly instead of requiring a source project

## Parallel Track: Brand / Launch Follow-Through

### `PLUXX-125` Product Branding + Launch Asset System

- shipped baseline:
  - canonical brand direction
  - launch-asset checklist
- proof/demo pack:
  - [first proof and demo asset pack](./first-proof-demo-asset-pack.md)
- likely follow-on work:
  - docs/site alignment
  - screenshots and marketplace-facing media
  - npm / GitHub / site message coherence

## Strategic Horizon: Operated Trust Layer

This is the later layer Pluxx may grow into, but it is not the current execution queue.

Potential surfaces:

- verified multi-host distribution
- signing / provenance / attestations
- canary checks against real MCPs
- compatibility verification artifacts
- runtime health and adoption visibility

This layer matters strategically because it is the most plausible paid / operated extension of the OSS wedge.

But Pluxx should earn the right to build it by first becoming the best OSS authoring substrate.

## Explicitly Deferred

These may become important later, but they should not drive the roadmap now:

- plugin marketplace / commerce
- private registry complexity beyond initial design
- cross-plugin dependency management
- skill-pack economy bets
- deep enterprise governance before real demand exists

## Separate Track: Validation / Sandbox Issues

These remain real, but they are not the main product roadmap:

- `PLUXX-100`
- `PLUXX-108`
- `PLUXX-109`
- `PLUXX-110`
- `PLUXX-111`
- `PLUXX-112`

Treat them as validation / linear-swarm work, not as the core Pluxx direction.

## If You Only Want The Next Sequence

Do this in order:

1. `PLUXX-79`
2. `PLUXX-116`

That sequence keeps Pluxx focused on:

- deeper agent/autopilot use of the richer MCP surfaces already shipped
- turning the shipped deterministic development baseline into a more polished author workflow
- continued docs/site clarity while the OSS wedge hardens
