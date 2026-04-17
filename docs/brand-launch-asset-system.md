# Pluxx Brand Direction And Launch Asset System

Last updated: 2026-04-16

This is the first product-brand contract for Pluxx itself.

It defines:

- the current visual and voice direction
- the canonical logo/icon treatment
- launch screenshot/media requirements
- concrete follow-on implementation tasks for site/docs/assets

It does not redefine the plugin `brand` primitive in `pluxx.config.ts`. That primitive remains plugin-author metadata for generated outputs.

## Brand Direction (v1)

### Product Positioning

Pluxx is the fastest way to maintain one plugin source project and ship native bundles across Claude Code, Codex, Cursor, and OpenCode.

Core promise to repeat consistently:

- one maintained source project
- native host outputs, not lowest-common-denominator abstractions
- deterministic structure with agent-assisted semantic refinement

### Voice And Messaging Rules

- Use direct, technical, no-hype language.
- Lead with cross-host maintenance pain solved by one source project.
- Describe Codex/Claude as semantic refinement hosts, not the product itself.
- Keep scope claims truthful: core four are primary, others are beta.

Canonical short message:

`Maintain one plugin. Ship it everywhere.`

### Visual Direction

Visual character:

- clean engineering product, high contrast, minimal ornament
- terminal-forward and artifact-forward (show real CLI/output proof)
- restrained color use with one accent family for CTAs and key highlights

Base palette (v1):

- `--pluxx-bg`: `#0B1020`
- `--pluxx-surface`: `#131A2E`
- `--pluxx-text`: `#E9EEFF`
- `--pluxx-muted`: `#9AA6C7`
- `--pluxx-accent`: `#36C2FF`
- `--pluxx-accent-strong`: `#0EA5E9`

Typography direction (v1):

- headings: modern geometric sans
- body: highly legible sans
- code/CLI: monospace with clear punctuation and zero/letter distinction

## Canonical Logo/Icon Treatment (v1)

### Primary Logo

- horizontal wordmark + symbol lockup for docs/site headers
- dark-background primary usage
- light-background alternate for docs exports and social cards

### App/Icon Mark

- square icon centered on the Pluxx symbol only
- shipped in `1024`, `512`, `256`, `128`, `64` PNG sizes and SVG master
- include safe-area guidance to avoid clipping in marketplace tiles

### File Ownership

Store canonical source files in:

- `assets/brand/logo/pluxx-logo-primary.svg`
- `assets/brand/logo/pluxx-logo-light.svg`
- `assets/brand/icon/pluxx-icon.svg`
- `assets/brand/icon/png/` size variants

## Launch Asset Requirements

For the concrete first-pass proof/demo capture plan (priorities, flows, and claim mapping), use [First proof and demo asset pack](./first-proof-demo-asset-pack.md).

### Required Screenshots And Media

1. Homepage hero screenshot (value proposition + primary CTA visible)
2. CLI scaffold flow (`init` from MCP or manual init)
3. Validation proof (`doctor` + `test` success path)
4. Build output proof (`dist/` targets visible)
5. Marketplace prep view (docs/process screenshot showing generated vs manual split)
6. Optional short demo clip (30-60 seconds) covering init -> build -> output

Media specs:

- screenshots: 16:10 and 1:1 variants
- minimum width: 1600px for source capture
- export both optimized web and archival originals
- redact secrets and local machine identifiers

## Launch Checklist

- [ ] canonical logo and icon source files finalized
- [ ] color tokens and typography choices codified in site/docs theme config
- [ ] homepage hero copy aligned to canonical short message
- [ ] README opening section aligned with same positioning language
- [ ] npm package metadata (`description`, keywords, homepage, repo) reviewed for brand consistency
- [ ] GitHub org/repo social preview and description aligned
- [ ] screenshot pack exported, named, and stored under `assets/launch/`
- [ ] marketplace listing copy draft (headline + long description + support links) prepared
- [ ] docs cross-links added: homepage messaging, marketplace prep, brand system

## Follow-On Implementation Tasks

These are the immediate implementation tasks after this direction doc.

### Site Theming And Components

- Scope: apply v1 color tokens, typography, and logo lockups across docs/site templates.
- Done when: docs/site has one coherent visual treatment and no conflicting legacy palette.

### Brand Asset Pipeline

- Scope: add canonical source assets, export script/convention, and deterministic file naming.
- Done when: logo/icon/screenshot assets are reproducible and versioned in-repo.

### Messaging Synchronization

- Scope: align homepage copy, README top narrative, npm metadata, and GitHub repo/org descriptions.
- Done when: the same product promise appears across all launch surfaces without wording drift.

### Marketplace Asset Pack

- Scope: produce required screenshot variants and listing copy bundle for submission flows.
- Done when: submission-ready pack exists for Cursor + Claude-target workflows documented in this repo.

### Governance

- Scope: define ownership and update cadence for brand assets and launch copy.
- Done when: one owner and one review checkpoint are documented in release flow docs.
