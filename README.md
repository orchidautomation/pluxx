# pluxx

**Stop maintaining four plugin repos for one MCP.**

Pluxx keeps one maintained plugin source project for **Claude Code, Cursor, Codex, and OpenCode**, then compiles the native bundle each host expects.

It is the cross-host plugin authoring and maintenance layer for MCP teams that want one source of truth instead of separate per-host plugin repos.

- Docs: [docs.pluxx.dev](https://docs.pluxx.dev/)
- Website: [pluxx.dev](https://pluxx.dev/)

## Why Pluxx

Every host has different plugin contracts:

- manifests
- instructions and rules
- hook surfaces
- MCP auth wiring
- brand and packaging metadata

Without Pluxx, those details drift across multiple repos. With Pluxx, you keep one source project and generate host-native outputs.

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
# Requires Bun on PATH
npx @orchid-labs/pluxx init --from-mcp https://example.com/mcp --name my-plugin --yes

cd my-plugin
npx @orchid-labs/pluxx doctor
npx @orchid-labs/pluxx lint
npx @orchid-labs/pluxx build
npx @orchid-labs/pluxx test
```

Common output shape:

```text
dist/
  claude-code/
  cursor/
  codex/
  opencode/
```

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

Pluxx owns the deterministic scaffold and validation. Your host coding agent can refine taxonomy, instructions, and examples without breaking the structure.

## Install And Runtime Notes

- npm package: `@orchid-labs/pluxx`
- preferred invocation: `npx @orchid-labs/pluxx ...`
- global install also works: `npm install -g @orchid-labs/pluxx`
- the current launcher still requires Bun at runtime

## Read Next

- [Getting started](./docs/getting-started.md)
- [Create a Pluxx plugin](./docs/create-a-pluxx-plugin.md)
- [How it works](./docs/how-it-works.md)
- [Use Pluxx in host agents](./docs/use-pluxx-in-host-agents.md)
- [Core primitives](./docs/core-primitives.md)
- [OSS wedge and trust layer](./docs/oss-wedge-and-trust-layer.md)
- [Compatibility matrix](./docs/compatibility.md)
- [First proof and demo asset pack](./docs/first-proof-demo-asset-pack.md)
- [Releasing Pluxx](./docs/releasing-pluxx.md)

## License

MIT
