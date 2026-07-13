---
artifact_contract: orchid-review/v1
linear_issue: PLUXX-322
reviewed: 2026-07-13
base: f92e3cc4b6b292c10e8d2cf4fdbac97afb7e97db
---

# PLUXX-322 v0.1.32 Release Review

## Verdict

Ready for PR review. CE correctness, testing, maintainability, project-standards, agent-native, learnings, adversarial release-gate, coherence, and feasibility passes found no unresolved actionable items after fixes.

## Findings resolved

- Added an exact-tag publish transition so the immutable `release-prep` tag commit can pass its release workflow without weakening ordinary branch or post-release proof-state checks. Focused proof and workflow coverage verifies exact-match, mismatch, and normal strict behavior.
- Documented the release gate's temporary-install and npm registry requirement.
- Corrected the active v0.1.32 sequence in `docs/start-here.md` and refreshed the public proof page date.
- Re-ran the complete release gate after all receipt, manifest, review, workflow, test, and documentation changes.

## Verification

- `npm exec -- vitest run tests/proof-freshness.test.ts tests/release-workflow.test.ts` — passed, 17/17.
- `npm run release:check` — passed with exit 0 on the completed working tree:
  - proof freshness: 6 claims, 6 receipts
  - build and typecheck: passed
  - official serial suite: 61 files, 752 tests passed
  - packed Node package runtime verification: passed
  - dry-run package: `@orchid-labs/pluxx@0.1.32`, 192 files, 707.7 kB

## Boundaries

No merge, tag, publish, GitHub Release mutation, public registry verification, or real-host proof was performed. Those remain coordinator-owned after this PR reaches a clean mergeable state.
