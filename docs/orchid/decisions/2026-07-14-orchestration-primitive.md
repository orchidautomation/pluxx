---
title: Accept Orchestration as a Canonical Compiler Primitive
type: decision
date: 2026-07-14
status: accepted
decision_owner: Brandon Guerrero
product_contract_source: linear-pluxx-323
implementation_status: not-shipped
---

# Accept Orchestration as a Canonical Compiler Primitive

## Decision

Pluxx will treat `orchestration` as its ninth canonical compiler bucket, distinct from `agents`.

The decision is accepted product direction. It does not mean the current schema, migration path, generators, compatibility registry, or runtime proof already implement the bucket.

Pluxx's author-once contract becomes:

> One maintained source expresses plugin components and the workflow control plane that connects them. Each supported host receives the strongest honest version its native capabilities allow, plus field-level preserve/translate/degrade/drop truth.

## Why This Is One Primitive

Three independent reference systems expose the same missing compiler seam:

| Reference | Architecture | What it proves |
|---|---|---|
| [Compound Engineering](https://github.com/EveryInc/compound-engineering-plugin) at `f871e4b4308f5a175b38ccada51d80dd67bab4fc` | Skills own 73 role/persona prompts and dispatch generic host subagents; no standalone agents are shipped | Reliable delegation can be skill-owned and host-neutral without custom agent manifests |
| [Hyperframes](https://github.com/heygen-com/hyperframes) at `6933e8acda57268da9a40e0adf3d99c85059d2b5` | A canonical router selects workflows; seven explicit worker/director/builder/finalizer roles exchange typed artifacts and use artifact-based wait/retry/fallback rules | Orchestration includes typed dataflow, bounded fan-out, file ownership, completion predicates, and repair—not only spawning |
| [Superpowers](https://github.com/obra/superpowers) 6.1.1 at `d884ae04edebef577e82ff7c4e143debd0bbec99` | Session bootstrap routes into a gated skill lifecycle; fresh implementer/reviewer agents exchange file briefs, diffs, reports, and a durable progress ledger | Orchestration includes activation, mandatory gates, review loops, resume state, and lifecycle fallback—not only role prompts |

These are three implementations of one control-plane concern: how authored components are activated, connected, scheduled, handed state, verified, repaired, resumed, and completed.

## Canonical Boundary

`orchestration` owns relationships and control policy:

- activation and intent routing
- lifecycle events, ordering, re-injection, and idempotency
- workflow stages, dependencies, gates, and modes
- skill-owned role contracts and dispatch packets
- role-asset reachability and orphan reporting
- sequential, parallel, and bounded fan-out
- per-dispatch child-environment inheritance and override intent
- artifact/state inputs, outputs, ownership, durability, and cleanup
- wait and completion predicates
- retry, repair context, cancellation, and fallback ladders
- resume and compaction recovery
- synthesis and final-tail ownership
- per-stage validation and behavioral proof requirements

Existing buckets retain their payload ownership:

- `skills`: workflow bodies, domain guidance, and invocable capabilities
- `agents`: standalone/custom executable identities and their permissions/tuning
- `instructions` and `hooks`: activation mechanisms where a host supports them
- `runtime`: scripts, MCP, assets, readiness, and executable support files
- `distribution`: manifests, install adapters, interface metadata, and host packaging

`orchestration` may reference those primitives. It does not absorb them.

## Minimum Subcontracts

The first schema design must define these facets without embedding host tool names:

1. `activation`: bootstrap, routing, lifecycle events, ordering, guarantee level, re-injection/idempotency, user authorization, and entry conditions
2. `graph`: stages, dependencies, gates, modes, and terminal ownership
3. `roles`: role prompt assets, graph reachability, capability needs, model tier, and input/output contract
4. `dispatch`: concurrency, batching, isolation, context packets, and file ownership
5. `childEnvironment`: per-dispatch tool/capability, MCP, permission/approval, sandbox, credential-availability, and delegation-depth inheritance or override
6. `state`: typed artifacts, shared resources, progress ledger, resume, and cleanup
7. `control`: wait predicates, retries, repair, cancellation, and native-to-fallback ladder
8. `proof`: validators, review loops, runtime receipts, and evidence tier

These are facets of one bucket, not seven new top-level primitives.

## Best-Effort Host Contract

For every orchestration field and every supported host, the compiler must emit one of:

- `preserve`: native behavior carries without semantic change
- `translate`: native behavior is equivalent through a different host surface
- `degrade`: an actionable prompt, serial, or external adapter fallback remains
- `drop`: the behavior cannot be represented safely

The receipt must name the native mechanism, activation requirement, effective child-environment outcome, enforcement level, and proof tier. It must report credential availability only as a class or reference, never a secret value. Copied prompt assets or generated files are packaging evidence, not runtime parity.

## Consequences

- The public canonical taxonomy is now nine compiler buckets.
- Current implementation truth remains eight implemented buckets plus one accepted, unshipped bucket.
- `agents` must not become a catch-all for workflow coordination.
- The first contract must represent all three fixtures: CE delegation, Hyperframes artifact pipelines, and Superpowers lifecycle/review loops.
- Existing CE Codex behavior remains a regression baseline and passthrough escape hatch.
- Host expansion remains a separate portfolio decision.
- The migration correctness defect found during the CE audit remains P0 and independent of the schema work.

## Non-Goals

- compiler or schema implementation in this docs tranche
- claiming live parity for Hyperframes or Superpowers on every advertised host
- adding a primitive for every framework-specific artifact or hook
- requiring every host to support native parallel subagents
- replacing skill prose with a fully declarative workflow language

## Evidence Required Before Calling It Shipped

- schema and migration round-trip tests for all eight facets
- one shared host capability registry used by generators, lint, doctor, docs, and receipts
- live core-four receipts for the supported tier
- CE Codex dispatch/wait/synthesis regression proof
- Hyperframes-style typed artifact completion and targeted retry proof
- Superpowers-style activation, review-loop, and durable-resume proof
- lifecycle re-injection/idempotency and child-environment inheritance proof
- explicit degradation receipts for all current beta targets

## Related Artifacts

- [Comparative reference-pattern audit](../requirements/2026-07-14-orchestration-reference-patterns.md)
- [Compound Engineering primitive audit](../requirements/2026-07-13-compound-engineering-primitive-audit.md)
- [Compound Engineering parity plan](../plans/2026-07-13-compound-engineering-parity-plan.md)
- [Core Primitives](../../core-primitives.md)
- [Primitive Compiler Hardening Architecture](../../primitive-compiler-hardening-architecture.md)
- [PLUXX-323](https://linear.app/orchid-automation/issue/PLUXX-323/audit-compound-engineering-plugin-primitives-and-cross-host-pluxx)
