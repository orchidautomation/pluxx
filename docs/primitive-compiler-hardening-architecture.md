# Primitive Compiler Hardening Architecture

Last updated: 2026-05-04

## Doc Links

- Role: source-of-truth execution spec for the primitive compiler-hardening tranche
- Related:
  - [docs/core-primitives.md](./core-primitives.md)
  - [docs/core-four-primitive-matrix.md](./core-four-primitive-matrix.md)
  - [docs/core-four-primitive-implementation-plan.md](./core-four-primitive-implementation-plan.md)
  - [docs/core-four-install-update-lifecycle.md](./core-four-install-update-lifecycle.md)
  - [docs/todo/queue.md](./todo/queue.md)
  - [docs/todo/master-backlog.md](./todo/master-backlog.md)
  - [docs/roadmap.md](./roadmap.md)
  - [Linear project: Pluxx Primitive Compiler Hardening](https://linear.app/orchid-automation/project/pluxx-primitive-compiler-hardening-5bf168feeb2d)
- Update together:
  - [docs/todo/queue.md](./todo/queue.md)
  - [docs/todo/master-backlog.md](./todo/master-backlog.md)
  - [docs/roadmap.md](./roadmap.md)

This doc is the concrete execution spec for the current compiler-hardening tranche.

The goal is not to redesign Pluxx from scratch.
The goal is to remove the repeated failure mode where a primitive is described as first-class in product/docs, but the implementation is still mostly:

- file copying
- host-specific glue
- duplicated translation truth
- emitted-file proof instead of installed behavior proof

## Core Rule

Pluxx should make operational intent compiler-owned.

That means:

- the author declares intent once
- Pluxx owns the strongest honest host translation
- degradation is explicit
- import/migrate should preserve as much meaning as possible before translation begins

What should remain explicit/manual:

- product positioning copy
- screenshots and listing assets
- workflow taxonomy judgment
- legal/commercial distribution choices
- security posture choices that are truly product-specific

## IR Boundaries

These are the target canonical seams for the current tranche.

### Instructions

Canonical IR should own:

- global routing/system guidance
- host-independent sections or blocks
- optional structured routing metadata if added later

Should stay manual:

- the actual high-level prose and tone

Compiler consumers:

- generators for `CLAUDE.md`, `AGENTS.md`, Cursor rules, OpenCode runtime instructions
- migrate/sync
- lint/doctor for size limits and degraded surfaces

### Skills

Canonical IR should own:

- real frontmatter parsing
- identity fields
- invocation/discovery hints
- explicit relationships to commands or agents where needed
- supporting-file/script usage metadata when present

Should stay manual:

- skill body content
- workflow examples and references

Compiler consumers:

- build generators
- migrate
- lint
- installed behavior proof

Current state:

- the shared skill-parser slice now exists in `src/skills.ts`
- lint, Agent Mode, migrate, and Claude skill rewrites now read the same `SKILL.md` parser instead of each carrying their own splitter and scalar readers
- canonical skill metadata now also carries adjacent support-file awareness for `examples/`, helper `scripts/`, and neighboring references
- the next follow-on is pushing that richer skill metadata into more generator, proof, and registry consumers, not adding another parser copy

### Commands

Canonical IR should own:

- command identity
- description
- arguments and examples
- routing metadata
- command-to-skill or command-to-agent relationships

Should stay manual:

- the command body template and product-specific examples

Compiler consumers:

- command generators
- Codex degradation/companion output
- migrate
- lint/build summaries

Current state:

- the shared command seam now preserves `when_to_use`, argument arrays, examples, explicit skill routing, agent routing, and context hints in addition to `argument-hint`
- Codex and OpenCode command companions now carry that richer metadata instead of flattening commands back into template-only guidance
- Agent Mode manual-project context now reads the same command-routing metadata the generators consume
- command and skill translation wording in `lint` now routes through shared registries instead of hand-written per-target strings
- the next follow-on is stronger native host emission and registry-backed explainability, not another ad hoc command parser

### Agents

Canonical IR should own:

- identity and specialist purpose
- delegation posture
- isolation and tuning hints
- canonical permission intent that belongs to agents

Should stay manual:

- specialist prompt content

Compiler consumers:

- agent generators
- migrate
- command routing validation
- behavioral proof

### Hooks

Canonical IR should own:

- canonical event intent
- hook type
- matcher/failure semantics
- capability tier: portable vs host-extended vs companion-only

Should stay manual:

- actual hook command bodies/prompts

Compiler consumers:

- hook generators
- migrate/import
- lint/doctor
- hook proof

### Permissions

Canonical IR should own:

- canonical `allow` / `ask` / `deny`
- selector scope
- skill- and workflow-scoped intent

Should stay manual:

- nothing substantial beyond author policy choices

Compiler consumers:

- permission mapping
- migrate
- hook/runtime enforcement
- behavioral proof

### Runtime

Publicly this remains one bucket.
Internally it should now be treated as these subprimitives:

- `runtime.mcp`
  - transport
  - auth shape
  - runtime auth materialization
  - stdio path normalization
- `runtime.readiness`
  - dependency refresh
  - gate targeting
  - timeout/failure policy
- `runtime.payload`
  - scripts
  - assets
  - passthrough payload

Should stay manual:

- actual runtime commands
- refresh/bootstrap/startup scripts

Compiler consumers:

- generators
- install/publish materialization
- lint/doctor
- installed runtime proof

### Distribution

Publicly this remains one bucket.
Internally it should now be treated as these subprimitives:

- `distribution.identity`
  - package/plugin identity
- `distribution.branding`
  - icon, logo, screenshots, metadata
- `distribution.install`
  - `userConfig`
  - install/reload/discovery contract
- `distribution.output`
  - `targets`
  - `outDir`

Should stay manual:

- listing copy
- icon/screenshot assets
- public release/commercial strategy

Compiler consumers:

- manifests
- install
- publish
- doctor/verify-install
- public proof/install docs

## Shared Registry Architecture

Each primitive should have one compiler-owned translation registry.

That registry should answer:

- what the canonical field or row is
- whether the target outcome is `preserve`, `translate`, `degrade`, or `drop`
- what native surface carries that outcome
- whether the result is bundle-enforced, runtime-enforced, or companion-only
- what explanation text validation and docs should use

Minimum registry responsibilities:

1. Generators should read emitted-surface behavior from it.
2. `lint` and `doctor` should read degradation/external-wiring text from it.
3. compatibility/product docs should read or mirror the same truth.
4. tests should assert the emitted result against the same modeled contract.

Recommended shape:

```ts
type TranslationMode = 'preserve' | 'translate' | 'degrade' | 'drop'
type Primitive = 'instructions' | 'skills' | 'commands' | 'agents' | 'hooks' | 'permissions' | 'runtime' | 'distribution'
type Platform = 'claude-code' | 'cursor' | 'codex' | 'opencode'

interface TranslationEntry {
  primitive: Primitive
  field: string
  canonicalIntent: string
  platforms: Record<Platform, {
    mode: TranslationMode
    nativeSurfaces: string[]
    delivery?: string
    bundleEnforced?: boolean
    externalArtifacts?: string[]
    matcherStrategy?: 'native' | 'best-effort' | 'none'
    notes?: string
  }>
  consumers: {
    generator: string[]
    lintCodes?: string[]
    doctorCodes?: string[]
    migrateNotes?: string[]
    discoverNotes?: string[]
  }
  proof: {
    tests?: string[]
    fixtures?: string[]
    docsRows?: string[]
  }
}
```

Recommended layout:

- `src/translation-registry/instructions.ts`
- `src/translation-registry/skills.ts`
- `src/translation-registry/commands.ts`
- `src/translation-registry/agents.ts`
- `src/translation-registry/hooks.ts`
- `src/translation-registry/permissions.ts`
- `src/translation-registry/runtime.ts`
- `src/translation-registry/distribution.ts`

Keep `src/validation/platform-rules.ts` as researched host fact/limit/source input.
Do not make it the executable translation registry itself.

## Runtime Pilot Pattern

The current runtime-readiness work is the reference implementation.

What it proves:

- a shared registry can drive generator hook bindings
- the same registry can drive Codex external-wiring messaging
- the same registry can drive validation wording

The next step is to promote that pattern from a one-off runtime slice into the shared registry framework rather than creating more isolated truth modules.

Follow the same pattern for the next hotspots instead of creating more scattered constants.

## Anti-Patterns To Remove

Do not keep doing these:

- hardcoding the same translation rule in each generator
- hand-writing slightly different degrade notes in `lint`, `doctor`, and docs
- treating install/runtime behavior as “just docs” when the CLI mutates or materializes it
- accepting lossy import when the source host actually contained richer structured intent
- treating bucket-level truth as sufficient when the real behavior differs inside the bucket

## Rollout Order

1. finish the internal IR seams
2. establish registry shape and one pilot per hotspot
3. move validation and explainability onto registry truth
4. move additional generators onto registry truth
5. move migrate/discovery onto registry truth
6. strengthen import fidelity
7. strengthen installed behavioral proof

Concrete registry rollout order:

1. define shared registry types and helpers
2. move existing readiness truth into `translation-registry/runtime.ts` with no behavior change
3. fold hook translation and Codex external hook wiring into the same registry path
4. fold runtime auth, local stdio/runtime payload, and installer-owned runtime script rules into `runtime.ts`
5. fold `distribution.install` and brand/install surfaces into `distribution.ts`
6. move permissions, then commands/agents, then skills/instructions
7. add a docs render/check path so matrix docs cannot drift from registry truth

## Current Ticket Mapping

- `PLUXX-214`: IR boundaries and ownership
- `PLUXX-215`: shared translation registry direction
- `PLUXX-230`: runtime/distribution internal split
- `PLUXX-231`: shared registry architecture shape
- `PLUXX-232`: registry pilot
- `PLUXX-253`: runtime script-role contract

Use this doc as the implementation anchor before opening more design-only follow-ons.
