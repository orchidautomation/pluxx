# First Proof And Demo Asset Pack

Last updated: 2026-04-17

This doc defines the first proof assets and demo flows for the Pluxx OSS launch.

It is intentionally execution-first:

- what to capture
- in what order
- from which source plugin/MCP examples
- and which public claim each artifact must support

For broader brand and visual standards, use [Brand launch asset system](./brand-launch-asset-system.md).

## Primary Claims To Prove

The first pack should prove these four claims with concrete artifacts:

1. one maintained source project can ship native bundles for the core four (Claude Code, Cursor, Codex, OpenCode)
2. MCP-first scaffold is fast and practical
3. deterministic quality gates (`doctor`, `test`, `build`) keep the scaffold trustworthy
4. real plugin sources (not toy files) can be maintained and synced over time

## Source Plugin / MCP Choices (Intentional)

Use these three sources for v1 proof coverage:

1. `example/firecrawl-plugin/pluxx.config.ts`
   - Why: real remote HTTP MCP with bearer auth; proves MCP auth wiring and practical workflow plugin shape.
2. `examples/prospeo-mcp/pluxx.config.ts`
   - Why: real sales-enrichment workflow with skills + hooks + stdio MCP; proves deeper plugin surface, not just import.
3. `example/pluxx/pluxx.config.ts`
   - Why: "Pluxx-in-Pluxx" dogfood plugin; proves command/skill/instruction packaging and cross-host consistency.

## Recommended Demo Flows

### Flow A (P0): MCP-first scaffold to cross-host build proof

Objective: prove the sharpest launch wedge in one pass.

Capture sequence:

1. terminal: `npx @orchid-labs/pluxx init --from-mcp https://api.firecrawl.dev/mcp`
2. terminal: first generated scaffold tree and `pluxx.config.ts` MCP block
3. terminal: `npx @orchid-labs/pluxx doctor`
4. terminal: `npx @orchid-labs/pluxx test`
5. terminal: `npx @orchid-labs/pluxx build`
6. file explorer or terminal tree: `dist/claude-code`, `dist/cursor`, `dist/codex`, `dist/opencode`

Output artifacts:

- 4-6 terminal captures (16:10)
- 1 cross-host `dist/` proof screenshot (16:10 + 1:1)
- optional 45-second clip covering steps 1-6

### Flow B (P1): Real workflow plugin depth proof (Prospeo)

Objective: show Pluxx handles practical plugin depth (skills, hooks, env checks), not only scaffold generation.

Capture sequence:

1. open `examples/prospeo-mcp/pluxx.config.ts` with focus on MCP + hooks + targets
2. open one skill file (`skills/search-person/SKILL.md`) to show workflow-oriented output
3. terminal: `npx @orchid-labs/pluxx build` from the example
4. terminal or file explorer: generated host bundles and script/hook artifacts

Output artifacts:

- 2 source screenshots (config + skill)
- 2 build/output screenshots
- 1 short caption card explaining "real plugin depth"

### Flow C (P1): Dogfood authoring workflow proof (Pluxx plugin)

Objective: show that Pluxx itself uses Pluxx for ongoing maintenance.

Capture sequence:

1. open `example/pluxx/pluxx.config.ts` (commands + skills + instructions + codex interface)
2. terminal: run build for this plugin
3. show generated outputs and instruction/command packaging in at least two target hosts

Output artifacts:

- 2 source/config screenshots
- 2 generated-output screenshots
- optional 30-second clip focused on "maintained over time" narrative

## Prioritized Asset List

| Priority | Asset | Source Flow | Format | Primary Use |
|---|---|---|---|---|
| P0 | Hero proof terminal strip (`init` -> `doctor` -> `test` -> `build`) | Flow A | PNG/WebP (16:10) | site hero, README proof block |
| P0 | Cross-host `dist/` proof (core four visible) | Flow A | PNG/WebP (16:10 + 1:1) | site proof section, social card |
| P0 | 45-second wedge demo clip | Flow A | MP4/GIF teaser | docs landing, social launch thread |
| P1 | Firecrawl MCP auth/config screenshot | Flow A | PNG | docs/how-it-works, marketplace prep |
| P1 | Prospeo workflow depth panel (config + skill + build output) | Flow B | PNG set | README "real plugin depth" proof |
| P1 | Pluxx dogfood panel (self-hosted plugin config + outputs) | Flow C | PNG set | docs/oss wedge narrative |
| P2 | Marketplace prep screenshot composite | Flow A + docs | PNG | marketplace submission support |
| P2 | Square social proof card variants | Derived | PNG (1:1) | X/LinkedIn launch posts |

## Mapping Assets To Public Claims

| Public claim | Proof asset(s) | Primary public surface |
|---|---|---|
| "Maintain one plugin. Ship it everywhere." | Hero proof terminal strip + cross-host `dist/` screenshot | homepage messaging, README top narrative |
| "MCP-first authoring is the sharpest wedge." | Flow A clip + Firecrawl MCP auth/config screenshot | README "Why", docs/how-it-works |
| "Deterministic scaffold + validation gates." | `doctor` and `test` terminal captures from Flow A | docs/getting-started, practical handbook |
| "Real plugins, not toy demos." | Prospeo depth panel + Pluxx dogfood panel | roadmap/strategy references, social launch thread |
| "Core four are prime-time launch path." | Cross-host `dist/` screenshot with visible target directories | homepage messaging, docs/compatibility |

## Capture Standards

- capture at minimum 1600px width source
- export both archival PNG and optimized WebP
- produce both 16:10 and 1:1 where listed
- keep terminal theme consistent across all captures
- redact secrets, local usernames, and absolute home paths
- use deterministic filenames under `assets/launch/`

Suggested naming:

- `pluxx-proof-flow-a-init-doctor-test-build.png`
- `pluxx-proof-core-four-dist.png`
- `pluxx-proof-firecrawl-auth-config.png`
- `pluxx-proof-prospeo-workflow-depth.png`
- `pluxx-proof-pluxx-dogfood.png`
- `pluxx-proof-flow-a-demo-45s.mp4`

## Execution Order

1. Produce Flow A assets first (all P0)
2. Produce Flow B and C stills (P1)
3. Export 1:1 social variants
4. Wire assets into site/docs/README surfaces
5. Keep this doc as the source of truth for future refreshes
