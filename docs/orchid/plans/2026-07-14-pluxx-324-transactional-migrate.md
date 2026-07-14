---
title: PLUXX-324 Transactional Mature-Plugin Migration - Plan
type: fix
date: 2026-07-14
artifact_contract: ce-unified-plan/v1
artifact_readiness: implementation-ready
product_contract_source: linear-pluxx-324
execution: code
origin: docs/orchid/requirements/2026-07-13-compound-engineering-primitive-audit.md
---

# PLUXX-324 Transactional Mature-Plugin Migration - Plan

## Goal Capsule

Make `pluxx migrate` publish a schema-valid canonical project or fail before changing the destination. PLUXX-324 is authoritative. Orchestration IR, generators, installs, releases, new hosts, and remote repository operations are out of scope.

## Product Contract

### Requirements

- **R1:** Validate the complete staged project with the current Pluxx config loader/schema before publication.
- **R2:** Validation or reconciliation failure publishes no new or partially replaced destination files.
- **R3:** Reproduce and fix the pinned Compound Engineering 3.19.0 `brand.displayName` false-success.
- **R4:** Discover all recognized manifests in deterministic order and merge compatible canonical truth.
- **R5:** Refuse conflicting scalar truth with a diagnostic naming the field and source manifests.
- **R6:** Persist deterministic manifest and field provenance in a migration receipt.
- **R7:** Preserve existing single-host, dry-run, collision, and rollback behavior.
- **R8:** Synchronize migration truth in repo docs and Linear.

### Acceptance Examples

- The pinned CE fixture combines Claude, Cursor, and Codex metadata, loads successfully, and records all manifest sources.
- Conflicting descriptions fail with both manifest paths and leave the destination unchanged.
- Invalid staged config fails in dry-run and apply before destination mutation.

## Planning Contract

### Key Technical Decisions

- **KTD1:** Replace first-match manifest selection with fixed-order discovery; keep a primary platform only for existing adjunct parsing.
- **KTD2:** Require identity-scalar agreement, stable-union arrays, and resolve brand scalars with explicit `opencode < claude-code < cursor < codex` precedence; refuse identity ambiguity.
- **KTD3:** Parse every manifest under its own platform rules so Codex/Cursor metadata survives a Claude primary source.
- **KTD4:** Reuse `loadConfig(stagedRoot)` as schema authority and `applyFileMutations` as the publication transaction.
- **KTD5:** Write the same versioned provenance to the migration receipt and machine-readable summary, including policy, chosen field sources, and all candidates.
- **KTD6:** Commit a bounded CE fixture with upstream SHA provenance rather than vendoring the full plugin.

## Implementation Units

### U1. Add failing migration contracts

**Requirements:** R1-R7

**Files:** `tests/migrate.test.ts`, `tests/fixtures/compound-engineering-3.19.0/**`

**Approach:** Add the CE regression, ambiguity refusal, receipt, and no-publication tests; run them before implementation.

**Test Scenarios:** CE brand enrichment and valid load; deterministic receipt; conflicting field names both manifests; invalid staged config leaves no output.

**Verification:** `bun test tests/migrate.test.ts`

### U2. Reconcile manifests and validate the stage

**Requirements:** R1-R7

**Files:** `src/cli/migrate.ts`, `tests/migrate.test.ts`

**Approach:** Discover and reconcile recognized manifests with provenance, generate the receipt, then load the staged config before mutation planning/application.

**Test Scenarios:** fixed discovery order; equal-value provenance; keyword union; host metadata merge; deterministic conflict diagnostics; single-host compatibility; apply/dry-run validity gate.

**Verification:** `bun test tests/migrate.test.ts tests/fs-transaction.test.ts tests/schema.test.ts`

### U3. Synchronize truth and close out locally

**Requirements:** R8

**Files:** `docs/start-here.md`, `docs/todo/queue.md`, `docs/todo/master-backlog.md`, `docs/roadmap.md`, `docs/orchid/requirements/2026-07-13-compound-engineering-primitive-audit.md`, `docs/orchid/reviews/2026-07-14-pluxx-324-review.md`

**Approach:** Record local Phase 0 behavior and proof while keeping Phase 1 unshipped; update PLUXX-324 and its parent execution index.

**Verification:** focused tests, full gates, independent CE review, and reviewer subagent.

## Verification Contract

1. Red proof: `bun test tests/migrate.test.ts`.
2. Focused: `bun test tests/migrate.test.ts tests/fs-transaction.test.ts tests/schema.test.ts`.
3. Manual pinned CE source after verifying SHA `f871e4b4308f5a175b38ccada51d80dd67bab4fc`.
4. Full gates: `npm test`, `npm run typecheck`, `npm run build`.
5. `package.json` has no repository lint script; report that explicitly.
6. Run `ce-code-review`, then the required reviewer subagent, and rerun affected gates.

## Definition of Done

- R1-R8 are implemented and proven.
- CE fails on baseline behavior and passes after the fix.
- Identity conflicts are refused; supported brand conflicts follow the recorded host-precedence policy.
- Validation precedes publication in dry-run and apply.
- Focused and full gates pass.
- Docs and Linear reflect local Phase 0 truth and the Phase 1 handoff.
- Review findings are resolved or recorded as residual risk.
- Local commits exist on `codex/pluxx-324-transactional-migrate`; no remote mutation occurs.
