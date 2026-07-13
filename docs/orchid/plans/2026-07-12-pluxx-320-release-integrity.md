---
artifact_contract: ce-unified-plan/v1
artifact_readiness: implementation-ready
product_contract_source: linear-pluxx-320
linear_issue: PLUXX-320
created: 2026-07-12
---

# PLUXX-320 Release Integrity And Recovery

## Problem frame

Pluxx release assets have generated checksums, but the generated installer chain does not authenticate installers or archives before execution/extraction. Per-host installers replace live installs before configuration and runtime bootstrap complete. Publish execution does not reconcile partially completed npm/GitHub state, and CLI upgrade does not prove which executable/version is active afterward.

Product Contract unchanged. This plan implements the acceptance criteria in PLUXX-320 without adding signing, marketplace submission, or automatic unpublish/rollback.

## Scope and requirements traceability

- R1 / tamper rejection: generated top-level and per-host installers fetch the release manifest and checksum inventory, verify the exact downloaded asset, and reject unsafe tar members before extraction.
- R2 / install recovery: each per-host installer prepares and bootstraps a staged install, preserves the live install until staging succeeds, and restores the prior install when commit-time work fails.
- R3 / publish identity: `pluxx publish --version` must agree with source config, built target manifests/package metadata, and the npm package identity.
- R4 / publish reconciliation: npm and GitHub channels inspect existing remote state, skip already-correct work, repair partial GitHub asset state, and verify both channels after mutation.
- R5 / upgrade recovery: upgrade reports invocation source, requested/latest/current comparison, downgrade warnings, the active PATH binary/version after installation, and an exact rollback command.
- R6 / proof: tests cover tampering, unsafe archive members, bootstrap rollback, identity mismatch, partial publish recovery, post-publish verification, and upgrade planning/verification.

## Scope boundaries

- No cryptographic signing, notarization, SBOM, or managed trust control plane.
- No marketplace API submissions or unpublish automation.
- No changes to local `pluxx install`; this ticket owns generated release installers, publish orchestration, and global CLI upgrade.
- Remote tests use deterministic command-runner fakes; official validation does not mutate npm or GitHub releases.

## Implementation units

### 1. Release asset verification and safe extraction

Files: `src/cli/publish.ts`, `tests/publish.test.ts`

Add manifest/checksum metadata that binds versioned and latest archive names to one release identity. Generated `install.sh` verifies each downloaded per-host installer before executing it. Per-host installers verify manifest version/plugin identity and archive checksum before extraction, reject absolute/traversal/link archive members, and only then inspect the expected bundle root.

Test scenarios:

1. A valid generated archive and checksum install successfully.
2. A modified archive fails before extraction and leaves the existing install unchanged.
3. An archive containing `../`, absolute, symlink, or hard-link members is rejected.
4. A modified per-host installer is rejected by the top-level installer.

### 2. Transactional generated installers

Files: `src/cli/publish.ts`, `tests/publish.test.ts`

Prepare the candidate bundle in a sibling staging directory, apply saved/user config and runtime bootstrap there, then swap it into place with a backup and rollback trap. Keep host metadata changes after a successful stage; preserve/restore directly modified companion files where the installer owns them.

Test scenarios:

1. Bootstrap failure keeps the previous bundle byte-for-byte.
2. Successful upgrade replaces the bundle and removes staging/backup paths.
3. Copy/config failure does not delete the previous install.

### 3. Publish identity, reconciliation, and verification

Files: `src/cli/publish.ts`, `tests/publish.test.ts`, `docs/publish-v1-contract.md`

Validate requested/source/built/npm versions during planning. Inspect npm package-version and GitHub release assets before mutation. Skip an already-published npm version, create or reconcile the GitHub release as needed, then query both channels to verify final version/assets. Return machine-readable per-channel action and verification detail.

Test scenarios:

1. Requested version mismatch fails preflight.
2. Built manifest/package version mismatch fails preflight.
3. Existing npm version is treated as reconciled rather than republished.
4. Existing GitHub release with missing assets uploads/reconciles them.
5. Failed post-publish verification makes the command fail.

### 4. Upgrade source and active-version proof

Files: `src/cli/upgrade.ts`, `src/cli/index.ts`, `tests/upgrade.test.ts`, `tests/meta-cli.test.ts`

Move upgrade planning/comparison into an injectable helper. Resolve current and requested/latest versions, classify invocation source, locate the active PATH executable, warn on downgrade, execute the global install, and verify the active executable/version. Always include an exact rollback command using the pre-upgrade version.

Test scenarios:

1. Global, npx/cache, and repo-local invocation paths are classified.
2. Upgrade, no-op, and downgrade comparisons are reported.
3. PATH resolves to a different binary or stale version and verification fails clearly.
4. Successful verification reports the active binary and version.

### 5. Workflow proof and product truth

Files: `.github/workflows/release.yml`, `tests/release-workflow.test.ts`, `docs/release-distribution-proof-map.md`, `docs/start-here.md`, `docs/todo/queue.md`, `docs/todo/master-backlog.md`, `docs/roadmap.md`

Make the package release workflow explicitly verify npm and GitHub release state after publication. Update maintained release truth to describe checksum verification, transactional recovery, reconciliation, and remaining residual risks without claiming a live authenticated release proof that was not run.

## Sequencing and validation

1. Add failure-mode tests, then implement installer integrity/transactions.
2. Add publish identity/reconciliation tests and implementation.
3. Add upgrade unit/integration tests and implementation.
4. Update release workflow and repo truth.
5. Run targeted publish/package/meta/release/distribution/release-check tests, `npm run typecheck`, `npm run build`, then official `npm test` serially.
6. Run CE code review plus supply-chain/security review, address findings, and rerun validation.

## Residual risks to report

- SHA-256 inventories protect transport/release consistency but are not publisher signatures; GitHub account/release compromise remains outside this ticket.
- npm does not support republishing an existing version; reconciliation verifies the immutable version and can repair dist-tags only when explicitly implemented.
- Host-owned metadata operations may have host-specific behavior beyond the deterministic fixture proof; live authenticated publish remains a separate proof activity.
