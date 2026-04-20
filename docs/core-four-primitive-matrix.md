# Core-Four Primitive Matrix

This document defines how the Pluxx authoring model should map across the core four hosts:

- Claude Code
- Cursor
- Codex
- OpenCode

The goal is not to copy one host's files into the others.

The goal is to normalize author intent once, then compile it into the best native surface each host exposes.

If you want the maintainer-facing build plan that follows from this matrix, read [Core-Four Primitive Implementation Plan](./core-four-primitive-implementation-plan.md).

## Compiler Buckets

These are the eight buckets Pluxx should compile from:

| Bucket | Includes |
|---|---|
| `instructions` | shared host guidance and routing rules |
| `skills` | reusable workflows plus taxonomy-derived workflow metadata |
| `commands` | explicit slash-command style entrypoints |
| `agents` | specialist or delegated execution surfaces |
| `hooks` | deterministic lifecycle automation |
| `permissions` | portable `allow` / `ask` / `deny` intent |
| `runtime` | MCP, runtime auth, local runtimes, passthrough dirs, helper scripts |
| `distribution` | user config, brand, packaging, install, publish, and install-surface metadata |

`taxonomy` remains an internal compiler input. It drives how skills, commands, instructions, and agents are rendered, but it is not itself a host-facing extension primitive.

## Canonical Shape

```ts
interface PluxxPrimitiveModel {
  instructions?: InstructionsSpec
  skills?: SkillSpec[]
  commands?: CommandSpec[]
  agents?: AgentSpec[]
  hooks?: HookSpec[]
  permissions?: PermissionSpec[]
  runtime?: {
    mcp?: McpSpec
    auth?: RuntimeAuthSpec[]
    passthrough?: string[]
    scripts?: string[]
    assets?: string[]
  }
  distribution?: {
    userConfig?: UserConfigSpec[]
    brand?: BrandSpec
    install?: InstallSurfaceSpec
    publish?: PublishSurfaceSpec
  }
  taxonomy: TaxonomySpec
}
```

This is a compiler-facing model. It is not a claim that each host has one identical manifest or one identical config file.

## Mapping Rules

| Bucket | Claude Code | Cursor | Codex | OpenCode | Pluxx mapping rule |
|---|---|---|---|---|---|
| `instructions` | `CLAUDE.md` plus plugin-level guidance surfaces | `rules/` plus `AGENTS.md` support | `AGENTS.md` and `AGENTS.override.md` | config-driven instruction files | Keep one instruction source of truth and compile it into the host-native guidance surface rather than duplicating prose by hand. |
| `skills` | `skills/<skill>/SKILL.md` | `skills/<skill>/SKILL.md` with a narrower documented frontmatter set | `skills/<skill>/SKILL.md`, optionally bundled through plugins | `skills/<skill>/SKILL.md` | Skills stay the semantic center. Preserve shared metadata and strip or downgrade host-only frontmatter during migration and build. |
| `commands` | native `commands/` markdown command files | native `commands/` plugin files | no documented plugin-packaged command directory today | native command system through markdown or JSON command definitions | Treat commands as first-class where the host exposes them. For Codex, degrade commands into skills and instruction routing instead of pretending parity exists. |
| `agents` | plugin `agents/` with rich frontmatter and isolation settings | plugin agents plus Cursor subagents | custom agents in `.codex/agents/*.toml` and subagent workflows | primary agents and subagents with model and permission config | Treat agents as specialist execution surfaces. Compile one specialist concept into each host's native agent or subagent format, even when the storage location differs. |
| `hooks` | `hooks/hooks.json` or inline plugin manifest hooks | `hooks/hooks.json` plus project and user hook locations | `.codex/hooks.json` or `~/.codex/hooks.json`, guarded by the `codex_hooks` feature flag | JS or TS plugin event handlers | Normalize hook intent and compile per host. Do not assume event names or return contracts are portable 1:1. |
| `permissions` | tool scoping and approval controls live in Claude-specific agent, hook, and runtime surfaces | hook allow or deny decisions, CLI permission config, and subagent tool access | approvals, sandbox policy, hook matchers, and custom-agent config | first-class permission config plus per-agent overrides | Keep `allow` / `ask` / `deny` as the canonical authoring model. When one host lacks a per-skill field, move the policy to its native agent, hook, or runtime control plane. |
| `runtime` | `.mcp.json` or inline MCP config, plus plugin support files | `mcp.json`, plugin support files, and host config integration | `.mcp.json` in plugins plus active MCP state in `config.toml`, with optional `.app.json` | config-driven MCP and JS plugin runtime | Runtime owns MCP, auth, env wiring, helper code, local runtimes, and passthrough dirs. Compile into bundle-local files when possible and external host config when required. |
| `distribution` | `.claude-plugin/plugin.json`, install scopes, user configuration, plugin cache, install command surfaces | `.cursor-plugin/plugin.json`, marketplace metadata, publish surface, local install path | `.codex-plugin/plugin.json`, marketplace catalogs, cache install path, interface metadata | npm or local JS plugin distribution rather than one shared manifest | Distribution owns `userConfig`, brand, legal links, icons, screenshots, install metadata, and publish metadata. Emit rich manifest fields where supported and install shims where they are not. |

