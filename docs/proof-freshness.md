# Proof Freshness And Evidence Tiers

Last updated: 2026-07-12

This document defines how Pluxx distinguishes repeatable repository checks from installed and real-host evidence. The machine-readable source is [proof-manifest.json](./proof-manifest.json), validated by `npm run proof:check`.

Current reviewed receipts for v0.1.32 are `v0.1.32-repository-validation` (`bundle-contract`, `current`) and `v0.1.32-fake-home-install` (`fake-home-install`, `current`). They cite committed release-prep state only after `npm run release:check` passed. The v0.1.31 receipts remain historical. Neither current tier is installed-runtime or real-host behavior evidence.

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
