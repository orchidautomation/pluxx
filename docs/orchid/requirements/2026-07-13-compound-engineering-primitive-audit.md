---
title: Compound Engineering Primitive and Cross-Host Delta Audit
type: research
date: 2026-07-13
artifact_contract: pluxx-primitive-audit/v1
artifact_readiness: evidence-complete
product_contract_source: linear-pluxx-323
execution: docs-only
---

# Compound Engineering Primitive and Cross-Host Delta Audit

## Executive Result

Pluxx does **not** fully represent Compound Engineering's subagent system today.

It does preserve the complete Compound Engineering skill tree across all 11 generated targets. In a controlled build, every target contained all 30 `SKILL.md` files, all 46 skill-local agent prompt assets, all 27 skill-local reviewer-persona prompts, and all 36 skill-local helper scripts. Representative skill, agent-prompt, and persona-prompt files were byte-identical across outputs.

That packaging success explains why an already-Codex-aware Compound Engineering skill can continue to launch agents reliably after being copied. It does not prove that Pluxx can derive or translate the behavior. The orchestration contract remains encoded in prompt prose and is opaque to the compiler.

The audit's most severe import finding was separate: migrating the Compound Engineering repository reported success with zero warnings but emitted an invalid Pluxx config. PLUXX-324 now closes that Phase 0 defect by reconciling supported manifests with provenance, validating the complete staged project against the current schema, and publishing only after validation succeeds. Broader semantic adjunct and orchestration recovery remain open.

## Decision Update

On 2026-07-14 Brandon accepted `orchestration` as a ninth canonical compiler bucket. Hyperframes and Superpowers independently confirmed the boundary: Hyperframes adds typed artifact dataflow, bounded dispatch, artifact-based completion, and targeted repair; Superpowers adds automatic lifecycle activation, mandatory routing, durable progress, and review loops.

This changes the product decision state, not the shipped implementation state. Pluxx still transports CE's behavior as opaque prompt content. The comparative evidence and accepted boundary are recorded in the [orchestration reference-pattern audit](./2026-07-14-orchestration-reference-patterns.md) and [decision record](../decisions/2026-07-14-orchestration-primitive.md).

## Evidence Snapshot

Audit date: 2026-07-13.

Compound Engineering source:

- repository: `EveryInc/compound-engineering-plugin`
- source commit: `f871e4b4308f5a175b38ccada51d80dd67bab4fc`
- package version: `3.19.0`
- installed Codex package inspected: `compound-engineering/3.19.0`

Pluxx source:

- commit: `faa7a3a`
- branch used for the audit: `codex/ce-plugin-primitive-audit`
- canonical targets inspected: all 11 targets accepted by the current schema

Counts below are pinned to the audited commit rather than inferred from the package version or README alone.

## Compound Engineering Inventory

| Surface | Count | Architectural role |
|---|---:|---|
| Skills | 30 | User-facing orchestrators and workflows |
| Standalone agents | 0 | CE intentionally does not depend on plugin-bundled custom agents |
| Skill-local agent prompt assets | 46 | Specialist prompts under `references/agents/` passed to generic subagents by owning skills |
| Skill-local persona prompt assets | 27 | Reviewer prompts under `references/personas/` also passed to generic subagents |
| Skill-local reference files | 202 | Procedures, rubrics, platform notes, and workflow context |
| Skill-local helper scripts | 36 | Mechanical support owned by skills |
| Skill-local assets | 2 | Non-script supporting payload |
| Root hooks | 0 | No canonical plugin hook surface in the audited snapshot |
| MCP servers | 0 | No canonical plugin MCP dependency |
| Portable plugin commands | 0 | One Claude-scoped repository triage command exists outside the portable plugin surface |
| Native plugin manifests | 7 | Claude, Cursor, Codex, Devin, Grok, Kimi, and Antigravity/root identity |
| Marketplace catalogs | 5 | Host-native discovery/distribution metadata |
| Dedicated loaders/adapters | 2 | OpenCode loader and Pi extension, plus install scripts for other hosts |
| Files under `tests/` | 114 | 76 test modules plus 38 fixture/support files for parser, converter, installer, release, and contract coverage |

