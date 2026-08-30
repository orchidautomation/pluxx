# Agent Plugins Portable Target

Last updated: 2026-08-30

## Doc Links

- Role: Agent Plugins 1.0.0 portable build, validation, and distribution contract
- Related:
  - [docs/agent-plugins-native-overlay-contract.md](./agent-plugins-native-overlay-contract.md)
  - [docs/compatibility.md](./compatibility.md)
  - [docs/release-distribution-proof-map.md](./release-distribution-proof-map.md)
  - [docs/core-four-primitive-matrix.md](./core-four-primitive-matrix.md)
  - [docs/orchid/plans/2026-08-30-pluxx-346-agent-plugins-portable-target.md](./orchid/plans/2026-08-30-pluxx-346-agent-plugins-portable-target.md)
- Update together:
  - [src/agent-plugins.ts](../src/agent-plugins.ts)
  - [tests/agent-plugins-portable.test.ts](../tests/agent-plugins-portable.test.ts)

## Contract

`agent-plugins` is an opt-in portable target, not a fifth native host and not a replacement
for the existing Claude Code, Cursor, Codex, or OpenCode bundles.

```bash
pluxx build --target agent-plugins
pluxx test --target agent-plugins
pluxx install --dry-run --target agent-plugins
pluxx publish --dry-run --github-release
```

The build writes `dist/agent-plugins/` with only:

- required root `plugin.json` targeting the canonical Agent Plugins 1.0.0 schema;
- immediate-child `skills/<skill>/SKILL.md` trees conforming to Agent Skills; and
- optional root `mcp.json` when every configured server is exactly representable.

The emitter does not copy top-level instructions, commands, agents, hooks, permissions,
readiness, scripts, assets, passthrough content, shared runtime, or assumed reverse-domain
client extensions. Lint reports those configured native-only surfaces deterministically.
The native core-four bundles retain their existing behavior.

## Fail-closed boundaries

The generator and post-build bundle checker reject:

- traversal, filesystem escapes, symlinks, and non-regular files;
- nested skills and invalid or host-only `SKILL.md` frontmatter;
- unknown `plugin.json` or `mcp.json` fields;
- unsupported MCP transport/auth/placeholder forms, unsafe remote URLs, and missing bundled
  stdio command references; and
- `com.cursor`, `com.openai`, or any other unproven client-extension output.

Agent Plugins 1.0.0 does not define OAuth or a portable secret-reference field. A canonical
MCP server that needs credential injection therefore fails the portable target instead of
embedding credentials or pretending the configuration is portable.

## Install and distribution truth

Pluxx has no first-party native install path for a generic Agent Plugins package.
`pluxx install --dry-run --target agent-plugins` reports client-managed/manual import, while a
non-dry-run install refuses to write a guessed host path.

GitHub Release planning includes versioned and `latest` Agent Plugins archives in the release
manifest and checksum inventory. `INSTALLER_TARGETS` remains limited to the native core four;
there is no generated `install-agent-plugins.sh`.

## Proof tiers

Repository tests run the same built artifact through isolated Cursor- and Codex-labelled
compatible-client discovery seams and bind the discovered skill/MCP inventory to one artifact
SHA-256. Those are deterministic package-contract fixtures, not real-host receipts.

A real Cursor or Codex product claim still requires a separately recorded client version,
actual client execution, artifact hash, skill discovery, and MCP registration/run evidence.
Do not promote the fixture tier into installed-host proof.

As retrieved 2026-08-30, the Agent Plugins compatible-client list names Cursor and ChatGPT &
Codex for skills plus MCP. Cursor separately documents local plugin import under
`~/.cursor/plugins/local/<name>` followed by reload/restart, but no Cursor binary is available
in this VPS worktree for that real-client run. OpenAI's current plugin packaging guide still
documents the native `.codex-plugin/plugin.json` / `.mcp.json` package and says local/repository
marketplace availability varies by surface; it does not establish a root Agent Plugins local
import path for the installed Codex CLI here. That gap remains explicit rather than guessed.

## Sources

- [Agent Plugins 1.0.0 specification](https://agent-plugins.org/specification)
- [Agent Plugins schemas](https://agent-plugins.org/schemas)
- [Agent Skills specification](https://agentskills.io/specification)
- [Agent Plugins compatible clients](https://agent-plugins.org/compatible-clients)
- [Cursor plugins](https://cursor.com/docs/plugins)
- [OpenAI plugin packaging](https://developers.openai.com/plugins/build/plugins)
