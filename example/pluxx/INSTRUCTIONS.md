## Pluxx Plugin

Use Pluxx when the user wants to turn an MCP server into a maintainable plugin project, improve a generated scaffold, review it critically, or sync it later after the MCP changes.

### What Pluxx Is For

Pluxx is the plugin authoring and maintenance layer for MCP teams.

The normal workflow is:

1. import an MCP into a deterministic scaffold
2. migrate an existing single-host plugin when needed
3. inspect and validate the generated project
4. optionally refine taxonomy and instructions with a host agent
5. build and install the target plugin bundles

### Main Workflows

- `pluxx-import-mcp`
  Use when the user wants to scaffold a plugin from a remote MCP URL or a local stdio MCP command.

- `pluxx-migrate-plugin`
  Use when the user already has a Claude Code, Cursor, Codex, or OpenCode plugin and wants to bring it into Pluxx.

- `pluxx-validate-scaffold`
  Use when the user wants a deterministic health and quality pass with `doctor`, `lint`, `eval`, and `test`.

- `pluxx-refine-taxonomy`
  Use when the generated skill grouping is too lexical, fragmented, or not product-shaped enough.

- `pluxx-rewrite-instructions`
  Use when the scaffold structure is fine but the shared instructions need to sound more like the actual product.

- `pluxx-review-scaffold`
  Use when the user wants findings before shipping, not blind rewrites.

- `pluxx-build-install`
  Use when the user wants to build installable plugins and optionally install one or more targets locally.

- `pluxx-sync-mcp`
  Use when an existing MCP-derived scaffold needs to be refreshed safely.

### Explicit Commands

- `/pluxx:import-mcp`
  Explicit entrypoint for turning an MCP URL or stdio command into a first-pass Pluxx scaffold.

- `/pluxx:migrate-plugin`
  Explicit entrypoint for bringing an existing host-native plugin into a maintained Pluxx source project.

- `/pluxx:validate-scaffold`
  Explicit entrypoint for running deterministic health and quality checks before deeper edits or shipping.

- `/pluxx:refine-taxonomy`
  Explicit entrypoint for improving skill grouping after the first pass is already valid.

- `/pluxx:rewrite-instructions`
  Explicit entrypoint for tightening `INSTRUCTIONS.md` without rewriting the whole scaffold.

- `/pluxx:review-scaffold`
  Explicit entrypoint for findings-first review before shipping.

- `/pluxx:build-install`
  Explicit entrypoint for building the requested target bundles and optionally installing them locally for testing.

- `/pluxx:sync-mcp`
  Explicit entrypoint for refreshing an existing scaffold from its MCP source.

These command entrypoints are for hosts that support plugin commands directly. In Codex, use `@pluxx` and pick the matching skill instead; `/` is reserved for native Codex commands.

### CLI Resolution

When these instructions say `pluxx ...`, treat that as the logical Pluxx command.

Resolve it in this order:

1. local `pluxx` on `PATH`
2. `npx @orchid-labs/pluxx`

If the npm path fails because Node or package resolution is missing, surface that clearly instead of improvising a different runtime contract.

### Runtime Prerequisite

The Pluxx plugin is a thin operator layer over the CLI.

That means the underlying machine still needs the Pluxx runtime available:

- preferred: local `pluxx`
- fallback: `npx @orchid-labs/pluxx`
- current runtime prerequisite for the npm path: Node 18+ on the machine

If the runtime is missing, do not pretend the host plugin can execute Pluxx by itself. Tell the user what needs to be installed first.

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
- `pluxx migrate` is the bridge when the user already invested heavily in one host.
- For OAuth-first MCPs, import auth and runtime auth may differ. Do not assume a bearer import token is the correct long-term runtime auth shape.
