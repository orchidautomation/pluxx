# Proof And Install

Last updated: 2026-04-23

## Doc Links

- Role: public-facing proof and install landing page
- Related:
  - [README.md](../README.md)
  - [docs/first-proof-demo-asset-pack.md](./first-proof-demo-asset-pack.md)
  - [docs/pluxx-self-hosted-core-four-proof.md](./pluxx-self-hosted-core-four-proof.md)
  - [docs/docs-ops-core-four-proof.md](./docs-ops-core-four-proof.md)
  - [docs/orchid-docs-ops-codex-walkthrough.md](./orchid-docs-ops-codex-walkthrough.md)
  - [docs/core-four-install-update-lifecycle.md](./core-four-install-update-lifecycle.md)
  - [docs/strategy/docs-ingestion-scaffold-before-after.md](./strategy/docs-ingestion-scaffold-before-after.md)
  - [docs/core-four-provider-docs-audit.md](./core-four-provider-docs-audit.md)
- Update together:
  - [README.md](../README.md)
  - [docs/first-proof-demo-asset-pack.md](./first-proof-demo-asset-pack.md)

This is the shortest current repo-native path to:

- understand what Pluxx already proves
- install the released self-hosted plugin in your host of choice
- run the strongest current demos in the right order

## The Story In One Screen

```text
raw MCP or host-native plugin
        ->
one maintained Pluxx source project
        ->
native Claude / Cursor / Codex / OpenCode bundles
        ->
install in the host you actually use
        ->
verify the installed bundle instead of trusting dist alone
```

## Fastest Proof Path

If you want the shortest credible answer to "is this real yet?", use this order:

1. [Self-hosted core-four proof](./pluxx-self-hosted-core-four-proof.md)
   What it proves: one maintained `example/pluxx` source project builds, installs, and passes `verify-install` across Claude Code, Cursor, Codex, and OpenCode.

2. [Docs Ops core-four proof](./docs-ops-core-four-proof.md)
   What it proves: the flagship `example/docs-ops` source project builds, installs, passes `verify-install`, and completes read-only inspect/rewrite workflows through the official Claude Code, Cursor, Codex, and OpenCode CLIs.

3. [Docs Ops live Codex walkthrough](./orchid-docs-ops-codex-walkthrough.md)
   What it proves: one maintained `docs-ops` source project compiles into a real in-app Codex plugin and talks to Orchid's live Docsalot MCP.

4. [Orchid Accordion before/after rewrite](../example/docs-ops/demo-rewrites/orchid-components-accordion.after.md)
   What it proves: the flagship example produces user-visible output, not just config files.

5. [Docs-ingestion scaffold before/after demo](./strategy/docs-ingestion-scaffold-before-after.md)
   What it proves: Firecrawl-backed sourced context changes the real generated scaffold, not just an eval row.

6. [Core-four provider docs audit](./core-four-provider-docs-audit.md)
   What it proves: the compatibility story is grounded in first-party provider docs, not hand-waving.

## Install The Released Pluxx Plugin

These commands install the released self-hosted `pluxx-plugin` from GitHub Releases.

### Claude Code

```bash
curl -fsSL https://github.com/orchidautomation/pluxx-plugin/releases/latest/download/install-claude-code.sh | bash
```

Then run `/reload-plugins`.

### Cursor

```bash
curl -fsSL https://github.com/orchidautomation/pluxx-plugin/releases/latest/download/install-cursor.sh | bash
```

Then reload the window or restart Cursor.

### Codex

```bash
curl -fsSL https://github.com/orchidautomation/pluxx-plugin/releases/latest/download/install-codex.sh | bash
```

Then use `Plugins > Refresh` if available, otherwise restart Codex.

### OpenCode

```bash
curl -fsSL https://github.com/orchidautomation/pluxx-plugin/releases/latest/download/install-opencode.sh | bash
```

Then reload or restart OpenCode.

For the fuller per-host install, update, and reload behavior, use [docs/core-four-install-update-lifecycle.md](./core-four-install-update-lifecycle.md).

## Run Pluxx From Source

If you want to prove the product without installing the released self-hosted plugin first, use the source workflow directly:

```bash
npx @orchid-labs/pluxx init --from-mcp https://example.com/mcp --name my-plugin --yes

cd my-plugin
npx @orchid-labs/pluxx doctor
npx @orchid-labs/pluxx lint
npx @orchid-labs/pluxx build
npx @orchid-labs/pluxx install --target codex --trust
npx @orchid-labs/pluxx verify-install --target codex
```

Swap `codex` for `claude-code`, `cursor`, or `opencode` when you want to validate a different host.

## Best Demo Flow

Use this when you want a clean founder demo, customer walkthrough, or investor pass:

1. Start with [README](../README.md)
   Frame: one maintained plugin source project, four native destinations.

2. Show [Self-hosted core-four proof](./pluxx-self-hosted-core-four-proof.md)
   Frame: installed-state verification is real.

3. Show [Docs Ops core-four proof](./docs-ops-core-four-proof.md)
   Frame: the flagship example is mechanically real across the core four, not only inside one host.

4. Show [Docs Ops live Codex walkthrough](./orchid-docs-ops-codex-walkthrough.md)
   Frame: raw MCP is not enough; shaped workflows matter.

5. Show the [Accordion before/after output](../example/docs-ops/demo-rewrites/orchid-components-accordion.after.md)
   Frame: the product changes user-visible output, not only internals.

6. Show [Docs-ingestion scaffold before/after demo](./strategy/docs-ingestion-scaffold-before-after.md)
   Frame: sourced product/docs context materially improves the scaffold.

7. Close with [Core-four provider docs audit](./core-four-provider-docs-audit.md)
   Frame: the compatibility story is truthful and provider-backed.

## What This Page Does Not Claim

This page is intentionally narrow.

It does not claim:

- the website is already the strongest public surface
- every host already has equally polished user-facing flagship proof yet
- the trust/distribution layer is already the main product

It does claim:

- the core product thesis is now backed by real repo-native proof
- the released self-hosted plugin has one-command install paths
- the current strongest demos can be followed without digging through maintainer notes
