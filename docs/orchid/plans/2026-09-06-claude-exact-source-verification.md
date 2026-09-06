# Claude exact-source verification

Authorized by Brandon on 2026-09-06 after the Claude A spec on PLUXX-353. Risk: Elevated. Direct Codex execution, zero implementation workers; no host cleanup, collision detection, Cursor changes, release, or deployment.

## Evidence

Baseline 0f98992fcb0fe4d9d68b7ddd4871ecd23d70fab1 resolves foreign same-version caches by mtime. Three extracted-resolver assertions reproduce that behavior. Existing release-cache verification intentionally supports non-development marketplaces and must remain supported through explicit native attribution.

Claude Code 2.1.233 was probed with a synthetic local marketplace in a temporary HOME and CLAUDE_CONFIG_DIR, isolated XDG and tmp roots, empty credentials environment and nonessential traffic disabled. Native add/install produced `probe@pluxx-proof`, version 1.0.0, scope user, enabled true and exact installPath. `plugin list --json` preserved every snapshotted configuration/catalog/plugin file (debug excluded), with no new protected files. This proves the installed-list schema for that version, not runtime activation or complete managed/session coverage.

## Contract

1. Add a bounded native inventory adapter and pure requested-source resolver. Validate the complete installed array, exact qualified ids, scope, enabled boolean, absolute installPath and nullable version. Do not inspect available catalogs or use mtime as native identity. Unsupported or contradictory rows return unavailable.
2. Explicit selectors bind identity. Unqualified verification can use exactly one relevant registered identity; multiple identities fail with source selection required. Scope defaults to current supported inventory context; do not claim an arbitrary session's runtime activation. Distinguish registered-disabled from enabled evidence. Enabled is inventory evidence, never proof hooks ran.
3. Preserve low-level file-only consumer inspection. Native verify-install for Claude obtains its path from inventory, checks source version and bundle content, and reports native evidence. Expose an explicit qualified selector option for disambiguation and a file-only mode for offline bundle checks; file-only output must disclose activation unverified.
4. Native local install checks inventory availability before mutations and exact requested selector/version/path after installation. Do not substitute another marketplace. Generated release installer applies the same selector semantics and verifies after registration; unchanged path must not bypass native readback. Offline generated staging continues to say activation unverified.
5. Doctor's explicit consumer path remains file-oriented but records that boundary; optional requested native identity uses the shared reader. Structured diagnostics retain failure reason and action. Aggregate must retain target failure; do not assert no requested files were changed after native command failure.

## Implementation surfaces

New shared Claude inventory module and tests; src/cli/install.ts; src/cli/verify-install.ts; src/cli/doctor.ts; src/cli/index.ts; src/cli/publish.ts; src/install-contract.ts only if additive evidence needed; relevant install/verify/doctor/publish tests. Use a shared standalone helper generation pattern or parity-tested embedding, not drifting classifiers.

## Acceptance and validation

Exact development and release identities pass. Foreign matching caches do not satisfy requested identity. Multiple ids require selection; mtime is irrelevant. Disabled records, version skew, absent request, contradictory scopes and malformed/missing/timed-out inventory have explicit diagnostics. File-only paths retain offline functionality without native claims. No CLI fallback escapes fake roots. Generated/local/verify parity and aggregate nonzero failure retention are tested, including unchanged paths. Preflight does not mutate; postflight reports native partial state honestly. Sentinels and other marketplaces remain unchanged.

Run focused Claude/install/verify/doctor/publish/result tests, typecheck, build, package check and full suite. Review one cumulative diff, create one PR labeled ai:autofix-enabled, stop before Brandon's merge. Reconcile results on the child ticket and PLUXX-353 without claiming shipped status.