The 46 agent prompts and 27 persona prompts are subsets of the 202 files under skill-local `references/` directories, not additional files beyond that reference count. Together with 30 skill entry files, 36 helper scripts, and 2 assets, the skill tree contains 270 files.

## How Compound Engineering Delegation Works

The reliable Codex behavior comes from a composition of existing Codex primitives:

1. A user invokes a CE skill.
2. The skill decides which specialist roles are needed.
3. It loads skill-local prompt assets such as reviewers or researchers.
4. It calls Codex's generic `spawn_agent` mechanism with a dispatch packet.
5. It tracks work, waits, sends follow-ups where needed, and synthesizes results.
6. It falls back when a host lacks the same subagent, input, tracker, or isolation primitive.

This is distinct from a project or user custom agent defined in a Codex TOML file. CE 3.19.0 contains no standalone Codex agent definitions. Its native Codex plugin manifest points to the skills directory, and the skills themselves own delegation.

## Primitive Map

Status meanings:

- **Modeled**: canonical IR and host translation materially exist.
- **Partial**: some canonical data exists, but fidelity or host coverage is incomplete.
- **Opaque**: Pluxx copies content without understanding its operational meaning.
- **Absent**: no canonical primitive currently represents it.
- **External**: useful package/release practice, but not necessarily a compiler primitive.

