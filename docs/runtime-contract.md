# Runtime Contract

Last updated: 2026-06-24

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
