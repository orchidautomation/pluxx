# Core Primitives

This document defines the tightened product scope for Pluxx after reviewing:

- the cross-host extension-system research in [research/extension-systems](../research/extension-systems)
- real open-source plugins and skill packs such as [obra/superpowers](https://github.com/obra/superpowers)

The point is simple:

- Pluxx should dominate the common plugin-authoring path
- Pluxx should not try to model every host-specific feature just because the platform exposes it

## The Product Rule

Pluxx should treat these as the canonical authoring model:

- `skills`
- `instructions`
- `mcp`
- `userConfig`
- `commands`
- `agents`
- `hooks`
- `permissions`
- `brand`
- `assets/scripts`
- `taxonomy`

Everything else is secondary until this layer is strong.

## Canonical Primitives

### 1. Skills

This is the semantic center of Pluxx.

- Skills are the most portable extension surface across Claude Code, Codex, Cursor, and OpenCode.
- Skills should remain the primary source of workflow meaning.
- Commands and agents should layer on top of the same semantic model, not replace it.

### 2. Instructions

This is the shared host-guidance layer.

- Compiles into `CLAUDE.md`, `AGENTS.md`, Cursor rules, or OpenCode rule/instruction equivalents.
- Must stay concise, route-oriented, and host-usable.
- Should be generated from the same semantic model as skills, not from raw tool-doc dumps.

### 3. MCP

This is the runtime integration layer.

- Transport
- auth shape
- import auth vs runtime auth
- remote vs local stdio
- target-specific MCP config compilation

Pluxx is MCP-first, so this remains core.

### 4. userConfig

This is the secret and install-time config layer.

- API keys
- tokens
- install-time prompts
- per-host env/config shims

This is now clearly a core primitive, not optional polish.

### 5. Commands

This is the host-native explicit entrypoint layer.

- Claude Code: yes
- Cursor: yes
- OpenCode: yes
- Codex: no equivalent plugin-command parity today; use `@plugin` + skills

Commands are first-class, but not universal.

### 6. Agents

This is the delegated execution layer.

- subagents
- worker/reviewer/planner surfaces
- background and isolation hints where available

Pluxx should support agents as a portable concept, even if the formats differ.

### 7. Hooks

This is the automation and policy-enforcement layer.

- session hooks
- tool interception
- stop/compact hooks
- MCP/session lifecycle hooks where supported

Hooks matter, but they are not portable 1:1. Pluxx should compile them per target rather than pretend the event vocabularies are the same.

### 8. Permissions

This is the canonical access-control layer.

- allow
- ask
- deny

The host-specific mechanisms differ, but plugin authors should not have to rediscover that separately for every target.

See [Permissions mapping](./permissions.md) for the concrete canonical schema, generated mappings, and current target gaps.

### 9. Brand / interface metadata

This is the presentation layer.

- display name
- icon
- color
- short description
- screenshots
- default prompts where supported

This stays core because it affects real plugin packaging across primary targets.

### 10. Assets / scripts

This is the support-file layer.

- hook scripts
- helper scripts
- icons
- supporting assets

These are not glamorous, but real plugins need them.

### 11. Taxonomy

This is the internal semantic source of truth.

- skill grouping
- names
- command derivation
- instruction routing

Users do not think of taxonomy as a host primitive, but Pluxx should. It is the stable semantic layer everything else should render from.

## Cross-Cutting Requirements

These are not primitives themselves, but Pluxx should treat them as mandatory product behavior:

- build-time target cap validation
- target-specific linting
- sync-safe persistence
- install/publish generation
- auth split between import auth and runtime auth

## What Is Not Core Right Now

These are real platform features, but they are not part of the common path Pluxx needs to win first:

- `outputStyles`
- `lspServers`
- `bin/` executables
- `monitors`
- `channels`
- `apps` abstraction
- plugin data-dir abstraction
- statuslines
- themes / keybindings
- sandbox or other user/admin runtime policy

Pluxx should document these and revisit them later, but they should not drive the near-term roadmap.

## Priority Order

After the current core-authoring work, the next extension-system priorities should be:

1. `userConfig`
2. `permissions`
3. build-time target cap validation
4. publish / marketplace generation
5. deeper MCP protocol support beyond `tools/list`
6. portable agent / subagent delegation

## Why This Scope Is Tight

The best open-source examples are not winning because they use every exotic host primitive.

They are winning because they combine:

- good skills
- clear instructions
- practical MCP wiring
- useful hooks
- decent install UX

That is the layer Pluxx should perfect first.
