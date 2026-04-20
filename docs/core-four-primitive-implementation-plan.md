# Core-Four Primitive Implementation Plan

This document turns the [Core-Four Primitive Matrix](./core-four-primitive-matrix.md) into an implementation plan for Pluxx itself.

The objective is straightforward:

- let authors bring a strong plugin from any one core host
- import the author's intent into a canonical Pluxx model
- compile that intent back out into the best native form for Claude Code, Cursor, Codex, and OpenCode

## Product Goal

Pluxx should behave like a real cross-host compiler, not a file copier.

That means:

- migration imports meaning, not just source files
- build emits the strongest native surface each host supports
- host-specific degradation is explicit and intentional
- plugin authors do not need to manually relearn four extension systems

## Non-Goals

This plan is not trying to:

- model every host-specific feature immediately
- make every host look identical
- promise lossless round-tripping for unsupported surfaces
- turn Pluxx into a general-purpose editor-config sync tool

## Canonical Compiler Contract

The compiler should normalize everything into these buckets:

1. `instructions`
2. `skills`
3. `commands`
4. `agents`
5. `hooks`
6. `permissions`
7. `runtime`
8. `distribution`

`taxonomy` remains the internal semantic source of truth used to derive workflow grouping, names, examples, commands, and routing.

## Translation Modes

Every mapped feature should be classified into one of four outcomes:

- `preserve`: the host has a close native equivalent
- `translate`: the host has a different native surface that can express the same intent
- `degrade`: the host cannot express the full intent, but Pluxx can preserve the user-facing workflow meaning in a weaker way
- `drop`: unsupported and not worth emulating yet

Pluxx should make those decisions in code, not as tribal knowledge in docs.

## Workstreams

### 1. Canonical Model Refactor

Goal:
- make the compiler buckets explicit in the internal model

Required changes:
- add a bucket-oriented internal representation on top of the current config schema
- keep current user-facing config compatible during the transition
- treat current primitives such as `mcp`, `userConfig`, `brand`, and `assets/scripts` as subparts of `runtime` or `distribution`

Primary files:
- [src/schema.ts](/Users/brandonguerrero/Documents/Orchid%20Automation/Orchid%20Labs/pluxx/src/schema.ts)
- [docs/core-primitives.md](/Users/brandonguerrero/Documents/Orchid%20Automation/Orchid%20Labs/pluxx/docs/core-primitives.md)

Acceptance criteria:
- one internal model can represent all current core-four outputs
- no generator needs to infer intent from raw host-specific frontmatter alone

### 2. Host Capability Registry

Goal:
- move from scattered host assumptions to one formal translation registry

Required changes:
- extend the platform rules into a real capability registry per bucket
- encode where each host supports:
  - native skills
  - native commands
  - native agents or subagents
  - native hooks
  - native permissions
  - native runtime embedding
  - native distribution metadata
- encode translation mode per bucket and per host

Primary files:
- [src/validation/platform-rules.ts](/Users/brandonguerrero/Documents/Orchid%20Automation/Orchid%20Labs/pluxx/src/validation/platform-rules.ts)
- [docs/core-four-primitive-matrix.md](/Users/brandonguerrero/Documents/Orchid%20Automation/Orchid%20Labs/pluxx/docs/core-four-primitive-matrix.md)

Acceptance criteria:
- the compiler can ask one source of truth how to map a primitive for a target
- lint can explain degradation from that same registry

### 3. Semantic Migration

Goal:
- import host-native plugins into the canonical Pluxx model instead of preserving raw host syntax

Required changes:
- upgrade `migrate` to parse host-specific files into bucket intent
- explicitly normalize known host-only fields during import
- preserve source information as provenance, not as compiler truth

Examples:
- Claude `allowed-tools` on a skill should become canonical permission intent
- Cursor subagent files should become canonical agent intent
- OpenCode agent permission blocks should become canonical permissions plus specialist settings
- Codex custom agent TOML should become canonical `agents`

Primary files:
- [src/cli/migrate.ts](/Users/brandonguerrero/Documents/Orchid%20Automation/Orchid%20Labs/pluxx/src/cli/migrate.ts)
- [tests/migrate.test.ts](/Users/brandonguerrero/Documents/Orchid%20Automation/Orchid%20Labs/pluxx/tests/migrate.test.ts)

Acceptance criteria:
- migrating a strong single-host plugin does not leave host-only warnings all over the new Pluxx project
- imported intent can be rebuilt cleanly for the other three core hosts

### 4. Host-Native Compilation

Goal:
- compile each bucket into the strongest native surface per host

Required changes by bucket:

- `instructions`
  - Claude -> `CLAUDE.md`
  - Cursor -> `rules/` and `AGENTS.md` support
  - Codex -> `AGENTS.md`
  - OpenCode -> config-driven instructions

- `skills`
  - preserve shared frontmatter
  - strip or rewrite host-only fields

- `commands`
  - compile natively for Claude, Cursor, OpenCode
  - degrade into skills and instruction routing for Codex

- `agents`
  - Claude -> plugin agents
  - Cursor -> agents or subagents
  - Codex -> `.codex/agents/*.toml`
  - OpenCode -> agents config or markdown agents

- `hooks`
  - compile host-specific event vocabularies
  - keep unsupported events visible as linted degradations

- `permissions`
  - preserve `allow` / `ask` / `deny` canonically
  - translate to host-native control planes

- `runtime`
  - keep MCP, auth, helper runtimes, passthrough dirs, and assets together
  - compile into bundle-local files or external config as required by the host

- `distribution`
  - compile install metadata, brand metadata, icons, screenshots, and user config prompts where supported

