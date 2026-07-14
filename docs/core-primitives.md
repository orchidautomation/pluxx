# Core Primitives

This document defines the tightened product scope for Pluxx after reviewing:

- the cross-host extension-system research in [research/extension-systems](../research/extension-systems)
- real open-source systems including [Compound Engineering](https://github.com/EveryInc/compound-engineering-plugin), [Hyperframes](https://github.com/heygen-com/hyperframes), and [Superpowers](https://github.com/obra/superpowers)

The point is simple:

- Pluxx should dominate the common plugin-authoring path
- Pluxx should not try to model every host-specific feature just because the platform exposes it

If you want the host-by-host mapping for the core four, read [Core-Four Primitive Matrix](./core-four-primitive-matrix.md).

## The Product Rule

Pluxx should treat these as the canonical authoring model:

- `skills`
- `instructions`
- `mcp`
- `userConfig`
- `commands`
- `agents`
- `orchestration`
- `hooks`
- `permissions`
- `brand`
- `assets/scripts`
- `taxonomy`

Everything else is secondary until this layer is strong.

## Compiler Buckets

The list above is the detailed authoring model.

For cross-host compilation, Pluxx reasons about that model through nine larger buckets. `orchestration` has a canonical IR, schema, semantic validator, complete core-four mappings, deterministic generated payloads, and 12 isolated `fake-home-install` receipts. Install layout, ownership, verifier behavior, and host registration artifacts are proven in isolated filesystems; real-host discovery is environment-unavailable in all 12. Activation and behavioral evidence remain unsupported or environment-unavailable, so no row is promoted beyond explicit degradation.

| Compiler bucket | Includes | Why it exists |
|---|---|---|
| `instructions` | `instructions` | Global host guidance is a distinct surface on every core host. |
| `skills` | `skills` plus taxonomy-derived workflow metadata | Skills remain the semantic center of the system. |
| `commands` | `commands` | Explicit entrypoints exist on some hosts and need their own compilation path. |
| `agents` | `agents` | Specialist execution surfaces differ too much to collapse into skills. |
| `orchestration` | workflow activation, routing, role graphs, dispatch, artifact/state flow, control policy, and workflow proof | This is the control plane that connects skills and executable identities without turning `agents` into a workflow catch-all. |
| `hooks` | `hooks` | Event vocabularies differ per host, but deterministic automation is still core. |
| `permissions` | `permissions` | `allow` / `ask` / `deny` intent needs a portable home even when hosts enforce it differently. |
| `runtime` | `mcp`, runtime auth, runtime readiness, local runtimes, passthrough dirs, helper scripts | This is the execution and integration layer. |
| `distribution` | `userConfig`, `brand`, packaging metadata, install/publish metadata, supporting assets | This is the install surface users actually touch. |

`taxonomy` stays internal. It is the compiler's semantic source of truth for how workflows should be grouped and routed into skills, agents, and orchestration, but it is not a host-facing primitive on its own.

Conceptually, Pluxx should compile from a shape closer to this:

```ts
interface PluxxPrimitiveModel {
  instructions?: InstructionsSpec
  skills?: SkillSpec[]
  commands?: CommandSpec[]
  agents?: AgentSpec[]
  orchestration?: OrchestrationSpec
  hooks?: HookSpec[]
  permissions?: PermissionSpec[]
  runtime?: {
    mcp?: {
      servers?: McpSpec
      auth?: RuntimeAuthSpec[]
    }
    readiness?: RuntimeReadinessSpec[]
    payload?: {
      passthrough?: string[]
      scripts?: string[]
      assets?: string[]
    }
  }
  distribution?: {
    identity?: IdentitySpec
    branding?: BrandSpec
    install?: {
      userConfig?: UserConfigSpec[]
      surface?: InstallSurfaceSpec
    }
    output?: {
      targets?: TargetPlatform[]
      outDir?: string
    }
    publish?: PublishSurfaceSpec
  }
  taxonomy: TaxonomySpec
}
```

This is a compiler-facing model, not a promise that every one of these buckets maps to one identical file or manifest field on every host.

## Canonical Primitives

### 1. Skills

This is the semantic center of Pluxx.

- Skills are the most portable extension surface across Claude Code, Cursor, Codex, and OpenCode.
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
- runtime readiness and background refresh gates
- remote vs local stdio
- target-specific MCP config compilation

MCP is optional in the config, but common enough across real plugin projects that it remains core. Internally, the compiler should treat runtime as at least three subcontracts:

- MCP and auth shaping
- readiness and refresh gating
- generic bundled payload support such as scripts, assets, and passthrough dirs

MCP-backed plugins are the flagship wedge because the cross-host differences are sharpest there.

### 4. userConfig

This is the secret and install-time config layer.

- API keys
- tokens
- install-time prompts
- per-host env/config shims

This is now clearly a core primitive, not optional polish.

Even though `userConfig` appears under the distribution/install surface, it is not just presentation metadata. It also affects runtime materialization and installed host behavior.

### 5. Commands

This is the host-native explicit entrypoint layer.

- Claude Code: yes
- Cursor: yes
- OpenCode: yes
- Codex: no equivalent plugin-command parity today; use `@plugin` + skills

Commands are first-class, but not universal.

### 6. Agents

This is the executable-identity layer.

- standalone/custom worker, reviewer, planner, or specialist definitions
- identity-scoped prompt, permissions, isolation, and tuning hints
- background and isolation hints where available

Pluxx should support agents as a portable concept, even if the formats differ. A host's generic subagent dispatch capability is consumed by `orchestration`; it is not, by itself, a standalone `AgentSpec`.

### 7. Orchestration

This is the workflow control plane.

- activation and routing into a workflow
- lifecycle events, ordering, re-injection guarantees, and idempotency
- staged and dependency-aware workflow graphs
- skill-owned role prompts, graph reachability, orphan reporting, and dispatch packets
- sequential, parallel, and bounded fan-out
- per-dispatch child-environment inheritance and override intent
- typed artifact and state handoffs
- wait, completion, retry, repair, cancellation, and fallback policy
- resume and compaction-recovery state
- synthesis and final-tail ownership
- per-stage validation and behavioral proof

`agents` still owns standalone/custom executable identities. `skills` still owns workflow bodies and domain guidance. Hooks, instructions, runtime files, and distribution surfaces remain separate mechanisms. `orchestration` owns the relationships and control policy across those primitives.

This bucket was accepted on 2026-07-14 after comparison of Compound Engineering, Hyperframes, and Superpowers. Its Phase 1 source contract is implemented and proven by [bounded canonical fixtures](../test-fixtures/orchestration-fixtures.ts). That is not a claim that generators, installed hosts, or runtime parity implement it. See [Orchestration Primitive Decision](./orchid/decisions/2026-07-14-orchestration-primitive.md).

### 8. Hooks

This is the automation and policy-enforcement layer.

- session hooks
- tool interception
- stop/compact hooks
- MCP/session lifecycle hooks where supported

Hooks matter, but they are not portable 1:1. Pluxx should compile them per target rather than pretend the event vocabularies are the same.

### 9. Permissions

This is the canonical access-control layer.

- allow
- ask
- deny

See [Canonical Permissions Model](./permissions-canonical-model.md) for the recommended schema shape and host fallback rules.

The host-specific mechanisms differ, but plugin authors should not have to rediscover that separately for every target.

### 10. Brand / interface metadata

This is the presentation layer.

- display name
- icon
- color
- short description
- screenshots
- default prompts where supported

This stays core because it affects real plugin packaging across primary targets.

Current support is target-graded, not uniform. See [Core-Four Branding Metadata Audit](./core-four-branding-metadata-audit.md) for verified field-by-field behavior across Claude Code, Cursor, Codex, and OpenCode.

### 11. Assets / scripts

This is the support-file layer.

- hook scripts
- helper scripts
- icons
- supporting assets

These are not glamorous, but real plugins need them.

### 12. Taxonomy

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

1. keep the completed core-four orchestration mappings, generators, and isolated proof receipts green
2. restore trustworthy intake for mature multi-host plugins
3. prove orchestration on the core four, starting with the working Codex baseline
4. retain honest core-four degradation for unsupported or environment-unavailable mechanisms
5. deeper MCP protocol support beyond `tools/list`
6. publish / marketplace generation

Secondary-target orchestration is deferred; Phase 7 froze this initiative to Claude Code, Cursor, Codex, and OpenCode.

## Why This Scope Is Tight

The best open-source examples are not winning because they use every exotic host primitive.

They are winning because they combine:

- good skills
- reliable orchestration
- clear instructions
- practical MCP wiring
- useful hooks
- decent install UX

That is the layer Pluxx should perfect first.
