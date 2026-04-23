# Use Pluxx In Claude, Codex, Cursor, And OpenCode

This is the operator guide for using **Pluxx inside a host coding agent**.

Use this doc when you want the meta workflow:

- install or enable Pluxx in your host
- ask Claude, Codex, Cursor, or OpenCode to use Pluxx for you
- scaffold a plugin from an MCP
- prepare context and refine the scaffold
- review it
- verify an install
- publish it
- or sync it later

This is different from [Create a Pluxx plugin](./create-a-pluxx-plugin.md), which is the CLI-first authoring walkthrough.

The self-hosting reference project for this flow now lives at [example/pluxx](../example/pluxx).

## What This Means

The meta workflow is:

```text
you in Claude/Codex/Cursor/OpenCode
  -> ask the host agent to use Pluxx
  -> Pluxx CLI does the deterministic work
  -> the host agent helps with refinement and review
```

So the host agent is the operator.
Pluxx is the plugin-authoring substrate underneath it.

## The Main Pluxx Workflows

The recommended Pluxx skill pack is organized around twelve jobs:

- `pluxx-import-mcp`
- `pluxx-migrate-plugin`
- `pluxx-validate-scaffold`
- `pluxx-prepare-context`
- `pluxx-refine-taxonomy`
- `pluxx-rewrite-instructions`
- `pluxx-review-scaffold`
- `pluxx-build-install`
- `pluxx-verify-install`
- `pluxx-sync-mcp`
- `pluxx-autopilot`
- `pluxx-publish-plugin`

Those correspond to:

1. import an MCP and scaffold a plugin
2. migrate an existing host-native plugin into Pluxx
3. validate the scaffold deterministically
4. prepare website/docs/local context before semantic refinement
5. improve the skill taxonomy
6. rewrite the shared instructions
7. review the scaffold critically
8. build native outputs and optionally install them
9. verify that the installed host bundle is actually healthy
10. refresh the scaffold when the MCP changes
11. run the one-shot import/refine/verify path
12. package the plugin for release distribution

The self-hosting plugin also exposes matching explicit commands in hosts that support plugin commands:

- `/pluxx:autopilot`
- `/pluxx:build-install`
- `/pluxx:import-mcp`
- `/pluxx:migrate-plugin`
- `/pluxx:prepare-context`
- `/pluxx:publish-plugin`
- `/pluxx:validate-scaffold`
- `/pluxx:refine-taxonomy`
- `/pluxx:rewrite-instructions`
- `/pluxx:review-scaffold`
- `/pluxx:sync-mcp`
- `/pluxx:verify-install`

Use commands when you want a direct host-native entrypoint in Claude Code, Cursor, or OpenCode. In Codex, use `@pluxx` and the skill list instead; `/` is reserved for native Codex commands. Use skills when you want the host agent to choose the right Pluxx workflow automatically.

## The Easiest Mental Model

Think in terms of what you want the host agent to do:

- “Use Pluxx to scaffold this MCP”
- “Use Pluxx to prepare context before rewriting this scaffold”
- “Use Pluxx to improve the taxonomy”
- “Use Pluxx to rewrite the instructions”
- “Use Pluxx to review this scaffold”
- “Use Pluxx to verify the installed Codex plugin”
- “Use Pluxx to publish this plugin”
- “Use Pluxx to sync this plugin from its MCP again”

You do **not** need to memorize the exact CLI every time if the host agent already has Pluxx available.

## Core Usage Patterns

### 1. Import a new MCP

Good prompt:

```text
Use Pluxx to scaffold a plugin from https://example.com/mcp.
Do a deterministic first pass, show me what gets generated, then run doctor, lint, and test.
```

If auth is needed:

```text
Use Pluxx to scaffold a plugin from https://example.com/mcp.
This MCP uses header auth via ACME_API_KEY and X-API-Key.
Do a dry-run first, then do the real import if it looks correct.
```

If you already know the desired project folder:

```text
Use Pluxx to scaffold this MCP into ./acme-plugin.
Use workflow grouping, safe hooks, and target Claude Code, Cursor, Codex, and OpenCode.
```

### 2. Refine the taxonomy

Good prompt:

```text
Use Pluxx to refine the taxonomy in this scaffold.
Refresh the agent context with the product website and docs first, then run the taxonomy pass and re-test the project.
```

If you want stronger product shaping:

```text
Use Pluxx to improve this scaffold's taxonomy.
The current skills are too lexical and fragmented.
Favor product-shaped workflows over one skill per tool.
```

### 3. Rewrite the instructions

Good prompt:

```text
Use Pluxx to rewrite the generated section in INSTRUCTIONS.md.
Keep the custom block intact, make the setup/auth boundaries clear, and keep the tone operational.
```

### 4. Review the scaffold

Good prompt:

```text
Use Pluxx to review this scaffold critically before shipping.
Find semantic weaknesses in the taxonomy, setup guidance, examples, and product framing.
Findings first.
```

