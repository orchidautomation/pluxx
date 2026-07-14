---
title: PLUXX-328 Core-Four Native Adjuncts and Distribution Topology - Plan
type: feat
date: 2026-07-14
artifact_contract: ce-unified-plan/v1
artifact_readiness: implementation-ready
product_contract_source: linear-pluxx-328
execution: code
origin: docs/orchid/plans/2026-07-13-compound-engineering-parity-plan.md
---

# PLUXX-328 Core-Four Native Adjuncts and Distribution Topology - Plan

## Goal Capsule

Recover the residual native adjunct and distribution topology of the pinned Compound Engineering, Hyperframes, and Superpowers fixtures into the existing compiler-owned distribution surface for Claude Code, Cursor, Codex, and OpenCode. Preserve the Phase 0-3 stack, publish transactionally, and emit 12 deterministic adjunct receipts without treating generated registration artifacts as real-host discovery or activation.

---

## Product Contract

### Requirements

- R1. Every fixture adjunct outside the nine canonical buckets is classified as identity/manifest, registration/discovery topology, lifecycle entrypoint, helper/support payload, host-native extension, or source-only distribution evidence, with an exact inventory and canonical owner.
- R2. Migration reconciles supported native identities and adjuncts with fixture revision/digest and path provenance; ambiguous identity, missing referenced content, private local state, path escape, or unowned collision refuses the whole publication.
- R3. One existing distribution registry drives the strongest honest preserve/translate/degrade/drop result for the frozen core four; no secondary-host rows or competing adjunct capability table are introduced.
- R4. Generation preserves exact host-native semantics that matter, including CE marketplace identity separation, Superpowers Codex `hooks: {}` suppression, executable modes, and OpenCode loader entrypoints, while explicitly dropping or degrading unsupported material.
- R5. Install, update, verification, and uninstall reuse transactional ownership primitives so only unchanged Pluxx-owned adjunct state is replaced or removed.
- R6. Twelve fixture/host receipts bind plugin identity/version, pinned fixture revision/digest, host, compiler output digest, exact inventory, install ownership, evidence tier, and policy outcomes, and remain byte-deterministic and privacy-safe.
- R7. Phase 3 residual truth remains authoritative: generated and isolated install topology may be proven, but real-host discovery, activation, and behavioral orchestration remain unsupported or environment-unavailable absent new executable evidence.
- R8. Maintained product, compatibility, roadmap, queue, backlog, decision/review, PLUXX-328, and PLUXX-323 Execution Index truth agree on the Phase 5 boundary and Phase 6 handoff.

### Scope Boundaries

- Claude Code, Cursor, Codex, and OpenCode only; Pi, Gemini, Kimi, ClawHub, and the other secondary targets are inventory evidence only and produce no target rows or receipts.
- Existing canonical skills, agents, orchestration, hooks, runtime payloads, permissions, and instructions keep ownership of their semantics. Adjunct recovery records exclusions rather than duplicating them.
- No live host state, private config, auth, cookies, sessions, transcripts, GitHub mutation, publishing, release, production mutation, or installed plugin mutation.
- Superpowers Codex `openai.yaml` metadata is external and unpinned in the fixture; deterministic publication must refuse any claim that depends on it rather than sourcing it from a live install.

---

## Planning Contract

### Key Technical Decisions

- KTD1. Extend the current distribution lifecycle registry and compiler bucket in place with registry-derived adjunct policy and source contracts. Adjunct inventory is source data, not a second capability matrix.
- KTD2. Represent each adjunct with a stable id, kind, source path, source host or scope, digest, mode, executable bit where relevant, canonical owner, and fixture provenance. Manifest overlays retain host-specific fields instead of first-wins reconciliation.
- KTD3. Compile into a staged host output tree and fail before publication when identity, ownership, path, reference, or suppression semantics are ambiguous. Existing filesystem transactions remain the publication boundary.
- KTD4. Preserve exact files only when the target fixture proves a native surface. Translate shared identity/topology through existing generators; degrade inert support or unproved behavior; drop sibling-host and secondary-host artifacts explicitly.
- KTD5. Extend the Phase 3 receipt compiler rather than adding a parallel receipt system. Adjunct proof is bound to the current compiler output and ownership inventory while activation/behavior stays at the Phase 3 ceiling.

### Inventory Decisions

- Compound Engineering: preserve host manifests/catalogs, OpenCode package loader, committed local-config schema, and referenced interface assets; keep marketplace ids/versions separate from plugin identity/version; treat legacy installers and release automation as source evidence only.
- Hyperframes: preserve three native manifests, Claude marketplace, referenced assets, host hook bindings, and residual skill-native extensions only after canonical agent/orchestration reconciliation; translate its attributed multi-host skill topology through Pluxx ownership rather than copying destructive mirror behavior.
- Superpowers: preserve native manifests/catalogs, Claude/Cursor lifecycle bindings, exact Codex empty-hook suppression, OpenCode loader, skill support modes, and referenced assets; refuse missing external Codex metadata and keep Pi/Kimi/Gemini source evidence out of outputs.

---

## Implementation Units

### U1. Define adjunct source, provenance, and registry policy

- **Requirements:** R1-R4, R7
- **Files:** `src/compiler-contract.ts`, `src/schema.ts`, `src/distribution-lifecycle.ts`, `src/distribution-adjuncts.ts`, `src/index.ts`, `tests/schema.test.ts`, `tests/distribution-adjuncts.test.ts`, `test-fixtures/distribution-adjunct-fixtures.ts`
- **Goal:** Add a strict compiler-owned adjunct contract, exact pinned inventories, and core-four outcomes without changing the nine-bucket boundary.
- **Patterns:** `src/orchestration-capability-registry.ts`, `src/orchestration-runtime-proof.ts`, `src/distribution-lifecycle.ts`.
- **Execution note:** Begin with failing schema/registry tests for coverage, identity separation, path safety, duplicate ownership, Codex hook suppression, executable modes, secondary-host exclusion, and deterministic normalization.
- **Verification:** Focused schema/registry tests prove complete fixture inventory and fail-closed ambiguity.

