# TODO

Last updated: 2026-05-01

Canonical files:

- [docs/todo/queue.md](./docs/todo/queue.md)
- [docs/todo/master-backlog.md](./docs/todo/master-backlog.md)

This file remains a compatibility mirror of the current outstanding work.
Edit the canonical files in `docs/todo/` first.

## Current Outstanding

### 1. Compiler hardening

- finish the shared hook translation registry beyond the first read-only slice:
  - move deeper generator routing truth into the registry
  - stop hand-maintaining hook translation rows in docs
- continue the new shared `skills` parser into a richer canonical skill spec:
  - carry more translation-aware metadata than the current line-oriented reader
  - reduce remaining skill-frontmatter loss and ad hoc serialization
- continue `commands` IR beyond `argument-hint` preservation:
  - richer argument/example/routing metadata
  - less lossy Codex/OpenCode degradation
- reduce lossy import paths in `migrate` and installed-MCP discovery
- finish portable installed hook env parity outside the Claude-only wrapper path

### 2. Product and planning truth

- keep `start-here`, `queue`, `master backlog`, `roadmap`, and Linear aligned
- remove or rewrite stale docs that still describe shipped work as future work
- keep public product docs separated from private GTM or account-specific material
- refresh provider-audit-driven compatibility and matrix docs

### 3. Flagship and proof

- keep pushing the `docs-ops` flagship example as the richest native reference plugin
- keep pushing `platform-change-ops` as the maximal enterprise all-primitive stress fixture
  - core-four installed-state proof is now green, including the real Claude cache install path
  - the remaining gap is turning it from a maintained stress fixture into a fuller public proof stack
- close the Exa import delta:
  - get raw `init --from-mcp`, `autopilot`, and `migrate` closer to the final polished workflow shape
- capture at least one polished in-app walkthrough outside Codex
- prove a safe authenticated publish plus rollback path

### 4. Ingestion and packaging

- improve weak docs-ingestion cases exposed by the fixture harness
- tighten product-description, workflow-hint, and setup/auth signal extraction
- polish public proof/install packaging and install/distribution assets
- keep the self-hosted plugin, published plugin repo, and proof docs aligned