Primary files:
- [src/generators/claude-code/index.ts](/Users/brandonguerrero/Documents/Orchid%20Automation/Orchid%20Labs/pluxx/src/generators/claude-code/index.ts)
- [src/generators/cursor/index.ts](/Users/brandonguerrero/Documents/Orchid%20Automation/Orchid%20Labs/pluxx/src/generators/cursor/index.ts)
- [src/generators/codex/index.ts](/Users/brandonguerrero/Documents/Orchid%20Automation/Orchid%20Labs/pluxx/src/generators/codex/index.ts)
- [src/generators/opencode/index.ts](/Users/brandonguerrero/Documents/Orchid%20Automation/Orchid%20Labs/pluxx/src/generators/opencode/index.ts)

Acceptance criteria:
- generators no longer rely on preserving source-host quirks to appear compatible
- each host output reads like something authored for that host

### 5. Lint, Doctor, and Explainability

Goal:
- make translation behavior visible to plugin authors

Required changes:
- lint should distinguish:
  - portable primitive
  - host-specific translation
  - degradation
  - unsupported feature
- doctor should explain when a migrated project still contains unresolved source-host assumptions
- build summaries should surface meaningful degradations instead of generic warnings

Primary files:
- [src/cli/lint.ts](/Users/brandonguerrero/Documents/Orchid%20Automation/Orchid%20Labs/pluxx/src/cli/lint.ts)
- [src/cli/doctor.ts](/Users/brandonguerrero/Documents/Orchid%20Automation/Orchid%20Labs/pluxx/src/cli/doctor.ts)

Acceptance criteria:
- authors can see exactly why a feature preserved, translated, degraded, or dropped
- warnings become actionable rather than noisy

### 6. Fixture and Smoke Coverage

Goal:
- prove that the compiler works on real imported plugins, not just synthetic fixtures

Required changes:
- add migration fixtures for each source host
- add rebuild assertions for all four targets
- add translation-specific assertions for known tricky cases

Priority fixtures:
- Claude skill with `allowed-tools`
- Cursor subagent-driven workflow
- Codex custom agent plus plugin bundle
- OpenCode plugin with permission-rich agents and command definitions

Primary files:
- [tests/build.test.ts](/Users/brandonguerrero/Documents/Orchid%20Automation/Orchid%20Labs/pluxx/tests/build.test.ts)
- [tests/migrate.test.ts](/Users/brandonguerrero/Documents/Orchid%20Automation/Orchid%20Labs/pluxx/tests/migrate.test.ts)
- [tests/release-smoke.test.ts](/Users/brandonguerrero/Documents/Orchid%20Automation/Orchid%20Labs/pluxx/tests/release-smoke.test.ts)

Acceptance criteria:
- "strong plugin on one host" becomes a repeatable test fixture, not a one-off manual confidence check

## Bucket-Specific Mapping Priorities

### Instructions

Priority:
- medium

Why:
- already mostly working
- needs cleaner formalization more than invention

### Skills

Priority:
- highest

Why:
- this is the stable semantic layer that everything else should compile from

### Commands

Priority:
- medium

Why:
- command parity is incomplete, especially on Codex
- degradation rules need to be explicit

### Agents

Priority:
- highest

Why:
- Cursor, Codex, and OpenCode all move more specialization here than Claude skills do
- this is the key to translating "perfect on one host" into "best native optimization on the others"
- see [Portable Delegation Model](./portable-delegation-model.md) for the canonical delegated-specialist subset

### Hooks

Priority:
- high

Why:
- hook event vocabularies differ materially across hosts
- copying names across platforms is not enough

### Permissions

Priority:
- highest

Why:
- permission intent is exactly where source-host leakage hurts migration quality today

### Runtime

Priority:
- high

Why:
- local runtimes, auth shims, passthrough dirs, and MCP config are central to real plugin behavior

### Distribution

Priority:
- medium

Why:
- important for install and polish
- less likely than permissions or agents to break semantic portability

## Recommended Milestones

### Milestone 1: Canonical Compiler Core

- formalize bucket model internally
- extend platform capability registry
- keep current config backward-compatible

### Milestone 2: Semantic Migration

- teach `migrate` to normalize host-specific syntax into canonical primitives
- add provenance metadata where useful

### Milestone 3: Native Recompilation

- upgrade generators to compile from canonical buckets
- implement explicit degradation rules

### Milestone 4: Explainability and Verification

- upgrade lint and doctor messaging
- add translation fixtures and release-smoke coverage

## First Concrete Translation Cases

These are the best first implementation targets because they prove the abstraction layer is real:

1. Claude skill `allowed-tools`
   - import as canonical permissions
   - rebuild to Cursor via subagent or permission surface
   - rebuild to Codex via custom agent or hook or approval surface
   - rebuild to OpenCode via agent permission config

2. Claude commands
   - import as canonical command intent
   - rebuild natively for Claude, Cursor, OpenCode
   - degrade to skill plus instruction routing for Codex

3. Cursor subagent workflow
   - import as canonical specialist intent
   - rebuild to Claude agents, Codex custom agents, and OpenCode agents

4. OpenCode agent permissions
   - import as canonical permission plus specialist intent
   - rebuild to the strongest available surfaces on the other three

## What Success Looks Like

Pluxx is succeeding here when all of the following are true:

- a strong single-host plugin can be migrated without leaving raw host quirks everywhere
- the rebuilt outputs look native to each target host
- degradations are explicit and understandable
- tests prove cross-host translation on real fixtures
- plugin authors no longer need to think in terms of "Claude field here, Cursor subagent there, Codex config over there"

At that point, Pluxx is acting like the abstraction layer it claims to be.
