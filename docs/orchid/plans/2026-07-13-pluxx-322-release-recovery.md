---
artifact_contract: ce-unified-plan/v1
artifact_readiness: implementation-ready
execution: code
product_contract_source: linear-pluxx-322
linear_issue: PLUXX-322
created: 2026-07-13
---

# PLUXX-322 v0.1.32 Release Recovery

## Goal capsule

Recover the existing immutable `v0.1.32` release after GitHub Actions run `29223240724` failed before publication because shallow checkout made proof receipt commit `f2b7cd4` unreachable. Preserve the tag at release merge `188527eb03b2ad31d3536ba461aef73ae3315649`; the coordinator owns merge and dispatch.

## Requirements

- R1. Release checkout fetches full history so committed proof receipts remain reachable.
- R2. Normal `v*` tag pushes keep using the existing release pipeline.
- R3. A required `workflow_dispatch` input selects an existing semver release tag while workflow code is dispatched from `main`.
- R4. Both trigger paths resolve one tag, verify it exists, verify checkout identity, match `package.json`, and pass that tag to `release:check` and GitHub Release creation.
- R5. Recovery dispatch rejects a tag outside the trusted `main` history.
- R6. No task action moves a tag, publishes locally, dispatches the workflow, merges, archives, or force-pushes.

## Scope boundaries

- Do not change package or installer behavior.
- Do not weaken proof freshness or npm provenance checks.
- Do not claim npm or GitHub publication before the coordinator completes and verifies the recovery run.
- Do not create a second release pipeline; reuse the existing ordered check, pack, publish, and verification steps.

## Implementation units

### U1. Hermetic tag resolution

Add full-history checkout and one resolved-tag output shared by tag-push and manual recovery triggers. Validate trigger/ref, tag format and existence, checked-out commit identity, trusted-main ancestry for dispatch, and package version.

### U2. Pipeline reuse

Pass the resolved tag to `PLUXX_RELEASE_TAG` and `softprops/action-gh-release` while leaving the existing release-check, npm reconciliation, provenance, and artifact verification order intact.

### U3. Proof and review

Add focused workflow tests, update only affected release/proof/planning truth, run the focused suite and full `npm run release:check`, then complete CE code/doc/release review.

### U4. Recovery PR

Commit and push `codex/pluxx-0.1.32-release-recovery`, open a ready PLUXX-322-linked PR, add `ai:autofix-enabled`, and monitor substantive CI/review to green without merging or dispatching.

## Verification contract

- Focused release-workflow and proof-freshness tests.
- `PLUXX_RELEASE_TAG=v0.1.32 npm run release:check` from full repository history.
- CE code/doc/release review with no actionable residuals.
- Ready recovery PR with current-head CI and Blocks review green.

## Definition of done

- The recovery workflow is safe for the existing tag and unchanged for future tag pushes.
- Canonical docs distinguish tag existence from successful public publication.
- PLUXX-322, PLUXX-312, and the project link the recovery PR and exact proof.
- Coordinator receives a no-merge/no-dispatch/no-publish handoff.