| Compound Engineering primitive | CE implementation | Closest Pluxx surface | State | Delta |
|---|---|---|---|---|
| Skill | `skills/*/SKILL.md` | `skills` | Modeled | Frontmatter is parsed and directories are copied; behavioral meaning remains largely in prose |
| Manual invocation gating | 7 skills set `disable-model-invocation` | Skill metadata | Modeled/partial | Parsed canonically; native support and warning behavior vary by target |
| Skill-scoped tool policy | 4 skills declare `allowed-tools` | Skill metadata plus permissions | Partial | Source intent is parsed, but migrate also broadens it into plugin-level fallback permissions |
| Standalone custom agent | Not used in CE 3.19.0 | `agents` | Modeled/partial | Pluxx materially models host agent files, but this is not CE's delegation pattern |
| Skill-owned specialist or reviewer role | `references/agents/*.md` and `references/personas/*.md` | Skill support/reference paths | Opaque | Files survive, but identity, owner, dispatch conditions, and contracts are not canonical |
| Generic subagent dispatch | Host branches using `spawn_agent`, `Agent`, Task, or fallback | None; sometimes described as `agents` | Absent | No dispatch IR, translation registry, or compatibility row |
| Fan-out/concurrency | Skill workflow prose | None | Absent | No portable parallel/sequential grouping or concurrency intent |
| Wait/follow-up/close | Skill workflow prose | None | Absent | No lifecycle contract for delegated work |
| Delegation isolation/depth | Host-specific instructions | Agent metadata only | Partial | Standalone agent hints exist; dynamic workflow isolation and depth do not |
| Role input/output contract | Dispatch packets and specialist prompts | Agent/skill prose | Opaque | Not validated or translated |
| Skill-to-skill routing | Namespaced skill invocation and pipelines | Command-to-skill metadata | Partial | Commands can route to skills; general workflow graphs cannot |
| Blocking user input | Host-specific question tools | None | Absent | No canonical ask/choice/fallback primitive |
| Task/goal tracking | Host-specific Task tools or `update_plan` | None | Absent | No portable tracker state or translation |
| Watch/monitor loop | Skill-local loop instructions | Hooks/runtime prose | Absent | No long-running wait, poll, stop, or terminal-condition contract |
| Capability probing/fallback | Explicit per-host branches | Platform rules and translation registries | Partial | Pluxx models feature support, but not workflow-level tool aliases and fallbacks |
| Model tier | Semantic extraction/generation/ceiling tiers | Agent/skill model strings | Partial | Current fields carry host model names, not portable semantic tiers |
| Cross-model peer execution | Review scripts and provider selection | Runtime scripts plus model fields | Opaque/partial | Scripts survive, but provider choice, independence, fallback, and result-folding intent are not canonical |
| Workflow mode | interactive, headless, pipeline, autonomous, return-to-caller | None | Absent | No canonical invocation/lifecycle mode |
| Execution engine | inline/subagent, callable goal mode, or dynamic workflow/prompt emission | None | Absent | Engine capability, activation, return envelope, and tail ownership are not canonical |
| Scratch evidence dossier | Temporary artifact directories and skill contracts | Runtime payload/passthrough | Opaque | Files can exist; lifecycle, privacy, and cleanup policy are not modeled |
| Durable artifact contract | brainstorms, requirements, plans, solutions | None | Absent | No canonical produced-artifact schema or handoff contract |
| Repository cache/history | helper-managed profiles and learnings | None | Absent | No cache identity, freshness, or invalidation contract |
| Host gating | Parser-supported `ce_platforms` plus host-specific install paths | Target list | Partial | Current CE skills do not set `ce_platforms`; Pluxx project targets exist, but no canonical per-skill platform gate does |
| Local workflow configuration | `.compound-engineering/config.local.example.yaml` | `userConfig`, runtime config, or declared passthrough | Partial | Pluxx's install-time `userConfig` is not equivalent; migrate does not recover CE's per-skill settings, connector choices, approvals, output policy, or private local override contract |
| Native manifest/interface metadata | Host manifests and catalogs | Distribution/brand | Partial | Core identity and branding exist; arbitrary native interface metadata and catalogs require passthrough or are missed by migrate |
| Loader/extension adapter | OpenCode loader, Pi extension | Runtime/distribution/passthrough | Partial | Files may be copied, but adapter semantics and install ownership are not inferred |
| Install/update/cleanup | Host-specific installers and legacy cleanup | Install ownership/distribution | Partial/strong | Pluxx has strong owned installs for primary fronts, but cannot import CE's multi-host install topology |
| Prompt contract tests | Skill and parser tests | Eval/behavioral smoke | Partial | Pluxx has semantic and behavioral proof, but no orchestration-specific contract suite |
| Live host behavior proof | CE's working host use plus host docs | Core-four proof stack | Partial | Existing Pluxx proof covers delegated agents, but not this skill-owned generic dispatch architecture across all targets |
| Release/version/catalog validation | CE tests and release scripts | Publish/release checks | External/partial | Important package-quality surface; not all of it belongs in canonical plugin IR |

## All-Target Preservation Experiment

A temporary audit config pointed Pluxx at the pinned CE skill tree and requested every current target. `pluxx validate` and `pluxx build` succeeded. Every target contained all 202 skill-local reference files; the table calls out the 73 prompts within that set because they drive delegated roles.

| Pluxx target | Target tier today | Skills | Specialist/reviewer prompts | Helper scripts | Orchestration translation | Evidence level |
|---|---|---:|---:|---:|---|---|
| Claude Code | Primary | 30 | 73 | 36 | None; CE-authored host prose survives | Generated package only |
| Cursor | Primary | 30 | 73 | 36 | None; CE-authored host prose survives | Generated package only |
| Codex | Primary | 30 | 73 | 36 | None; CE-authored `spawn_agent` prose survives | Generated package plus external working CE baseline |
| OpenCode | Primary | 30 | 73 | 36 | None; CE-authored host prose survives | Generated package only |
| GitHub Copilot | Beta | 30 | 73 | 36 | None | Fixture-level package only |
| OpenHands | Beta | 30 | 73 | 36 | None | Fixture-level package only |
| Warp | Beta | 30 | 73 | 36 | None | Fixture-level package only |
| Gemini CLI | Beta | 30 | 73 | 36 | None | Fixture-level package only |
| Roo Code | Beta | 30 | 73 | 36 | None | Fixture-level package only |
| Cline | Beta | 30 | 73 | 36 | None; all 30 skills are copied, including 7 manual-only skills that CE's own Cline installer omits by default because Cline lacks an auto-invocation gate | Fixture-level package with invocation-safety loss |
| Amp | Beta | 30 | 73 | 36 | None | Fixture-level package only |

