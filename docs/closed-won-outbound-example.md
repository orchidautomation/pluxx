# Closed-Won Outbound Example

Last updated: 2026-04-29

## Doc Links

- Role: first-class GTM workflow example for closed-won expansion into outbound pipeline
- Related:
  - [README.md](../README.md)
  - [docs/proof-and-install.md](./proof-and-install.md)
  - [docs/start-here.md](./start-here.md)
  - [docs/todo/queue.md](./todo/queue.md)
  - [docs/todo/master-backlog.md](./todo/master-backlog.md)
  - [docs/roadmap.md](./roadmap.md)
  - [example/closed-won-outbound/README.md](../example/closed-won-outbound/README.md)
  - [example/closed-won-outbound/pluxx.config.ts](../example/closed-won-outbound/pluxx.config.ts)
  - [site/examples/closed-won-outbound-example.mdx](../site/examples/closed-won-outbound-example.mdx)
- Update together:
  - [README.md](../README.md)
  - [docs/proof-and-install.md](./proof-and-install.md)
  - [docs/start-here.md](./start-here.md)
  - [docs/todo/queue.md](./todo/queue.md)
  - [docs/todo/master-backlog.md](./todo/master-backlog.md)
  - [docs/roadmap.md](./roadmap.md)

Use this doc when you want the shortest honest explanation of the closed-won outbound example:

- what it is
- why it matters
- what is native today
- what still depends on thin adapters
- what is still missing for live proof

## What It Is

The source project is:

- [example/closed-won-outbound](../example/closed-won-outbound)

It is a first-class Pluxx example for a real GTM motion:

- closed-won deals in
- best-customer cohort selection
- lookalike company discovery
- persona mapping
- CRM dedupe
- enrichment
- campaign-tagged pipeline handoff

Unlike the live `docs-ops` proof and the clean-room Exa example, this example is intentionally honest about current adapter boundaries.

It proves the workflow shape and source-project design now.

It does not yet claim live provider-backed end-to-end proof from this repo.

## Why It Matters

This example proves something different from the existing public examples.

`docs-ops` proves a rich docs workflow.

The Exa example proves clean-room research architecture and cross-host packaging.

This closed-won outbound example proves that Pluxx can also model a higher-value business workflow that is:

- multi-stage
- multi-system
- stateful
- dedupe-sensitive
- operator-facing

That matters because the product claim is not only “we can wrap MCPs.”

The stronger claim is:

- one maintained source project can express a real workflow layer around multiple adapters
- Pluxx can keep the workflow honest even when some backing integrations are still thin adapters or placeholders

## Source Shape

The example models these workflow entrypoints:

- `closed-won-outbound`
- `segment-best-customers`
- `find-lookalikes`
- `map-buying-committee`
- `dedupe-crm`
- `enrich-prospects`
- `stage-outbound-handoff`
- `review-workflow-gaps`

And these specialist agents:

- `cohort-analyst`
- `lookalike-analyst`
- `persona-scout`
- `dedupe-guardian`
- `enrichment-operator`
- `handoff-reviewer`

The runtime model is expressed through the same operator-facing MCP grouping style called out in the ticket:

- `crm.*`
- `lead.*`
- `research.*`
- `pipeline.*`
- `runtime.*`

## Native Today Vs Adapter Required

### Native in Pluxx today

These parts are already native product surface:

- one maintained source project
- commands, skills, and specialist agents
- hooks and setup guidance
- multi-MCP wiring
- permission modeling
- user-config prompts for auth
- brand metadata and installable bundle generation
- `doctor`, `lint`, `build`, `install`, and `verify-install` surfaces

### Thin adapters this example expects

These are the workflow boundaries the example assumes can exist behind MCPs:

- pulling closed-won accounts or opportunities from a CRM source of truth
- ranking or generating lookalike companies
- discovering and enriching target personas
- deduplicating against CRM state and active pipeline
- upserting tagged records into the outbound or CRM destination
- writing operator-facing handoff artifacts

That is why the example models five MCP groups instead of pretending one public MCP already does everything.

### Still placeholders in v1

This example is still intentionally not claiming:

- exact best-customer scoring logic
- exact Ocean-style similarity parity
- exact LinkedIn, enrichment, or CRM provider bindings
- live behavioral smoke against real endpoints

Those are the next proof steps, not the current claim.

## Smallest Next Step To Turn This Into Live Proof

The smallest honest next step is not “write more docs.”

It is:

1. bind the placeholder `crm.*`, `lead.*`, `research.*`, `pipeline.*`, and `runtime.*` groups to real adapters
2. run `doctor`, `lint`, `build`, `install`, and `verify-install` on the source project
3. capture one end-to-end operator run that produces a campaign-tagged prospect handoff

Once that exists, this example stops being primarily a workflow-design proof and becomes a runtime-backed proof asset.

## Result

This example now gives Pluxx a third first-class public shape:

- docs operations
- research operator pack
- closed-won outbound workflow

That is useful for product, docs, and GTM because it shows Pluxx can represent a more business-critical motion than scaffolding mechanics alone.
