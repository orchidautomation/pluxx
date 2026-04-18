# Pluxx TODO

Last updated: 2026-04-18

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

The first quality-eval baseline is now shipped on `main`:

- `PLUXX-132` first-class scaffold and prompt-pack evals via `pluxx eval`

The adoption / support baseline is now also shipped on `main`:

- `PLUXX-131` `pluxx migrate` for host-native plugin imports
- `PLUXX-134` consumer-side `pluxx doctor --consumer` for installed bundle health

The deterministic dev-loop baseline is now also shipped on `main`:

- `PLUXX-133` `pluxx mcp proxy` with record/replay tapes for MCP sessions

The public surface baseline is now also shipped on `main`:

- npm package published as `@orchid-labs/pluxx@0.1.1`
- `pluxx.dev` live with the current cross-host plugin-authoring positioning
- docs live at `docs.pluxx.dev`
- GitHub tag-based npm release flow is configured

The first broad OSS QA sweep is now also shipped on `main`:

- `PLUXX-136` Cursor/OpenCode authoring flow validation
- `PLUXX-143` repo-wide QA sweep umbrella
- `PLUXX-144` deterministic CLI + MCP lifecycle QA fixes
- `PLUXX-145` core-four bundle + consumer-doctor runtime QA
- `PLUXX-146` public-surface consistency pass
- `PLUXX-147` examples / fixtures / release-smoke parity pass
- `PLUXX-148` core-four plugin branding metadata truth audit

The first Pluxx-side brand asset baseline is now also shipped on `main`:

- canonical SVG logo + icon sources under `assets/brand/`
- launch/social asset skeleton under `assets/launch/`
- website Open Graph / Twitter image routes

The near-term question is no longer "does Pluxx have a believable core contract?"

It is now:

- can Pluxx become the best OSS authoring substrate for real MCP vendors
- can that OSS wedge later grow into a verified distribution / trust layer

## Active Now

### Product / Launch Work

- `PLUXX-135` Define the OSS wedge GTM and launch checklist for Pluxx
  - status: `In Progress`
  - role: launch / GTM track
  - current focus: convert the shipped product into launch-ready messaging, outreach, and asset execution
- `PLUXX-138` Draft X/Twitter launch posts for the OSS wedge
  - status: `Todo`
  - role: launch copy
  - current focus: thread + follow-up posts tied to real shipped proof
- `PLUXX-139` Draft LinkedIn launch copy and founder narrative for Pluxx
  - status: `Todo`
  - role: launch copy
  - current focus: founder-ready post and variants
- `PLUXX-142` Identify MCP repos for Pluxx adoption outreach
  - status: `In Progress`
  - role: outbound / design-partner pipeline
  - current focus: shortlist the best early MCP/vendor targets and proposal angles

### Core Umbrellas

- `PLUXX-79` Define Agent Mode as the semantic authoring layer on top of Core
  - status: `In Progress`
  - role: umbrella / product-coherence issue
  - current focus: keep strengthening the semantic authoring layer on top of the now-shipped eval/import/auth baselines

### Near-Term OSS Wedge Work

- `PLUXX-131` Add `pluxx migrate` to import existing host-native plugins into a Pluxx source project
  - status: shipped baseline
  - why it matters: adoption unlock
- `PLUXX-132` Add first-class evals for scaffold and prompt quality regression
  - status: shipped baseline
  - why it matters: turns autopilot quality from vibes into measurable regression checks
- `PLUXX-133` Add an MCP dev proxy with record/replay fixtures for local development and CI
  - status: shipped baseline
  - why it matters: deterministic MCP development loop and CI
- `PLUXX-134` Add a consumer-side `pluxx doctor` flow for installed plugin health
  - status: shipped baseline
  - why it matters: makes installed-plugin support and debugging much better

### Parallel Docs / Site Work

- `PLUXX-116` Docs site
  - status: `In Progress`
  - role: public docs / polish follow-through
  - current focus: polish and tighten the now-live Mintlify docs rather than standing up the baseline

### Open Umbrellas Still Relevant

- `PLUXX-61` Competitive readiness: expand MCP import beyond `tools/list`
  - status: `Backlog`
  - role: umbrella for richer non-tool MCP surfaces
- `PLUXX-62` Competitive readiness: deepen MCP auth and discovery support
  - status: `Backlog`
  - role: umbrella for deeper auth/runtime/import follow-through beyond the shipped baseline

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
  - status:
    - shipped baseline via `pluxx eval` and `pluxx test`
    - deeper eval fixtures and richer scoring can still expand from here
- `PLUXX-131` migrate
  - outcome:
    - existing host-native plugins can move into Pluxx instead of rewriting from scratch
  - status:
    - shipped baseline via `pluxx migrate`
    - follow-on refinement can improve host-specific import fidelity over time
- `PLUXX-133` MCP dev proxy with record/replay
  - outcome:
    - deterministic dev + CI loop for real MCP-backed plugins
  - status:
    - shipped baseline via `pluxx mcp proxy --record` / `--replay`
    - follow-on work can deepen fixture ergonomics, host docs, and richer transport validation
- `PLUXX-134` consumer-side doctor
  - outcome:
    - installed plugin health checks for end users, not just authors
  - status:
    - shipped baseline via `pluxx doctor --consumer`
    - follow-on work can deepen host-specific diagnostics and runtime repair guidance

### Phase 3: Launch And Real-World Confidence

- `PLUXX-135` OSS wedge GTM / launch checklist
  - outcome:
    - the shipped product gets a coherent launch story and execution plan
  - status:
    - in progress
    - this is now the main non-product track
- `PLUXX-138` / `PLUXX-139`
  - outcome:
    - the launch narrative becomes publishable social/founder copy
  - status:
    - open
- `PLUXX-142`
  - outcome:
    - first real MCP/vendor outreach targets are organized instead of ad hoc
  - status:
    - in progress

### Phase 3: Brand / Launch Follow-Through

- `PLUXX-125` product branding and launch asset system
  - status: shipped baseline
  - remaining work:
    - baseline SVG logo/icon assets are versioned in-repo
    - export PNG icon variants and social-ready raster derivatives
    - capture the P0 proof screenshots from `docs/first-proof-demo-asset-pack.md`
    - record the 45-second wedge demo clip
    - align GitHub social preview and repo/org description with the current wedge copy
- `PLUXX-148` core-four plugin branding metadata audit
  - status: shipped
  - why it matters:
    - avoid implying portable plugin brand support where the generators/hosts do not actually back it

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

1. `PLUXX-135` GTM / launch checklist
2. `PLUXX-138` and `PLUXX-139` launch copy
3. `PLUXX-142` outreach target shortlist
4. `PLUXX-148` plugin-brand support audit
5. `PLUXX-79` follow-through on deeper agent/autopilot coherence
6. `PLUXX-116` docs/site polish

## Open PR Queue

These are the only PRs that currently matter:

- `#182` / `PLUXX-148`
  - branding metadata audit
  - not ready to merge unchanged; its Firecrawl note is stale after the recent frontmatter fix
- `#169` / `PLUXX-142`
  - prospect shortlist + outreach proposals
  - worth review/merge if the GTM artifact is useful

These are still open in GitHub but are not part of the active execution queue:

- `#34`
- `#21`

That sequence keeps the near-term effort focused on:

- turning the shipped baseline into a launchable OSS wedge
- packaging the launch story into concrete public/outbound assets
- keeping plugin-brand claims truthful before we lean on them publicly
- keeping Agent Mode/product coherence strong as the wedge sharpens
- polishing the public docs/site around what is already real
