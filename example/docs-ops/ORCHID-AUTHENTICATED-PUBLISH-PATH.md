# Orchid Authenticated Publish Path

Last updated: 2026-04-24

This note separates the authenticated write and publish contract from the public Orchid read-only MCP proof.

## The Important Split

The current public Orchid Docsalot MCP endpoint is:

- `https://orchid-docs.docsalot.dev/api/mcp`

That surface is valid for:

- inspect
- search
- pull
- rewrite proposals
- review

It is not the authenticated publish path.

## Source-Project Contract

The `docs-ops` source project now models the write path explicitly through install/runtime config:

- `DOCSALOT_AUTHORING_URL`
- `DOCSALOT_AUTHORING_TOKEN`

Those values are declared in:

- `pluxx.config.ts` via `userConfig`

And the publish workflow now gates on:

- `scripts/check-publish-auth.sh`

That means the source project no longer implies:

- that the public Orchid MCP URL is enough for publish
- that read-side success automatically means write-side setup is done

## What Is Proven Today

Today this write-path lane is proven in the following narrower sense:

- the read-only public MCP surface is explicitly separated from the write/publish contract
- the source project carries distinct user-config keys for the private authoring path
- the publish skill and command now refuse to treat the public read-only MCP as the publish surface
- the publish workflow has a deterministic auth gate before checks or recommendations continue

## Mechanical Installed-Bundle Proof

This repo now also has a local installed-bundle proof for that contract.

The proof used placeholder private values only to test the packaging and guard path:

- `DOCSALOT_AUTHORING_URL=https://authoring.example.internal/api`
- `DOCSALOT_AUTHORING_TOKEN=pluxx-proof-token`

Maintainer commands actually run from this repo:

```bash
node ../../bin/pluxx.js install --target claude-code --trust
node ../../bin/pluxx.js install --target cursor --trust
node ../../bin/pluxx.js install --target codex --trust
node ../../bin/pluxx.js install --target opencode --trust

node ../../bin/pluxx.js verify-install --target claude-code cursor codex opencode
node ../../bin/pluxx.js doctor --consumer ~/.codex/plugins/docs-ops

bash ~/.codex/plugins/docs-ops/scripts/check-publish-auth.sh
```

Observed result:

- all four installs succeeded
- `verify-install` passed across Claude Code, Cursor, Codex, and OpenCode
- the installed Codex bundle passed consumer doctor with `.pluxx-user.json` present
- the installed `check-publish-auth.sh` gate exited cleanly

## What Is Not Proven Yet

This note does not claim:

- Orchid's private authoring endpoint URL is known publicly
- a real authenticated publish succeeded against Orchid
- rollback against a real publish target has been exercised yet

That proof still needs:

1. a real private authoring endpoint
2. a real publish credential
3. one safe sandbox docs target
4. an end-to-end publish plus rollback pass

## Working Rule

Until that private authoring path is supplied, use `docs-ops` in one of two honest modes:

- read-only proof mode against the public Orchid Docsalot MCP
- publish-contract mode where Pluxx proves the separate write path is modeled and gated correctly