The 73-prompt total is 46 files under `references/agents/` plus 27 under `references/personas/`. Representative `SKILL.md`, agent-prompt, and persona-prompt hashes matched across all 11 outputs after accounting for target-specific skill roots. This proves payload preservation. It does not prove that a host recognizes the skill, exposes the required tools, launches a delegated specialist, respects concurrency/isolation intent, or returns the expected synthesis.

The lint result also exposes the difference between "all targets built" and "all targets modeled": its machine-readable `primitiveSummary.targets` contains only Claude Code, Cursor, Codex, and OpenCode. The seven beta outputs currently receive no registry-backed primitive or field-level degradation receipt.

The build emitted 107 counted warnings plus 3 primitive-degradation summaries:

- 29 Codex skill-frontmatter translation warnings
- 29 Cursor unsupported-frontmatter warnings
- 29 OpenCode translation warnings
- 18 display-description truncation warnings
- 1 missing Codex branding-screenshot warning
- 1 source-root instruction-size warning even though the audit config did not select instructions
- 3 primitive-degradation summaries excluded from the warning counter

The instruction-size warning appears to inspect the source repository's root `AGENTS.md` independently of the configured instruction path and should be reviewed as a possible false positive.

## Migration Audit

`pluxx migrate` was run against the pinned Compound Engineering source in an empty temporary destination.

The findings below describe the original `1c028b4` baseline reproduction. The PLUXX-324 implementation update follows them.

### What it recovered

- package identity and version
- 30 skills and their complete directories
- broad brand website metadata
- root scripts and assets
- root `CLAUDE.md` as instructions
- a four-target default set
- some skill-scoped `allowed-tools` evidence in a compiler-intent receipt

### What it misclassified or missed

- chose Claude Code from the first recognized manifest rather than reconciling the repository's multiple native plugin manifests
- treated repository-development `CLAUDE.md` as end-user plugin instructions
- treated root release automation as plugin runtime scripts
- flattened skill-local tool policy into broad plugin-level permissions
- missed Codex interface branding/default prompts and the other native manifests/catalogs
- missed the OpenCode loader and Pi extension as semantic install adapters
- missed the Claude-scoped triage command
- missed the local workflow-config example and its per-skill settings, connector, approval, output, and privacy contract
- created an MCP scaffold with a placeholder even though the plugin has no MCP server
- did not recover specialist-role ownership, dispatch relationships, workflow modes, or host capability fallbacks

### Fail-open correctness defect

Migration reported success with zero warnings, but the emitted config fails validation:

```text
brand.displayName: Required
```

The migrated brand object contains only `websiteURL`. This is a P0 migration correctness gap because downstream build fails after a successful, warning-free intake.

### PLUXX-324 implementation update

Phase 0 now treats mature supported manifests as one reconciled source set instead of selecting the first match:

- Claude, Cursor, Codex, and qualifying OpenCode manifests are discovered in a fixed order
- compatible identity values merge, keyword catalogs union deterministically, and richer host branding follows recorded `opencode < claude-code < cursor < codex` precedence
- contradictory canonical identity fields fail with the field and responsible manifest paths
- malformed secondary manifests name the responsible source path
- the full staged project loads through the current Pluxx config schema before dry-run success or destination mutation
- schema or reconciliation failure leaves the destination unchanged
- a versioned migration receipt and dry-run summary record the resolution policy, primary platform, recognized manifests, chosen field sources, and all candidates
- non-dry-run migration holds the existing workspace mutation lock across staging, validation, planning, and publication

