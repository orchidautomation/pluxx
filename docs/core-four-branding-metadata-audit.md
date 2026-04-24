# Core-Four Branding Metadata Audit

Date: 2026-04-18

This audit verifies what plugin branding and interface metadata actually works across the core four:

- Claude Code
- Cursor
- Codex
- OpenCode

Use [Core-Four Translation Hit List](./core-four-translation-hit-list.md) as the closure tracker for the brand/distribution rows in this audit.

It compares:

- `src/schema.ts`
- `src/generators/claude-code/index.ts` via the shared Claude-family generator
- `src/generators/cursor/index.ts`
- `src/generators/codex/index.ts`
- `src/generators/opencode/index.ts`
- real generated outputs from:
  - `example/firecrawl-plugin`
  - `example/pluxx`
  - `example/megamind`
  - `examples/prospeo-mcp`

## Method

Built real examples for all four targets and inspected generated outputs:

- Firecrawl:
  - `example/firecrawl-plugin/dist/{claude-code,cursor,codex,opencode}`
- Pluxx:
  - `example/pluxx/dist/{claude-code,cursor,codex,opencode}`
- Megamind:
  - `example/megamind/dist/{claude-code,cursor,codex,opencode}`
- Prospeo:
  - `examples/prospeo-mcp/dist/{claude-code,cursor,codex,opencode}`

## Schema Contract

`BrandSchema` currently models:

- `displayName`
- `shortDescription`
- `longDescription`
- `category`
- `color`
- `icon`
- `logo`
- `screenshots`
- `defaultPrompts`
- `websiteURL`
- `privacyPolicyURL`
- `termsOfServiceURL`

## Core-Four Truth Matrix

Legend:

- `Y`: yes
- `N`: no
- `P`: partial / target-specific override path only

| Field | Modeled in schema | Claude emits | Cursor emits | Codex emits | OpenCode emits | Actually consumed by target surface | Notes |
|---|---:|---:|---:|---:|---:|---|---|
| `displayName` | Y | N | N | Y (`interface.displayName`) | N | Codex: Y; others: N | Verified with Pluxx, Megamind, and Prospeo outputs |
| `shortDescription` | Y | N | N | Y (`interface.shortDescription`) | N | Codex: Y; others: N | Falls back to top-level `description` in Codex when absent |
| `longDescription` | Y | N | N | Y (`interface.longDescription`) | N | Codex: Y; others: N | Verified in Megamind and Pluxx |
| `category` | Y | N | N | Y (`interface.category`) | N | Codex: Y; others: N | Default `Productivity` reaches Codex |
| `color` | Y | N | N | Y (`interface.brandColor`) | N | Codex: Y; others: N | Verified in Megamind and Pluxx |
| `icon` | Y | N | Y (`plugin.json.logo`) | Y (`interface.composerIcon`, `interface.logo`) | N | Cursor: Y; Codex: Y | Cursor and Codex both consume icon through different fields |
| `defaultPrompts` | Y | N | N | Y (`interface.defaultPrompt`) | N | Codex: Y; others: N | Verified in Megamind and Pluxx |
| `websiteURL` | Y | N | Y (`plugin.json.homepage`) | Y (`interface.websiteURL`) | N | Cursor: Y; Codex: Y | Verified in Megamind and Pluxx |
| `screenshots` | Y | N | N | Y (`interface.screenshots`) | N | Codex: Y when provided | `example/pluxx` now sets `brand.screenshots` |
| `privacyPolicyURL` | Y | N | N | Y (`interface.privacyPolicyURL`) | N | Codex: Y; others: N | Now mapped from shared `brand` into Codex |
| `termsOfServiceURL` | Y | N | N | Y (`interface.termsOfServiceURL`) | N | Codex: Y; others: N | Now mapped from shared `brand` into Codex |

## Real Example Verification Notes

### Firecrawl (`example/firecrawl-plugin`)

- No `brand` block in config.
- Generated outputs expose no brand/interface metadata, which matches current generators.

### Prospeo (`examples/prospeo-mcp`)

- Config sets `brand.displayName`, `shortDescription`, and `category`.
- Codex output includes:
  - `.codex-plugin/plugin.json -> interface.displayName`
  - `.codex-plugin/plugin.json -> interface.shortDescription`
  - `.codex-plugin/plugin.json -> interface.category`
- Cursor, Claude, and OpenCode do not emit those fields.

### Megamind (`example/megamind`)

- Config sets rich brand metadata: display name, short and long descriptions, category, color, icon, default prompts, and website URL.
- Codex output includes the rich interface block as expected.
- Cursor output includes only `homepage` and `logo`.
- Claude and OpenCode do not surface brand metadata in their generated manifests or wrappers.
- The example still includes Codex-specific interface overrides, but shared `brand` now covers the policy-link fields too.

### Pluxx (`example/pluxx`)

- Config sets `privacyPolicyURL` and `termsOfServiceURL` under `brand`.
- Codex output now includes both fields without requiring `platforms.codex.interface` overrides.
- Confirms the shared brand contract and the Codex generator are aligned for policy links.

## What The Audit Confirms

1. `brand` is still a core primitive, but support is target-graded rather than portable in a uniform way.
2. Codex is the rich interface target today.
3. Cursor only consumes a narrow subset of brand metadata: `homepage` and `logo`.
4. Claude Code and OpenCode currently do not expose a manifest-backed brand/interface layer from the shared `brand` contract.
5. Policy-link fields are now aligned between `BrandSchema` and the Codex generator.

## Recommended Contract Language

- Keep `brand` as a core primitive.
- Describe it as target-graded rather than host-uniform.
- Position rich metadata such as screenshots and default prompts as Codex-first until other hosts expose equivalent file-backed surfaces.
- Do not imply that Claude Code or OpenCode consume shared `brand` metadata beyond indirect copy and asset reuse.
