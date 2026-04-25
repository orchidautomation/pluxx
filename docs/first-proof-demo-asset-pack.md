# Current Proof And Demo Asset Pack

Last updated: 2026-04-24

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
- [Docs Ops authenticated publish path](./docs-ops-authenticated-publish-path.md)
- [Exa Research Example](./exa-research-example.md)

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

### 2b. Flagship docs workflow example across the core four

Primary doc:

- [Docs Ops core-four proof](./docs-ops-core-four-proof.md)

What it proves:

- the flagship `example/docs-ops` source project builds native bundles for Claude Code, Cursor, Codex, and OpenCode
- `pluxx install` works for the flagship example across the core four
- `pluxx verify-install` confirms the installed host-visible state for the flagship example too

Best public use:

- bridge between the self-hosted proof and the narrower live Codex walkthrough
- proof that the flagship example is mechanically real beyond one host
- cleaner install-story support for the flagship lane

### 2c. Flagship authenticated publish split

Primary doc:

- [Docs Ops authenticated publish path](./docs-ops-authenticated-publish-path.md)

What it proves:

- the public Orchid MCP endpoint is no longer being treated as a publish surface
- the private authoring lane is now source-modeled through `userConfig`
- install/runtime config and publish gating have now been exercised mechanically

Best public use:

- honest auth-story support for the flagship lane
- proof that Pluxx is shaping more than read-only MCP access
- bridge from the public read-only Orchid proof to a future real private publish proof

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

### 3b. Clean-room Exa-style research architecture

Primary doc:

- [Exa Research Example](./exa-research-example.md)

What it proves:

- a strong Claude-first research-operator shape can be rebuilt cleanly from one Pluxx source project
- the source project can carry specialist agents, commands, auth, hooks, and rich brand metadata together
- the example is already mechanically real across Claude Code, Cursor, Codex, and OpenCode
- a real public example can pressure-test the compiler and improve it

Best public use:

- MCP-vendor outreach
- “raw MCP is not enough” narrative
- proof that Pluxx can port subagent-heavy architecture without copying private plugin internals

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

### 1. More visual public packaging for the current proof stack

Missing artifact:

- one stronger visual asset that shows:
  - source project in
  - native bundles out
  - install and verify
  - live flagship workflow
  - clean-room Exa architecture lane
  - separate authenticated publish lane

Why it matters:

- the repo docs now prove the story honestly
- the public site/docs still need a tighter visual and screenshot-led surface

### 2. Polished in-app walkthrough beyond Codex

Missing artifact:

- one polished in-app walkthrough outside Codex

Why it matters:

- the current CLI/headless proof is now real across all four
- the in-app flagship story is still most legible in Codex today

### 3. Live private publish / rollback proof

Missing artifact:

- one safe end-to-end authenticated publish and rollback run against a private sandbox target

Why it matters:

- the private publish lane is now modeled and mechanically guarded
- the last missing flagship auth proof is a real private endpoint, not more source-project work

## Best Current Demo Flow

If you need the strongest current narrative without waiting on Firecrawl, use this order:

1. start with [README](../README.md) and [start-here](./start-here.md)
2. show [Self-hosted core-four proof](./pluxx-self-hosted-core-four-proof.md)
3. show [Docs Ops core-four proof](./docs-ops-core-four-proof.md)
4. show [Orchid Docs Ops Codex walkthrough](./orchid-docs-ops-codex-walkthrough.md)
5. show the [Accordion before/after rewrite](../example/docs-ops/demo-rewrites/orchid-components-accordion.after.md)
6. show the [Docs-ingestion scaffold before/after demo](./strategy/docs-ingestion-scaffold-before-after.md)
7. close with [Core-four provider docs audit](./core-four-provider-docs-audit.md)

That sequence supports the current product story:

- one maintained source project
- native bundles across the core four
- real installed-state verification
- richer workflow surface than raw MCP alone
- truthful compatibility stance

## Next Asset Pack To Build

The next public-facing asset block should be:

### P0

- one stronger visual self-hosted plugin proof panel
- one stronger visual docs-ops flagship proof panel
- one screenshot-led install and verify panel

### P1

- one Firecrawl docs-ingestion comparison panel
- one live private publish / rollback panel once the sandbox endpoint exists

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
