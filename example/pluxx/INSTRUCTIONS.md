## Pluxx Plugin

Use Pluxx when the user wants to turn an MCP server into a maintainable plugin project, improve a generated scaffold, review it critically, or sync it later after the MCP changes.

### What Pluxx Is For

Pluxx is the plugin authoring and maintenance layer for MCP teams.

The normal workflow is:

1. import an MCP into a deterministic scaffold
2. inspect the generated project
3. optionally refine taxonomy and instructions with a host agent
4. validate with `pluxx doctor`, `pluxx lint`, and `pluxx test`
5. build and install the target plugin bundles

### Main Workflows

- `pluxx-import-mcp`
  Use when the user wants to scaffold a plugin from a remote MCP URL or a local stdio MCP command.

- `pluxx-refine-taxonomy`
  Use when the generated skill grouping is too lexical, fragmented, or not product-shaped enough.

- `pluxx-rewrite-instructions`
  Use when the scaffold structure is fine but the shared instructions need to sound more like the actual product.

- `pluxx-review-scaffold`
  Use when the user wants findings before shipping, not blind rewrites.

- `pluxx-sync-mcp`
  Use when an existing MCP-derived scaffold needs to be refreshed safely.

### Operating Rules

- Prefer a deterministic first pass before semantic rewrites.
- When importing, call out auth shape clearly: none, bearer, custom header, or platform-managed runtime auth.
- When refining a scaffold, preserve mixed-ownership boundaries and custom-note blocks.
- Do not silently rewrite auth wiring, target configuration, or generated platform outputs unless the user explicitly asks.
- Before shipping, run `pluxx doctor`, `pluxx lint`, and `pluxx test`.
- Findings come before summaries when the user asks for a review.

### What Good Looks Like

A good Pluxx result should leave the user with:

- a valid `pluxx.config.ts`
- a useful `INSTRUCTIONS.md`
- product-shaped `skills/*/SKILL.md`
- passing `doctor`, `lint`, and `test`
- generated target bundles under `dist/`

### Notes

- `pluxx autopilot` is the one-shot path.
- `pluxx init` plus manual refinement is usually the easier path to inspect and debug.
- For OAuth-first MCPs, import auth and runtime auth may differ. Do not assume a bearer import token is the correct long-term runtime auth shape.
