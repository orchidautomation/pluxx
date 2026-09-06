# PLUXX-333 Legacy Installer Adoption QA

## Scope

Release-blocking fix for generated GitHub Release installers that refused to upgrade trusted pre-ownership plugin installs without `pluxx.install-ownership.v1` ledgers.

## Regression Coverage

- `tests/publish.test.ts` now proves trusted legacy adoption for Claude Code, Cursor, Codex, and OpenCode using fake HOME generated-installer fixtures.
- Negative coverage keeps missing, malformed, and mismatched legacy manifests fail-closed.
- OpenCode coverage migrates recognized generated wrapper and namespaced skill companions, while unrelated skill collisions still fail closed.

## Validation

- `bun test tests/publish.test.ts --timeout 120000` — passed locally during implementation.
- `bun test tests/install-ownership.test.ts --timeout 120000` — passed locally during implementation.
- `npm run typecheck` — passed locally after dependency install.
- `npm run build` — passed locally after dependency install.
- `npm test` — passed locally on 2026-07-16: 61 files / 758 tests.
- `npm run release:check` — passed locally on 2026-07-16, including proof freshness, build, typecheck, full test suite, node package runtime verification, and dry-run npm pack for `@orchid-labs/pluxx@0.1.33`.

CI, PR review, merge, tag, npm publication, and GitHub release verification remain pending until the branch is pushed and reviewed.
