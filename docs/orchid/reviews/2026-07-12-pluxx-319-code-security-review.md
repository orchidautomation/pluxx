# PLUXX-319 Code, Security, and Reliability Review

Reviewed the working diff against `origin/main` after the first complete targeted and full-suite validation pass.

## Coverage

- Correctness and acceptance criteria: install staging, swap, rollback, ownership drift, conservative removal, Codex apply/unapply, generated installer parity, and verification semantics.
- Reliability: failure before swap, failure after swap, ownership-write ordering, backup lifecycle, idempotency, legacy/unowned state, and host-adjacent post-install failures.
- Security and supply chain: archive-to-stage boundary, path traversal, ownership-ledger tampering, symlink handling, config overwrite targets, file permissions, and secret-bearing config backups.
- Tests and docs: targeted failure-mode coverage, current serial full-suite proof, CLI help, and canonical planning truth.

## Actionable Findings Resolved

### P1. Codex config ownership could redirect unapply to an arbitrary path

The first implementation trusted `configPath` from the ownership record. A same-user tamper could redirect conservative restore to another file. Unapply now requires the recorded path to equal the path resolved from the current command options, and a sentinel test proves tampering cannot overwrite another file.

### P1. Codex config rewrite and ownership backup permissions were too broad

Atomic temp files initially used default creation permissions even though the ownership record contains a recoverable copy of active config that may include secrets. Config rewrites now preserve the existing mode or default to `0600`; config and install ownership records are created with `0600`.

### P2. Backup cleanup could invalidate a successful transaction

The first implementation treated failure to delete a post-verification backup as transaction failure, which could restore the old bundle after the new ownership record had committed. Backup cleanup is now best effort after the new bundle and ledger are valid; a cleanup failure leaves the recoverable backup instead of rolling state backward inconsistently.

## Residual Risk

- Generated installers embed the transaction helper because consumers may not have Pluxx installed. The helper is covered by executed installer fixtures, but it intentionally duplicates a narrow subset of `src/install-ownership.ts`; future schema changes must update both paths together.
- Existing copied installs without a valid ownership record are not silently adopted. Reinstall fails with an instruction to move or remove the legacy directory, which favors preservation over seamless migration.
- Codex unapply restores automatically only when the active config still matches the applied state. Later user edits are preserved and require manual reconciliation; this is intentionally conservative.
- Archive checksum/signature verification and release recovery remain outside this issue and belong to PLUXX-320.

## Verdict

No unresolved P0-P2 correctness, security, reliability, or supply-chain finding remains in the PLUXX-319 diff. The branch is ready for final serial validation and PR review.