The pinned Compound Engineering source at `f871e4b4308f5a175b38ccada51d80dd67bab4fc` now migrates to a config with `brand.displayName: Compound Engineering` and a three-manifest provenance receipt. Repository-development instruction classification, release-script classification, non-MCP scaffold semantics, OpenCode/Pi adapter recovery, workflow configuration, and orchestration relationships remain outside this Phase 0 fix.

## Host Portfolio Delta

| Host family | CE 3.19.0 | Pluxx | Audit implication |
|---|---|---|---|
| Claude Code | Yes | Primary | Shared pressure target |
| Cursor | Yes | Primary | Shared pressure target |
| Codex | Yes | Primary | Reliable CE delegation baseline |
| OpenCode | Yes | Primary | Shared pressure target |
| GitHub Copilot | Yes | Beta | Shared, but Pluxx proof is weaker |
| Cline | Yes | Beta | Shared, but Pluxx proof is weaker |
| OpenHands | No declared CE destination | Beta | Pluxx-only best-effort target |
| Warp | No declared CE destination | Beta | Pluxx-only best-effort target |
| Gemini CLI | CE points to Antigravity instead | Beta | Provider-strategy decision needed |
| Roo Code | No declared CE destination | Beta | Pluxx-only best-effort target |
| Amp | No declared CE destination | Beta | Pluxx-only best-effort target |
| Kimi | Yes | No | Candidate only; no automatic scope expansion |
| Grok | Yes | No | Candidate only; no automatic scope expansion |
| Devin | Yes | No | Candidate only; no automatic scope expansion |
| Factory Droid | Yes | No | Candidate only; no automatic scope expansion |
| Qwen | Yes | No | Candidate only; no automatic scope expansion |
| Pi | Yes | No | Candidate with distinctive extension model |
| Antigravity | Yes | No | Review against existing Gemini CLI target |

## Prioritized Delta

### P0: trustworthy intake

- migrate must emit a valid canonical project or fail with actionable errors
- multi-manifest repositories must be reconciled rather than first-match-wins
- repository-development instructions and release scripts must not silently become plugin runtime surfaces
- success cannot be reported when required schema fields are missing

### P1: orchestration contract

- specify the accepted ninth `orchestration` bucket
- model skill-owned specialists separately from standalone agents
- define dispatch, concurrency, lifecycle, role contracts, and synthesis
- distinguish discovered role prompt assets from graph-reachable roles and report orphans
- define lifecycle events, re-injection/idempotency, and per-dispatch child-environment inheritance/override
- distinguish execution-engine selection from interaction and return-to-caller modes
- define capability aliases and explicit fallbacks
- cover CE delegation, Hyperframes artifact-driven pipelines, and Superpowers lifecycle/review loops with one host-neutral contract

### P2: core-four translation and proof

- map canonical orchestration fields to the strongest native surface on each primary host
- preserve CE's working Codex pattern as a regression fixture
- emit field-level preserve/translate/degrade/drop truth
- add real-host behavior receipts for delegation, wait/follow-up, and synthesis

### P3: all-supported-target best effort

- make every beta generator emit an explicit orchestration degradation manifest
- distinguish recognized native support from prompt-only fallback and complete drop
- do not promote beta targets to behavior-proven without live receipts

### P4: native adjunct and distribution import

- recover host manifests, catalogs, loaders, extensions, install adapters, and passthrough ownership intentionally
- recover local workflow-config schemas as canonical runtime/user config, declared passthrough, or explicit external state without committing private overrides
- add per-skill host gating and semantic model tiers
- define which release/test surfaces belong to the compiler versus the source repository

### P5: portfolio decision

