# Master Backlog

Last updated: 2026-04-23

This is the most complete repo-native backlog for Pluxx.

Use this file when you want the broadest view of what still needs to happen across product, proof, docs, GTM, and the later trust layer.

This is not the same thing as the short queue.

- Use [queue.md](./queue.md) for the active operational queue.
- Use [start-here.md](../start-here.md) for orientation.
- Use [roadmap.md](../roadmap.md) for direction.
- Use [Linear](https://linear.app/orchid-automation) for ticket-level sequencing, ownership, and issue-by-issue detail.

## Doc Links

- Role: broadest repo-native backlog
- Related:
  - [docs/start-here.md](../start-here.md)
  - [queue.md](./queue.md)
  - [docs/roadmap.md](../roadmap.md)
  - [docs/oss-wedge-and-trust-layer.md](../oss-wedge-and-trust-layer.md)
  - [docs/flagship-docs-ops-plugin.md](../flagship-docs-ops-plugin.md)
  - [docs/pluxx-plugin-surface-audit.md](../pluxx-plugin-surface-audit.md)
  - [Linear](https://linear.app/orchid-automation)
- Update together:
  - [docs/start-here.md](../start-here.md)
  - [queue.md](./queue.md)
  - [docs/roadmap.md](../roadmap.md)

## How To Read This

The backlog is grouped by horizon:

- `Now`: work that should shape the next real execution block
- `Next`: work that matters soon, but is not the immediate center
- `Later`: work that is strategically important, but should not drive the current build

Within each section:

- `[ ]` means still open
- `[~]` means partially underway or structurally in place
- `[x]` means materially shipped and included here only when it unlocks follow-on work

## Source-Of-Truth Stack

If these files ever disagree, resolve them in this order:

1. `docs/start-here.md`
2. `docs/todo/queue.md`
3. `docs/todo/master-backlog.md`
4. `docs/roadmap.md`
5. Linear

The goal is simple:

Any person or agent should be able to enter the repo and answer:

- what Pluxx is
- what is already shipped
- what matters next
- what is deferred
- where the business could go later

## Now

### 1. Product clarity and front-door coherence

- [~] Keep [start-here.md](../start-here.md), [queue.md](./queue.md), this file, and Linear aligned
- [~] Keep the README top section, website hero, GitHub About metadata, and docs homepage messaging aligned
- [ ] Remove or rewrite any stale docs that still describe already-shipped work as future work
- [ ] Decide which docs are public product docs vs strategy docs vs internal-only GTM docs
- [ ] Move account-specific GTM and customer notes out of the public repo
- [ ] Define a simple rule for when repo docs should be updated alongside Linear

### 2. Flagship reference plugin

Goal:

- prove that Pluxx handles rich native plugin depth, not just basic MCP wrapping

Open work:

- [~] Build the chosen flagship example from a single maintained source project:
  - Docsalot-style `docs-ops`
- [ ] Use [docs/flagship-docs-ops-plugin.md](../flagship-docs-ops-plugin.md) as the concrete build spec
- [~] Keep the scaffold and live read-only Orchid proof in place:
  - `example/docs-ops`
  - `example/docs-ops/ORCHID-READONLY-DEMO.md`
- [x] Capture one cleaner before/after rewrite artifact on a real Orchid docs page:
  - `example/docs-ops/demo-rewrites/orchid-components-accordion.before.md`
  - `example/docs-ops/demo-rewrites/orchid-components-accordion.after.md`
- [x] Prove the generated plugin can be installed and used in Codex against the live Orchid Docsalot MCP:
  - `docs/orchid-docs-ops-codex-walkthrough.md`
- [ ] Exercise richer Claude skill surfaces where useful:
  - supporting files / references
  - scripts
  - `context: fork`
  - more advanced skill behavior
- [ ] Exercise the best equivalent native surfaces in Cursor, Codex, and OpenCode
- [ ] Use the reference plugin as:
  - a product demo
  - a regression fixture
  - a docs anchor
  - a sales proof asset
- [ ] Separate the public read-only Docsalot MCP proof from the private write/publish auth path
- [ ] Document what is truly preserved vs translated vs degraded across the core four in this example

### 3. Docs and website ingestion proof

Goal:

- make docs ingestion visibly useful, not just implemented

Open work:

- [ ] Rerun `npm run eval:docs-ingestion` with a real Firecrawl key
- [ ] Compare `local` vs `firecrawl` results directly
- [ ] Capture a live before/after demo:
  - source URLs
  - selected pages
  - `.pluxx/sources.json`
  - `.pluxx/docs-context.json`
  - scaffold improvements
- [ ] Improve weak cases exposed by the fixture harness
- [ ] Tighten signal extraction:
  - product description quality
  - setup/auth hint quality
  - workflow hint quality
  - code-snippet/chrome filtering
- [ ] Decide whether ingestion should stay a context-prep layer or grow into a more explicit scaffold-quality comparison harness

### 4. Release-grade Pluxx plugin

Goal:

- make the Pluxx plugin itself feel polished and real

Open work:

- [ ] Harden metadata, prompts, screenshots, and install guidance
- [ ] Verify the self-hosted plugin path across Claude Code, Cursor, Codex, and OpenCode
- [ ] Keep the plugin thin and the CLI as the execution engine
- [ ] Close the plugin workflow coverage gap documented in `docs/pluxx-plugin-surface-audit.md`
- [ ] Add first-class plugin workflows for:
  - `verify-install`
  - `publish`
  - `autopilot`
  - explicit context-prep / docs-ingestion
- [ ] Decide what belongs in `example/pluxx` vs `plugins/pluxx`
- [ ] Decide whether plugin distribution should stay in this repo or move later
- [ ] Decide the public install/distribution UX for docs and marketplace-like surfaces:
  - direct install commands
  - one-click install buttons where hosts support them
  - how much Pluxx should abstract host-specific install flows vs expose them clearly

### 5. Public site and docs polish

- [~] Keep the homepage story centered on the one-to-many promise:
  - one maintained plugin source
  - four native destinations
  - no four drifting repos
- [ ] Add stronger proof sections to the site:
  - source project in
  - native bundles out
  - compatibility / truthful native mapping
  - install verification
- [ ] Tighten mobile layout bugs and overflow issues
- [ ] Make the docs/site structure easier for new visitors to scan quickly
- [ ] Turn the current proof assets into cleaner demo pages and screenshots

### 6. Customer discovery and GTM

Goal:

- learn where the strongest near-term pull actually is

Open work:

- [ ] Run two explicit customer lanes:
  - MCP vendors
  - internal AI platform / DevEx teams
- [ ] Build a short target list for each lane
- [ ] Create a lightweight outreach brief and demo flow for each lane
- [ ] Use real examples like PlayKit and the self-hosted Pluxx plugin as proof
- [ ] Keep public OSS messaging separate from later enterprise messaging
- [ ] Use the enterprise thesis in founder-led conversations, not as the public default story
- [ ] Keep named prospect lists, account research, and outreach notes in the private GTM workspace rather than the public repo
- [ ] Keep market/comparable-company notes in the private GTM workspace:
  - open-core references
  - pricing / packaging references
  - adjacent tooling like API/MCP infrastructure platforms

### 7. Next release readiness

- [ ] Validate the current self-hosting flow end to end
- [ ] Run tests and release smoke before the next cut
- [ ] Ship the next npm version once the story, plugin, and proof surfaces feel coherent together

## Next

### 8. Import and discovery depth

These are already part of the strategy direction and should stay in view:

- [ ] Import beyond plain `tools/list` when possible
- [ ] Improve MCP resource and resource-template awareness
- [ ] Improve prompt-template awareness where useful
- [ ] Make imported projects feel less generic and more product-shaped from the start

### 9. Auth depth

- [ ] Improve truthful auth/import behavior for real remote MCPs
- [ ] Keep OAuth-ready scaffold support moving in the right direction
- [ ] Make auth hints and validation clearer in generated outputs

### 10. Eval depth and regression confidence

- [~] Keep `pluxx eval` meaningful as a product surface, not just a maintainer nicety
- [ ] Expand regression coverage where prompt-pack quality still feels too subjective
- [ ] Use the flagship plugin and docs-ingestion flow as stable eval fixtures

### 11. Migration and sync depth

- [ ] Keep `pluxx migrate` strong enough to be a true adoption wedge
- [ ] Keep `pluxx sync` safe enough that users trust refreshing from the MCP without losing human edits
- [ ] Improve change visibility after sync

### 12. Compatibility and truthfulness

- [ ] Keep the core-four compatibility matrix current
- [ ] Make preserve/translate/degrade/drop more visible in docs and demos
- [ ] Avoid promising equal support across hosts when the product cannot prove it

## Later

### 13. Trust / distribution layer

This is a plausible later business, not the current build center.

- [ ] Organization-wide rollout
- [ ] Managed plugin distribution
- [ ] Version channels
- [ ] Approval and policy controls
- [ ] Runtime health visibility
- [ ] Adoption analytics
- [ ] Governance surfaces

### 14. Enterprise packaging

- [ ] Decide what the paid layer actually is
- [ ] Decide what stays OSS and what becomes operated product
- [ ] Decide whether enterprise features belong in this repo, a companion repo, or a hosted control plane

### 15. Marketplace and registry ideas

- [ ] Decide whether Pluxx should ever own a marketplace
- [ ] Decide whether Pluxx should ever own a private registry
- [ ] Avoid building commerce complexity before the authoring substrate is clearly winning

### 16. Provenance and trust

- [ ] Signing
- [ ] provenance
- [ ] trust-layer validation beyond the initial authoring workflow

## Explicitly Not The Current Build Center

These ideas may be real later, but they should not distort near-term prioritization:

- [ ] trying to support every host equally
- [ ] turning Pluxx into a generic AI control plane right now
- [ ] overbuilding analytics before real demand
- [ ] overbuilding enterprise governance before clear design-partner pull
- [ ] turning the public repo into a private GTM notebook

## Current Strategic Bets

These are the bets the repo is currently making.

### Bet 1

The OSS authoring substrate is the right first wedge.

### Bet 2

The one-to-many story is stronger than “cross-host compiler” alone.

### Bet 3

Raw MCP access is not enough; users need workflow shaping and native packaging.

### Bet 4

The later enterprise opportunity is real, but should be earned after the OSS wedge proves itself.

### Bet 5

The best near-term proof is not a longer strategy memo.

It is:

- one flagship reference plugin
- one live docs-ingestion demo
- one clean self-hosted plugin flow

## Suggested Immediate Sequence

If someone needs the next concrete path without reopening strategy debates:

1. Finish any remaining clarity drift between repo docs and Linear.
2. Build the flagship reference plugin.
3. Capture the live docs-ingestion proof.
4. Polish the self-hosted Pluxx plugin.
5. Run customer discovery in the two explicit lanes.
6. Cut the next release once those surfaces feel coherent together.

## Linear Note

This file is the comprehensive repo-native backlog.

Linear is where the detailed execution layer should live:

- issue-by-issue scope
- ownership
- project grouping
- state changes
- acceptance criteria when the work needs more precision

Workspace:

- [Orchid Automation Linear](https://linear.app/orchid-automation)
