# Pluxx TODO

Last updated: 2026-04-20

This file is the short operational queue for Pluxx.

For longer-term direction, use:

- [docs/roadmap.md](/Users/brandonguerrero/Documents/Orchid%20Automation/Orchid%20Labs/pluxx/docs/roadmap.md)
- [docs/status-quo-vs-pluxx-story.md](/Users/brandonguerrero/Documents/Orchid%20Automation/Orchid%20Labs/pluxx/docs/status-quo-vs-pluxx-story.md)
- [docs/strategy/docs-url-ingestion.md](/Users/brandonguerrero/Documents/Orchid%20Automation/Orchid%20Labs/pluxx/docs/strategy/docs-url-ingestion.md)
- [docs/strategy/pluxx-plugin-distribution-strategy.md](/Users/brandonguerrero/Documents/Orchid%20Automation/Orchid%20Labs/pluxx/docs/strategy/pluxx-plugin-distribution-strategy.md)
- [docs/strategy/pluxx-plugin-operating-model.md](/Users/brandonguerrero/Documents/Orchid%20Automation/Orchid%20Labs/pluxx/docs/strategy/pluxx-plugin-operating-model.md)

## Current Truth

The core-four compiler sprint is done:

- canonical compiler buckets are defined
- host capability registry and translation modes exist
- semantic migration now preserves more host intent
- native compilation is materially stronger across Claude Code, Cursor, Codex, and OpenCode
- `doctor`, `lint`, and `build` explain preserve/translate/degrade/drop more clearly
- `pluxx test --install` now verifies installed consumer bundle state after install, not just `dist/`
- local core-four proof is real in the host apps:
  - Claude
  - Cursor app
  - Codex
  - OpenCode
- `--approve-mcp-tools` can now scaffold canonical MCP-wide tool approval intent directly into generated config

The public baseline is also real:

- npm package is live as `@orchid-labs/pluxx`
- docs site is live
- Mintlify docs now reflect the core compiler story more honestly

## Now

### 1. Release-grade Pluxx plugin

Goal:

- make the Pluxx plugin itself good enough to stand on its own as a real install surface

Current direction:

- canonical source project: `example/pluxx`
- repo-local Codex dogfood surface: `plugins/pluxx`
- plugin stays thin
- CLI stays the execution engine

Open work:

- finish the full operator skill pack
  - import
  - migrate
  - validate
  - refine taxonomy
  - rewrite instructions
  - review
  - build/install
  - sync
- keep the execution contract explicit:
  - prefer local `pluxx`
  - fallback to `npx @orchid-labs/pluxx`
- harden metadata, prompts, screenshots, and install guidance
- rebuild and test the self-hosted plugin across the core four
- decide whether distribution should stay in the main repo or move to a dedicated plugin/marketplace repo later

### 2. Install verification and release smoke

Goal:

- turn the now-proven local install story into an explicit product surface and repeatable release contract

Open work:

- add a dedicated `pluxx verify-install` command
  - keep `pluxx test --install` as the broad smoke path
  - make `verify-install` the explicit host-state truth-serum
- define the stable release smoke stack:
  - one hermetic stub MCP
  - one real-world MCP proof target owned by Pluxx
- keep host verification truthful:
  - Claude app
  - Cursor app, not Cursor CLI
  - Codex app
  - OpenCode app
- tighten docs around `doctor --consumer` and install-path debugging

### 3. Docs and website ingestion

Goal:

- treat product docs and website URLs as first-class context, not just optional extras

Current state:

- `pluxx agent prepare --website/--docs` now writes:
  - `.pluxx/sources.json`
  - `.pluxx/docs-context.json`
- deep docs pages can now act as seed URLs while still inferring a broader docs root when possible
- `init --from-mcp`, `autopilot`, and `agent prepare` now share the same `--ingest-provider auto|local|firecrawl` contract
- repeatable fixture evaluation now exists:
  - `bun run eval:docs-ingestion`
  - latest snapshot: `docs/strategy/docs-ingestion-fixture-eval.md`

Open work:

- rerun the fixture evaluation with a real Firecrawl key so `firecrawl` can be compared directly against `local`
- use the fixture snapshots to improve the weak cases the harness now exposes
  - especially Firecrawl-style JS-heavy surfaces under the local fallback
- tighten signal extraction further:
  - product description quality
  - workflow hint quality
  - code-snippet/chrome filtering in setup/auth hints
- decide whether the fixture harness should stay as baseline/local/firecrawl or grow into a fuller scaffold-quality comparison layer

### 4. Mintlify and product story

Goal:

- make the docs tell the same story the product now supports

Open work:

- keep tightening the public Mintlify narrative around:
  - status quo vs Pluxx
  - proven local core-four install + invocation flow
  - one engine, native wrappers
  - core-four portability
  - CI / evaluation / replay
- make `--approve-mcp-tools` and current install verification paths easy to discover
- add more plugin-specific docs once the self-hosted plugin surface settles
- keep public docs aligned with the real product contract, not the aspirational one

### 5. GTM and audience

Goal:

- turn the shipped product into a sharper launch and outreach story

Open work:

- refine ICP and audience hypotheses
  - internal AI platform teams
  - MCP vendors
  - devtools teams
  - agencies / consultancies
- tighten the status-quo-vs-Pluxx story into launch assets
- explicitly use the “build once, ship installable plugins to Claude, Cursor, Codex, and OpenCode” framing
- turn the local core-four proof into demo and outreach material
- draft and queue launch posts
- connect the product proof to outreach targets

### 6. Next release

Goal:

- publish the next npm cut once the plugin/operator surface changes stabilize

Open work:

- validate the new self-hosting/plugin flow
- run tests and release smoke
- cut the next npm version after the plugin surface is coherent enough to publish

## Explicitly Deferred

These are real, but not the current queue:

- marketplace / commerce complexity
- private registry / enterprise distribution complexity
- provenance / signing / trust-layer features beyond initial design
- deep governance features without present demand

## Working Rule

Right now the priority order is:

1. ship explicit install verification and release-smoke ergonomics
2. make the Pluxx plugin itself excellent
3. make docs ingestion measurable and useful
4. tighten the public story and launch execution
5. then ship the next release
