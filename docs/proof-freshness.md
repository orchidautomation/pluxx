# Proof Freshness And Evidence Tiers

Last updated: 2026-08-31

This document defines how Pluxx distinguishes repeatable repository checks from installed and real-host evidence. The machine-readable source is [proof-manifest.json](./proof-manifest.json), validated by `npm run proof:check`.

The canonical independently verified public release is `@orchid-labs/pluxx@0.1.42` / `v0.1.42` for PLUXX-348, carrying the PLUXX-346 strict Agent Plugins portable target, the PLUXX-347 overlay policy, and the PR #483 installer rollback repair. Immutable tag `v0.1.42` resolves to trusted merge `0f6621a39c02aa69ad3363ad22ada429175779b7`; Release run [33405498774](https://github.com/orchidautomation/pluxx/actions/runs/33405498774) published byte-identical npm and GitHub tarballs at SHA-256 `c4e97ed5eb23703e445ed60a7e5e14f5d096cbd56a291222abf85f94731aadf3`. npm reports integrity `sha512-Mw63WOao0GXFVcqNw3w4Axs1+5nQhb+wtNWJWwOy8SYwuKvlF3r4G+NSjgGd+ZEoqfS1V1gKm3nXsNPjbOtKaw==`, and the isolated registry CLI reports `0.1.42`. The published CLI emitted and tested the strict portable artifact in an isolated fixture with tree digest `7f1264d055421f8b7570f9ca9764a2232a2d6dc9046fd90984fb5a43203e1efa`. Existing repository, native fake-home, and portable compatible-client fixture receipts remain bound to the reachable tested release-prep ancestor `aa13f53f938eeba67d38b22de7070dcbff57eb44`. The 0.1.41 receipts are historical. No current receipt claims active-home installation, real-host behavior, or a generic Codex Agent Plugins import path.

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
