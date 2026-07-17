# Runtime Contract

Last updated: 2026-07-17

## Doc Links

- Role: package runtime source of truth
- Related:
  - [README.md](../README.md)
  - [docs/how-it-works.md](./how-it-works.md)
  - [docs/proof-and-install.md](./proof-and-install.md)
  - [docs/releasing-pluxx.md](./releasing-pluxx.md)
  - [docs/start-here.md](./start-here.md)
  - [docs/todo/queue.md](./todo/queue.md)
  - [docs/todo/master-backlog.md](./todo/master-backlog.md)
  - [docs/roadmap.md](./roadmap.md)
- Update together:
  - [README.md](../README.md)
  - [docs/how-it-works.md](./how-it-works.md)
  - [docs/proof-and-install.md](./proof-and-install.md)

This is the current runtime contract for `@orchid-labs/pluxx`.

## Published CLI Runtime

The published Pluxx CLI runs on Node `>=18`.

Node is sufficient for end users running the npm package.

Supported consumer invocation paths:

- `npx @orchid-labs/pluxx ...`
- `npm install -g @orchid-labs/pluxx` followed by `pluxx ...`
- `node ./bin/pluxx.js ...` from this repo after `npm run build`

The published package ships the Node launcher in `bin/` and the compiled runtime in `dist/`.
The launcher intentionally does not load TypeScript source files or fall back to Bun at runtime.

## Config Loading

`pluxx.config.ts` and `pluxx.config.js` are loaded under Node through `jiti`.

Config imports of `pluxx` or `@orchid-labs/pluxx` are rewritten to the package runtime entry so fixture projects and installed packages do not need a separate local package alias.

## Generated Hook Command Runtime

Generated command-hook wrappers run bundle-owned commands from the installed plugin root. They export the host/plugin root variable for the target plus the shared `PLUGIN_ROOT` and `PLUXX_PLUGIN_ROOT` variables so scripts can reference bundled files without depending on the host launch directory.

Wrappers also expose `PLUXX_HOOK_WORKSPACE_ROOT` when Pluxx can prove the active agent workspace from an explicit setting, a known host workspace variable, or a JSON hook payload on stdin. If no workspace can be proven, the variable is omitted instead of falling back to the plugin root.

When a wrapper reads a hook payload from stdin to discover the workspace, it forwards the same payload to the user hook command so existing hook commands can still parse host-provided event data.

## Generated MCP Stdio Runtime Env

For Claude Code, Cursor, Codex, and OpenCode, Pluxx owns the compatibility layer for stdio MCP startup env. Plugin projects should express runtime-inherited values once in `mcp.<server>.env` using pure placeholders such as `${SENDLENS_INSTANTLY_API_KEY}`; downstream plugins should not add per-host Codex, Cursor, Claude Code, or OpenCode special cases.

When those stdio env placeholders are runtime-inherited, generated core-four bundles start the MCP server through `runtime/pluxx-mcp-env.mjs`. That launcher:

- runs the real MCP command from the installed plugin root
- ignores stale installed `.pluxx-user.json` values for runtime-inherited stdio env vars
- loads matching vars from the active launch workspace `.env` when one can be found
- lets the normal process/global environment provide the fallback when the workspace does not define them
- avoids treating the installed plugin/cache directory as the active workspace

Workspace `.env` values intentionally win over global env values for runtime-inherited stdio vars. This keeps one global plugin install usable across multiple repos while still allowing a global `SENDLENS_INSTANTLY_API_KEY`-style fallback when the current repo has no local value.

Remote/native MCP auth materialization remains separate: bearer/header auth that is expressed through host-native HTTP config is still materialized or preserved as env references according to the target host contract.

## Generated Native Dependency Runtime Store

Generated GitHub Release installers prepare platform-native Node dependencies in a shared Pluxx runtime store when the installed bundle includes package dependency metadata and a supported deterministic lockfile (`package-lock.json`, `npm-shrinkwrap.json`, `pnpm-lock.yaml`, `yarn.lock`, `bun.lock`, or `bun.lockb`).

The store lives under `~/.pluxx/runtimes/` by default and is keyed by:

- the deterministic installed bundle payload that can affect runtime installation, including package metadata, lockfiles, lifecycle helper scripts, `.npmrc`, patch files, and `scripts/bootstrap-runtime.sh`, while excluding host manifests, materialized MCP config, saved user config, and other install-local state
- OS and architecture
- Node ABI
- Pluxx runtime-store contract version

Published runtime entries are treated as immutable. A host installer builds the runtime in an atomic staging directory, validates the resulting `node_modules`, publishes the entry under its content fingerprint, and links the staged host bundle to that entry. Compatible Claude Code, Cursor, Codex, and OpenCode installs therefore reuse one prepared native runtime instead of each extracting and installing the same dependencies.

If a matching entry is missing or corrupted, the installer repairs it before relinking. If the bundle does not provide enough dependency metadata for safe shared reuse, including a supported lockfile for dependency resolution, the installer logs the fallback and runs `bootstrap-runtime.sh` inside the staged host bundle as before.

## Contributor Tooling

Normal contributor workflows run through Node and npm:

- `npm run build`
- `npm run dev -- ...` for source-mode CLI work
- `npm run typecheck`
- `npm test`
- `node scripts/verify-node-package-runtime.mjs`
- `npm run release:check`

The test suite still carries compatibility shims for older `bun:test` imports and `Bun.*` helper calls. Those shims run under Vitest's Node environment and are not a consumer Bun dependency.

Historical host probe commands may still mention `bun scripts/...` in dated proof notes. Treat those as dated probe receipts, not the published CLI runtime contract.

## Release Proof

The release gate includes `node scripts/verify-node-package-runtime.mjs`, which packs the npm artifact and verifies:

- installed package execution through `node node_modules/@orchid-labs/pluxx/bin/pluxx.js`
- `npm exec --package <tarball> -- pluxx ...`
- TypeScript config loading
- `doctor`, `validate`, and `build` on a clean fixture project
