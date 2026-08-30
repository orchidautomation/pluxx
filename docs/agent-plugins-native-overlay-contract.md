# Agent Plugins Native Enhancement Overlay Contract

## Doc Links

- Role: authoritative client-extension contract and machine-enforced policy for the Agent Plugins portable floor
- Related:
  - [docs/core-four-primitive-matrix.md](./core-four-primitive-matrix.md)
  - [docs/core-four-provider-docs-audit.md](./core-four-provider-docs-audit.md)
  - [docs/compatibility.md](./compatibility.md)
  - [src/agent-plugins-native-overlay-contract.ts](../src/agent-plugins-native-overlay-contract.ts)
  - [tests/agent-plugins-native-overlay-contract.test.ts](../tests/agent-plugins-native-overlay-contract.test.ts)
  - [docs/orchid/plans/2026-08-30-pluxx-347-agent-plugins-native-overlay-contract.md](./orchid/plans/2026-08-30-pluxx-347-agent-plugins-native-overlay-contract.md)
- Update together:
  - [docs/core-four-primitive-matrix.md](./core-four-primitive-matrix.md) (only when a row’s native or portable disposition changes)
  - [src/agent-plugins-native-overlay-contract.ts](../src/agent-plugins-native-overlay-contract.ts) (matrix and allowlist are the same source)
  - [tests/agent-plugins-native-overlay-contract.test.ts](../tests/agent-plugins-native-overlay-contract.test.ts) (policy and doc-sync tests)
  - Linear issue `PLUXX-347`


Last updated: 2026-08-30

## Purpose

Agent Plugins v1 defines exactly two portable component types — skills and MCP servers —
and permits reverse-domain client-extension directories under `<namespace-owner>/...`.
Those directories are client-owned, not portable, and their contents are not guaranteed to
be shared across hosts. This document is the authoritative table Pluxx consults before
emitting any client extension; every row carries either a first-party citation with an
explicitly tiered evidence-fixture identity or an explicit negative decision with a rationale.

## Dispositions

Five stable values describe each (client, capability) pair:

- `portable` — the Agent Plugins v1 specification publishes the contract; a package-contract fixture exists, while installed proof is tracked separately.
- `native` — the host bundles the capability through its own native path; no portable extension is published.
- `extension-proven` — the namespace owner publishes a reverse-domain extension; installed proof exists.
- `degraded` — limited support with a deliberate degradation path; documented separately.
- `unsupported` — no first-party contract at retrieval time; Pluxx must omit or record a negative decision.

## Matrix

| Client | Namespace owner | Capability | Directory / schema | Disposition | First-party source | Retrieved | Evidence fixture | Decision |
|---|---|---|---|---|---|---|---|---|
| Agent Plugins (portable spec) | `agent-plugins` | Skills | `agent-plugins/skills` (`skills/<name>/SKILL.md`) | `portable` | https://agent-plugins.org/specification | 2026-08-30 | `contract: pluxx:fixture:agent-plugins-skills-contract-2026-08` | Allowlisted via agent-plugins.skills. |
| Agent Plugins (portable spec) | `agent-plugins` | MCP | `agent-plugins/mcp.json` (`mcp.json`) | `portable` | https://agent-plugins.org/specification | 2026-08-30 | `contract: pluxx:fixture:agent-plugins-mcp-contract-2026-08` | Allowlisted via agent-plugins.mcp. |
| Cursor | `cursor` | Hooks | `cursor/hooks` (—) | `unsupported` | https://cursor.com/docs/reference/plugins | 2026-08-30 | — (negative decision or native-only) | Negative: Cursor ships a native Cursor Plugins surface (hooks/hooks.json) and a portable Agent Plugins surface for skills + MCP. Pluxx does not assert a `com.cursor/hooks` Agent Plugins extension; hooks remain a native Cursor bundle capability. Re-evaluate only if Cursor publishes a reverse-domain Agent Plugins hooks schema and an installed fixture proves it. |
| OpenAI / Codex | `openai` | Hooks | `openai/hooks` (—) | `unsupported` | https://learn.chatgpt.com/docs/hooks | 2026-08-30 | — (negative decision or native-only) | Negative: Codex loads native plugin hooks from `hooks/hooks.json`; that is not evidence for a `com.openai/hooks` Agent Plugins reverse-domain extension. Pluxx must not emit a `com.openai/hooks` directory; hooks stay in the native Codex bundle until OpenAI publishes an Agent Plugins extension contract and an installed fixture proves it. |
| Cursor | `cursor` | Agents / subagents | `cursor/agents` (—) | `unsupported` | https://cursor.com/docs/reference/plugins | 2026-08-30 | — (negative decision or native-only) | Negative: Cursor ships native plugin agents under its Cursor Plugins surface. There is no documented Agent Plugins `com.cursor/agents` extension at retrieval time; native output is the only path until Cursor publishes a reverse-domain extension contract. |
| Anthropic / Claude Code | `anthropic` | Skills | `anthropic/skills` (`skills/<name>/SKILL.md`) | `native` | https://docs.anthropic.com/en/docs/claude-code/plugins | 2026-08-30 | — (negative decision or native-only) | Claude Code reads skills through its native plugin bundle, not through a reverse-domain Agent Plugins extension. Native output is the documented and proven path. |
| OpenCode | `opencode` | Skills | `opencode/skills` (`skills/<name>/SKILL.md`) | `native` | https://opencode.ai/docs/plugins/ | 2026-08-30 | — (negative decision or native-only) | OpenCode reads skills through its native plugin surface and config; no Agent Plugins reverse-domain extension is published at retrieval time. |
