## Pluxx Plugin

Use Pluxx when the user wants to turn an MCP server into a maintainable plugin project, improve a generated scaffold, review it critically, or sync it later after the MCP changes.

### What Pluxx Is For

Pluxx is the plugin authoring and maintenance layer for MCP teams.

The normal workflow is:

1. import an MCP into a deterministic scaffold
2. migrate an existing single-host plugin when needed
3. optionally prepare docs, website, and local context before semantic passes
4. inspect and validate the generated project
5. optionally refine taxonomy and instructions with a host agent
6. build, verify, and install the target plugin bundles
7. publish when the plugin is actually ready to distribute

### Main Workflows

- `pluxx-import-mcp`
  Use when the user wants to scaffold a plugin from a remote MCP URL or a local stdio MCP command.

- `pluxx-bootstrap-runtime`
  Use when the machine is missing `pluxx`, is stale, or the user wants a smoother operator path than ad hoc `npx` usage.

- `pluxx-migrate-plugin`
  Use when the user already has a Claude Code, Cursor, Codex, or OpenCode plugin and wants to bring it into Pluxx.

- `pluxx-validate-scaffold`
  Use when the user wants a deterministic health and quality pass with `doctor`, `lint`, `eval`, and `test`.

- `pluxx-prepare-context`
  Use when the user wants to ingest website docs, product docs, or local context before rewriting taxonomy or instructions.

- `pluxx-refine-plugin`
  Use when the first scaffold exists, but it still needs coordinated product shaping, clearer translation honesty, or findings-first refinement.

- `pluxx-refine-taxonomy`
  Use when the generated skill grouping is too lexical, fragmented, or not product-shaped enough.

- `pluxx-rewrite-instructions`
  Use when the scaffold structure is fine but the shared instructions need to sound more like the actual product.

- `pluxx-review-scaffold`
  Use when the user wants findings before shipping, not blind rewrites.

- `pluxx-build-install`
  Use when the user wants to build installable plugins and optionally install one or more targets locally.

- `pluxx-prove-plugin`
  Use when the user wants structural proof, install proof, and behavioral proof together instead of isolated checks.

- `pluxx-verify-install`
  Use when the user wants to prove an installed host target is actually visible and healthy.

- `pluxx-troubleshoot-install`
  Use when the plugin already built or installed, but the host still does not look right and deeper installed-bundle diagnosis is needed.

- `pluxx-sync-mcp`
  Use when an existing MCP-derived scaffold needs to be refreshed safely.

- `pluxx-autopilot`
  Use when the user wants the one-shot import, refine, and verification path.

- `pluxx-publish-plugin`
  Use when the user wants to package the current plugin for release distribution.

### Explicit Commands

- `/pluxx:import-mcp`
  Explicit entrypoint for turning an MCP URL or stdio command into a first-pass Pluxx scaffold.

- `/pluxx:bootstrap-runtime`
  Explicit entrypoint for installing, upgrading, or checking the Pluxx CLI runtime.

- `/pluxx:migrate-plugin`
  Explicit entrypoint for bringing an existing host-native plugin into a maintained Pluxx source project.

- `/pluxx:validate-scaffold`
  Explicit entrypoint for running deterministic health and quality checks before deeper edits or shipping.

- `/pluxx:prepare-context`
  Explicit entrypoint for ingesting website docs, product docs, or local files into the Pluxx agent pack before semantic refinement.

- `/pluxx:refine-plugin`
  Explicit entrypoint for taking a valid scaffold and making it read and translate like a serious product.

- `/pluxx:refine-taxonomy`
  Explicit entrypoint for improving skill grouping after the first pass is already valid.

- `/pluxx:rewrite-instructions`
  Explicit entrypoint for tightening `INSTRUCTIONS.md` without rewriting the whole scaffold.

- `/pluxx:review-scaffold`
  Explicit entrypoint for findings-first review before shipping.

- `/pluxx:build-install`
  Explicit entrypoint for building the requested target bundles and optionally installing them locally for testing.

- `/pluxx:prove-plugin`
  Explicit entrypoint for validating, building, installing, verifying, and behaviorally proving a plugin.

- `/pluxx:verify-install`
  Explicit entrypoint for verifying that an installed target is actually visible and healthy in the host.

- `/pluxx:troubleshoot-install`
  Explicit entrypoint for diagnosing why an installed target still does not look right in the host after build or install.

- `/pluxx:sync-mcp`
  Explicit entrypoint for refreshing an existing scaffold from its MCP source.

- `/pluxx:autopilot`
  Explicit entrypoint for the one-shot import, refine, and verification path.

- `/pluxx:publish-plugin`
  Explicit entrypoint for packaging the current plugin for release distribution.

These command entrypoints are for hosts that support plugin commands directly. In Codex, use `@pluxx` and pick the matching skill instead; `/` is reserved for native Codex commands.

### CLI Resolution

When these instructions say `pluxx ...`, treat that as the logical Pluxx command.

Resolve it in this order:

1. local `pluxx` on `PATH`
2. `npx @orchid-labs/pluxx`

