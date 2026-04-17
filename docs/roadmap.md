# Roadmap

Last updated: 2026-04-16

This is the execution map for Pluxx after tightening the product scope around the core primitives:

- `skills`
- `instructions`
- `mcp`
- `userConfig`
- `commands`
- `agents`
- `hooks`
- `permissions`
- `brand`
- `assets/scripts`
- `taxonomy`

See [Core primitives](./core-primitives.md) for the product-scope rationale behind this roadmap.

## Current State

Pluxx already has the core mechanical loop:

- import
- scaffold
- doctor
- lint
- test
- build
- install
- sync

It also has the semantic authoring layer:

- Agent Mode prompt/context packs
- taxonomy persistence
- commands generated from the same semantic layer as skills
- working self-hosting Pluxx plugin outputs for Claude Code, Cursor, Codex, and OpenCode

The remaining gap is not “does Pluxx work?” It is “does Pluxx have a complete product contract for real plugin authors?”

## Active Work

### `PLUXX-116` Docs Site

- status: `In Progress`
- delegate: `Blocks`
- outcome: a Mintlify docs site that matches the tightened product scope and current behavior

### `PLUXX-79` Core + Agent Coherence

- status: `In Progress`
- role: umbrella issue
- outcome: keep the deterministic Core and semantic Agent layers aligned in docs and execution

### `PLUXX-125` Product Branding + Launch Asset System

- status: `In Progress`
- delegate: `Blocks`
- outcome: one canonical product-brand direction doc, launch-asset checklist, and follow-on implementation map

## Milestone 1: Core Product Contract

This is the main execution queue.

### Done

- `PLUXX-113` canonical `userConfig`
  - shipped on `main`
  - commit: `a9a6326`

### Next

#### `PLUXX-114` Canonical permissions

Goal:

- let plugin authors declare one permission model
- compile it honestly across Claude Code, Codex, Cursor, and OpenCode

Subtasks:

- `PLUXX-117` Design the canonical permissions model from primary-host behaviors
  - delegate: `Blocks`
- `PLUXX-118` Compile canonical permissions into primary target generators
- `PLUXX-119` Add lint, test, and docs coverage for permission mappings
  - delegate: `Blocks`

Dependencies:

- `PLUXX-117` must settle the portable model first
- `PLUXX-118` depends on that decision
- `PLUXX-119` depends on the implemented mapping

Deliverable:

- one truthful `permissions` primitive with documented gaps and target behavior

#### `PLUXX-115` Build-time cap validation

Goal:

- catch the important primary-target hard limits before shipping

Subtasks:

- `PLUXX-120` Catalog primary-target hard caps in platform-rules
  - delegate: `Blocks`
- `PLUXX-121` Enforce primary-target cap validation in lint and build

Dependencies:

- `PLUXX-120` identifies the enforced caps
- `PLUXX-121` turns them into product behavior

Deliverable:

- proactive warnings/errors for Codex, OpenCode, Claude Code, and Cursor target limits

#### `PLUXX-50` Publish

Goal:

- close the gap between “built a plugin” and “can actually ship it”

Subtasks:

- `PLUXX-122` Define publish v1 contract and dry-run output
  - delegate: `Blocks`
- implementation inside `PLUXX-50`
- `PLUXX-123` Prepare marketplace submission metadata and docs for publish flows
  - delegate: `Blocks`

Dependencies:

- `PLUXX-122` defines the first real publish contract
- `PLUXX-50` implements it
- `PLUXX-123` turns it into marketplace-aware guidance

Deliverable:

- `pluxx publish` v1 with dry-run, artifact packaging, and distribution guidance

## Cross-Cutting Track: Product Brand System

### `PLUXX-125` Define Pluxx product branding and launch asset system

Goal:

- make Pluxx branding coherent across docs, npm, GitHub, screenshots, and marketplace-facing assets
- keep product-brand decisions separate from plugin `brand` schema support

Deliverable:

- [Brand launch asset system](./brand-launch-asset-system.md) as the canonical reference

Follow-on implementation themes:

- site theming and component alignment
- brand asset pipeline (logo/icon/screenshot source + exports)
- messaging synchronization across homepage/docs/npm/GitHub
- marketplace-ready media and listing copy pack

## Milestone 2: Protocol Depth

This is the next tier after the core product contract.

### `PLUXX-62` Auth and discovery

Umbrella for:

- `PLUXX-43` OAuth 2.1 auth type to schema and generators
- `PLUXX-69` richer MCP auth discovery and OAuth-ready scaffold support

Deliverable:

- Pluxx can describe richer MCP auth models without pretending to complete runtime OAuth inside the CLI

### `PLUXX-61` Import beyond `tools/list`

Umbrella for:

- `PLUXX-67` resources and resource templates
- `PLUXX-68` prompt templates

Deliverable:

- Pluxx imports more than tool metadata and generates richer plugin context from those MCP surfaces

## Milestone 3: Semantic / Agent Portability

This is the portability layer after the core contract and protocol depth are stable.

### `PLUXX-89` Portable delegation

Goal:

- define what agent/subagent delegation means across the core four without inventing a fake universal runtime

Deliverable:

- one clear portable subset for delegation, hooks, and agent metadata

### `PLUXX-95` Commands as a host-native layer

Goal:

- strengthen host-native command UX where it actually exists

Deliverable:

- stronger command names, descriptions, and argument hints for Claude/Cursor/OpenCode
- Codex remains skills-first via `@plugin`

### `PLUXX-88` Frontmatter / metadata coherence

Goal:

- unify metadata ownership across skills, agents, and rule surfaces

Deliverable:

- one clear explanation of what Pluxx owns vs what hosts own

## Explicitly Folded Work

To keep the board coherent, the following were folded or closed:

- `PLUXX-41` -> duplicate of `PLUXX-68`
- `PLUXX-42` -> duplicate of `PLUXX-67`
- `PLUXX-22` -> superseded by `PLUXX-115`

## Separate Track: Validation / Sandbox Issues

These remain real, but they are not the main product roadmap:

- `PLUXX-100`
- `PLUXX-108`
- `PLUXX-109`
- `PLUXX-110`
- `PLUXX-111`
- `PLUXX-112`

Treat them as validation / linear-swarm work, not as the core Pluxx execution queue.

## If You Only Want The Next Sequence

Do this in order:

1. `PLUXX-117`
2. `PLUXX-118`
3. `PLUXX-120`
4. `PLUXX-121`
5. `PLUXX-122`
6. `PLUXX-50`

That sequence closes the three biggest remaining product-contract gaps:

- permissions
- target-cap validation
- publish
