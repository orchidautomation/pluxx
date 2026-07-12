# pluxx publish v1 contract

This document defines the first shippable product contract for `pluxx publish`.

For the broader ship-today vs release-gap map, use [Release Distribution Proof Map](./release-distribution-proof-map.md).

## Goal

`pluxx publish` should make plugin distribution repeatable from one source repo by orchestrating two channels:

- npm publish for package-based targets (v1: OpenCode wrapper package)
- GitHub Release publication for versioned bundle artifacts (`dist/<platform>/...`)

The command is orchestration-only. It does not replace `pluxx build`, and it does not deploy MCP backends.

The current implemented release lane is intentionally narrow:

- GitHub Release assets and generated installers are for the primary fronts: Claude Code, Cursor, Codex, and OpenCode.
- The npm channel is currently for the npm-backed OpenCode wrapper package path.
- Gemini CLI and the other beta targets may be generated and fixture-tested, but they are not part of the primary release-smoked installer lane yet.

## Command surface (v1)

```bash
pluxx publish [--npm] [--github-release] [--dry-run] [--json] [--tag <tag>] [--version <semver>]
```

Behavior rules:

- default channel behavior: if neither `--npm` nor `--github-release` is passed, resolve channels from built targets (target-aware)
  - enable npm only when at least one npm-backed publish target is present
  - enable GitHub Release only when bundle artifacts exist for release distribution
  - this can resolve to npm only, GitHub Release only, or both
- `--npm`: run npm channel only
- `--github-release`: run GitHub Release channel only
- `--version`: required when auto-detection from `package.json` or git tag is ambiguous
- `--tag`: passed to npm dist-tag behavior (defaults to `latest`)
- `--dry-run`: never mutates remote state
- `--json`: machine-readable output with no prose wrappers

## Preconditions

`pluxx publish` v1 must fail fast if required preconditions are missing:

- build artifacts are missing (expects `pluxx build` already ran)
- git working tree is dirty (unless a future `--allow-dirty` is introduced)
- npm channel requested but package metadata/token is missing
- GitHub channel requested but git remote/release credentials are missing

## Artifact contract

`pluxx build` remains the artifact producer. `pluxx publish` only consumes and distributes these outputs.

v1 artifact contract:

- source of truth: current repository commit + built `dist/`
- GitHub Release assets:
  - one compressed artifact per built platform folder (`dist/<platform>/`)
  - a generated `install.sh` front door with `--agents`, `--claude-code`, `--cursor`, `--codex`, `--opencode`, and `-y` support for the primary installer lane
  - generated per-host installer scripts and the compatibility `install-all.sh` script
  - required release manifest and SHA-256 inventory used before installer execution or archive extraction
- npm package source:
  - OpenCode package contents prepared from the generated wrapper target

Version contract:

- one publish invocation maps to one semantic version
- npm and GitHub Release channels must agree on version when both run

## Dry-run contract

`--dry-run` must show exactly what would happen, per channel, before any network mutation.

Human output requirements:

- resolved version/tag
- selected channels (including whether they were explicitly requested or target-inferred)
- precondition check results
- list of release assets that would be uploaded (name + path)
- npm package name/version/tag that would be published
- explicit "no remote changes were made" footer

JSON output requirements (`--json --dry-run`):

```json
{
  "command": "publish",
  "dryRun": true,
  "version": "1.2.3",
  "tag": "latest",
  "channels": {
    "npm": {
      "enabled": true,
      "packageName": "@scope/example-opencode",
      "wouldPublish": true
    },
    "githubRelease": {
      "enabled": true,
      "releaseTag": "v1.2.3",
      "wouldCreateRelease": true,
      "assets": [
        {
          "name": "claude-code-v1.2.3.tgz",
          "path": "dist/claude-code"
        }
      ]
    }
  },
  "checks": [
    {
      "name": "artifacts-exist",
      "ok": true
    }
  ]
}
```

JSON contract rules:

- stable top-level keys: `command`, `dryRun`, `version`, `tag`, `channels`, `checks`
- channel objects always present; use `enabled: false` when not selected
- check failures include a machine-readable code in a future-compatible `code` field

## Responsibility split: npm vs GitHub Release

npm channel owns:

- package publish for npm-backed plugin targets
- dist-tag assignment
- package-level provenance that npm already supports

GitHub Release channel owns:

- creating/updating release entry for the version
- uploading built plugin bundle artifacts for manual or platform-specific install flows
- generating the top-level `install.sh` front door that can route to all supported core hosts through `--agents -y` or to one host through a host flag
- generating host installer scripts, including `install-codex.sh` hook-gate handling for hook-bearing Codex bundles that need `[features].hooks = true`
- release notes body (initially templated/minimal in v1)

When both channels are enabled, failure handling should report per-channel outcome and return non-zero if any enabled channel fails.

## Integrity and recovery behavior

- requested version, source config version, generated host manifests, and npm package metadata must agree before remote mutation
- generated top-level installers verify downloaded per-host installer scripts against `SHA256SUMS.txt`
- generated per-host installers verify manifest identity and archive checksum, reject absolute/traversal paths and link archive members, and only then extract
- config and runtime bootstrap run against a staged candidate; the previous install remains live until staging succeeds and is restored when commit-time work fails
- npm publication compares the exact packed tarball SRI with the registry's `dist.integrity`; it skips an immutable version only when those bytes match
- GitHub publication creates a missing release or reconciles an existing release to the exact asset set, removing stale extras
- enabled channels are queried after mutation; incomplete verification makes the command fail

## Explicit non-goals for v1

Out of scope for this first version:

- marketplace-specific API submissions (Cursor store, etc.)
- promoting Gemini CLI or other beta targets into primary-front installer/release-smoke parity
- automatic remote rollback/unpublish orchestration (local generated-installer rollback is implemented)
- signing, notarization, or SBOM generation
- cross-repo publish orchestration
- changelog intelligence beyond simple template generation
- MCP backend deployment or environment promotion

## Acceptance criteria for implementation tickets

Implementation can be considered aligned with this contract when:

- command behavior matches channel selection rules
- dry-run output includes all required fields in human and JSON modes
- version consistency is enforced across enabled channels
- error codes and messages identify precondition vs channel execution failures
- docs and CLI help text match this contract
