# Release Distribution Proof Map

Last updated: 2026-06-24

## Doc Links

- Role: release, distribution, and proof source-of-truth
- Related:
  - [README.md](../README.md)
  - [docs/start-here.md](./start-here.md)
  - [docs/proof-and-install.md](./proof-and-install.md)
  - [docs/core-four-primitive-proof-ledger.md](./core-four-primitive-proof-ledger.md)
  - [docs/core-four-install-update-lifecycle.md](./core-four-install-update-lifecycle.md)
  - [docs/releasing-pluxx.md](./releasing-pluxx.md)
  - [docs/publish-v1-contract.md](./publish-v1-contract.md)
  - [docs/compatibility.md](./compatibility.md)
  - [docs/pluxx-self-hosted-core-four-proof.md](./pluxx-self-hosted-core-four-proof.md)
  - [docs/docs-ops-core-four-proof.md](./docs-ops-core-four-proof.md)
  - [docs/exa-research-example.md](./exa-research-example.md)
- Update together:
  - [README.md](../README.md)
  - [docs/start-here.md](./start-here.md)
  - [docs/todo/queue.md](./todo/queue.md)
  - [docs/todo/master-backlog.md](./todo/master-backlog.md)
  - [docs/roadmap.md](./roadmap.md)

This is the short release/distribution map for what Pluxx can ship today, what is locally proven, and what still belongs to later marketplace or trust-layer work.

## Current Primary Fronts

The repo-owned source of truth currently treats these as the primary, release-smoked fronts:

- Claude Code
- Cursor
- Codex
- OpenCode

Gemini CLI is present as a beta generator target. It is fixture-tested through the generator layer, but it is not part of the current core-four release-smoke or installer lane.

## What Ships Today

Pluxx can ship the OSS authoring substrate today:

- `@orchid-labs/pluxx` is published on npm and runs on Node `>=18`
- one Pluxx source project can build native bundles under `dist/<target>/`
- `pluxx build` checks generated manifests and package outputs for source version drift and missing referenced bundle files before publish
- `pluxx install` can install built bundles locally for the primary fronts
- `pluxx verify-install` checks the host-visible installed bundle, not only generated files in `dist/`
- `pluxx test --install` runs source checks, build smoke, local install, and installed verification together
- `pluxx publish --github-release` can package built bundles into GitHub Release assets and generate the `install.sh --agents` front door plus primary-front installer scripts
- `pluxx publish --npm` covers the npm-backed OpenCode wrapper package path
- `pluxx discover-mcp` and `pluxx init --from-installed-mcp` can import already configured MCP servers from Claude Code, Cursor, Codex, and OpenCode without copying literal secret values

The strongest current proof assets are:

- [Self-hosted core-four proof](./pluxx-self-hosted-core-four-proof.md)
- [Docs Ops core-four proof](./docs-ops-core-four-proof.md)
- [Exa Research Example](./exa-research-example.md)
- [Platform Change Ops reference plugin](./platform-change-ops-reference-plugin.md)
- [Core-four primitive proof ledger](./core-four-primitive-proof-ledger.md)

## Local Build, Install, And Proof Commands

Use the same target slugs everywhere: `claude-code`, `cursor`, `codex`, and `opencode`.

`pluxx sync` refreshes the maintained source project from MCP metadata before build. It is host-independent; run it once in the source project, then rebuild the targets you care about.

```bash
pluxx sync
pluxx sync --from-mcp <source>
```

| Front | Build | Local install | Installed proof | Reload/update note |
| --- | --- | --- | --- | --- |
| Claude Code | `pluxx build --target claude-code` | `pluxx install --target claude-code --trust` | `pluxx verify-install --target claude-code` | run `/reload-plugins` |
| Cursor | `pluxx build --target cursor` | `pluxx install --target cursor --trust` | `pluxx verify-install --target cursor` | use `Developer: Reload Window` or restart |
| Codex | `pluxx build --target codex` | `pluxx install --target codex --trust` | `pluxx verify-install --target codex` | use `Plugins > Refresh` if available, otherwise restart |
| OpenCode | `pluxx build --target opencode` | `pluxx install --target opencode --trust` | `pluxx verify-install --target opencode` | restart or reload OpenCode |

Whole-lane checks:

```bash
pluxx build --target claude-code cursor codex opencode
pluxx test --target claude-code cursor codex opencode
pluxx test --install --trust
pluxx test --install --trust --behavioral
```

`--trust` is only appropriate when the plugin's local hook commands are expected and reviewed. Without it, install prompts before trusting hook-bearing bundles.

## Release And Publish Commands

Maintainer package release for `@orchid-labs/pluxx`:

```bash
npm run release:check
git tag vX.Y.Z
git push origin vX.Y.Z
```

The package itself should publish through the tag-based GitHub Actions workflow, not a local `npm publish`.

Plugin bundle distribution from a Pluxx source project:

```bash
pluxx build
pluxx publish --dry-run
pluxx publish --github-release --version X.Y.Z
pluxx publish --npm --version X.Y.Z
```

`pluxx publish --dry-run` is the safe preflight. Real GitHub Release publishing and npm publishing require clean git state plus the relevant `gh` or npm auth.

## What Is Not Shipped Yet

These are still release gaps, not hidden capabilities:

- marketplace-specific submission APIs, store review workflows, and one-click marketplace listing management
- an operated trust/distribution control plane with org rollout, policy channels, adoption analytics, and fleet health
- automatic rollback or unpublish orchestration
- signing, notarization, SBOM generation, or managed provenance beyond npm/GitHub release primitives
- real authenticated publish plus rollback proof against a safe private authoring target
- Gemini CLI release-smoke and generated installer parity with the primary fronts
- broader host-runtime proof for the remaining Codex and Claude edge cases tracked in the reliability register

## Practical Readiness Rule

Call a plugin release-ready for local/self-hosted distribution when all of these pass:

```bash
pluxx doctor
pluxx lint
pluxx eval
pluxx build --target claude-code cursor codex opencode
pluxx test --target claude-code cursor codex opencode
pluxx test --install --trust
pluxx publish --dry-run
```

The `build` step includes the generated bundle check for targets with manifest or package outputs. It compares source config identity and version to generated output, verifies declared bundle paths, and returns a deterministic file list for tests and release diagnostics.

Call it marketplace/trust-layer ready only after the remaining marketplace submission, managed distribution, authenticated publish/rollback, and provenance requirements are explicitly implemented and proven.