If the npm path fails because Node or package resolution is missing, surface that clearly instead of improvising a different runtime contract.
If the runtime is missing or stale and the user wants help fixing it, route through `pluxx-bootstrap-runtime`.

### Runtime Prerequisite

The Pluxx plugin is a thin operator layer over the CLI.

That means the underlying machine still needs the Pluxx runtime available:

- preferred: local `pluxx`
- fallback: `npx @orchid-labs/pluxx`
- current runtime prerequisite for the npm path: Node 18+ on the machine

If the runtime is missing, do not pretend the host plugin can execute Pluxx by itself. Tell the user what needs to be installed first.
If the user wants the smoother reusable path, help them bootstrap or upgrade the runtime instead of leaving the fallback implicit.

### Operating Rules

- Prefer a deterministic first pass before semantic rewrites.
- When importing, call out auth shape clearly: none, bearer, custom header, or platform-managed runtime auth.
- When refining a scaffold, preserve mixed-ownership boundaries and custom-note blocks.
- Do not silently rewrite auth wiring, target configuration, or generated platform outputs unless the user explicitly asks.
- Before shipping, run `pluxx doctor`, `pluxx lint`, and `pluxx test`.
- Before telling the user a local install is healthy, prefer `pluxx verify-install`.
- When a local install still looks wrong after verification, prefer the explicit troubleshooting path instead of guessing.
- When the user wants “make this feel real” or “prove this actually works,” prefer the guided `pluxx-refine-plugin` or `pluxx-prove-plugin` paths over making them pick several adjacent micro-workflows.
- Findings come before summaries when the user asks for a review.
- When starting from a raw MCP, do not stop at a lowest-common-denominator skill dump. Shape the scaffold into the strongest native mix of skills, commands, argument-bearing entrypoints, and specialist agents/subagents that the discovered workflows justify.

### What Good Looks Like

A good Pluxx result should leave the user with:

- a valid `pluxx.config.ts`
- a useful `INSTRUCTIONS.md`
- product-shaped `skills/*/SKILL.md`
- passing `doctor`, `lint`, and `test`
- generated target bundles under `dist/`
- verified installed host state when local install was requested
- release-ready artifacts when the user asked to publish

### Notes

- `pluxx autopilot` is the one-shot path.
- `pluxx-bootstrap-runtime` is the operator path for installing or upgrading the underlying CLI runtime.
- `pluxx init` plus manual refinement is usually the easier path to inspect and debug.
- `pluxx-refine-plugin` is the guided refinement journey over the lower-level prepare/taxonomy/instructions/review workflows.
- `pluxx migrate` is the bridge when the user already invested heavily in one host.
- `pluxx-prove-plugin` is the guided proof journey over validate/build/install/verify/troubleshoot flows.
- `pluxx verify-install` is the install-state proof after local install.
- `pluxx-troubleshoot-install` is the operator path when install-state proof alone is not enough.
- `pluxx publish` is the packaging and release path after the scaffold is healthy.
- For OAuth-first MCPs, import auth and runtime auth may differ. Do not assume a bearer import token is the correct long-term runtime auth shape.

## Command Routing

This plugin defines canonical command entrypoints. Codex does not package them as native slash commands today, so route those requests through the matching workflow directly.

- `/autopilot` - Run the one-shot Pluxx import, refinement, and verification path (arguments: [mcp-source or existing project context])
- `/bootstrap-runtime` - Install, upgrade, or verify the local Pluxx CLI runtime before deeper plugin work (arguments: [version or install mode optional])
- `/build-install` - Build installable plugins and optionally install requested targets locally (arguments: [targets optional])
- `/import-mcp` - Scaffold a new Pluxx plugin from an MCP source (arguments: [mcp-url-or-stdio-command])
- `/migrate-plugin` - Migrate an existing host-native plugin into a Pluxx source project (arguments: [plugin-path])
- `/prepare-context` - Ingest docs, website, and local context into the Pluxx agent pack (arguments: [website-or-docs-or-context optional])
- `/prove-plugin` - Validate, build, install, verify, and behaviorally prove a plugin (arguments: [targets optional])
- `/publish-plugin` - Package the current plugin for release distribution (arguments: [release options optional])
- `/refine-plugin` - Refine a scaffold into a product-shaped, host-honest plugin (arguments: [context or focus optional])
- `/refine-taxonomy` - Improve the skill taxonomy for an existing Pluxx scaffold (arguments: [website-docs-or-context optional])
- `/review-scaffold` - Review a Pluxx scaffold critically before shipping (arguments: [focus optional])
- `/rewrite-instructions` - Rewrite INSTRUCTIONS.md so a Pluxx scaffold explains itself clearly (arguments: [website-docs-or-context optional])
- `/sync-mcp` - Refresh an existing Pluxx scaffold from its MCP source (arguments: [override-mcp-source optional])
- `/troubleshoot-install` - Diagnose why a locally installed plugin still is not visible or healthy in the host (arguments: [targets or installed-path optional])
- `/validate-scaffold` - Run deterministic health and quality checks on the current Pluxx scaffold (arguments: [targets optional])
- `/verify-install` - Verify that an installed host bundle is actually visible and healthy (arguments: [targets optional])
