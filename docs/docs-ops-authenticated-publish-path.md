# Docs Ops Authenticated Publish Path

Last updated: 2026-04-24

## Doc Links

- Role: public-facing proof note for the separate authenticated write and publish contract in the flagship `docs-ops` example
- Related:
  - [docs/docs-ops-core-four-proof.md](./docs-ops-core-four-proof.md)
  - [docs/flagship-docs-ops-plugin.md](./flagship-docs-ops-plugin.md)
  - [docs/proof-and-install.md](./proof-and-install.md)
  - [example/docs-ops/ORCHID-READONLY-DEMO.md](../example/docs-ops/ORCHID-READONLY-DEMO.md)
  - [example/docs-ops/ORCHID-AUTHENTICATED-PUBLISH-PATH.md](../example/docs-ops/ORCHID-AUTHENTICATED-PUBLISH-PATH.md)
- Update together:
  - [docs/docs-ops-core-four-proof.md](./docs-ops-core-four-proof.md)
  - [docs/flagship-docs-ops-plugin.md](./flagship-docs-ops-plugin.md)
  - [docs/proof-and-install.md](./proof-and-install.md)

Use this doc when the question is:

- how is the `docs-ops` publish lane separated from the public Orchid read-only MCP proof
- what is actually modeled in the source project today
- what is proven mechanically versus what still needs a real private endpoint

## The Split

The public Orchid Docsalot MCP endpoint:

- `https://orchid-docs.docsalot.dev/api/mcp`

is now treated explicitly as a read-only surface for:

- inspect
- search
- pull
- rewrite proposals
- review

It is not treated as the publish path.

The write and publish lane is now modeled separately through install/runtime config:

- `DOCSALOT_AUTHORING_URL`
- `DOCSALOT_AUTHORING_TOKEN`

## What Changed In The Source Project

The flagship `example/docs-ops` source project now carries the publish contract directly:

- `pluxx.config.ts`
  - declares optional `userConfig` for the private authoring URL and token
- `INSTRUCTIONS.md`
  - separates the public Orchid MCP from the write path in the operator brief
- `scripts/check-publish-auth.sh`
  - blocks publish recommendations when the private authoring contract is not configured
- `skills/docs-publish/SKILL.md`
  - requires the separate authoring path before publish checks or recommendations continue
- `commands/publish-docs.md`
  - now treats publish as a separate authenticated flow instead of a natural continuation of the public MCP proof

## Mechanical Proof Run

A non-sensitive installed-bundle proof now exists for the separate publish lane.

This proof used placeholder private authoring values only to prove:

- install-time config materialization
- installed-bundle verification
- deterministic publish gating

It did not use a real Orchid private authoring endpoint.

Public CLI shape:

```bash
export DOCSALOT_AUTHORING_URL="https://authoring.example.internal/api"
export DOCSALOT_AUTHORING_TOKEN="pluxx-proof-token"

pluxx install --target claude-code --trust
pluxx install --target cursor --trust
pluxx install --target codex --trust
pluxx install --target opencode --trust

pluxx verify-install --target claude-code
pluxx verify-install --target cursor
pluxx verify-install --target codex
pluxx verify-install --target opencode

pluxx doctor --consumer ~/.codex/plugins/docs-ops
bash ~/.codex/plugins/docs-ops/scripts/check-publish-auth.sh
```

## Result

- `install` succeeded for Claude Code, Cursor, Codex, and OpenCode with placeholder private authoring values present
- `verify-install` passed across all four installed bundles
- `pluxx doctor --consumer ~/.codex/plugins/docs-ops` passed and reported:
  - `.pluxx-user.json` present
  - `2` saved value entries
  - `2` env bindings
- the installed publish gate ran successfully from the installed Codex bundle:
  - `PUBLISH_AUTH_CHECK=pass`

## What This Proves Today

This does prove:

- the public read-only proof and the private write path are now separate concepts in the source project itself
- Pluxx can model the write path with `userConfig` instead of pretending the public MCP endpoint is enough
- the publish workflow has a deterministic auth gate before it recommends or attempts anything risky
- install/runtime config now has a truthful place to land when a real private authoring endpoint is provided later
- the same modeled write-path contract survives actual local install and `verify-install`, not just source-level docs

## What This Does Not Prove Yet

This does not yet prove:

- a real private Orchid authoring endpoint
- a successful authenticated publish
- a real rollback against an authenticated publish target

That follow-on proof still needs:

1. a safe sandbox docs target
2. a real private authoring URL
3. a real private authoring credential
4. one end-to-end publish plus rollback run

## The Honest Current Claim

The authenticated publish path is now:

- explicitly separated
- source-modeled
- install/runtime-configurable
- mechanically guarded

It is not yet:

- live-published against Orchid
- a replacement for the public read-only MCP proof

That is the right current state for the flagship example.
