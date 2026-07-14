---
title: PLUXX-326 Core-Four Orchestration Adapters - Plan
type: feat
date: 2026-07-14
artifact_contract: ce-unified-plan/v1
artifact_readiness: implementation-ready
product_contract_source: linear-pluxx-326
execution: code
origin: docs/orchid/plans/2026-07-13-compound-engineering-parity-plan.md
---

# PLUXX-326 Core-Four Orchestration Adapters - Plan

## Goal Capsule

Populate one compiler-owned orchestration registry for every canonical field across Claude Code, Cursor, Codex, and OpenCode, then make generation, diagnostics, summaries, compatibility docs, and receipts consume that truth. This phase proves source-inspected mappings and deterministic generated payloads only; installed/runtime behavior remains Phase 3.

## Product Contract

### Requirements

- R1. Every `ORCHESTRATION_CAPABILITY_FIELDS` path has exactly one preserve/translate/degrade/drop row per core-four host, including a named mechanism, rationale, activation requirement, enforcement level, child-environment outcome, and non-runtime evidence tier.
- R2. A single registry drives generator/adapters, lint, doctor, primitive summaries, compatibility output, and receipts; no parallel host capability table is introduced.
- R3. Each configured orchestration bucket emits deterministic host payload/guidance and a deterministic receipt that accounts for all canonical fields, including every degraded/dropped semantic.
- R4. CE, Hyperframes, and Superpowers canonical fixtures generate across all four hosts; all 12 payload/receipt pairs are mechanically and manually inspectable.
- R5. Projects without orchestration retain their existing generated tree byte-for-byte.
- R6. Documentation labels generated/source-inspected proof separately from installed/runtime proof and hands the three reference cases to Phase 3.

### Scope Boundaries

- No host installation, runtime execution, parity claim, secondary-target mapping, distribution work, publishing, PR, or GitHub mutation.
- Native host files are emitted only for semantics supported by the existing audited host surfaces; the remaining semantics become deterministic companion/guidance artifacts rather than silent omissions.

## Planning Contract

### Key Technical Decisions

- KTD1. Extend `src/orchestration-capability-registry.ts` in place. Derive primitive capability, field matrices, generator plans, diagnostics, and receipts from its rows.
- KTD2. Add a shared adapter renderer under `src/generators/` and call it from the four existing generators. Host generators own paths; the shared renderer owns registry interpretation and deterministic content.
- KTD3. Treat `unit` as the source-inspected field-mapping tier and `bundle-contract` as generated-payload receipt evidence. Reject installed/runtime tiers in the Phase 2 registry.
- KTD4. Emit nothing when `config.orchestration` is absent. This makes legacy byte stability structural rather than cleanup-based.
- KTD5. Generate compatibility/docs sections mechanically from the registry, including field-level rationale and evidence.

## Implementation Units

### U1 - Complete registry and inventory contract

- Requirements: R1, R2
- Files: `src/orchestration-capability-registry.ts`, `src/validation/platform-rules.ts`, `tests/orchestration-capability-registry.test.ts`, `tests/platform-rules.test.ts`
- Work: add rationale, complete 27 x 4 inventory, enforce exact coverage and Phase 2 proof bounds, and derive the orchestration primitive summary from field rows.
- Test scenarios: missing host row fails; missing field fails; duplicate fails; unsupported runtime evidence fails; every row is non-empty and every host derives a non-preserve-or-honestly-preserve bucket result.

### U2 - Registry-driven deterministic adapters and receipts

- Requirements: R2, R3, R5
- Files: `src/generators/orchestration.ts`, `src/generators/base.ts`, `src/generators/{claude-code,cursor,codex,opencode}/index.ts`, `tests/build.test.ts`, `tests/orchestration-generation.test.ts`
- Work: render a versioned host plan, guidance, and receipt from canonical orchestration plus registry outcomes; call it from each core-four generator only when configured.
- Test scenarios: byte-deterministic output; every field accounted for once; degraded/dropped rows surfaced; receipt tier is bundle-contract; no orchestration produces no new files and unchanged tree output.

### U3 - Three-reference 12-output proof and CLI explainability

- Requirements: R3, R4
- Files: `test-fixtures/orchestration-fixtures.ts`, `tests/orchestration-generation.test.ts`, `tests/primitive-summary.test.ts`, `tests/lint.test.ts`, `tests/doctor.test.ts`
- Work: build all three fixtures for all core-four hosts, assert payload/receipt integrity, and replace unmapped summaries with registry-derived outcomes and diagnostics.
- Test scenarios: 12 builds succeed; each pair contains the fixture identity and 27 outcomes; unsupported semantics are listed; lint/doctor/summary agree with registry.

### U4 - Generated compatibility and durable handoff

- Requirements: R2, R6
- Files: `src/compatibility/core-four-primitives.ts`, `docs/compatibility.md`, `site/how-it-works/compatibility-limits.mdx`, `docs/core-four-primitive-matrix.md`, `docs/start-here.md`, `docs/todo/queue.md`, `docs/todo/master-backlog.md`, `docs/roadmap.md`
- Work: render orchestration field truth from the registry and update product state to generated/source-inspected Phase 2 while reserving runtime proof for Phase 3.
- Test scenarios: compatibility generators reproduce checked-in docs; stale `unmapped`/Phase 2 wording is absent from canonical surfaces; local links and diff checks pass.

## Execution and Verification

Work test-first per unit. Run focused registry/generator/CLI/doc tests after each unit, inspect the 12 generated fixture outputs and receipts, then run `npm test`, `npm run typecheck`, `npm run build`, and repository lint/compatibility validation. Finish with independent CE code review and a separate reviewer-subagent pass; incorporate valid findings before local commits and Linear closeout.