### U2. Recover adjuncts transactionally during migration

- **Requirements:** R1-R3
- **Dependencies:** U1
- **Files:** `src/cli/migrate.ts`, `src/cli/migrate-adjuncts.ts`, `tests/migrate.test.ts`, `tests/fixtures/compound-engineering-3.19.0/**`, `tests/fixtures/native-adjuncts/**`
- **Goal:** Discover supported adjunct sources, reconcile identities and references with provenance, copy owned source payloads, and publish only after complete staged validation.
- **Patterns:** manifest reconciliation in `src/cli/migrate.ts`, mutation manifests in `src/fs-transaction.ts`, PLUXX-324 tests.
- **Execution note:** Add red tests for CE marketplace-version separation, conflicting identities, missing assets/entrypoints, private config refusal, path escape, and zero partial output before implementation.
- **Verification:** Focused migration tests cover all three fixtures and transactional refusal.

### U3. Compile and install strongest core-four adjunct outputs

- **Requirements:** R3-R5, R7
- **Dependencies:** U1-U2
- **Files:** `src/generators/base.ts`, `src/generators/{claude-code,cursor,codex,opencode}/index.ts`, `src/cli/install.ts`, `src/cli/verify-install.ts`, `src/install-ownership.ts`, `tests/distribution-adjunct-generation.test.ts`, `tests/install.test.ts`, `tests/verify-install.test.ts`
- **Goal:** Render host-appropriate adjuncts, retain exact suppression/entrypoint semantics, and include all companion surfaces in transactional ownership and verification.
- **Patterns:** existing manifest generation, multi-surface install ownership, Codex agent registration, OpenCode wrapper ownership, verifier referenced-file checks.
- **Execution note:** Start with failing generation/install/verify tests, including unowned collisions, update rollback, executable-bit preservation, missing adjunct detection, and uninstall preservation of modified files.
- **Verification:** Four deterministic generators plus isolated install/update/uninstall/verify cases pass without touching live homes.

### U4. Emit and inspect 12 deterministic adjunct receipts

- **Requirements:** R6-R7
- **Dependencies:** U1-U3
- **Files:** `src/orchestration-runtime-proof.ts`, `scripts/audit-distribution-adjunct-fixtures.ts`, `scripts/run-orchestration-runtime-proof.ts`, `tests/orchestration-runtime-proof.test.ts`, `tests/orchestration-installed-runtime-proof.test.ts`, `tests/fixtures/orchestration-runtime-receipts/**`
- **Goal:** Extend the existing receipt contract with fixture revision/digest, compiler output digest, exact adjunct inventory/outcomes, and install ownership evidence for every fixture/host pair.
- **Patterns:** Phase 3 receipt validation, freshness binding, stable serialization, privacy scan, isolated fake-home runner.
- **Execution note:** Add red receipt tests for missing inventory, stale fixture revision/digest, compiler digest mismatch, ownership mismatch, nondeterminism, private material, and prohibited discovery/activation promotion.
- **Verification:** All 12 receipts reproduce byte-for-byte and are manually inspected for exact inventory and Phase 3 evidence ceiling.

### U5. Synchronize compiler-derived truth and closeout artifacts

- **Requirements:** R8
- **Dependencies:** U1-U4
- **Files:** `src/compatibility/core-four-primitives.ts`, `docs/compatibility.md`, `docs/core-four-primitive-matrix.md`, `site/how-it-works/compatibility-limits.mdx`, `docs/start-here.md`, `docs/todo/queue.md`, `docs/todo/master-backlog.md`, `docs/roadmap.md`, `docs/orchid/decisions/2026-07-14-orchestration-primitive.md`, `docs/orchid/plans/2026-07-13-compound-engineering-parity-plan.md`, `docs/orchid/reviews/2026-07-14-pluxx-328-review.md`
- **Goal:** Generate compatibility truth from the registry/receipts and record complete Phase 5 proof plus the exact Phase 6 release-gate handoff.
- **Verification:** Generated docs reproduce exactly; stale-claim, local-link, privacy, and diff checks pass; Linear descriptions match the committed truth.

---

## Verification Contract

1. Focused migration, schema, registry, generator, distribution, install, ownership, verifier, compatibility, and receipt tests after each unit.
2. Inspect all 12 adjunct receipts and rerun generation to prove byte determinism, exact fixture/output digests, and ownership binding.
3. Run `npm test`, `npm run typecheck`, `npm run build`, `npm run generate:compatibility`, and `npm run proof:check`.
4. Run built CLI lint and doctor against isolated maintained fixtures, `git diff --check`, local-link/stale-truth scans, and privacy scans for secrets, auth/session material, absolute user paths, and live host state.
5. Run CE full multi-persona code review plus a separate final independent reviewer; resolve every valid P0-P2 finding and rerun affected and full gates.

---

## Definition of Done

- R1-R8 are met for the frozen core four with no competing registry or reopened secondary-host work.
- Migration and publication fail atomically on ambiguity, collision, private state, missing ownership, or missing pinned evidence.
- All 12 receipts are deterministic, exact-inventory/digest/ownership bound, privacy-safe, and retain the Phase 3 discovery/activation/behavior ceiling.
- Focused and full validation pass; both review layers report no remaining P0-P2 findings.
- A local commit records the complete implementation and synchronized docs; PLUXX-328 closes only then, PLUXX-323 records the commit/validation/residual risk/Phase 6 handoff, and no GitHub or production action occurs.
