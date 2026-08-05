# Proof Freshness And Evidence Tiers

Last updated: 2026-08-05

This document defines how Pluxx distinguishes repeatable repository checks from installed and real-host evidence. The machine-readable source is [proof-manifest.json](./proof-manifest.json), validated by `npm run proof:check`.

The canonical and independently verified public release is `@orchid-labs/pluxx@0.1.39` for the PLUXX-341/PLUXX-342 quiet OpenCode hook-scope repair merged through PR #468. Immutable tag `v0.1.39` points to trusted merge `9e404537e8f3b007cfadf67d90487efdad160f20`; tag-triggered Release run [31023227838](https://github.com/orchidautomation/pluxx/actions/runs/31023227838) published byte-identical npm and GitHub artifacts at SHA-256 `79a75caa36f636e34e03dbadc36376ca513c279cbae03fecab9c9da1235e2fe5`. Fresh current receipts `v0.1.39-repository-validation` and `v0.1.39-fake-home-install` bind to exact release-prep commit `6ffb6337b351c5a87b985394f0c011d2c271a940`, where `npm run release:check` passed on 2026-08-05 with 62 test files and 828 tests plus isolated packed-runtime and dry-pack verification. No current receipt claims installed-runtime or real-host behavior.

## Version And Freshness Policy

- `package.json` is the canonical repository version.
- The expected release tag is `v<packageVersion>`.
- `releaseState` is `released` when that tag exists and `release-prep` when it does not. This field records immutable tag state, not successful npm or GitHub publication; public release claims still require publication verification. Release-prep docs must not describe the pending version as already tagged or released.
- Unit, bundle-contract, and fake-home receipts are current only when their package version matches `package.json` and their tested commit is reachable from the current branch.
- Installed-runtime and real-host receipts must also be 30 days old or newer. Older environment evidence is historical even when its package version still matches.
- Historical receipts remain available, but canonical current-proof claims must label them historical and may not use them as current compatibility evidence.

## Evidence Tier Contract

| Tier | Minimum evidence | What it may claim | What it may not claim |
| --- | --- | --- | --- |
| `unit` | focused assertions against source modules | the tested function or module contract | generated bundle, installation, runtime discovery, or host behavior |
| `bundle-contract` | real CLI build/test plus generated-file and consumer-contract checks | the generated bundle has the expected shape and passes repo-owned contract checks | installation into a real user home or host behavior |
| `fake-home-install` | install and verification against an isolated temporary home, including installed-file assertions | install layout, ownership, and verifier behavior in an isolated filesystem | discovery or execution by a real host application |
| `installed-runtime` | host-visible installed path, artifact hash, host version, runtime command, and outcome | the named installed artifact was discovered or executed by the named host/runtime version | broader workflows or other host versions not exercised by the receipt |
| `real-host-behavior` | an actual host workflow with host version, installed path/hash, command or prompt, observable outcome, and timestamp | the exact workflow succeeded in the named host environment | evergreen compatibility after the 30-day window or untested hosts/workflows |

`tests/release-smoke.test.ts` is retained as a stable file path, but its suite is bundle-contract plus isolated fake-home install proof. It is not real-host behavior proof.

## Receipt Contract

Each receipt records commit SHA, package version, timestamp, proof tier, commands, target and host versions, installed paths, hashes, and outcomes. Older evidence may provide a reason when an environment field was not captured.

Current claims in `docs/proof-manifest.json` must resolve to a receipt whose tier and freshness match the claim. CI also rejects obsolete release-prep/current-version language in canonical planning and proof docs.

## Immutable-Tag Recovery Contract

An existing immutable tag may be recovered only after a reviewed workflow change lands on the exact current trusted `main` commit. The workflow must prove that the tag commit belongs to current `main`, that the checked-out tag, package version, and artifact identity match, and that the tagged checkout has no tracked changes.

The recovery reruns build, typecheck, the full test suite, packaged-runtime verification, and dry-run packaging against the exact tag tree. It may then create an ephemeral proof-manifest overlay that binds only the existing current receipt set to that exact tag and the newly passed commands. The normal `proof:check` command must pass against the overlay. The workflow must restore the committed manifest and re-prove a clean tag checkout before packing the publish candidate.

The recovery receipt records the exact tag commit and tree, trusted-main workflow commit, validation outcomes, proof baseline and overlay hashes, and package artifact hashes. The final npm tarball and downloaded GitHub release asset must match the independently validated candidate hashes. Recovery does not move the tag, weaken the normal proof checker, or claim installed-runtime or real-host evidence.

## Real-Host Refresh Guidance

Run real-host proof manually before a release claim or on a scheduled monthly cadence:

1. Record the package version, tested commit, UTC timestamp, host version, and installed path.
2. Hash the installed artifact or deterministic installed tree.
3. Run the named workflow and capture only the observable outcome needed for the claim.
4. Add or regenerate the receipt, then run `npm run proof:check`.
5. If the host or environment is unavailable, record `not-run` and the reason. Do not copy an older success forward as current evidence.

Scheduled automation may publish receipts as CI artifacts. Committed canonical claims still require a reviewed manifest update before they can be described as current.

Use [proof-receipt.example.json](./proof-receipt.example.json) as the receipt-spec shape. Checked-in run specs live under `docs/proof-receipts/`. Copy the example to a run-specific file, record the commands and outcomes actually observed, then regenerate the matching receipt:

```bash
npm run proof:receipt -- --spec path/to/receipt-spec.json
npm run proof:check
```

`proof:receipt` fills the current commit SHA, package version, and UTC timestamp, then inserts or replaces the receipt with the same `id`. Add or update the corresponding claim in `proof-manifest.json`; its `tier`, `freshness`, and `receiptId` must match before `proof:check` passes.