- assess Antigravity versus Gemini CLI
- score CE-only destinations against user demand, host-native capability, maintenance burden, and testability
- add targets only through a separate product decision

## Requirements for a Future Implementation

- R1. A CE-class source must migrate to a valid canonical project or fail loudly before files are published.
- R2. The canonical model must distinguish standalone agents from skill-owned delegated specialists.
- R3. The model must represent dispatch, role prompt, input/output contract, sequencing, wait/follow-up, synthesis, and fallback intent.
- R4. Each supported host must receive a field-level preserve/translate/degrade/drop result.
- R5. Capability adapters must cover generic subagents, task tracking, blocking user input, skill invocation, wait/monitor behavior, and cross-model peer execution where declared.
- R6. Existing CE Codex delegation behavior must remain intact in passthrough mode and become a maintained behavioral regression case.
- R7. A copied prompt tree must never be described as behavioral parity without a host runtime receipt.
- R8. Per-skill platform gates and semantic model tiers must survive import and translation.
- R9. Native manifests and install adjuncts must be imported, preserved as declared passthrough, or reported as dropped.
- R10. Beta targets must expose honest best-effort degradation even when only prompt-level fallback is possible.
- R11. Compatibility docs, lint, build summaries, and proof receipts must share the same orchestration registry truth.
- R12. Public docs must distinguish nine-bucket canonical direction from the current eight-bucket implementation until orchestration ships.
- R13. Import and lint must distinguish discovered role assets, graph-reachable roles, and orphaned or historical role assets.
- R14. Each dispatch must declare effective tool/capability, MCP, permission/approval, sandbox, credential-availability, and delegation-depth inheritance or override without exposing secret values.
- R15. Activation must model lifecycle event coverage, ordering, re-injection guarantees, and idempotency separately from durable workflow resume.

## Independent Review

A separate subagent cross-checked the three artifacts against the pinned CE source, Pluxx source, generated 11-target output, and migrated project. Its material findings were incorporated:

- count both agent prompts and reviewer-persona prompts
- expose Cline's seven-skill manual-invocation safety loss
- state that machine-readable primitive summaries currently stop at the core four
- map skill-scoped tool policy and local workflow configuration
- separate execution-engine selection from workflow interaction mode
- correct warning-counter and test-file accounting
- qualify `ce_platforms` as parser-supported but unused in the pinned skill set

No remaining challenge changed the central conclusion, migration defect, all-target payload evidence, or host portfolio delta.

## Exit Criteria for the Investigation

- pinned CE inventory documented
- all current Pluxx targets built from the same CE source tree
- payload preservation separated from runtime behavior proof
- current and missing primitives mapped
- migrate failure reproduced and scoped
- host portfolio overlap and delta documented
- phased implementation path proposed without writing compiler code
- Linear issue and planning docs linked
- independent review completed and findings incorporated

## Related Artifacts

- [Brainstorm](../brainstorms/2026-07-13-compound-engineering-parity-brainstorm.md)
- [Comparative orchestration patterns](./2026-07-14-orchestration-reference-patterns.md)
- [Accepted orchestration decision](../decisions/2026-07-14-orchestration-primitive.md)
- [Phased parity plan](../plans/2026-07-13-compound-engineering-parity-plan.md)
- [Primitive Compiler Hardening Architecture](../../primitive-compiler-hardening-architecture.md)
- [PLUXX-323](https://linear.app/orchid-automation/issue/PLUXX-323/audit-compound-engineering-plugin-primitives-and-cross-host-pluxx)
- [Every Compound Engineering plugin](https://github.com/EveryInc/compound-engineering-plugin)
- [HeyGen Hyperframes](https://github.com/heygen-com/hyperframes)
- [obra/superpowers](https://github.com/obra/superpowers)
- [Codex subagent configuration](https://learn.chatgpt.com/docs/agent-configuration/subagents?surface=app)
