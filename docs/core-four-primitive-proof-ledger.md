# Core-Four Primitive Proof Ledger

Last updated: 2026-06-24

## Doc Links

- Role: primitive-by-host proof ledger for the core-four native shipping claim
- Related:
  - [docs/core-four-primitive-matrix.md](./core-four-primitive-matrix.md)
  - [docs/core-four-provider-docs-audit.md](./core-four-provider-docs-audit.md)
  - [docs/core-four-reliability-register.md](./core-four-reliability-register.md)
  - [docs/release-distribution-proof-map.md](./release-distribution-proof-map.md)
  - [docs/pluxx-self-hosted-core-four-proof.md](./pluxx-self-hosted-core-four-proof.md)
  - [docs/docs-ops-core-four-proof.md](./docs-ops-core-four-proof.md)
  - [docs/exa-research-example.md](./exa-research-example.md)
  - [docs/platform-change-ops-reference-plugin.md](./platform-change-ops-reference-plugin.md)
  - [docs/todo/queue.md](./todo/queue.md)
  - [docs/todo/master-backlog.md](./todo/master-backlog.md)
  - [docs/roadmap.md](./roadmap.md)
- Update together:
  - [docs/core-four-primitive-matrix.md](./core-four-primitive-matrix.md)
  - [docs/core-four-reliability-register.md](./core-four-reliability-register.md)
  - [docs/release-distribution-proof-map.md](./release-distribution-proof-map.md)
  - [docs/todo/queue.md](./todo/queue.md)
  - [docs/todo/master-backlog.md](./todo/master-backlog.md)
  - [docs/roadmap.md](./roadmap.md)

This ledger is the durable proof map for the core-four claim:

> one maintained Pluxx source project can ship honest native outputs for Claude Code, Cursor, Codex, and OpenCode.

It links the current proof sources instead of duplicating every command log.

## How To Read This

- `Strong` means the primitive has matrix coverage plus generator or fixture coverage plus maintained install, verify, release-smoke, or workflow proof.
- `Medium` means the primitive is modeled and generated, but live host proof is narrower or host enforcement is split across config layers.
- `Gap` means Pluxx has an honest translation story, but the host behavior is not proven deeply enough to sell as symmetric native support.

This is not a promise that every host has the same primitive. It is a promise that Pluxx preserves the source intent where a host has a native surface, translates it where the native surface differs, degrades it visibly where the host is weaker, and refuses to imply parity where no honest parity exists.

## Ledger

