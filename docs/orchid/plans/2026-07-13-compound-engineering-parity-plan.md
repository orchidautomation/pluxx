---
title: Orchestration Cross-Host Parity - Phased Plan
type: research
date: 2026-07-13
artifact_contract: pluxx-roadmap-plan/v1
artifact_readiness: decision-approved
product_contract_source: linear-pluxx-323
execution: docs-only
---

# Orchestration Cross-Host Parity - Phased Plan

## Goal Capsule

Turn the Compound Engineering, Hyperframes, and Superpowers reference patterns into a future Pluxx contract without writing implementation in this tranche.

The intended end state is:

> One maintained plugin source expresses runtime components, orchestration intent, state/artifact contracts, and distribution adjuncts; Pluxx compiles the strongest honest version for every supported host and proves the result at the appropriate evidence tier.

## Guardrails

- Preserve the installed CE 3.19.0 Codex behavior as the baseline.
- Do not equate byte preservation with runtime parity.
- Keep the accepted `orchestration` bucket separate from standalone agent identity and configuration.
- Do not expand the host portfolio as a side effect of this audit.
- Keep primary and beta evidence tiers explicit.
- Treat raw/native passthrough as a supported escape hatch with declared ownership and compatibility, not an invisible workaround.

## Phase 0: Restore Intake Correctness

Objective: a CE-class multi-host repository either becomes a valid Pluxx source or fails before claiming success.

Scope:

- fix fail-open migration validation
- reconcile multiple native manifests instead of first-match-wins
- classify repository-development instructions separately from shipped plugin instructions
- classify release automation separately from plugin runtime scripts
- stop creating placeholder MCP intent for sources without MCP
- preserve skill-local permissions without broadening them silently to plugin scope
- produce an import receipt listing recovered, passthrough, degraded, dropped, and ambiguous surfaces

Evidence gate:

- the pinned CE fixture migrates to a schema-valid project or returns a deterministic, actionable refusal
- no warning-free success can precede a validation failure
- migration receipt accounts for every recognized native manifest and adjunct

Dependency: none. This is correctness work even if the orchestration design is deferred.

## Phase 1: Specify the Accepted Orchestration IR

Objective: establish the smallest canonical contract that describes CE's reliable delegation, Hyperframes' artifact-driven pipelines, and Superpowers' lifecycle/review loops.

Decision:

- accepted on 2026-07-14: add `orchestration` as the ninth compiler bucket
- implementation status: not shipped; `agents` remains the standalone/custom executable-identity bucket

Minimum contract:

- workflow identity and owning skill
- specialist role identity and prompt asset
- graph reachability and orphaned-role-asset reporting
- required host capabilities
- dispatch input and expected output
- sequential and parallel groups
- isolation, depth, and model-tier preference
- wait, follow-up, cancel, and cleanup policy
- failure and fallback policy
- synthesis owner
- task/goal tracking and blocking-input needs
- workflow mode: interactive, headless, pipeline, autonomous, return-to-caller
- execution engine: inline/subagent, callable goal mode, dynamic workflow, or prompt-emission fallback
- engine activation lifecycle events, ordering, re-injection/idempotency, terminal status, return envelope, and shipping-tail ownership
- artifact outputs, durability, privacy, and cleanup
- activation strength and user-authorization boundary
- typed producer/consumer artifact edges and authoritative completion predicates
- bounded context packets, file ownership, and shared-resource barriers
- per-dispatch child-environment inheritance/override for tools, MCP, permissions/approvals, sandbox, credential availability, and delegation depth
- durable progress and compaction-safe resume
- targeted validation, repair, and review loops

Evidence gate:

- `ce-code-review`/`ce-work`, a Hyperframes typed-artifact workflow, and Superpowers subagent-driven development can be represented without embedding host tool names in canonical fields
- standalone custom agent TOML remains a separate modeled surface
- schema examples cover native, translated, prompt-fallback, and dropped outcomes

Dependency: the accepted [orchestration decision](../decisions/2026-07-14-orchestration-primitive.md). No further bucket-boundary decision is required.

