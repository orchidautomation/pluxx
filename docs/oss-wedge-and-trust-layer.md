# OSS Wedge And Trust Layer

Last updated: 2026-04-17

## Doc Links

- Role: product framing
- Related:
  - [docs/start-here.md](./start-here.md)
  - [docs/todo/queue.md](./todo/queue.md)
  - [docs/todo/master-backlog.md](./todo/master-backlog.md)
  - [docs/roadmap.md](./roadmap.md)
- Update together:
  - [docs/start-here.md](./start-here.md)
  - [docs/roadmap.md](./roadmap.md)

This doc explains the current strategic direction for Pluxx.

It is intentionally simpler than the full roadmap:

- [docs/todo/queue.md](./todo/queue.md) is the live queue
- [Roadmap](./roadmap.md) is the execution direction
- this doc is the product framing behind both

## The Core Decision

Pluxx should be built in two layers.

### Layer 1: OSS Authoring Substrate

This is the thing Pluxx must be excellent at now.

It includes:

- `init`
- `sync`
- `lint`
- `doctor`
- `test`
- `build`
- `install`
- `agent prepare`
- `agent prompt`
- `autopilot`
- future authoring leverage like `migrate`, evals, and record/replay

The goal of this layer is simple:

> make Pluxx the default way to author and maintain a real cross-host plugin from one source project

This layer should stay generous and easy to adopt.

## Why The OSS Layer Comes First

Pluxx's current wedge is not "premium features inside a CLI."

It is:

- one source of truth across hosts
- truthful MCP import and sync
- better semantic scaffolds
- better authoring ergonomics than hand-maintaining host-native plugins

If Pluxx is not excellent here, nothing later matters.

## Layer 2: Operated Trust Layer

This is the plausible later extension of Pluxx, not the main build queue today.

Potential surfaces:

- verified multi-host distribution
- signing / provenance / attestations
- canary checks against real MCPs
- compatibility verification artifacts
- runtime health and adoption visibility

This layer is strategically important because it is the clearest place where Pluxx could become a real operated product instead of only a framework.

But this is not the immediate build priority.

Pluxx should first win the OSS authoring problem.

## What The Near-Term Roadmap Should Favor

The best near-term work is the work that strengthens the OSS wedge directly:

- richer MCP auth discovery and OAuth-ready scaffolds
- import beyond `tools/list`
- first-class evals for scaffold and prompt quality
- `pluxx migrate`
- MCP dev proxy with record/replay
- consumer-side `pluxx doctor`

These all make the open-source authoring substrate stronger.

They also create the raw ingredients for any later trust layer.

## What Should Stay Deferred

These ideas are interesting, but they should not define the current roadmap:

- plugin marketplace / commerce
- cross-plugin dependency management
- private registry complexity beyond early design
- "plugin economy" bets
- deep enterprise governance before real demand exists

Those are option value, not the present product center.

## The Practical Rule

Use this rule when deciding what to build next:

> If it makes Pluxx a clearly better OSS authoring substrate for real plugin authors, it is probably near-term roadmap material.

> If it mostly assumes a hosted trust/business layer that does not exist yet, it belongs in the strategic horizon unless it is foundational.

## Summary

Pluxx should:

1. become excellent as an OSS authoring substrate
2. use that adoption wedge to learn what the trust layer really needs
3. only then expand into operated verification, compatibility, and runtime products

That keeps the product focused without capping the long-term upside.
