# Current Proof And Demo Asset Pack

Last updated: 2026-04-23

This doc is the public-proof map for Pluxx.

Use it when you want the cleanest answer to:

- what proof already exists
- what claims that proof actually supports
- what proof is still missing
- what public-facing demo assets should be built next

This is no longer a speculative launch memo.

It is the current proof inventory plus the next capture plan.

If you want the shortest public-facing entrypoint instead of the fuller planning inventory, start with [docs/proof-and-install.md](./proof-and-install.md).

## The Claims That Matter

The current public proof should support these claims:

1. one maintained source project can ship native outputs for Claude Code, Cursor, Codex, and OpenCode
2. raw MCP is not enough; Pluxx shapes that raw surface into a better native workflow
3. installed-state verification is real, not just `dist/` screenshots
4. Pluxx is truthful about host differences instead of pretending every host works the same way

The biggest remaining missing claim is no longer docs-ingestion proof. It is cleaner public packaging of the proof that now exists.

The first pass of that packaging now exists at:

- [Proof and install guide](./proof-and-install.md)

## Proof That Already Exists

### 1. Self-hosted Pluxx plugin across the core four

Primary doc:

- [Self-hosted core-four proof](./pluxx-self-hosted-core-four-proof.md)

What it proves:

- `example/pluxx` is a real maintained source project
- it builds native bundles for Claude Code, Cursor, Codex, and OpenCode
- `pluxx install` works across the core four
- `pluxx verify-install` can prove the host-visible bundle state after install

Best public use:

- repo proof block
- install-trust story
- “one maintained source project” claim

### 2. Flagship docs workflow example in Codex

Primary doc:

- [Orchid Docs Ops Codex walkthrough](./orchid-docs-ops-codex-walkthrough.md)

What it proves:

- one maintained `docs-ops` source project can compile into a real Codex plugin
- the plugin can talk to Orchid’s live public Docsalot MCP
- the result is a useful workflow surface, not just raw tool output

Best public use:

- flagship product walkthrough
- Codex-native proof
- “raw MCP is not enough” story

### 3. Concrete before/after rewrite artifact

Primary files:

- [before](../example/docs-ops/demo-rewrites/orchid-components-accordion.before.md)
- [after](../example/docs-ops/demo-rewrites/orchid-components-accordion.after.md)

What it proves:

- the flagship example produces legible output, not just config files
- Pluxx can be shown through user-visible outcome, not only generator internals

Best public use:

- demo slide
- docs proof block
- founder demo narrative

### 4. Host-truth audit

Primary docs:

- [Core-four provider docs audit](./core-four-provider-docs-audit.md)
- [Core-four install and update lifecycle](./core-four-install-update-lifecycle.md)
- [Compatibility matrix](./compatibility.md)

What it proves:

- Pluxx is not hand-waving host support
- capability, lifecycle, and install behavior are grounded in first-party docs plus current observed host behavior

Best public use:

- trust and truthfulness narrative
- release notes
- technical buyer confidence

### 5. Connector-backed Firecrawl docs-ingestion proof

Primary doc:

- [Firecrawl connector docs-ingestion proof](./strategy/firecrawl-connector-docs-ingestion-proof.md)
- [Docs-ingestion scaffold before/after demo](./strategy/docs-ingestion-scaffold-before-after.md)

What it proves:

- a real Firecrawl-backed comparison now exists on the current fixture set
- Firecrawl materially improves extracted product/setup/auth/workflow context on those fixtures
- the docs-ingestion lane now has a committed scaffold-quality before/after demo, not only eval snapshots
- the remaining gap is now broader public packaging and continued fixture hardening, not basic proof-of-value

Best public use:

- docs-ingestion story
- demo script support
- product-proof bridge while broader public demo packaging catches up

## What Is Still Missing

### 1. Flagship example beyond Codex

Missing artifact:

- the same level of obvious, user-facing proof for Claude Code, Cursor, and OpenCode

Why it matters:

- the `docs-ops` flagship proof is strongest in Codex today
- the story gets better when the same source project feels native in more than one host

### 2. Cleaner public install proof asset

Missing artifact:

- one stronger visual/story asset than the current doc-only landing page showing:
  - source project in
  - native bundles out
  - install
  - verify-install

Why it matters:

- [docs/proof-and-install.md](./proof-and-install.md) is the right first packaging step, but it is still doc-led rather than a polished visual public asset

## Best Current Demo Flow

If you need the strongest current narrative without waiting on Firecrawl, use this order:

1. start with [README](../README.md) and [start-here](./start-here.md)
2. show [Self-hosted core-four proof](./pluxx-self-hosted-core-four-proof.md)
3. show [Orchid Docs Ops Codex walkthrough](./orchid-docs-ops-codex-walkthrough.md)
4. show the [Accordion before/after rewrite](../example/docs-ops/demo-rewrites/orchid-components-accordion.after.md)
5. show the [Docs-ingestion scaffold before/after demo](./strategy/docs-ingestion-scaffold-before-after.md)
6. close with [Core-four provider docs audit](./core-four-provider-docs-audit.md)

That sequence supports the current product story:

- one maintained source project
- native bundles across the core four
- real installed-state verification
- richer workflow surface than raw MCP alone
- truthful compatibility stance

## Next Asset Pack To Build

The next public-facing asset block should be:

### P0

- one clean self-hosted plugin proof panel
  - source project
  - built outputs
  - install/verify state
- one cleaner flagship docs-ops proof panel
  - source project
  - live MCP backend
  - rewrite result

### P1

- one Firecrawl docs-ingestion comparison panel
- one cross-host flagship comparison panel once Claude/Cursor/OpenCode proof catches up

## Working Rule

Do not treat every internal proof artifact as public proof automatically.

For public proof, prefer artifacts that show:

- the source project
- the user-facing outcome
- the installed host state
- the exact product claim being supported

Avoid turning public proof into:

- a pile of internal screenshots
- a changelog
- or a maintainer-only validation note
