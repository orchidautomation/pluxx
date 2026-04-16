# Pluxx TODO

Last updated: 2026-04-16

## Active Now

### In Progress

- `PLUXX-116` Build a Mintlify docs site for Pluxx
  - delegate: `Blocks`
  - deliverable: public docs site that reflects the tightened core-primitives scope
- `PLUXX-79` Define Agent Mode as the semantic authoring layer on top of Core
  - role: umbrella / coordination issue
  - deliverable: keep the Core + Agent product story coherent while child issues ship
- `PLUXX-125` Define Pluxx product branding and launch asset system
  - delegate: `Blocks`
  - deliverable: canonical brand direction doc + launch asset checklist + follow-on implementation map

## Execution Queue

### Milestone 1: Core Product Contract

This is the immediate product-contract gap after the recent `userConfig` work.

- `PLUXX-113` Add canonical `userConfig` and install-time secret handling across primary targets
  - status: `Done`
  - shipped in commit `a9a6326`

- `PLUXX-114` Add a canonical permissions schema across Claude Code, Codex, Cursor, and OpenCode
  - status: `Todo`
  - deliverable: one truthful `permissions` primitive compiled across the core four
  - subtasks:
    - `PLUXX-117` Design the canonical permissions model from primary-host behaviors
      - delegate: `Blocks`
    - `PLUXX-118` Compile canonical permissions into primary target generators
    - `PLUXX-119` Add lint, test, and docs coverage for permission mappings
      - delegate: `Blocks`
  - dependency chain:
    - `PLUXX-117` -> `PLUXX-118` -> `PLUXX-119`

- `PLUXX-115` Add build-time target cap validation for primary platforms
  - status: `Todo`
  - deliverable: proactive warnings/errors for the primary-target limits that can silently break plugins
  - subtasks:
    - `PLUXX-120` Catalog primary-target hard caps in platform-rules
      - delegate: `Blocks`
    - `PLUXX-121` Enforce primary-target cap validation in lint and build
  - dependency chain:
    - `PLUXX-120` -> `PLUXX-121`

- `PLUXX-50` Add `pluxx publish` command for plugin distribution
  - status: `Todo`
  - deliverable: publish v1 contract, dry-run, and artifact/release path
  - subtasks:
    - `PLUXX-122` Define publish v1 contract and dry-run output
      - delegate: `Blocks`
    - implementation inside `PLUXX-50`
    - `PLUXX-123` Prepare marketplace submission metadata and docs for publish flows
      - delegate: `Blocks`
  - dependency chain:
    - `PLUXX-122` -> `PLUXX-50` -> `PLUXX-123`

### Milestone 2: Protocol Depth

This is the next expansion layer after the core product contract is solid.

- `PLUXX-62` Competitive readiness: deepen MCP auth and discovery support
  - role: umbrella
  - child issues:
    - `PLUXX-43` Add OAuth 2.1 auth type to schema and generators
    - `PLUXX-69` Add richer MCP auth discovery and OAuth-ready scaffold support

- `PLUXX-61` Competitive readiness: expand MCP import beyond `tools/list`
  - role: umbrella
  - child issues:
    - `PLUXX-67` Scaffold skills and instructions from MCP resources and resource templates
    - `PLUXX-68` Scaffold prompt-aware plugin content from MCP prompt templates

### Milestone 3: Semantic / Agent Portability

This is the remaining semantic layer after the core product contract and protocol depth work.

- `PLUXX-89` Define a portable agent and subagent delegation model for primary platforms
  - status: `Backlog`
  - deliverable: one truthful cross-host delegation model instead of copy-through behavior

- `PLUXX-95` Add first-class command generation with argument hints for Claude Code and Cursor
  - status: `Backlog`
  - priority: `Medium`
  - deliverable: host-native command UX layered on top of the same taxonomy model

- `PLUXX-88` Unify frontmatter and agent surface handling across skills, agents, and rules
  - status: `Backlog`
  - deliverable: coherent metadata ownership across semantic surfaces

## Closed / Folded Work

These are no longer part of the active execution map.

- `PLUXX-113`
  - completed and shipped
- `PLUXX-41`
  - closed as duplicate of `PLUXX-68`
- `PLUXX-42`
  - closed as duplicate of `PLUXX-67`
- `PLUXX-22`
  - canceled as superseded by `PLUXX-115`

## Separate Validation / Sandbox Track

These are real issues, but they are not the core Pluxx product roadmap.

- `PLUXX-100`
- `PLUXX-108`
- `PLUXX-109`
- `PLUXX-110`
- `PLUXX-111`
- `PLUXX-112`

Treat these as validation / linear-swarm test work, not as the main product execution queue.

## What To Do Next

If you only want the next concrete sequence, it is:

1. finish `PLUXX-117`
2. implement `PLUXX-118`
3. finish `PLUXX-120`
4. implement `PLUXX-121`
5. finish `PLUXX-122`
6. implement `PLUXX-50`

That sequence closes the biggest remaining product-contract gaps in order:

- permissions
- target-cap validation
- publish
