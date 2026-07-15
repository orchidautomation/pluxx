---
title: Orchestration Reference Patterns - CE, Hyperframes, and Superpowers
type: research
date: 2026-07-14
artifact_contract: pluxx-orchestration-reference-audit/v1
artifact_readiness: decision-approved
product_contract_source: linear-pluxx-323
execution: docs-only
---

# Orchestration Reference Patterns - CE, Hyperframes, and Superpowers

## Bottom Line

Compound Engineering, Hyperframes, and Superpowers independently confirm that Pluxx needs `orchestration` as a distinct canonical compiler bucket.

Subagents are a host execution primitive, not the whole product primitive. The compiler seam also needs activation, routing, workflow topology, context and artifact handoffs, completion criteria, recovery, resume state, and proof.

> `agents` models executable identities. `orchestration` models the control plane that connects skills, identities, state, runtime support, and proof into reliable workflows.

## Pinned Evidence

| Source | Pinned revision | Audited surface | Runtime-proof boundary |
|---|---|---|---|
| [Compound Engineering](https://github.com/EveryInc/compound-engineering-plugin) | `f871e4b4308f5a175b38ccada51d80dd67bab4fc`, 3.19.0 | 30 skills, zero standalone agents, 73 role/persona prompts, host-aware dispatch prose | Installed Codex behavior is the baseline; this audit proved payload preservation, not all-host parity |
| [Hyperframes](https://github.com/heygen-com/hyperframes) | `6933e8acda57268da9a40e0adf3d99c85059d2b5` | 20 top-level skills, one router, seven explicit role prompts, typed artifacts, dispatch/repair rules | Source architecture audited; no new live workflow run in this tranche |
| [Superpowers](https://github.com/obra/superpowers) | `d884ae04edebef577e82ff7c4e143debd0bbec99`, 6.1.1 | 14 top-level skills, five discovered prompt assets, three graph-reachable workflow roles, lifecycle bootstrap, gated workflow, file handoffs, progress ledger | Source and packaging audited; advertised host behavior not independently re-proved here |

Hyperframes binary assets did not fully materialize because Git LFS was unavailable. Counts and conclusions use the Git tree and readable text sources; no conclusion depends on those binaries.

## Shared Primitive Shape

| Facet | Compound Engineering | Hyperframes | Superpowers |
|---|---|---|---|
| Activation | Explicit skill entry and workflow modes | `/hyperframes` routes intent into an end-to-end workflow | Bootstrap requires routing before action and re-injects after compaction on supported adapters |
| Graph | Dispatch, fan-out, wait, follow-up, synthesis, engine variants | Ordered pipelines with setup, design, worker, finalize, and render gates | Brainstorm → spec → plan → execute → task review → branch review → finish |
| Roles | 46 agent prompts plus 27 reviewer personas | Director, Builder, Finalize, and frame workers | Fresh implementer, task reviewer, and final reviewer are reachable; two additional reviewer prompt assets are not referenced by the current workflow |
| Context | Role prompt and dispatch packets | Full role file plus verbatim bounded context | Brief, diff, report, and constraint files |
| Concurrency | Parallel specialists within host limits | Bounded waves; lower parallelism does not reduce scope | Serial implementers in one worktree; independent work may parallelize |
| State | Skill-local artifacts and outputs | Typed shot plan, storyboard/script/frame packets, frame files, render | Progress ledger, task briefs, diffs, fix reports, commits |
| Completion | Parent waits and synthesizes | Expected artifact on disk is authoritative | Evidence, report, review approval, and ledger state |
| Recovery | Host-aware fallback and follow-up | One targeted re-dispatch with exact repair context | Fix/re-review loops, stop states, compaction-safe resume |
| Fallback | Inline, subagent, goal/workflow, or prompt emission | Native subagent → headless child → inline serial | Subagent development → separate-session plan execution |
| Proof | Prompt/parser and behavioral expectations | Stage validators, lint/check/render, artifact gates | TDD evidence, task review, branch review, host acceptance |

## Compound Engineering Pattern

CE proves reliable specialist delegation does not require standalone custom-agent manifests. Skills carry role prompts and instruct the host to launch generic specialists, pass bounded context, fan out independent work, wait, follow up, synthesize, and select a fallback engine.

Pluxx currently copies this tree successfully, which explains why CE can keep working in Codex. The relationships remain opaque, so the compiler cannot translate, lint, explain, or behaviorally prove them.

## Hyperframes Pattern

Hyperframes adds dataflow and control detail. Its root skill is a capability router, while workflow skills own ordered pipelines. The harness-neutral dispatch contract defines:

- `DISPATCH(role_file, dispatch_context)`
- bounded parallel fan-out
- `WAIT` against an expected artifact on disk
- one targeted re-dispatch with the same prompt plus repair context
- native-subagent, headless-child, and inline-serial fallbacks

The motion workflow passes a typed `shot-plan.json` from Director to Builder. Other workflows create frame packets, assign file ownership, preinstall shared resources before fan-out, validate each stage, and retry only the failed frame.

An orchestration IR therefore needs artifact contracts, shared-resource barriers, context packets, completion predicates, repair locality, and file ownership. An agent list cannot express those semantics.

## Superpowers Pattern

Superpowers adds lifecycle activation, mandatory routing, and durable review state. Its porting contract supports automatic bootstrap through a shell lifecycle hook, an in-process extension lifecycle, or install-shipped instructions/context.

Subagent-driven development uses one fresh implementer per task, file-based briefs and diffs, a task reviewer, fix/re-review loops, a final whole-branch reviewer, and a durable progress ledger that prevents duplicate dispatch after context compaction.

The pinned package contains five reviewer/implementer prompt assets, but only the implementer, task reviewer, and final reviewer are referenced by the current executable skill graph. The spec- and plan-reviewer prompt files are inventory, not proof of current dispatch. Import and lint must distinguish discovered assets, graph-reachable roles, and orphaned or historical assets.

Its Pi adapter injects bootstrap context on both session start and session compaction, while the shell lifecycle hook matches startup, clear, and compact events. Activation therefore needs explicit lifecycle events, ordering, guarantee level, re-injection, and idempotency. This is separate from the progress ledger's durable workflow resume.

It also separates essential host capabilities from degradable ones. Skill invocation and file/shell operations are foundational; subagents, task tracking, and web access can fall back. Codex packaging deliberately leaves plugin hooks empty where reliable automatic lifecycle activation is unavailable.

Orchestration must therefore describe activation strength and re-injection, mandatory gates, reachable roles, durable progress, review loops, terminal states, and fallback execution modes—not merely delegate a prompt.

## Mapping to Current Pluxx Buckets

| Reference behavior | Existing payload owner | Orchestration-owned relationship | Current state |
|---|---|---|---|
| Role prompt | `skills` or `agents` | Which stage dispatches it, with what packet and output | Payload preserved; relationship opaque |
| Standalone agent | `agents` | Where it participates in the graph | Agent modeled; graph absent |
| Lifecycle hook or root instruction | `hooks` / `instructions` | Activation strength, guarantee, and fallback | Mechanism unevenly modeled; lifecycle absent |
| Script, CLI child, MCP, or asset | `runtime` | Preflight, invocation stage, completion, cleanup | Payload supported; workflow ownership absent |
| Typed artifact | `runtime` payload or skill support file | Producer, consumer, schema, durability, completion role | No canonical dataflow contract |
| Manifest/install adapter | `distribution` | Required activation/runtime wiring | Packaging modeled; workflow dependency absent |
| Review/validator | `skills` / `runtime` | Gate, retry target, terminal decision, evidence tier | General proof exists; orchestration registry absent |

`orchestration` references these payloads and mechanisms. It does not absorb them.

## Required Canonical Facets

1. **Activation and routing:** entrypoint, owning skill, mode, lifecycle events, ordering, activation guarantee, re-injection/idempotency, user authorization, host fallback.
2. **Workflow graph:** stages, dependencies, sequential/parallel groups, gates, modes, synthesis owner, final-tail owner.
3. **Roles and dispatch:** prompt asset, graph reachability, capabilities, model tier, packet, output, isolation, concurrency, batching, file ownership, shared-resource barriers.
4. **State and dataflow:** typed inputs/outputs, producer/consumer edges, authoritative completion artifact, durability, resume, compaction recovery, cleanup, shared-filesystem policy.
5. **Child environment:** per-dispatch tool/capability, MCP, permission/approval, sandbox, credential-availability, and delegation-depth inheritance or override, without moving those payload definitions out of their owning buckets.
6. **Control:** wait predicate, retry and repair context, follow-up, cancellation, terminal status, return envelope, fallback ladder.
7. **Proof:** validators, review loops, receipt fields, and evidence tier.

These are facets of one primitive, not new top-level buckets.

## Pluxx Delta

Reusable foundations already exist:

- complete skill-directory and support-file preservation
- standalone agent generation on supported hosts
- hooks, instructions, runtime payload, and distribution buckets
- preserve/translate/degrade/drop vocabulary
- generic eval, install verification, and behavioral proof

Missing compiler semantics are:

- canonical activation and routing
- workflow graph and stage gates
- skill-owned delegated roles
- role-asset reachability and orphan reporting
- context packets and typed artifact dataflow
- per-dispatch child-environment inheritance and override outcomes
- concurrency, ownership, and shared-resource barriers
- artifact-based completion and targeted repair
- durable progress/resume
- synthesis and terminal ownership
- orchestration-specific capability registry and receipts

The CE migration test also reported success before emitting an invalid config with missing `brand.displayName`. Multi-manifest reconciliation and semantic adjunct recovery remain incomplete. This P0 intake defect is independent of the orchestration design.

## Acceptance Requirements

- One host-neutral contract represents CE `ce-work`/`ce-code-review`, a Hyperframes typed-artifact workflow, and Superpowers subagent-driven development.
- `agents` remains independently useful for standalone identities.
- Every supported host reports every field as preserve, translate, degrade, or drop.
- Activation strength and user authorization are explicit.
- Lifecycle activation declares start/clear/compact behavior, ordering, re-injection guarantee, and idempotency.
- Discovered prompt assets are distinguished from graph-reachable roles and reported orphans.
- Each dispatch declares inherited/overridden tools, MCP, permissions/approvals, sandbox, credential availability, and delegation depth without exposing secret values.
- Completion uses declared evidence, not a generic child-done notification.
- Context packets and file ownership are explicit before parallel dispatch.
- Retry and repair target the failed stage or artifact.
- Resume state prevents duplicate dispatch after interruption or compaction.
- Runtime parity requires live receipts; copied payload never upgrades the evidence tier.

## Independent Review

A separate subagent checked the expanded diff against both pinned repositories. Its material findings were incorporated:

- distinguish Superpowers' five discovered prompt assets from the three roles reachable in the current workflow
- add role-asset reachability and orphan reporting as import/lint semantics
- add per-dispatch child-environment inheritance and override outcomes
- separate lifecycle re-injection/idempotency from durable progress resume
- synchronize README and How It Works with nine canonical versus eight implemented buckets

The reviewer confirmed the Hyperframes dispatch, artifact-completion, targeted-retry, and role-count claims; the CE counts; local Markdown links; proof freshness; and diff hygiene. No material finding remains open in this docs tranche.

## Related Artifacts

- [Accepted orchestration decision](../decisions/2026-07-14-orchestration-primitive.md)
- [Compound Engineering primitive audit](./2026-07-13-compound-engineering-primitive-audit.md)
- [Compound Engineering parity plan](../plans/2026-07-13-compound-engineering-parity-plan.md)
- [PLUXX-323](https://linear.app/orchid-automation/issue/PLUXX-323/audit-compound-engineering-plugin-primitives-and-cross-host-pluxx)
