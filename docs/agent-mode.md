# Agent Mode

Pluxx has two product layers:

- `Core`: deterministic scaffolding, validation, build, install, and sync
- `Agent`: guided semantic refinement driven by Claude Code, Codex, or another coding agent

Pluxx does **not** need to become its own AI orchestration runtime to solve the hard part of plugin authoring. The right split is:

- let Pluxx own the structure, hard rules, and safe write boundaries
- let the host agent own the semantic judgment

That matches how people already work. They are inside Claude Code or Codex anyway, so Pluxx should prepare the scaffold and the prompt/context pack that the agent needs to do high-quality refinement.

## Why Agent Mode Exists

`pluxx init --from-mcp` can always produce a valid scaffold from:

- MCP transport + auth
- `serverInfo`
- `tools/list`
- tool descriptions and input schemas

That is enough to build:

- `pluxx.config.ts`
- baseline `INSTRUCTIONS.md`
- baseline `skills/*/SKILL.md`
- generated hooks / scripts
- platform bundles

But complex MCPs need more than valid scaffolding.

PlayKit is a good example. Raw introspection can discover the tools, but it does not fully recover the product narrative:

- setup vs runtime tools
- knowledge tools vs API tools
- account/usage/admin surfaces
- the way the product is actually explained on its site and docs

That is where Agent Mode comes in.

## Product Definition

### Core Mode

Core Mode stays deterministic and model-free.

It owns:

- MCP introspection
- config generation
- baseline skill generation
- lint
- build
- install
- sync
- file ownership rules

### Agent Mode

Agent Mode prepares the semantic context and prompt pack for the host agent.

It owns:

- MCP summary for the agent
- product/workflow context
- prompt packs for taxonomy, instructions, and review
- explicit write boundaries
- acceptance criteria for the refinement pass

It does **not** own model execution.

## User Flow

### Flow A: Core only

```bash
bunx pluxx init --from-mcp https://example.com/mcp
bunx pluxx lint
bunx pluxx build
bunx pluxx test
```

Use this when a deterministic first pass is enough.

### Flow B: Core + Agent

```bash
bunx pluxx init --from-mcp https://example.com/mcp
bunx pluxx agent prepare
```

Then in Claude Code or Codex:

```text
Use the Pluxx agent context and taxonomy prompt to refine the generated skills.
Only edit Pluxx-managed sections.
Preserve all custom sections.
Run pluxx lint and pluxx test when done.
```

That is the intended semantic-authoring flow.

## Commands

Phase 1 should support:

```bash
pluxx autopilot --from-mcp https://example.com/mcp --runner codex --yes --name acme --display-name "Acme" --author "Acme"
pluxx agent prepare
pluxx agent prompt taxonomy
pluxx agent prompt instructions
pluxx agent prompt review
pluxx agent run taxonomy --runner claude
pluxx agent run taxonomy --runner codex
pluxx agent run review --runner opencode --attach http://localhost:4096 --no-verify
```

Optional flags:

```bash
--docs https://docs.example.com
--website https://example.com
--context README.md,docs/overview.md
--json
--dry-run
```

## Runner Adapters

Agent Mode is file-first. The runner layer is optional.

`pluxx agent run` does three things:

1. refreshes `.pluxx/agent/context.md` and `.pluxx/agent/plan.json`
2. refreshes the selected prompt pack
3. invokes a host agent in headless mode against those files

Current built-in runners:

- `claude`
- `opencode`
- `codex`

If you want the entire deterministic + agent flow in one command, use `pluxx autopilot`. It composes scaffold import, agent refinement, and final verification without introducing a separate authoring engine.

### Verification Contract

For edit-oriented runs like `taxonomy` and `instructions`, Pluxx verifies the scaffold after the host agent exits by running the normal Pluxx verification flow.

For read-only runs like `review`, Pluxx disables verification automatically and keeps the host runner in read-only/review mode where supported.

## Generated Files

`pluxx agent prepare` generates:

```text
.pluxx/
├── mcp.json
└── agent/
    ├── context.md
    └── plan.json
```

Prompt packs are generated separately:

```text
.pluxx/
└── agent/
    ├── taxonomy-prompt.md
    ├── instructions-prompt.md
    └── review-prompt.md
```

Project-owned overrides live outside the generated `.pluxx/agent/` directory:

```text
pluxx.agent.md
```

Use that file for durable Agent Mode customization. The generated prompt packs are disposable.

Example:

