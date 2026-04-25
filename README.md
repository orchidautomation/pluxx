# pluxx

**Turn a raw MCP into a native plugin across Claude Code, Cursor, Codex, and OpenCode.**

Import a raw MCP or an existing host-native plugin, keep one maintained source project, and compile native outputs for **Claude Code, Cursor, Codex, and OpenCode** instead of maintaining four separate plugin codebases.

Pluxx is the authoring, maintenance, and compilation layer for teams that want one source of truth instead of four drifting per-host plugin repos. Start with `init`, or use `pluxx autopilot` when you want the one-shot path.

Raw MCP access is usually not enough. Most products still need workflow grouping, stronger instructions, hooks, commands, auth/setup guidance, and honest host-native packaging. Pluxx is the layer that makes that repeatable.

- Start here: [docs/start-here.md](./docs/start-here.md)
- Docs: [docs.pluxx.dev](https://docs.pluxx.dev/)
- Website: [pluxx.dev](https://pluxx.dev/)

## Current Proof

If you want the fastest way to see what is already real, start with these:

- [Proof and install guide](./docs/proof-and-install.md)
  - the shortest public path to the current demos plus one-command install paths for the released self-hosted plugin
- [Self-hosted core-four proof](./docs/pluxx-self-hosted-core-four-proof.md)
  - `example/pluxx` rebuilt, installed, and `verify-install` checked across Claude Code, Cursor, Codex, and OpenCode
- [Docs Ops core-four proof](./docs/docs-ops-core-four-proof.md)
  - the flagship `example/docs-ops` source project rebuilt, installed, `verify-install` checked, and exercised through read-only inspect/rewrite workflows across the official Claude Code, Cursor, Codex, and OpenCode CLIs
- [Docs Ops live Codex walkthrough](./docs/orchid-docs-ops-codex-walkthrough.md)
  - one maintained `docs-ops` source project compiled into a real Codex plugin and used against Orchid's live Docsalot MCP
- [Docs Ops authenticated publish path](./docs/docs-ops-authenticated-publish-path.md)
  - the flagship example now separates Orchid's public read-only MCP proof from the private write/publish contract, and the install/runtime gate is mechanically proven
- [Exa Research Example](./docs/exa-research-example.md)
  - a clean-room Exa-style research operator pack built from one maintained source project, with specialist agents, rich brand metadata, real build/install/verify proof across the core four, and live workflow proof in Claude Code, Codex Desktop, Cursor CLI, and OpenCode CLI
- [Orchid Accordion before/after rewrite](./example/docs-ops/demo-rewrites/orchid-components-accordion.after.md)
  - concrete output from the flagship docs workflow example
- [Core-four provider docs audit](./docs/core-four-provider-docs-audit.md)
  - first-party host capability and lifecycle truth for Claude Code, Cursor, Codex, and OpenCode
- [Firecrawl connector docs-ingestion proof](./docs/strategy/firecrawl-connector-docs-ingestion-proof.md)
  - the first real Firecrawl-backed extraction proof on the fixture set
- [Docs-ingestion fixture snapshot](./docs/strategy/docs-ingestion-fixture-eval.md)
  - keyed local harness rerun with `baseline`, `local`, and `firecrawl` results recorded side by side
- [Docs-ingestion scaffold before/after demo](./docs/strategy/docs-ingestion-scaffold-before-after.md)
  - a committed Sumble scaffold delta showing what sourced Firecrawl context changes in real generated files

The biggest remaining flagship gap is now a real private publish and rollback run against a safe sandbox authoring target, not basic cross-host workflow proof.

## Why Pluxx

Every host has different plugin contracts and different places to express the same intent:

- manifests
- instructions and rules
- hook surfaces
- agents and subagents
- permission and approval controls
- MCP auth wiring
- brand and packaging metadata

Without Pluxx, those details drift across multiple repos. With Pluxx, you keep one source project and compile honest host-native outputs.

For teams that want the shortest path from raw MCP to something usable, `pluxx autopilot` wraps import, refinement, and build/test flow into one command.

The current product focus is the OSS authoring substrate:

- import
- scaffold
- refine
- lint
- doctor
- eval
- build
- test
- install
- sync

Pluxx is built around an explicit compiler model:

- `preserve` when a primitive maps cleanly to a host-native surface
- `translate` when the same intent belongs in a different host surface
- `degrade` when a host only supports a weaker equivalent
- `drop` when the host has no truthful native equivalent

That keeps the cross-host story explicit instead of pretending every platform works the same way.

## Platform Focus

Pluxx is currently centered on the core four:

- Claude Code
- Cursor
- Codex
- OpenCode

Other targets still exist as generated secondary/beta outputs, but the product and docs are intentionally optimized around the core four.

For the detailed compatibility and verification matrix, see [docs/compatibility.md](./docs/compatibility.md).

## Quick Start

```bash
npx @orchid-labs/pluxx init --from-mcp https://example.com/mcp --name my-plugin --yes

cd my-plugin
npx @orchid-labs/pluxx doctor
npx @orchid-labs/pluxx lint
npx @orchid-labs/pluxx build
npx @orchid-labs/pluxx test
```

One-shot path:

```bash
npx @orchid-labs/pluxx autopilot \
  --from-mcp https://example.com/mcp \
  --runner codex \
  --name my-plugin \
  --yes
```

Common output shape:

```text
dist/
  claude-code/
  cursor/
  codex/
  opencode/
```

For local stdio MCPs, pass the real executable command, not just the npm package name. The bin name can differ from the package name.

```bash
npx @orchid-labs/pluxx init --from-mcp "npx -y -p @acme/mcp acme-mcp" --yes
```

## Command Cheat Sheet

```text
Need a new project from an MCP?
  pluxx init --from-mcp <source> --yes

Need the all-in-one path?
  pluxx autopilot --from-mcp <source> --runner <runner>

Need deterministic checks?
  pluxx doctor
  pluxx lint
  pluxx eval
  pluxx build
  pluxx test

Need local installs too?
  pluxx build --install
  pluxx test --install
  pluxx uninstall

Need agent refinement?
  pluxx agent prepare [--website <url>] [--docs <url>]
  pluxx agent run taxonomy --runner <runner>
  pluxx agent run instructions --runner <runner>
  pluxx agent run review --runner <runner>

Need to import an old host-native plugin?
  pluxx migrate <path>

Need to inspect a shipped bundle?
  pluxx doctor --consumer <bundle>

Need deterministic MCP replay?
  pluxx mcp proxy --from-mcp <source> --record tape.json
  pluxx mcp proxy --replay tape.json

Need to refresh from the MCP later?
  pluxx sync
```

Full docs tree:

- [docs.pluxx.dev/getting-started/command-decision-tree](https://docs.pluxx.dev/getting-started/command-decision-tree)

## Core Commands

Pluxx includes more than scaffold generation:

- `pluxx eval` checks scaffold and prompt-pack quality
- `pluxx migrate <path>` imports an existing host-native plugin into a Pluxx project
- `pluxx doctor --consumer <bundle>` inspects built or installed plugin bundles from the user side
- `pluxx mcp proxy --record` and `--replay` give you deterministic MCP tapes for debugging and CI

## Authoring Model

Pluxx is intentionally opinionated around a compact cross-host model:

- skills
- instructions
- mcp
- commands
- hooks
- permissions
- userConfig
- agents
- brand and assets
- taxonomy

Pluxx owns the deterministic scaffold, validation, and host compilation layer. Your host coding agent can refine taxonomy, instructions, and examples without breaking the structure.

## Install And Runtime Notes

- npm package: `@orchid-labs/pluxx`
- preferred invocation: `npx @orchid-labs/pluxx ...`
- global install also works: `npm install -g @orchid-labs/pluxx`
- published CLI runtime: Node `>=18`
- source builds and maintainer workflows also run on Node `>=18`

## Read Next

- [Getting started](./docs/getting-started.md)
- [Create a Pluxx plugin](./docs/create-a-pluxx-plugin.md)
- [How it works](./docs/how-it-works.md)
- [Self-hosted core-four proof](./docs/pluxx-self-hosted-core-four-proof.md)
- [Docs Ops core-four proof](./docs/docs-ops-core-four-proof.md)
- [Proof and install guide](./docs/proof-and-install.md)
- [Docs Ops Codex walkthrough](./docs/orchid-docs-ops-codex-walkthrough.md)
- [Use Pluxx in host agents](./docs/use-pluxx-in-host-agents.md)
- [Core primitives](./docs/core-primitives.md)
- [OSS wedge and trust layer](./docs/oss-wedge-and-trust-layer.md)
- [Compatibility matrix](./docs/compatibility.md)
- [First proof and demo asset pack](./docs/first-proof-demo-asset-pack.md)
- [Releasing Pluxx](./docs/releasing-pluxx.md)

## License

MIT
