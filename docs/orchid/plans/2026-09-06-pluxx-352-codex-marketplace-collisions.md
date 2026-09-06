# PLUXX-352 — Detect enabled Codex name collisions across marketplaces

## Status and authority

Planning requested and implementation subsequently authorized by Brandon on 2026-09-06. Implementation runs directly in this task; publication, release, and active-host plugin changes remain out of scope.

- Issue: [PLUXX-352](https://linear.app/orchid-automation/issue/PLUXX-352/detect-enabled-same-name-codex-plugins-across-marketplaces).
- Primary write repository: `orchidautomation/pluxx`; base: `main`.
- Inspected baseline: `0f98992fcb0fe4d9d68b7ddd4871ecd23d70fab1`.
- Planning branch: `codex/pluxx-352-collision-plan`.
- Planning risk: Routine. Proposed implementation risk: Elevated, because verification, generated installers, and exported result contracts must change together.
- Execution: current Codex session and selected model, zero implementation workers, deterministic checks first, at most one local reviewer, zero paid review passes.
- MDP-395 owns consumer test isolation in a separate repository. It is related, not a recorded blocker; PLUXX-349, PLUXX-319, and PLUXX-201 are Done. No consumer repository edits belong here.

## Context and confirmed current behavior

The issue describes a consumer installer verifying its requested native selector while a same-name selector stays enabled elsewhere. That observation is not evidence that Pluxx already has the same native registration implementation.

At the inspected baseline:

- `src/cli/publish.ts`, `renderInstallCodexScript`, stages and swaps the bundle, registers companions, writes a marketplace catalog, and finalizes ownership. It does not call a Codex native installed-plugin listing. Its unchanged shortcut exits before any active-plugin inventory check.
- `src/cli/install.ts`, `installPlugin`, calls `ensureCodexMarketplace`, `clearCodexLocalCache`, and `syncCodexAgentRegistration`; the function returns `Promise<void>`.
- `src/cli/verify-install.ts`, `findCodexCacheCandidates`, scans all marketplace cache directories and sorts by modification time. Cache presence is not enabled-state evidence. `buildCheckFromReport` builds its outcome from doctor, stale state, and separate agent errors.
- `src/cli/doctor.ts`, `doctorConsumer`, is the shared consumer diagnostic path. `VerifyInstallIssue` inherits the doctor issue shape.
- `src/install-contract.ts` exports `pluxx.install-results.v1`, five states, `InstallTargetResult`, `validateInstallResultsEnvelope`, and `renderInstallResultsHuman`. No structured collision field exists.
- Generated aggregate handling in `src/cli/publish.ts` reads child result files only on exit zero, reduces them to pipe-separated fields, and substitutes a generic failure for nonzero exits. Cleanup traps can also overwrite a previously emitted specific failure.
- `tests/publish.test.ts` has generated installer fixtures and transaction tests. Isolation must be checked in every relevant helper, not inferred from a helper that sets only some roots.

The four orientation/planning documents were considered. This issue does not change overall priority, current release truth, or the four-native-destination product boundary; this scoped plan is the only repo documentation change in this planning pass.

## Objective, scope, and non-goals

Prevent clean success whenever the requested Codex package name conflicts with an installed, enabled selector from a different marketplace. Preserve exact composite identities and give a bounded, reusable diagnostic. Same-name parallel installs may be intentional; the operator chooses the remedy.

Scope: reusable inventory normalization and classification, local/generated install checks, doctor and verify-install, exported result validation/rendering, aggregate result preservation, isolated regressions, and narrowly affected install documentation.

Non-goals: automatic uninstall/disable, marketplace preference selection, native registration redesign, cleanup of active host state, cross-plugin primitive-by-primitive overlap detection, MDP-specific policy, release/version bump, or changes to other hosts' success semantics.

## Proposed design decisions

### 1. Native inventory, separate from cache evidence

Introduce `src/codex-plugin-collisions.ts` (new) with a pure normalizer/classifier and a separately injectable process reader. Proposed exports: `normalizeCodexPluginInventory`, `detectCodexPluginCollisions`, and `inspectCodexPluginCollisions`. Export the reusable types and pure classifier through `src/index.ts`.

Upstream research on 2026-09-06: [OpenAI CLI source](https://github.com/openai/codex/blob/main/codex-rs/cli/src/plugin_cmd.rs) documents `codex plugin list --json`; its JSON contains `installed` and `available`, and installed rows carry `pluginId`, `name`, `marketplaceName`, nullable `version`, `installed`, `enabled`, and source metadata. Listing can consult remote catalog state. [App-server documentation](https://github.com/openai/codex/blob/main/codex-rs/app-server/README.md) also describes an installed-only method. These moving upstream sources are research evidence, not proof of the operator's installed CLI version.

Use the CLI listing as the initial adapter, with argument-array spawning, an injected runner, explicit environment/cwd, a 15-second timeout and 2 MiB output limit. Do not use a marketplace filter. Do not add native install/remove calls. Before implementation proceeds beyond the adapter, pin a supported upstream revision and capture sanitized fixtures from a supported CLI in a wholly isolated home. Verify listing preserves plugin/config/catalog state; if it rewrites protected state, stop and resolve the reader contract instead of accepting that side effect. An app-server fallback is not implicit scope.

Normalize only explicit installed rows, require boolean enabled state and internally consistent composite identity, and keep nullable versions as unknown. Do not reinterpret catalog entries or cache directories as enabled installs. Conflicting duplicate rows, malformed identity, oversized output, missing CLI, timeout, or incomplete/unreadable inventory produce `codex-plugin-inventory-unavailable`, never an empty clean inventory. Unknown provider fields may be ignored; required fields may not be guessed.

Resolve requested identity from the generated manifest name plus the actual effective marketplace catalog name. Do not use display names or assume an environment default overrides an existing catalog name. For verify/doctor, bind the requested selector through catalog/source evidence; if it is ambiguous, report unavailable rather than choosing the newest cache. Allow downstream callers to supply an exact requested identity without reimplementing classification.

### 2. Deterministic collision semantics

Compare case-sensitive stable plugin names, not display names. Select rows with `installed === true`, `enabled === true`, a different marketplace, and the same exposed name. Same version and version skew behave identically. Ignore explicitly disabled rows for collision purposes; this is documented policy. Same selector repeated identically is deduplicated. Different plugin names do not collide.

Produce one diagnostic per requested identity with code `same-name-cross-marketplace`, the requested selector/version/source identity, and conflicting selector/version/source identities sorted by selector. Missing requested native registration must not hide a known enabled conflict: report the conflict against the requested installation intent and separately identify requested registration as absent. Do not claim the catalog-only installer has enabled a native selector.

Proposed bounds: up to 20 conflicting rows in output, exact total count and omitted count, and a 16 KiB diagnostic limit. Classify the entire bounded inventory before truncating presentation. Retained selectors remain exact; invalid or overlong identity values yield an unavailable diagnostic instead of truncating an identity into a different selector. Duplicate-name classification represents potential discovery ambiguity, not proof every bundled primitive collides.

Safe source identities contain source kind and a stable digest/opaque identifier. Do not emit raw home paths, credentials, URLs with query strings, manifests, environment contents, or process stderr. Human and JSON renderers use the same sanitized record.

### 3. Terminal result and transaction behavior

Keep the existing state union and schema name. Collision returns `state: failed`, `reason: same-name-cross-marketplace`, bounded `error`, explicit `action`, and an additive typed `diagnostics` array. Inventory failure also returns failed with its distinct reason. The diagnostic describes an unresolved verification condition, not an assertion that no files were installed.

Explicit target exits nonzero. Aggregate continues other selected targets but preserves the full Codex failed record and exits nonzero. A collision can never become installed, updated, unchanged, or skipped. Existing consumers that understand failed remain compatible; update validation so any present diagnostic is validated, and reject success records containing error diagnostics.

Run detection before the unchanged fast path and before install mutations, then re-read after target writes and before transaction finalization. A preflight collision aborts without writes. A post-write collision uses existing owned transaction rollback where available, preserves all pre-existing conflicting plugin/marketplace bytes, and retains the specific diagnostic. Do not promise whole-operation atomicity for `installPlugin` beyond its existing transaction boundaries; report any retained requested-target writes honestly. A future wrapper that performs native registration must call the same check after registration too.

Make result emission terminal and single-owner: cleanup may synthesize generic failure only if no valid specific terminal failure exists. Aggregate must parse and validate child JSON even on nonzero exit, retain diagnostics without pipe/newline flattening, check target identity and exit/result consistency, and fail closed on malformed result files. Human aggregate output must say failures remain and show remediation rather than an unqualified completion message.

### 4. Operator action

Identify both selectors and versions. Tell the operator to review them in Codex's native plugin manager, choose which to keep enabled, disable/remove only their chosen conflicting selector, then refresh/restart and rerun verification. No automatic corrective command runs. Intentional parallel installations still retain the diagnostic; no silent allowlist is introduced.

## Affected files and ordered implementation

1. **Provider fixtures and isolation:** inspect `tests/publish.test.ts` helpers, `tests/install.test.ts`, `tests/verify-install.test.ts`, and `tests/doctor.test.ts`. Add a new synthetic fixture/helper under `test-fixtures/` binding HOME, CODEX_HOME, XDG roots, config override, catalog, caches, cwd, PATH stub, runtime store, and lock roots to one temporary parent. Reject external override paths before spawning. Pin provider schema evidence; do not use active host state.
2. **Classifier and contract:** add the new module and `tests/codex-plugin-collisions.test.ts`; extend `src/install-contract.ts` and `src/index.ts`. Add `tests/install-contract.test.ts` for diagnostic validity, legacy compatibility, deterministic bounds, and human rendering. Pure functions must not spawn or read files.
3. **Verification:** integrate the reader into `doctorConsumer` in `src/cli/doctor.ts`, with one inspection per consumer check. Extend its issue shape with structured diagnostic evidence. Make `src/cli/verify-install.ts` preserve the evidence through `buildCheckFromReport`, count errors once, and return `ok: false`. Keep stale-cache checks separate.
4. **Local install:** add preflight/post-write checks to `installPlugin` in `src/cli/install.ts`, before a clean summary. Use a typed failure carrying the shared diagnostic; inspect and update the CLI caller in `src/cli/index.ts` so JSON/human failures retain it. Preserve the existing return signature for successful callers.
5. **Generated install:** wire the same classifier into `renderInstallCodexScript` and result helpers in `src/cli/publish.ts`. Render/embed the pure implementation using the repo's standalone Node helper pattern, without a runtime npm dependency or an independently maintained classifier copy. Golden parity tests must compare generated and library behavior. Cover unchanged, preflight, post-write, rollback, and cleanup emission.
6. **Aggregate:** replace lossy child-result flattening in `src/cli/publish.ts` with validated JSON composition, including failed children. Preserve the v1 envelope and one result per planned target. Resolve any observed plan-field mismatch against `validateInstallResultsEnvelope` within this integration.
7. **Documentation and proof:** update affected sections of `docs/core-four-install-update-lifecycle.md` and `docs/proof-and-install.md` after reading their Doc Links; explain collision policy, unknown inventory, CLI capability, remediation, and catalog versus native activation. Update relevant linked docs only where behavior changed. Record validation on PLUXX-352; do not call it shipped before release proof.

## Acceptance mapping

| Issue acceptance criterion | Steps | Required proof |
| --- | --- | --- |
| One enabled plugin stays clean | 1–5 | Pure, doctor, verify, and generated fake-home clean cases |
| Two enabled names across marketplaces yield one diagnostic | 2–5 | Exact sorted requested/conflict record, one diagnostic |
| Same-version and skew covered | 2, 5 | Both cases fail identically; versions retained |
| Disabled policy is unambiguous | 2, 7 | Disabled fixture clean; docs say ignored |
| Different names do not collide | 2, 5 | Multiple marketplaces with unrelated names stay clean |
| Pre-existing state is read-only | 1, 4, 5 | External sentinels and conflicting plugin/config/catalog/cache hashes unchanged on success/failure |
| Human and JSON contain identity and remediation | 2–6 | Parse JSON; assert versions, selectors, source identities, action, and no secret/path sentinel leakage |
| Explicit installer cannot report clean success | 5 | Nonzero on collision, including unchanged path and collision introduced between reads |
| Aggregate preserves collision | 6 | Failed child remains exact structured failure; other targets finish; overall nonzero |
| All host roots isolated | 1 | Mixed-root pre-spawn rejection; no real Codex executable fallback; cleanup only fixture-owned state |
| Docs explain marketplaces do not supersede each other | 7 | Focused doc review and consistent wording |

Additional edge cases: requested registration absent; malformed or incomplete inventory; unknown version; duplicate rows; deterministic ordering across shuffled rows; 21+ conflicts; timeout/output cap; source-redaction sentinels; repeated unchanged collision; generic EXIT trap cannot overwrite evidence; rollback failure remains visible alongside collision; JSON output is one parseable document with no progress text.

## Validation sequence

Planning validation: inspect every cited existing path/symbol, confirm all eleven acceptance rows have proof, run `git diff --check`, and review the plan against the issue. No application test pass or installed-runtime proof is claimed from this planning task.

After implementation authorization:

1. Run the new classifier/contract tests and the generated collision regression before the fix; demonstrate the original silent-success failure.
2. Run `npm test -- tests/codex-plugin-collisions.test.ts tests/install-contract.test.ts tests/publish.test.ts tests/install.test.ts tests/verify-install.test.ts tests/doctor.test.ts tests/install-ownership.test.ts tests/codex-agent-install.test.ts` after the changes. Use the repo's exclusive test wrapper.
3. Run `npm test`, `npm run typecheck`, `npm run build`, and `npm run pack:check`. Exercise the packaged export and rendered installer against the same synthetic fixture; no active-home install.
4. Directly review the diff for transaction boundaries, diagnostic loss, provider limits, and identity/privacy correctness. At most one independent local reviewer if warranted; no paid external review.

## Compatibility, rollout, risks, and rollback

No migration or native registration mutation is required. Existing result states remain valid, with additive diagnostics. CLI absence/unsupported inventory will newly prevent clean Codex verification; documentation and tests must make this intentional compatibility cost explicit. Other host results remain unchanged.

The key risks are provider schema drift, remote listing latency/side effects, incorrect marketplace attribution, confounding cache presence with activation, accidentally changing install transaction guarantees, and generated/library classifier drift. Isolated pinned provider fixtures, strict unavailable outcomes, preflight/post-write reads, parity tests, and byte-preservation checks address them. Inspection is a snapshot, not a guarantee against later concurrent operator changes.

Ship one cohesive implementation PR after authorization. Existing repo policy requires `ai:autofix-enabled` when that PR is opened unless explicitly opted out. Merge remains Brandon's action. Release and downstream installer regeneration are separate work; old generated installers will not acquire detection automatically. Rollback is a reviewed code revert and later release, never deletion or disabling of a conflicting host plugin. Record result code/counts in validation evidence without raw host inventories.

## Blockers and readiness verdict

The design is ready for review. No recorded Linear dependency blocks planning. Native provider compatibility and read-only behavior still require the isolated capability check in step 1; the operator's current CLI has not been exercised. Do not claim a supported runtime range until that check pins evidence.

Execution verdict: **READY_TO_PIN** following implementation authorization and isolated provider proof. On 2026-09-06 Codex CLI 0.149.1 registered two synthetic collision-proof selectors in separate temporary marketplaces. Native JSON listing returned both as installed and enabled, with name/version/source fields matching the proposed adapter. SHA-256 snapshots of fixture config, catalogs, plugin sources and caches were identical before and after listing. No active-host data was used. The supported adapter baseline is this observed CLI schema; future incompatible responses fail closed. Commit/pin this plan and fresh-read the repaired Linear brief through canonical readiness before application code changes.