## Phase 2: Build the Capability Adapter Contract for the Core Four

Objective: translate canonical orchestration into each primary host's strongest native mechanisms.

Capability families:

- spawn/delegate
- task/goal tracking
- callable goal activation and terminal-status lifecycle
- dynamic-workflow invocation or explicit prompt-emission fallback
- blocking user input
- skill invocation
- wait/watch/follow-up
- isolation and concurrency
- web/browser/research
- model selection or semantic model tier
- cross-model peer execution and provider fallback
- external connector requirements
- child-environment inheritance and override enforcement
- lifecycle-event coverage, re-injection, and idempotency

Per-field output must be one of `preserve`, `translate`, `degrade`, or `drop`, with the exact native surface and enforcement level.

Evidence gate:

- shared registry drives generator output, lint, doctor, compatibility docs, and receipts
- all four primary hosts have a documented result for every required orchestration field
- prompt-only fallback is labeled as such

Dependency: Phase 1 contract.

## Phase 3: Preserve the Three Reference Success Cases

Objective: make the behavior Brandon already observes in CE a maintained regression baseline, then prove the additional Hyperframes and Superpowers semantics.

Proof scenarios:

- a skill launches at least one specialist through generic Codex subagents
- a fan-out scenario launches multiple specialists within configured limits
- the parent waits and synthesizes role outputs
- a follow-up reaches the correct specialist
- unsupported custom-agent configuration is not confused with generic dispatch
- passthrough mode preserves current CE behavior before richer compilation is enabled
- a typed intermediate artifact is produced, validated, consumed, and used as the authoritative completion signal
- a failed stage receives targeted repair context without re-running unaffected stages
- lifecycle activation strength is reported honestly per host
- session-start/clear/compact re-injection is idempotent where supported and explicitly degraded where unavailable
- durable progress prevents duplicate task dispatch after interruption or context compaction
- per-task review/fix/re-review and final review gates reach an explicit terminal result

Receipt requirements:

- invoked skill/workflow identity
- spawned role identities
- delegation and wait events
- final synthesis markers or factual artifacts
- host version and plugin/source commit
- known permission, sandbox, and MCP inheritance caveats
- declared versus effective child-environment outcome without secret values
- activation event, ordering, re-injection, and idempotency outcome

Evidence gate:

- installed Codex behavior passes from a generated Pluxx bundle without relying on an undocumented manual repair
- failure cases prove missing specialist assets and unsupported dispatch are caught
- the typed-artifact scenario proves producer/consumer validation, authoritative artifact completion, and targeted repair
- the lifecycle scenario proves activation reporting, durable resume, task review, repair, and final terminal review

Dependency: Phases 1-2. The passthrough regression can begin after Phase 0.

## Phase 4: Extend Honest Best Effort to Every Current Target

Objective: every one of the 11 Pluxx targets receives the strongest available orchestration representation and an honest degradation report.

Target lanes:

- primary/live proof: Claude Code, Cursor, Codex, OpenCode
- beta/generated proof: GitHub Copilot, OpenHands, Warp, Gemini CLI, Roo Code, Cline, Amp

For each beta target:

- verify native skill discovery
- map manual-only versus automatic skill invocation and omit or warn on unsafe activation where the host has no gate
- verify whether generic subagents exist
- map task, user-input, wait, and skill-invocation capabilities
- emit prompt fallback only where it remains actionable
- drop impossible semantics explicitly
- add a minimal behavior receipt before any promotion to primary

Evidence gate:

- all-target compatibility matrix is generated from the same orchestration registry
- build summaries account for every field
- no target is called behavior-proven based only on copied files or fixture tests

Dependency: Phase 2 registry.

## Phase 5: Recover Native Adjuncts and Distribution Topology

Objective: import mature multi-host repositories without discarding the host-native packaging that makes them operational.

Scope:

- native manifests and interface metadata
- marketplace catalogs
- loader/extension entrypoints
- install/update/cleanup adapters
- per-skill platform gating
- semantic model tiers
- declared passthrough ownership
- local workflow configuration schema, install/user configuration mapping, private override boundary, and approval/source policy
- legacy-install detection and cleanup policy

