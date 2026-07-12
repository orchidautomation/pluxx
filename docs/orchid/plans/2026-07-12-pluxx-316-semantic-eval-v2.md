---
title: Semantic Eval v2 and Outcome-Based Workflow Proof - Plan
type: feat
date: 2026-07-12
artifact_contract: ce-unified-plan/v1
artifact_readiness: implementation-ready
product_contract_source: linear-pluxx-316
execution: code
---

# Semantic Eval v2 and Outcome-Based Workflow Proof - Plan

## Goal Capsule

- Deliver PLUXX-316 from `origin/main` as one focused change.
- Separate deterministic scaffold checks from semantic quality checks.
- Strengthen behavioral receipts with workflow identity, assertions, and factual artifacts.
- Preserve compatibility for legitimate manual projects.

---

## Product Contract

### Problem Frame

The evaluator proves generated headings and phrases more reliably than workflow coherence. The behavioral harness treats response substrings as sufficient evidence and does not preserve a structured receipt of the invoked workflow surface and produced artifacts.

### Requirements

- R1. Report scaffold-contract checks separately from semantic rubric checks.
- R2. Score tool coverage, routing correctness, taxonomy coherence, realistic examples, argument guidance, delegation, setup truth, and cross-file consistency.
- R3. Support project-level warning and failure thresholds with safe defaults.
- R4. Fail an adversarial fixture that preserves expected headings and phrases while replacing coherent workflow content.
- R5. Keep legitimate manual projects, including `example/pluxx` and `example/docs-ops`, passing without MCP scaffold metadata.
- R6. Return behavioral receipts that identify target, command, skill or agent, assertions, and artifact results.
- R7. Maintain self-hosted cases for import, refine, prove, translate, troubleshoot, and publish dry-run.
- R8. Keep flagship and docs-ingestion projects as maintained semantic regression inputs.

### Scope Boundaries

- This issue does not replace deterministic lint, introduce model-backed grading, refresh old proof claims, or change host translation semantics.
- Live publishing and proof-version governance remain outside PLUXX-316.

### Acceptance Examples

- AE1. A heading-complete but generic or contradictory fixture fails semantic evaluation while its contract checks still pass.
- AE2. A maintained manual project receives fair semantic checks without fabricated MCP or delegation requirements.
- AE3. A behavioral result records the host target, workflow identifiers, response assertions, and factual artifact checks.

---

## Planning Contract

### Key Technical Decisions

- KTD1. Tag checks by domain in `src/cli/eval.ts` so JSON and console consumers can distinguish contract from semantic results without a second command.
- KTD2. Use a deterministic, evidence-bearing rubric so the official suite stays reproducible.
- KTD3. Add semantic thresholds to the validated public project config so TypeScript and JSON projects share one typed policy surface and invalid ranges fail at config load.
- KTD4. Mark inapplicable criteria explicitly instead of assigning zero scores.
- KTD5. Extend behavioral fixtures with workflow identity and artifact assertions while preserving existing response assertion behavior.

### High-Level Technical Design

`runEvalSuite` loads project configuration, authored instructions, skills, commands, optional MCP metadata, and optional eval policy. Contract checks remain exact and generated-scaffold-specific. A semantic rubric emits criterion scores and evidence, then thresholds translate the aggregate score into success, warning, or failure. The behavioral runner normalizes each case into a receipt and evaluates response and filesystem assertions after the host command exits.

---

## Implementation Units

### U1. Semantic rubric and threshold policy

- **Goal:** Add deterministic semantic evaluation with separate reporting and configurable thresholds.
- **Files:** `src/cli/eval.ts`, `tests/eval.test.ts`, and focused fixtures.
- **Test Scenarios:** Healthy generated fixture passes; adversarial heading-complete fixture fails; manual projects pass; threshold overrides alter classification; contract failures remain independently visible.
- **Covers:** R1-R5, R8, AE1-AE2.

### U2. Behavioral receipts and artifact assertions

- **Goal:** Produce structured receipts with factual artifact proof.
- **Files:** `src/cli/behavioral.ts`, `tests/behavioral-smoke.test.ts`.
- **Test Scenarios:** Receipts contain host and workflow identifiers; artifact existence and content assertions pass and fail; legacy configs remain valid.
- **Covers:** R6, AE3.

### U3. Maintained regression inputs

- **Goal:** Make the named self-hosted workflows and maintained projects regression inputs.
- **Files:** Self-hosted behavioral cases, example eval policies, docs-ingestion fixture surfaces, and targeted tests.
- **Test Scenarios:** Six self-hosted flows declare workflow identity and artifact assertions; flagship and docs-ingestion inputs run through semantic evaluation.
- **Covers:** R5-R8.

### U4. Product truth and operator documentation

- **Goal:** Document the new eval and receipt contract and align affected canonical planning surfaces.
- **Files:** Evaluator documentation plus affected canonical docs identified by their `Doc Links` blocks.
- **Covers:** R1-R3, R6-R8.

---

## Verification Contract

| Gate | Command | Done signal |
|---|---|---|
| Eval coverage | `npx vitest run tests/eval.test.ts` | semantic, adversarial, manual-project, and threshold cases pass |
| Behavioral coverage | `npx vitest run tests/behavioral-smoke.test.ts` | receipts and artifact assertions pass |
| Release compatibility | `npx vitest run tests/release-smoke.test.ts` | maintained fixture packaging remains valid |
| Type safety | `npm run typecheck` | zero TypeScript errors |
| Build | `npm run build` | distribution build succeeds |
| Official suite | `npm test` | full suite passes serially |

---

## Definition of Done

- Requirements R1-R8 are implemented or explicitly blocked without weakening behavior.
- New failure modes are proven by deterministic tests.
- CE code review has no unresolved actionable findings.
- Repo docs and Linear truth link the implementation and current validation.
- A focused PR links PLUXX-316 and GitHub issue #406, carries the enrolled repair label, and is mergeable without being merged.
