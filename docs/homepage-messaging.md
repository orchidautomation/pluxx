# Homepage Messaging

This is the working homepage copy for Pluxx. It is intentionally concise and structured so it can drive the site, README positioning, and launch assets without diverging.

## Doc Links

- Role: homepage and hero messaging source
- Related:
  - [README.md](../README.md)
  - [docs/start-here.md](./start-here.md)
  - [apps/web/app/page.tsx](../apps/web/app/page.tsx)
  - [apps/web/app/layout.tsx](../apps/web/app/layout.tsx)
  - [apps/web/app/opengraph-image.tsx](../apps/web/app/opengraph-image.tsx)
- Update together:
  - [README.md](../README.md)
  - [apps/web/app/page.tsx](../apps/web/app/page.tsx)
  - [apps/web/app/layout.tsx](../apps/web/app/layout.tsx)

## Positioning

Pluxx gives you one maintained plugin source project that ships native plugins for Claude Code, Codex, Cursor, and OpenCode.

The important product promise is:

- deterministic structure from Pluxx
- semantic refinement from the coding agent the user already works in
- one maintained source of truth over time
- optional MCP import when the plugin wraps a live server

## Hero

### Headline

Maintain one plugin source. Ship fully native experiences.

### Subheadline

Pluxx turns one maintained source project into native plugins for Claude Code, Cursor, Codex, and OpenCode, so you do not rebuild the same workflow four times. Pluxx generates the scaffold, host-specific files, and managed guardrails up front so your coding agent can safely refine taxonomy and instructions.

### Primary CTA

Read docs

### Secondary CTA

View repository

### Command chip

`npx @orchid-labs/pluxx init --from-mcp https://example.com/mcp`

### Proof line

Published CLI and maintainer flows run on Node 18+.

## Section: The Problem

### Heading

Your plugin is useful. Packaging it everywhere is not.

### Body

Every coding agent has its own plugin format, auth model, hooks surface, and instruction files. Without Pluxx, shipping one plugin across tools means maintaining separate plugin projects that drift over time.

## Section: The Mechanism

### Heading

One source project in. Native bundles out.

### Body

Pluxx generates the source project, validates it, and produces native plugin bundles for each target platform. If you bring an MCP, it can scaffold that project from the server. Either way, the generated source project becomes the thing you maintain over time.

## Section: The Agent Story

### Heading

Let the agent refine the meaning, not the structure.

### Body

Pluxx owns the deterministic scaffold, boundaries, and validation. Your host coding agent gets a context pack and prompt pack to improve taxonomy, instructions, and examples inside managed sections only.

## Section: How It Works

### Step 1

Start your source project

Import a raw HTTP, SSE, or stdio MCP if you have one, or initialize an empty plugin and author it directly.

### Step 2

Validate the baseline

Run `doctor` and `test` to confirm the deterministic scaffold is healthy before any semantic refinement.

### Step 3

Refine with your host coding agent

Agent Mode prepares the context and prompt pack; Claude Code, Cursor, Codex, or OpenCode improves only the managed sections.

### Step 4

Build, install, and sync

Generate the platform bundles, test locally, and keep the project updated with `pluxx sync --from-mcp`.

## Section: Core Four

### Heading

Prime-time on the core four.

### Body

Claude Code, Codex, Cursor, and OpenCode are the primary launch path. Other generators exist, but they are still beta and should be positioned that way.

## Section: Open Source

### Heading

Open source core. Agent-native workflow.

### Body

Pluxx stays deterministic and open source. The host coding agent does the semantic refinement, which means the product gets smarter as Codex and Claude get better.

## Section: Shipped Now

### Heading

Real authoring leverage. Not just bundle generation.

### Body

Pluxx now covers migration, evals, consumer diagnostics, and deterministic MCP replay so the whole authoring loop is easier to trust and support.

## Footer CTA

### Heading

Start your plugin in 30 seconds

### CTA

`npx @orchid-labs/pluxx init my-plugin`

## Notes

- Lead with one maintained plugin source of truth, then use MCP import as the sharpest entry path.
- Mention Codex and Claude as refinement hosts, not as the whole product.
- Avoid collapsing Pluxx into a generic skills installer or an unopinionated plugin compiler.