Evidence gate:

- the pinned CE repository produces an intake receipt with no unaccounted native surface
- every adjunct is canonical, declared passthrough, intentionally external, or explicitly dropped
- reinstall/uninstall ownership remains conservative

Dependency: Phase 0 import receipts; can proceed alongside Phases 2-4 after the taxonomy is stable.

## Phase 6: Make Orchestration Proof Release-Gating

Objective: prevent packaging-only regressions from being mistaken for cross-host parity.

Scope:

- parser/frontmatter contract tests
- orchestration schema and registry tests
- migration round trips
- generated-shape fixture tests
- real-host delegation smoke tests
- artifact/state lifecycle tests
- release receipt freshness and host-version capture

Evidence gate:

- primary targets have current runtime receipts for the supported orchestration tier
- beta targets remain clearly fixture-only until live proof exists
- release checks fail when compatibility docs, registry outcomes, and receipts diverge

Dependency: Phases 2-5.

## Phase 7: Decide the Host Portfolio Separately

Objective: avoid turning a reference-plugin audit into uncontrolled target expansion.

Research questions:

- Has Antigravity replaced enough of the Gemini CLI use case to change Pluxx's target strategy?
- Do Kimi, Grok, Devin, Droid, Qwen, or Pi have material user demand?
- Which have stable native skill/subagent APIs, installation contracts, and automatable proof?
- Can an existing target family adapter cover them honestly?

Evidence gate:

- a scored provider decision covers demand, native depth, maintenance cost, proofability, and distribution path
- any new target receives its own product decision and Linear project scope

Dependency: none for research; implementation waits until the current 11-target truth is credible.

## Suggested Execution Sequence

1. Phase 0 intake correctness.
2. Phase 1 orchestration contract against the accepted decision.
3. Phases 2 and 3 together, anchored on the working Codex baseline.
4. Phase 4 target-by-target best effort.
5. Phase 5 mature native-adjunct import.
6. Phase 6 release gates.
7. Phase 7 host portfolio decision when demand warrants it.

## Ticketing Shape

Keep [PLUXX-323](https://linear.app/orchid-automation/issue/PLUXX-323/audit-compound-engineering-plugin-primitives-and-cross-host-pluxx) as the research and decision anchor. The bucket decision is now accepted; create future implementation tickets one per evidence-bearing phase rather than one issue per field, reference plugin, or host.

The migration validity defect can be pulled forward independently because it is a correctness bug, not an orchestration architecture dependency.

## Definition of Done for This Docs Tranche

- current CE architecture and counts are pinned to a source commit
- Hyperframes and Superpowers reference patterns are pinned and mapped without upgrading source inspection to runtime proof
- the working Codex delegation pattern is explained accurately
- standalone agents and generic delegated workflows are separated
- all Pluxx targets have a preservation/proof audit
- migration defects and missing primitives are prioritized
- a phased future path exists without compiler changes
- canonical planning docs and Linear point to the artifacts
- an independent subagent review finds no unresolved material overclaim or omission

## Related Artifacts

- [Brainstorm](../brainstorms/2026-07-13-compound-engineering-parity-brainstorm.md)
- [Primitive audit and requirements](../requirements/2026-07-13-compound-engineering-primitive-audit.md)
- [Comparative orchestration patterns](../requirements/2026-07-14-orchestration-reference-patterns.md)
- [Accepted orchestration decision](../decisions/2026-07-14-orchestration-primitive.md)
- [Primitive Compiler Hardening Architecture](../../primitive-compiler-hardening-architecture.md)
- [Every Compound Engineering plugin](https://github.com/EveryInc/compound-engineering-plugin)
- [HeyGen Hyperframes](https://github.com/heygen-com/hyperframes)
- [obra/superpowers](https://github.com/obra/superpowers)
- [Codex subagent configuration](https://learn.chatgpt.com/docs/agent-configuration/subagents?surface=app)