```md
# Pluxx Agent Overrides

## Context Paths
- docs/product.md
- notes/playbook.md

## Product Hints
This MCP has a clear split between knowledge tools and runtime API tools.

## Setup/Auth Notes
Knowledge tools work immediately. Runtime API tools require secondary auth.

## Grouping Hints
- setup-and-auth: connect, status
- knowledge: ask, compare, catalog

## Taxonomy Guidance
Prefer product-shaped skills over raw tool buckets.

## Instructions Guidance
Make the setup and auth boundary explicit in shared instructions.

## Review Criteria
Flag any skill grouping that mixes setup/admin tools with runtime workflows.
```

### `context.md`

The semantic handoff for the host agent.

Should include:

- MCP identity and auth summary
- discovered tool inventory
- current generated skills and their tool assignments
- optional docs/site summary
- known caveats from lint/test
- the intended output quality bar

### `plan.json`

Machine-readable constraints for the agent.

Should include:

- editable files
- editable sections
- non-editable files
- success criteria
- known caveats

### `taxonomy-prompt.md`

Prompt for:

- grouping tools into real product/workflow skills
- merging/splitting/renaming generated skills
- identifying setup/admin/account surfaces

### `instructions-prompt.md`

Prompt for rewriting the generated block in `INSTRUCTIONS.md`.

### `review-prompt.md`

Prompt for evaluating whether the scaffold is actually good after refinement.

## Write Boundaries

Agent Mode only works if the write contract is explicit.

The host agent may edit:

- the generated block in `INSTRUCTIONS.md`
- the generated block in each `skills/*/SKILL.md`
- files under `.pluxx/agent/`

The host agent must not edit unless explicitly requested:

- auth wiring in `pluxx.config.ts`
- target platform configuration
- user-owned custom sections
- generated platform bundles in `dist/`
- `pluxx.agent.md`

This lets agents do meaningful semantic work without turning the scaffold into an unreviewable mess.

## Prompt Contract

The prompt packs should be constrained, not vague.

Example taxonomy prompt:

```text
You are refining a Pluxx-generated plugin scaffold for an MCP.

Inputs:
- .pluxx/mcp.json
- .pluxx/agent/context.md
- INSTRUCTIONS.md
- skills/*/SKILL.md

Your job:
1. Infer the MCP's real product surfaces and workflows.
2. Merge, split, or rename generated skills if needed.
3. Rewrite only Pluxx-managed sections.
4. Preserve all custom-note blocks.
5. Do not change auth wiring or platform config.

Success criteria:
- each skill represents a real user workflow or product surface
- setup/admin/account tools are grouped intentionally
- examples are concrete and realistic
- wording matches the MCP's product narrative
```

## PlayKit Example

The deterministic import of PlayKit produced a working scaffold, but the grouping was still mostly lexical.

Agent Mode should help move that scaffold toward a more product-shaped taxonomy like:

```text
setup-and-auth
clay-knowledge
clay-workflow-design
clay-table-operations
account-and-usage
```

That is the type of semantic refinement Agent Mode is designed to unlock.

## Why Not Built-in Smart Mode

Built-in Smart Mode sounds appealing, but it creates a larger product than Pluxx needs right now:

- provider abstraction
- model auth and billing
- retries and fallbacks
- nondeterministic support burden
- prompt/runtime orchestration inside the CLI

Agent Mode avoids that complexity.

Pluxx should remain:

- deterministic in Core
- agent-native in semantic refinement

If a built-in model layer is ever added later, it should reuse the same context pack and write-boundary model that Agent Mode establishes first.

## Phase 1 Scope

Phase 1 Agent Mode should ship:

- `pluxx agent prepare`
- prompt pack generation
- context pack generation
- explicit write boundaries
- docs links from README / docs

It does **not** need:

- built-in model execution
- provider abstraction
- prompt marketplace complexity
- automatic commit/publish flows

## Success Criteria

Agent Mode is successful when:

- a user can scaffold from an MCP in Core mode
- run `pluxx agent prepare`
- hand the prompt/context pack to Claude Code or Codex
- get a better plugin without losing deterministic safety
- preserve custom edits across future syncs

## Dogfood Plugin

This repo now ships a repo-local Codex plugin at [`plugins/pluxx`](../plugins/pluxx) plus marketplace metadata at [`../.agents/plugins/marketplace.json`](../.agents/plugins/marketplace.json).

The dogfood skill pack is intentionally narrow:

- `pluxx-import-mcp`
- `pluxx-refine-taxonomy`
- `pluxx-rewrite-instructions`
- `pluxx-review-scaffold`
- `pluxx-sync-mcp`

Use it to drive the same Core + Agent workflow from inside Codex instead of remembering raw commands.
