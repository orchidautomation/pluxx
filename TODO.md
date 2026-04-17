# Pluxx TODO

Last updated: 2026-04-17

This file is the operational status doc.

- [Roadmap](./docs/roadmap.md) is direction
- [OSS wedge and trust layer](./docs/oss-wedge-and-trust-layer.md) is product strategy

## Current Truth

The core product-contract layer is now shipped on `main`:

- `PLUXX-50` publish / npm / GitHub release flow
- `PLUXX-113` canonical `userConfig`
- `PLUXX-114` canonical permissions
- `PLUXX-115` build-time target cap validation

The first real MCP dogfood quality batch is also shipped on `main`:

- `PLUXX-125` product-brand baseline / launch asset system
- `PLUXX-126` Claude command-first slash UX without losing semantic skills
- `PLUXX-127` saved agent-pack freshness after taxonomy rerenders
- `PLUXX-128` better deterministic scaffold metadata and branding defaults
- `PLUXX-129` better generated examples and command blurbs
- `PLUXX-130` better autopilot prompt quality and regression coverage

The Phase 1 protocol-depth baseline is now also shipped on `main`:

- `PLUXX-67` resources and resource templates shape deterministic scaffolds
- `PLUXX-68` prompt templates shape deterministic scaffolds
- `PLUXX-69` richer MCP auth discovery and OAuth-ready scaffold support

The near-term question is no longer "does Pluxx have a believable core contract?"

It is now:

- can Pluxx become the best OSS authoring substrate for real MCP vendors
- can that OSS wedge later grow into a verified distribution / trust layer

## Active Now

### Core Umbrellas

- `PLUXX-79` Define Agent Mode as the semantic authoring layer on top of Core
  - status: `In Progress`
  - role: umbrella / product-coherence issue
  - current focus: make agent/autopilot packs consume per-skill resource and prompt-template associations, not just top-level discovery counts
- `PLUXX-61` Competitive readiness: expand MCP import beyond `tools/list`
  - status: `Backlog`
  - role: umbrella for richer non-tool MCP surfaces
- `PLUXX-62` Competitive readiness: deepen MCP auth and discovery support
  - status: `Backlog`
  - role: umbrella for richer auth discovery and OAuth-ready scaffolds

### Near-Term OSS Wedge Work

- `PLUXX-131` Add `pluxx migrate` to import existing host-native plugins into a Pluxx source project
  - status: `Backlog`
  - why it matters: adoption unlock
- `PLUXX-132` Add first-class evals for scaffold and prompt quality regression
  - status: `Backlog`
  - why it matters: turns autopilot quality from vibes into measurable regression checks
- `PLUXX-133` Add an MCP dev proxy with record/replay fixtures for local development and CI
  - status: `Backlog`
  - why it matters: deterministic MCP development loop and CI
- `PLUXX-134` Add a consumer-side `pluxx doctor` flow for installed plugin health
  - status: `Backlog`
  - why it matters: makes installed-plugin support and debugging much better

### Parallel Docs / Site Work

- `PLUXX-116` Docs site
  - status: `In Progress`
  - delegate: `Blocks`

## Execution Queue

### Phase 1: Richer MCP Surfaces

- `PLUXX-62` Auth and discovery
  - child work:
    - `PLUXX-43` OAuth 2.1 auth type to schema and generators
    - `PLUXX-69` richer MCP auth discovery and OAuth-ready scaffold support
  - outcome:
    - Pluxx imports and explains real auth surfaces more honestly
  - status:
    - `PLUXX-69` shipped baseline
    - deeper provider/runtime follow-through remains open under the umbrella

- `PLUXX-61` Import beyond `tools/list`
  - child work:
    - `PLUXX-67` scaffold from MCP resources and resource templates
    - `PLUXX-68` scaffold prompt-aware content from MCP prompt templates
  - outcome:
    - generated plugins reflect more than tool metadata
  - status:
    - `PLUXX-67` shipped baseline
    - `PLUXX-68` shipped baseline
    - next follow-through is making Agent Mode consume those per-skill associations more deeply

### Phase 2: Quality And Adoption Leverage

- `PLUXX-132` first-class evals
  - outcome:
    - prompt/scaffold quality becomes regression-testable
- `PLUXX-131` migrate
  - outcome:
    - existing host-native plugins can move into Pluxx instead of rewriting from scratch
- `PLUXX-133` MCP dev proxy with record/replay
  - outcome:
    - deterministic dev + CI loop for real MCP-backed plugins
- `PLUXX-134` consumer-side doctor
  - outcome:
    - installed plugin health checks for end users, not just authors

### Phase 3: Brand / Launch Follow-Through

- `PLUXX-125` product branding and launch asset system
  - status: shipped baseline
  - remaining work:
    - follow-on site/docs/assets implementation as needed

## Strategic Horizon, Not Current Build Queue

These are the later trust-layer themes, not the immediate OSS execution list:

- verified multi-host distribution
- canary checks against real MCPs
- signing / provenance / attestations
- compatibility verification artifacts
- runtime health and adoption visibility

This is the future paid/operated layer.

It should inform the roadmap, but it should not crowd out the current OSS wedge work.

## Explicitly Deferred

These are interesting, but not worth centering yet:

- plugin marketplace / commerce
- cross-plugin dependency management
- private registry complexity beyond initial design
- "plugin economy" bets
- deep enterprise governance before real demand exists

## Closed / Folded Work

- `PLUXX-50`
  - completed and shipped
- `PLUXX-113`
  - completed and shipped
- `PLUXX-114`
  - completed and shipped
- `PLUXX-115`
  - completed and shipped
- `PLUXX-41`
  - closed as duplicate of `PLUXX-68`
- `PLUXX-42`
  - closed as duplicate of `PLUXX-67`
- `PLUXX-22`
  - canceled as superseded by `PLUXX-115`

## Separate Validation / Sandbox Track

These are real issues, but they are not the main product queue:

- `PLUXX-100`
- `PLUXX-108`
- `PLUXX-109`
- `PLUXX-110`
- `PLUXX-111`
- `PLUXX-112`

Treat them as validation / linear-swarm work, not as the core Pluxx execution map.

## What To Do Next

If you only want the next concrete sequence, it is:

1. `PLUXX-79` follow-through on deeper agent/autopilot use of per-skill discovery surfaces
2. `PLUXX-132`
3. `PLUXX-131`
4. `PLUXX-133`
5. `PLUXX-134`

That sequence keeps the near-term effort focused on:

- richer MCP truthfulness in both deterministic scaffolds and agent refinement
- measurable scaffold / prompt quality
- easier adoption
- deterministic development
- better installed-plugin support
