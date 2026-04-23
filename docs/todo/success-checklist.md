# Pluxx Success Checklist

Last updated: 2026-04-23

## Doc Links

- Role: comprehensive execution and completeness checklist
- Related:
  - [docs/start-here.md](../start-here.md)
  - [queue.md](./queue.md)
  - [master-backlog.md](./master-backlog.md)
  - [docs/roadmap.md](../roadmap.md)
  - [docs/core-four-provider-docs-audit.md](../core-four-provider-docs-audit.md)
  - [docs/core-four-install-update-lifecycle.md](../core-four-install-update-lifecycle.md)
  - [docs/flagship-docs-ops-plugin.md](../flagship-docs-ops-plugin.md)
  - [docs/pluxx-plugin-surface-audit.md](../pluxx-plugin-surface-audit.md)
  - [docs/pluxx-self-hosted-core-four-proof.md](../pluxx-self-hosted-core-four-proof.md)
  - [Linear](https://linear.app/orchid-automation)
- Update together:
  - [docs/start-here.md](../start-here.md)
  - [queue.md](./queue.md)
  - [master-backlog.md](./master-backlog.md)
  - [docs/roadmap.md](../roadmap.md)

Use this file when you want the broadest “are we actually covered?” view.

This is not the same as:

- [queue.md](./queue.md), which is the short active block
- [master-backlog.md](./master-backlog.md), which is the broad horizon backlog

This checklist is for completeness.

If the answer to too many items here is still “no,” Pluxx is not yet set up as cleanly as it should be for the next serious push.

## How To Use This Doc

- `[ ]` means missing
- `[~]` means underway or partially true
- `[x]` means materially true today

Do not treat every unchecked item as an immediate blocker.

Use this file to:

- spot blind spots
- make sure the current push is balanced
- avoid overinvesting in one lane while another important lane quietly drifts

## 1. Product Truth And Story

- [x] There is one short repo-level explanation of what Pluxx is:
  - [docs/start-here.md](../start-here.md)
- [x] The one-sentence product truth is stable:
  - one maintained plugin source project
  - native outputs across Claude Code, Cursor, Codex, and OpenCode
- [x] The repo clearly distinguishes:
  - the real OSS authoring substrate
  - the later trust / distribution layer
- [~] README, docs homepage, GitHub About, and top-level docs all tell the same story
- [ ] No stale front-door doc still frames already-shipped work as future work
- [ ] The website and docs front door show the product proof as clearly as the repo docs now do

## 2. Canonical Planning And Doc Hygiene

- [x] The canonical planning docs live in `docs/todo/`
- [x] The repo has a short queue:
  - [queue.md](./queue.md)
- [x] The repo has a broad backlog:
  - [master-backlog.md](./master-backlog.md)
- [x] The repo now has a completeness checklist:
  - this file
- [~] The planning stack is aligned:
  - [docs/start-here.md](../start-here.md)
  - [queue.md](./queue.md)
  - [master-backlog.md](./master-backlog.md)
  - [docs/roadmap.md](../roadmap.md)
  - Linear
- [x] A simple standing rule exists for when Linear changes should trigger repo-doc updates and vice versa:
  - [AGENTS.md](../../AGENTS.md)
- [ ] The remaining stale secondary docs have been reconciled or explicitly marked as historical

## 3. Host Truth And Compatibility Truth

- [x] A machine-readable host capability registry exists:
  - [src/validation/platform-rules.ts](../../src/validation/platform-rules.ts)
- [x] A generated compatibility doc exists:
  - [docs/compatibility.md](../compatibility.md)
- [x] A conceptual primitive matrix exists:
  - [docs/core-four-primitive-matrix.md](../core-four-primitive-matrix.md)
- [x] A first-party provider audit exists:
  - [docs/core-four-provider-docs-audit.md](../core-four-provider-docs-audit.md)
- [x] A host lifecycle matrix exists:
  - [docs/core-four-install-update-lifecycle.md](../core-four-install-update-lifecycle.md)
- [~] The runtime, installer, and docs surfaces all reflect the current audited host truth
- [ ] The remaining downstream generator and maintainer docs that still embed older assumptions have been reconciled
- [ ] Preserve / translate / degrade / drop behavior is visible enough that a user can predict what Pluxx will do per host

## 4. OSS Authoring Substrate Quality

- [x] `init` is real
- [x] `autopilot` is real
- [x] `doctor` is real
- [x] `lint` is real
- [x] `eval` is real
- [x] `build` is real
- [x] `test` is real
- [x] `install` is real
- [x] `verify-install` is real
- [x] `migrate` is real
- [x] `sync` is real
- [x] `mcp proxy --record/--replay` is real
- [~] The command lifecycle is documented clearly enough for a brand-new user starting from a raw MCP
- [ ] The best command-by-command docs feel polished and complete rather than repo-maintainer-centric
- [ ] The deterministic CLI and the host-plugin UX tell the same execution story without drift

## 5. Flagship Proof Surface

- [x] A flagship reference plugin exists:
  - `example/docs-ops`
- [x] The flagship spec exists:
  - [docs/flagship-docs-ops-plugin.md](../flagship-docs-ops-plugin.md)
- [x] The flagship example is wired to a live public Docsalot MCP surface
- [x] There is at least one real before/after rewrite artifact
- [x] There is at least one installed-plugin proof in Codex
- [ ] The same level of proof has been repeated across Claude Code, Cursor, and OpenCode
- [ ] The flagship example clearly demonstrates what is preserved vs translated vs degraded across the core four
- [ ] The private write/publish auth path has been separated and tested as its own follow-on proof
- [ ] The flagship example has been turned into a clean public-facing demo asset

## 6. Self-Hosted Pluxx Plugin Quality

- [x] `example/pluxx` exists as the maintained source project
- [x] `plugins/pluxx` exists as the repo-local Codex dogfood surface
- [x] The published `pluxx-plugin` repo exists
- [x] The plugin workflow coverage gap has been closed
- [x] A real local build/install/verify proof exists for the self-hosted plugin across Claude Code, Cursor, Codex, and OpenCode:
  - [docs/pluxx-self-hosted-core-four-proof.md](../pluxx-self-hosted-core-four-proof.md)
- [~] `example/pluxx`, `plugins/pluxx`, and the published plugin repo are staying aligned
- [~] Install/update guidance is now much more truthful across the core four
- [~] Metadata, screenshots, prompts, and store/listing quality are moving in the right direction, but are not polished enough yet
- [~] Release automation is healthier now, but tagged GitHub release publishing still needs one fresh fully automatic proof
- [ ] The public install/update experience is excellent enough that a new user can succeed quickly without reading half the repo

## 7. Docs And Website Ingestion Proof

- [x] Docs ingestion exists as a real surface
- [x] Deterministic artifacts exist:
  - `.pluxx/sources.json`
  - `.pluxx/docs-context.json`
- [ ] A real Firecrawl-backed comparison has been run and documented clearly
- [ ] A live before/after scaffold improvement demo exists
- [ ] The fixture harness weak cases have been tightened based on real eval output
- [ ] The resulting proof is strong enough to use in docs, demos, and outreach

## 8. Distribution And Install UX

- [x] Host-specific install scripts can be generated at publish time
- [x] The Codex installer path is proven live from a real GitHub release
- [~] Install/update/reload guidance is now documented honestly
- [ ] One-click or near-one-click install UX is defined clearly per host
- [ ] The release asset and docs experience is clean enough that a user does not need repo context to install
- [ ] The future embeddable install component direction is captured and intentionally scoped

## 9. Public Site, Docs, And Proof Assets

- [~] The repo docs are clearer than they were
- [ ] The site hero and key pages reflect the stronger current proof
- [ ] The docs homepage and getting-started path reflect the current product truth
- [ ] Proof artifacts have dedicated, clean public presentation:
  - source project in
  - native outputs out
  - install verification
  - flagship example
  - compatibility truth
- [ ] Mobile and layout polish issues are not undermining the credibility of the public surface

## 10. GTM And Learning Motion

- [~] The target near-term users are clear:
  - MCP vendors
  - internal AI platform / DevEx teams
- [~] Public OSS messaging is cleaner than the private enterprise thesis
- [ ] The current proof assets are packaged into usable demo and outreach flows
- [ ] There is a consistent founder/demo narrative for:
  - raw MCP is not enough
  - one source project is better than four drifting repos
  - Pluxx handles truthful native translation
- [ ] GTM-sensitive account research and outreach notes are fully out of the public repo

## 11. Release Readiness

- [x] The npm package is live
- [x] Node runtime expectation is clear
- [~] The next release surface is much cleaner than before
- [ ] The next release should only happen after:
  - core proof assets are coherent
  - self-hosted plugin story is polished
  - install/update story is clear
  - docs/site front door is consistent
- [~] Release smoke across the core four has been rerun after the latest compatibility and lifecycle fixes
- [ ] The release notes/story tell one coherent “why this release matters” narrative

## 12. Operational Safety

- [x] The repo distinguishes public product docs from private GTM material
- [x] The docs now have visible dependency links for coordinated updates
- [~] Important proof and planning artifacts are easier for humans and agents to keep aligned
- [ ] The remaining high-churn docs have enough structure that future edits are unlikely to reintroduce major drift
- [x] The repo has a simple repeatable routine for:
  - host-doc audit
  - compatibility update
  - proof rerun
  - docs refresh
  - release decision
  - [docs/core-four-maintenance-routine.md](../core-four-maintenance-routine.md)

## 13. Definition Of “Set Up For Success”

Pluxx is set up for success when all of these are true at the same time:

- the product truth is stable
- the host truth is stable
- the flagship proof is convincing
- the self-hosted plugin feels excellent
- the docs-ingestion proof is obvious
- the install/update story is easy
- the public site and docs match the repo truth
- the next release can ship as one coherent story instead of a bag of unrelated progress

If one of those is still weak, that is probably where the next serious block of work belongs.
