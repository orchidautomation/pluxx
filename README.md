# pluxx

**Build AI agent plugins once. Ship them to the core four.**

Pluxx turns one plugin source project into installable outputs for **Claude Code, Cursor, Codex, and OpenCode**.

It keeps the authoring model stable across hosts (skills, instructions, MCP config, hooks, commands, permissions, and brand metadata), then compiles host-specific packaging details for each target.

Docs site: [orchidautomation.mintlify.app](https://orchidautomation.mintlify.app/)

## Why Pluxx

Every host has different plugin contracts. Without Pluxx, teams maintain separate manifests, instruction formats, hook mappings, and MCP auth wiring for each platform.

With Pluxx, you maintain one source project and generate host-native outputs.

## Platform Focus

Pluxx launch support is centered on the core four:

- Claude Code
- Cursor
- Codex
- OpenCode

Additional targets exist as generated secondary/beta outputs (for example GitHub Copilot, Warp, Gemini CLI, OpenHands, Roo Code, Cline, AMP), but the front-door product focus is the core four.

For full compatibility details and verification status, see [docs/compatibility.md](./docs/compatibility.md).

## Quick Start

```bash
# Requires Bun on PATH
npx @orchid-labs/pluxx init --from-mcp https://mcp.example.com/sse --name my-plugin --yes

cd my-plugin
npx @orchid-labs/pluxx lint
npx @orchid-labs/pluxx build
```

Common output shape:

```text
dist/
  claude-code/
  cursor/
  codex/
  opencode/
```

## Install And Runtime Notes

- npm package: `@orchid-labs/pluxx`
- Preferred invocation: `npx @orchid-labs/pluxx ...`
- Global install also works: `npm install -g @orchid-labs/pluxx`
- Current launcher still requires Bun at runtime

## Core Authoring Model

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

Pluxx does not try to normalize every host-specific surface yet; it prioritizes the parts required to ship reliable cross-host plugins.

## Read Next

- [Getting started](./docs/getting-started.md)
- [Create a Pluxx plugin](./docs/create-a-pluxx-plugin.md)
- [Practical handbook](./docs/practical-handbook.md)
- [How it works](./docs/how-it-works.md)
- [Core primitives](./docs/core-primitives.md)
- [Use Pluxx in host agents](./docs/use-pluxx-in-host-agents.md)

## License

MIT
