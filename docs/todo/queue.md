# Pluxx Queue

Last updated: 2026-04-26

## Doc Links

- Role: short operational queue
- Related:
  - [docs/start-here.md](../start-here.md)
  - [master-backlog.md](./master-backlog.md)
  - [success-checklist.md](./success-checklist.md)
  - [docs/roadmap.md](../roadmap.md)
  - [docs/oss-wedge-and-trust-layer.md](../oss-wedge-and-trust-layer.md)
  - [docs/flagship-docs-ops-plugin.md](../flagship-docs-ops-plugin.md)
  - [docs/docs-ops-core-four-proof.md](../docs-ops-core-four-proof.md)
  - [docs/exa-research-example.md](../exa-research-example.md)
  - [docs/pluxx-plugin-surface-audit.md](../pluxx-plugin-surface-audit.md)
  - [docs/pluxx-self-hosted-core-four-proof.md](../pluxx-self-hosted-core-four-proof.md)
  - [docs/core-four-provider-docs-audit.md](../core-four-provider-docs-audit.md)
  - [docs/core-four-translation-hit-list.md](../core-four-translation-hit-list.md)
  - [Linear](https://linear.app/orchid-automation)
- Update together:
  - [docs/start-here.md](../start-here.md)
  - [master-backlog.md](./master-backlog.md)
  - [docs/roadmap.md](../roadmap.md)

This file is the short operational queue for Pluxx.

If you are new to the repo, read [docs/start-here.md](../start-here.md) first.

If you want the broadest “make sure we are not missing anything” checklist, use [docs/todo/success-checklist.md](./success-checklist.md).

For broader context, use:

- [docs/todo/master-backlog.md](./master-backlog.md)
- [docs/todo/success-checklist.md](./success-checklist.md)
- [docs/roadmap.md](../roadmap.md)
- [docs/oss-wedge-and-trust-layer.md](../oss-wedge-and-trust-layer.md)
- [docs/enterprise-adoption-thesis.md](../enterprise-adoption-thesis.md)
- [docs/status-quo-vs-pluxx-story.md](../status-quo-vs-pluxx-story.md)
- [docs/strategy/docs-url-ingestion.md](../strategy/docs-url-ingestion.md)
- [docs/strategy/gh-skill-and-agent-skills-note.md](../strategy/gh-skill-and-agent-skills-note.md)
- [docs/strategy/pluxx-plugin-distribution-strategy.md](../strategy/pluxx-plugin-distribution-strategy.md)
- [docs/strategy/pluxx-plugin-operating-model.md](../strategy/pluxx-plugin-operating-model.md)
- [docs/core-four-provider-docs-audit.md](../core-four-provider-docs-audit.md)
- [docs/core-four-maintenance-routine.md](../core-four-maintenance-routine.md)
- [Linear workspace](https://linear.app/orchid-automation)

## Current Truth

The core-four compiler sprint is done.

- canonical compiler buckets are defined
- host capability registry and translation modes exist
- semantic migration now preserves more host intent
- native compilation is materially stronger across Claude Code, Cursor, Codex, and OpenCode
- `doctor`, `lint`, and `build` explain preserve/translate/degrade/drop more clearly
- `pluxx verify-install` is shipped as an explicit host-state check
- `pluxx test --install` verifies installed consumer bundle state after install, not just `dist/`
- OpenCode translation is now more honestly native:
  - agent output prefers `permission` over deprecated legacy `tools`
  - native `skill` / `task` permission keys are modeled as real host surfaces
- local core-four proof is real in the host apps:
  - Claude
  - Cursor app
  - Codex
  - OpenCode
- `--approve-mcp-tools` can now scaffold canonical MCP-wide tool approval intent directly into generated config
- a second major public example now exists:
  - `example/exa-plugin`
- that Exa example now proves a clean-room subagent-heavy research architecture can also be built, installed, and `verify-install` checked across Claude Code, Cursor, Codex, and OpenCode:
  - `docs/exa-research-example.md`
- the Exa example now also has real live workflow proof across multiple host surfaces:
  - Claude Code app PASS
  - Cursor CLI PASS
  - Codex Desktop app PASS
  - OpenCode CLI PASS
- the published npm package (`0.1.5`) now includes the Claude plugin-agent manifest fix:
  - the public `pluxx test --install --trust --behavioral` path now matches the repo-local Exa proof state
- the remaining Exa rerun blocker is now narrower:
  - fresh Cursor CLI reruns currently hit a local macOS keychain/auth issue on this machine, not a plugin-bundle issue

The public baseline is also real.

- npm package is live as `@orchid-labs/pluxx`
- published CLI runtime is Node `>=18`
- published CLI lifecycle ergonomics are now stronger for global installs:
  - `pluxx --version`
  - `pluxx upgrade`
- docs site is live
- Mintlify docs reflect the core compiler story more honestly
- `migrate`, `eval`, `doctor --consumer`, and `mcp proxy --record/--replay` are shipped
- the self-hosted Pluxx plugin exists:
  - canonical source project: `example/pluxx`
  - repo-local Codex dogfood surface: `plugins/pluxx`
- the self-hosted Pluxx plugin has now been rebuilt, installed, and `verify-install` checked from `example/pluxx` across:
  - Claude Code
  - Cursor
  - Codex
  - OpenCode
  - `docs/pluxx-self-hosted-core-four-proof.md`
- docs/website ingestion is now a real surface with deterministic artifacts:
  - `.pluxx/sources.json`
  - `.pluxx/docs-context.json`
  - `--ingest-provider auto|local|firecrawl`

## Now

### 1. Product clarity and source-of-truth cleanup

Goal:

- make it obvious to any person or agent what Pluxx is, what is shipped, and what matters next

Open work:

- keep [docs/start-here.md](../start-here.md), this queue, the master backlog, and Linear aligned
- tighten the remaining top-level docs framing and entrypoint docs
- keep GTM-sensitive material out of the public repo
- continue reconciling stale planning artifacts that still describe already-shipped work as future work
- refresh `src/validation/platform-rules.ts`, `docs/compatibility.md`, and `docs/core-four-primitive-matrix.md` from the first-party provider audit:
  - [docs/core-four-provider-docs-audit.md](../core-four-provider-docs-audit.md)
- use [docs/core-four-translation-hit-list.md](../core-four-translation-hit-list.md) as the concrete closure tracker for:
  - row-level translation docs in:
    - [docs/core-four-primitive-matrix.md](../core-four-primitive-matrix.md)
    - [docs/core-four-branding-metadata-audit.md](../core-four-branding-metadata-audit.md)
  - the now-closed registry, generator, migration, explainability, and fixture rows for the current audited core four
  - any future host-drift refreshes and public proof-packaging follow-ons
- use the Exa example as the next import-quality pressure test:
  - a raw `init --from-mcp`, `autopilot`, or `migrate` run should get closer to the final Exa workflow architecture without depending on as much maintainer hand-shaping

### 2. Flagship depth example

Goal:

- prove that Pluxx handles rich host-native agent surfaces, not just basic MCP wrappers

Open work:

- keep building the chosen flagship example:
  - a Docsalot-style `docs-ops` plugin from one maintained source project
- use [docs/flagship-docs-ops-plugin.md](../flagship-docs-ops-plugin.md) as the concrete build spec
- keep the new Exa clean-room example in the proof stack as the clearest non-docs showcase of:
  - raw MCP plus official-host workflow shape in
  - branded native core-four bundles out
- document and close the current Exa import delta:
  - what a raw MCP import already gets for free
  - what a host-native Claude-first migration already gets for free
  - what still required explicit workflow and packaging refinement
- finish the Exa host-runtime proof block when the local environment permits:
  - Claude CLI connection issue
  - Codex CLI model/account/runtime issue
- treat the current scaffold and Orchid read-only proof as complete:
  - `example/docs-ops`
  - `example/docs-ops/ORCHID-READONLY-DEMO.md`
- treat the core-four build/install/verify proof as complete:
  - `docs/docs-ops-core-four-proof.md`
- treat the first concrete rewrite proof as complete:
  - `example/docs-ops/demo-rewrites/orchid-components-accordion.before.md`
  - `example/docs-ops/demo-rewrites/orchid-components-accordion.after.md`
- treat the installed Codex plugin proof as complete:
  - `docs/orchid-docs-ops-codex-walkthrough.md`
- treat the official CLI inspect/rewrite proof as complete across:
  - Claude Code
  - Cursor
  - Codex
  - OpenCode
  - `docs/docs-ops-core-four-proof.md`
- treat the first cleaner public-facing packaging pass as in place:
  - `docs/proof-and-install.md`
  - `site/examples/docs-ops-flagship.mdx`
- capture at least one polished in-app walkthrough outside Codex
- document what the example preserves vs translates vs degrades across the core four
- explicitly cover richer Claude skill capabilities where useful:
  - supporting files / references
  - scripts
  - `context: fork`
  - more sophisticated skill behaviors
- treat the write/publish auth surface as mechanically separated and source-modeled:
  - `docs/docs-ops-authenticated-publish-path.md`
- prove a real authenticated publish plus rollback only after a safe private endpoint exists
- use that reference plugin as:
  - a proof fixture
  - a demo target
  - a regression surface

### 3. Docs and website ingestion

Goal:

- turn docs ingestion from “implemented” into “obviously useful”

Open work:

- treat the connector-backed comparison as captured:
  - [docs/strategy/firecrawl-connector-docs-ingestion-proof.md](../strategy/firecrawl-connector-docs-ingestion-proof.md)
- treat the keyed local fixture snapshot as captured:
  - [docs/strategy/docs-ingestion-fixture-eval.md](../strategy/docs-ingestion-fixture-eval.md)
- treat the live scaffold before/after demo as captured:
  - [docs/strategy/docs-ingestion-scaffold-before-after.md](../strategy/docs-ingestion-scaffold-before-after.md)
- use the fixture snapshots to improve the weak cases the harness now exposes
- tighten signal extraction further:
  - product description quality
  - workflow hint quality
  - code-snippet/chrome filtering in setup/auth hints

### 4. Release-grade Pluxx plugin

Goal:

- make the Pluxx plugin itself feel like a real install surface and operator UX

Open work:

- harden metadata, prompts, screenshots, and install guidance
- keep the plugin thin and the CLI as the execution engine
- keep `example/pluxx`, `plugins/pluxx`, and the published `pluxx-plugin` repo in sync
- keep [docs/pluxx-plugin-surface-audit.md](../pluxx-plugin-surface-audit.md) accurate now that lifecycle coverage is present
- treat the local self-hosted core-four proof as complete:
  - [docs/pluxx-self-hosted-core-four-proof.md](../pluxx-self-hosted-core-four-proof.md)
- treat the first repo-native public proof/install landing page as complete:
  - [docs/proof-and-install.md](../proof-and-install.md)
- keep turning that landing page into a cleaner visual public asset
- keep the new flagship public example page aligned with the repo proof stack:
  - `site/examples/docs-ops-flagship.mdx`
- evaluate whether a `gh skill`-compatible export/publish path makes sense for the skills-only slice of a Pluxx project
- decide later whether distribution should stay in the main repo or move to a dedicated plugin/marketplace repo

### 5. GTM and audience

Goal:

- turn the shipped OSS product into a sharp outreach and learning motion without overcommitting to the later trust layer

Open work:

- run two explicit lanes:
  - MCP vendors that need a better native agent experience
  - internal AI platform / DevEx teams as design partners for the later trust layer
- turn the local core-four proof into demo and outreach material
- keep refining the public OSS wedge story:
  - one maintained source project
  - native bundles across the core four
  - install verification and truthful compatibility

### 6. Next release

Goal:

- publish the next npm cut after the story, examples, and plugin surfaces are coherent enough to ship together

Open work:

- validate the current self-hosting/plugin flow
- run tests and release smoke
- cut the next npm version after the clarity/docs/plugin polish lands

## Explicitly Deferred

These are real, but not the current queue:

- hosted governance / control-plane features
- marketplace / commerce complexity
- private registry / enterprise distribution complexity
- org-wide telemetry and adoption analytics as a product
- provenance / signing / trust-layer features beyond initial design
- deep governance features without present demand

## Working Rule

Right now the priority order is:

1. keep the product story and source-of-truth docs clean
2. make the OSS authoring substrate obviously useful
3. prove richer plugin depth with a flagship example
4. make the Pluxx plugin itself excellent
5. use customer discovery to learn where the later trust layer should go
6. then ship the next release