### 5. Sync later

Good prompt:

```text
Use Pluxx to sync this project from its MCP source again.
Preview first, then explain what changed, what was preserved, and whether taxonomy or instructions should be rerun.
```

## The Best Inputs To Give The Host Agent

Pluxx works much better when you hand the host agent the real product context up front.

When possible, include:

- MCP URL or local stdio command
- auth shape
- website URL
- docs URL
- plugin name
- display name
- desired targets
- whether you want a dry-run first

Example:

```text
Use Pluxx to scaffold a plugin from https://mcp.sumble.com.
Use Claude Code, Cursor, Codex, and OpenCode as targets.
Website: https://sumble.com
Docs: https://docs.sumble.com/api/mcp
Do a deterministic import first, then prepare the agent context pack.
```

## What The Host Agent Will Usually Do

Under the hood, the host agent should follow something close to this:

1. run `pluxx init --from-mcp ...`
2. inspect the scaffold
3. run `pluxx agent prepare --website ... --docs ...`
4. optionally run taxonomy/instructions/review passes
5. run `pluxx doctor`
6. run `pluxx lint`
7. run `pluxx test`
8. run `pluxx build`
9. optionally run `pluxx install --target ...`

That is the right sequence whether the host is Claude, Codex, Cursor, or OpenCode.

## Host-Specific Guidance

### Claude Code

Use Pluxx in Claude Code when you want:

- interactive scaffold iteration
- fast review/refine loops
- native runtime testing of generated Claude plugins

Good prompt:

```text
Use Pluxx to scaffold this MCP, then refine the taxonomy and instructions before building and installing the Claude target.
```

### Codex

Use Pluxx in Codex when you want:

- CLI-first deterministic generation
- stricter review behavior
- strong local coding-agent workflows around the generated scaffold
- explicit plugin invocation via `@pluxx` rather than plugin slash commands

Good prompt:

```text
Use Pluxx to import this MCP, validate the first pass, then review what still looks weak before we install anything.
```

This matches the general Codex workflow model described in the official OpenAI Codex use-cases docs: explicit tasks, concrete context, and repeatable operator flows. See [Codex use cases](https://developers.openai.com/codex/use-cases).

### Cursor

Use Pluxx in Cursor when you want:

- plugin authoring in a more IDE-native environment
- Cursor-specific validation and runtime testing
- headless taxonomy/instructions passes via the Cursor agent CLI when needed

Good prompt:

```text
Use Pluxx to scaffold this MCP, then make the plugin feel natural in Cursor and check the generated Cursor output before we ship it.
```

### OpenCode

Use Pluxx in OpenCode when you want:

- OpenCode-specific plugin wrapper generation
- attachable headless runs for refinement
- explicit command and hook mapping into OpenCode's plugin model

Good prompt:

```text
Use Pluxx to generate this plugin, then run the refinement passes through OpenCode and verify the final wrapper output.
```

## How To Ask For The Right Level Of Automation

### Deterministic first

Use this when you want control:

```text
Use Pluxx, but keep the first pass deterministic.
Do not jump into semantic rewrites until the scaffold builds and tests.
```

### Full autopilot

Use this when you want convenience:

```text
Use Pluxx autopilot for this MCP.
Run the standard mode, summarize what changed, and only stream runner logs if something fails.
```

### Review before mutation

Use this when you want caution:

```text
Use Pluxx to dry-run the import first and show me the plan before writing files.
```

## What “Good” Looks Like

A good Pluxx-assisted run should leave you with:

- a valid `pluxx.config.ts`
- a sensible `INSTRUCTIONS.md`
- product-shaped `skills/*/SKILL.md`
- passing `doctor`, `lint`, and `test`
- built `dist/` outputs for the requested targets
- optionally an installed local plugin for one host

## Recommended Prompts

### Import only

```text
Use Pluxx to scaffold a plugin from this MCP and validate the first pass.
```

### Import + product shaping

```text
Use Pluxx to scaffold this MCP, then improve the taxonomy and instructions so the plugin feels product-shaped instead of tool-shaped.
```

### Review before shipping

```text
Use Pluxx to review this scaffold critically and tell me what is still weak before we publish it.
```

### Sync existing project

```text
Use Pluxx to sync this scaffold from its MCP source again and explain what changed.
```

## What To Document For Your Team

If your team uses Pluxx inside host agents regularly, capture these four things:

- which MCPs you wrap
- what auth shape each one uses during import
- whether runtime auth is platform-managed or plugin-managed
- which prompts/workflows you want people to use by default

That gives your team a stable way to say:

```text
Use Pluxx to do the standard import -> refine -> verify loop for this MCP.
```

## Related Docs

- [Create a Pluxx plugin](./create-a-pluxx-plugin.md)
- [Practical handbook](./practical-handbook.md)
- [Getting started](./getting-started.md)
- [Agent Mode](./agent-mode.md)