| Primitive | Claude Code proof | Cursor proof | Codex proof | OpenCode proof | Proof strength | Known gaps |
| --- | --- | --- | --- | --- | --- | --- |
| Instructions | [Primitive matrix](./core-four-primitive-matrix.md) maps source guidance to `CLAUDE.md`; [Docs Ops proof](./docs-ops-core-four-proof.md) exercises official CLI workflow guidance. | [Primitive matrix](./core-four-primitive-matrix.md) maps rules and `AGENTS.md`; [Docs Ops proof](./docs-ops-core-four-proof.md) and [Exa proof](./exa-research-example.md) cover installed workflow use. | [Primitive matrix](./core-four-primitive-matrix.md) maps `AGENTS.md` and `AGENTS.override.md`; [Docs Ops proof](./docs-ops-core-four-proof.md) and the [reliability register](./core-four-reliability-register.md) cover instruction-routing caveats. | [Primitive matrix](./core-four-primitive-matrix.md) maps `AGENTS.md`, `CLAUDE.md`, config instructions, and plugin code; [Docs Ops proof](./docs-ops-core-four-proof.md) covers official CLI workflow use. | Strong | Codex command routing is still guidance plus companion metadata rather than plugin-native slash-command parity. Claude managed settings beyond local file-based proof remain open in the [reliability register](./core-four-reliability-register.md). |
| Skills | [Primitive matrix](./core-four-primitive-matrix.md) preserves `skills/<skill>/SKILL.md`; [self-hosted proof](./pluxx-self-hosted-core-four-proof.md), [Docs Ops proof](./docs-ops-core-four-proof.md), and [Exa proof](./exa-research-example.md) cover install/verify and workflow use. | [Primitive matrix](./core-four-primitive-matrix.md) preserves shared skill files; [Docs Ops proof](./docs-ops-core-four-proof.md) and [Exa proof](./exa-research-example.md) include Cursor install and workflow evidence. | [Primitive matrix](./core-four-primitive-matrix.md) preserves skill files and companion metadata; [reliability register](./core-four-reliability-register.md) records current Codex skill-discovery proof and uneven `skills.config` behavior. | [Primitive matrix](./core-four-primitive-matrix.md) preserves skill files; [Docs Ops proof](./docs-ops-core-four-proof.md) and [Exa proof](./exa-research-example.md) include OpenCode install and workflow evidence. | Strong | Claude-rich frontmatter still degrades on other hosts when no native field exists. Codex end-user exposure of companion skill metadata still needs deeper UX proof. |
| Commands | [Primitive matrix](./core-four-primitive-matrix.md) preserves command intent through Claude commands and skills; maintained behavioral smoke fixtures require command-specific output markers. | [Primitive matrix](./core-four-primitive-matrix.md) preserves command intent through Cursor slash-command surfaces; [Docs Ops proof](./docs-ops-core-four-proof.md) covers real CLI use. | [Primitive matrix](./core-four-primitive-matrix.md) explicitly degrades commands into skills, `AGENTS.md` routing, and `.codex/commands.generated.json`; [reliability register](./core-four-reliability-register.md) tracks routing risk. | [Primitive matrix](./core-four-primitive-matrix.md) preserves commands through markdown or config command definitions; [Docs Ops proof](./docs-ops-core-four-proof.md) covers OpenCode workflow use. | Medium | Codex does not currently document plugin-packaged custom slash-command parity. More adversarial Codex prompt-routing proof is still needed. |
| Agents and subagents | [Primitive matrix](./core-four-primitive-matrix.md) preserves Claude `agents/*.md`; [Exa proof](./exa-research-example.md) exercises a subagent-heavy product shape. | [Primitive matrix](./core-four-primitive-matrix.md) translates specialist agents into Cursor-native agent surfaces; [Exa proof](./exa-research-example.md) covers installed research workflow proof. | [Primitive matrix](./core-four-primitive-matrix.md) translates agents to `.codex/agents/*.toml`; [reliability register](./core-four-reliability-register.md) records maintained Codex custom-agent and delegated MCP probes, including the June 24 inherited-root MCP and empty child override cases. | [Primitive matrix](./core-four-primitive-matrix.md) preserves agents through OpenCode config and agent files; [Exa proof](./exa-research-example.md) covers OpenCode workflow proof. | Medium | Codex `sandbox_mode`, `skills.config`, agent-local inline MCP activation, and installed-plugin skill preload are still uneven. Claude plugin-agent unsupported fields and broader subagent constraints need more depth. |
| Hooks and readiness | [Primitive matrix](./core-four-primitive-matrix.md), [provider audit](./core-four-provider-docs-audit.md), and [reliability register](./core-four-reliability-register.md) cover plugin hooks, settings hooks, and installed-plugin activation proof. | [Primitive matrix](./core-four-primitive-matrix.md) and [provider audit](./core-four-provider-docs-audit.md) cover Cursor hook events; installed verifier coverage catches malformed Cursor hook bundles. | [Primitive matrix](./core-four-primitive-matrix.md), [provider audit](./core-four-provider-docs-audit.md), and [reliability register](./core-four-reliability-register.md) cover bundled `hooks/hooks.json`, canonical `[features].hooks = true`, trust/review checks, and negative runtime probes. | [Primitive matrix](./core-four-primitive-matrix.md) and [provider audit](./core-four-provider-docs-audit.md) cover OpenCode code-first plugin event handlers; [Platform Change Ops](./platform-change-ops-reference-plugin.md) exercises runtime readiness and hooks in the maximal fixture. | Medium | Codex has no maintained reviewed-hook success yet. `codex_hooks` is deprecated and should only appear as historical compatibility context. Claude broader event regression coverage is still thin. |
| Permissions | [Primitive matrix](./core-four-primitive-matrix.md) maps permission intent into Claude agent frontmatter, hooks, and runtime approvals; installed verifier coverage executes bundled permission-hook scripts. | [Primitive matrix](./core-four-primitive-matrix.md) maps permission intent into hooks, CLI config, and subagent access; verifier coverage catches installed hook decision regressions. | [Primitive matrix](./core-four-primitive-matrix.md) maps permission intent into approvals, sandbox policy, hooks, custom agents, and `.codex/config.generated.toml`; [reliability register](./core-four-reliability-register.md) records approved MCP allow-path proof. | [Primitive matrix](./core-four-primitive-matrix.md) preserves OpenCode permission maps; [provider audit](./core-four-provider-docs-audit.md) confirms permission-first agent control. | Medium | Permission enforcement is host-owned and split across several layers. Codex generated approval snippets are not auto-loaded enforcement unless installed into active config. |
| Runtime, MCP, credentials, and payloads | [Primitive matrix](./core-four-primitive-matrix.md), [Docs Ops proof](./docs-ops-core-four-proof.md), and [Platform Change Ops](./platform-change-ops-reference-plugin.md) cover MCP wiring, local runtime payloads, and install verification. | [Primitive matrix](./core-four-primitive-matrix.md), [Docs Ops proof](./docs-ops-core-four-proof.md), and [Platform Change Ops](./platform-change-ops-reference-plugin.md) cover MCP/runtime install verification. | [Primitive matrix](./core-four-primitive-matrix.md), [reliability register](./core-four-reliability-register.md), and [Platform Change Ops](./platform-change-ops-reference-plugin.md) cover `.mcp.json`, `.codex/config.toml`, bundled payloads, and approved MCP probes. | [Primitive matrix](./core-four-primitive-matrix.md), [Docs Ops proof](./docs-ops-core-four-proof.md), and [Platform Change Ops](./platform-change-ops-reference-plugin.md) cover OpenCode config, plugin runtime, MCP, and payloads. | Strong | Real private publish plus rollback remains separate from public read-only MCP proof. Codex inherited root MCP approval is now stronger, but agent-local inline MCP activation remains unproven in the latest local run. |
| Distribution, install, update, and verify | [Release distribution map](./release-distribution-proof-map.md) covers local build/install/verify, generated installers, and reload guidance; [self-hosted proof](./pluxx-self-hosted-core-four-proof.md) verifies the self-hosted source project. | [Release distribution map](./release-distribution-proof-map.md) covers local install and reload-window guidance; [self-hosted proof](./pluxx-self-hosted-core-four-proof.md) verifies Cursor install state. | [Release distribution map](./release-distribution-proof-map.md) covers local marketplace/cache install, refresh/restart guidance, and Codex installer proof; [self-hosted proof](./pluxx-self-hosted-core-four-proof.md) verifies Codex install state. | [Release distribution map](./release-distribution-proof-map.md) covers local config/plugin install and npm-backed wrapper publishing; [self-hosted proof](./pluxx-self-hosted-core-four-proof.md) verifies OpenCode install state. | Strong for local/self-hosted distribution; Medium for release/publish automation | Marketplace submission APIs, managed trust/distribution, automatic rollback/unpublish, and private publish plus rollback proof remain open release gaps. Gemini CLI remains beta/generated only, not part of the core four. |
| Brand and interface metadata | [Exa proof](./exa-research-example.md) exercises rich listing metadata and Claude-native output; [provider audit](./core-four-provider-docs-audit.md) records host metadata surfaces. | [Exa proof](./exa-research-example.md) and [provider audit](./core-four-provider-docs-audit.md) cover Cursor brand/listing metadata and plugin surfaces. | [Exa proof](./exa-research-example.md), [provider audit](./core-four-provider-docs-audit.md), and generated Codex `.app.json` coverage prove richer Codex interface metadata structurally. | [Exa proof](./exa-research-example.md) and [provider audit](./core-four-provider-docs-audit.md) cover OpenCode code/config surfaces for product metadata. | Medium | Public proof/site packaging and store/listing polish are still follow-up work. Visual metadata can be emitted before it is proven through every host's final public marketplace UX. |

## Current Honest Claim

Pluxx can honestly claim:

- one maintained source project
- native outputs for Claude Code, Cursor, Codex, and OpenCode
- preserve, translate, degrade, or drop intent according to documented host capability
- build, install, and verify maintained examples across the core four

Pluxx should not claim yet:

- equal primitive parity across the four hosts
- finished marketplace submission support
- managed organization distribution
- automatic rollback
- fully proven Codex hook execution
- fully proven Claude managed-settings behavior
- Gemini CLI as part of the core four
