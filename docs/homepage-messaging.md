# Homepage Messaging

This is the working homepage copy for Pluxx. It is intentionally concise and structured so it can drive the site, README positioning, and launch assets without diverging.

## Positioning

Pluxx turns a raw MCP into a maintainable plugin project for Claude Code, Codex, Cursor, and OpenCode.

The important product promise is:

- deterministic structure from Pluxx
- semantic refinement from the coding agent the user already works in
- one maintained source of truth over time

## Hero

### Headline

Bring your MCP. Get plugins everywhere.

### Subheadline

Pluxx turns a raw MCP into a maintainable plugin project for Claude Code, Codex, Cursor, and OpenCode. Then Codex or Claude can refine the scaffold safely without breaking the structure.

### Primary CTA

`bunx pluxx init --from-mcp https://example.com/mcp`

### Secondary CTA

View on GitHub

### Proof line

Bun runtime required today. Core-four path is the prime-time launch surface.

## Section: The Problem

### Heading

Your MCP is useful. Packaging it everywhere is not.

### Body

Every coding agent has its own plugin format, auth model, hooks surface, and instruction files. Without Pluxx, shipping one MCP across tools means maintaining separate plugin projects that drift over time.

## Section: The Mechanism

### Heading

One MCP in. One source project out.

### Body

Pluxx imports the MCP, generates the source project, validates it, and produces native plugin bundles for each target platform. The generated project becomes the thing you maintain over time.

## Section: The Agent Story

### Heading

Let the agent refine the meaning, not the structure.

### Body

Pluxx owns the deterministic scaffold, boundaries, and validation. Codex or Claude gets a context pack and prompt pack to improve taxonomy, instructions, and examples inside managed sections only.

## Section: How It Works

### Step 1

Import your MCP

Pluxx introspects a raw HTTP, SSE, or stdio MCP and scaffolds a valid plugin project.

### Step 2

Validate the baseline

Run `doctor` and `test` to confirm the deterministic scaffold is healthy before any semantic refinement.

### Step 3

Refine with Codex or Claude

Agent Mode prepares the context and prompt pack; your host coding agent improves only the managed sections.

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

## Footer CTA

### Heading

Bring your MCP in 30 seconds

### CTA

`bunx pluxx init --from-mcp https://example.com/mcp`

## Notes

- Keep the site focused on the MCP-first story, not “11 generators” as the lead.
- Mention Codex and Claude as refinement hosts, not as the whole product.
- Avoid framing Pluxx as a generic plugin compiler with no opinionated workflow.
