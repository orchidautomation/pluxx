---
artifact_contract: ce-unified-plan/v1
artifact_readiness: implementation-ready
execution: code
product_contract_source: linear-pluxx-322
linear_issue: PLUXX-322
created: 2026-07-13
---

# PLUXX-322 Pluxx v0.1.32 Release Preparation

## Goal capsule

Prepare a focused 0.1.32 release PR from exact post-audit main `f92e3cc4b6b292c10e8d2cf4fdbac97afb7e97db`, with truthful release-prep docs and fresh repository-owned proof. The coordinator will merge, tag, publish, verify public artifacts, and archive work.

Product Contract unchanged. This plan packages the nine already-merged PLUXX-313 through PLUXX-321 remediations; it does not change their behavior.

## Requirements

- R1. `package.json`, `package-lock.json`, and canonical version surfaces identify 0.1.32.
- R2. Canonical planning docs say all nine audit remediations are merged and make the 0.1.32 release PR the current next action.
- R3. Pending 0.1.32 is described as `release-prep`, never already tagged, published, or released.
- R4. Existing 0.1.31 receipts remain historical; they are not reused as current 0.1.32 evidence.
- R5. Current 0.1.32 repository and fake-home claims cite a reachable commit containing the release-prep changes and only commands observed passing.
- R6. Official serial `npm test` and `npm run release:check` pass after the version/proof changes.
- R7. A ready, linked, autofix-enabled PR reaches GitHub `CLEAN` with no actionable review threads.

## Scope boundaries

- No merge, tag, npm publish, GitHub Release mutation, force-push, or task/archive cleanup.
- No production behavior changes beyond version metadata and accurate release/proof/planning truth.
- No real-host or live publish proof is claimed; public npm, GitHub, tarball, and CLI verification remains coordinator-owned after release.
- Historical evidence stays historical even when still useful context.

## Key technical decisions

- Use `package.json` as canonical version truth and set the proof manifest to `v0.1.32` plus `release-prep` until the tag exists.
- Commit release/version/doc truth before generating current receipts so receipt SHAs point to code that contains 0.1.32.
- Keep a separate proof-record commit if needed; an ancestor release-prep commit remains reachable from the final branch.
- Describe the audit tranche by outcomes without inventing live publish evidence.

## Implementation units

### U1. Version and release-prep truth

Move package, lockfile, and maintained release docs to pending 0.1.32. Preserve explicitly historical version references. Verify package/lock agreement and run the proof-freshness check.

### U2. Proof reset and fresh receipts

Demote 0.1.31 current claims and receipts to historical. After U1 is committed and the named checks pass, generate new current 0.1.32 receipts through the maintained repository command. Verify manifest version, tag, state, claim linkage, passing outcomes, and reachable commit ancestry.

### U3. Full release verification and review

Install dependencies reproducibly when needed. Run focused version, proof, package, workflow, and release-smoke checks; the official serial suite; and the full release gate. Record exact results, run CE code/doc/release review, and resolve every actionable finding.

### U4. PR and merge-ready handoff

Push the focused branch, open a ready PR linked to PLUXX-322, apply the autofix label, monitor checks and reviews, resolve actionable findings, and stop at GitHub `CLEAN` without merging.

## Verification contract

- `npm ci` when dependency state requires it.
- Focused proof freshness/version, release workflow, package, meta CLI, and release-smoke checks.
- Official serial `npm test`.
- `npm run release:check`.
- CE code/doc/release review with no actionable residuals.
- Ready PR with autofix enabled, GitHub `CLEAN`, and no actionable review threads.

## Definition of done

- Package, proof, planning, and public release docs agree on 0.1.32 release prep.
- Fresh current receipts reference committed 0.1.32 state and observed passing commands only.
- Official serial tests and the release gate pass after final proof changes.
- PLUXX-322, PLUXX-312, and the project carry exact branch, commit, PR, and proof state.
- Coordinator receives an explicit no-merge/no-tag/no-publish handoff and residual-risk summary.