## Practical Consequences

This matrix implies a few hard rules for Pluxx:

1. Migration should be semantic, not syntactic.
   Import the source host's intent, not its exact file format.

2. Skills are the stable workflow layer.
   Commands and agents should compile from the same workflow model rather than forking meaning.

3. Permissions are portable intent, not portable syntax.
   A Claude-only field such as `allowed-tools` should become a host-agnostic policy that Pluxx re-expresses for Cursor, Codex, and OpenCode in their native control planes.

4. Codex is not command-parity with Claude, Cursor, or OpenCode today.
   That is a translation problem for Pluxx, not a reason to leak host differences into the authoring model.

5. OpenCode is code-first for plugins.
   Hooks, runtime extensions, and some distribution behavior need real JS or TS generation rather than manifest-only generation.

## Official Docs Basis

### Claude Code

- [Extend Claude Code](https://code.claude.com/docs/en/features-overview)
- [Create plugins](https://code.claude.com/docs/en/plugins)
- [Plugins reference](https://code.claude.com/docs/en/plugins-reference)
- [Hooks](https://code.claude.com/docs/en/hooks)
- [Create custom subagents](https://code.claude.com/docs/en/sub-agents)
- [How Claude Code works](https://code.claude.com/docs/en/how-claude-code-works)

### Cursor

- [Plugins Reference](https://cursor.com/docs/reference/plugins)
- [Plugins](https://cursor.com/docs/plugins)
- [Agent Skills](https://cursor.com/docs/skills)
- [Subagents](https://cursor.com/docs/subagents)
- [Hooks](https://cursor.com/docs/hooks)
- [Rules](https://cursor.com/docs/rules)
- [Permissions](https://cursor.com/docs/cli/reference/permissions)

### Codex

- [Build plugins](https://developers.openai.com/codex/plugins/build)
- [Agent Skills](https://developers.openai.com/codex/skills)
- [Subagents](https://developers.openai.com/codex/subagents)
- [Hooks](https://developers.openai.com/codex/hooks)
- [Model Context Protocol](https://developers.openai.com/codex/mcp)
- [Custom instructions with AGENTS.md](https://developers.openai.com/codex/guides/agents-md)

### OpenCode

- [Config](https://opencode.ai/docs/config/)
- [Plugins](https://opencode.ai/docs/plugins/)
- [Skills](https://opencode.ai/docs/skills/)
- [Commands](https://opencode.ai/docs/commands/)
- [Agents](https://opencode.ai/docs/agents/)

## Related Docs

- [Portable Delegation Model](./portable-delegation-model.md)
