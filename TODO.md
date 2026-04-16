# Pluxx TODO

Last updated: 2026-04-16

## Active Now

### In Progress

- `PLUXX-79` Define Agent Mode as the semantic authoring layer on top of Core
  - role: umbrella / coordination issue
  - deliverable: keep the Core + Agent product story coherent while child issues ship
- `PLUXX-114` Add a canonical permissions schema across Claude Code, Codex, Cursor, and OpenCode
  - status: `In Progress`
  - shipped baseline:
    - `PLUXX-117` is done
    - the first compiler slice already landed on `main`
  - remaining active work:
    - `PLUXX-118` delegated to `Blocks`
    - `PLUXX-119` active PR `#138`
- `PLUXX-115` Add build-time target cap validation for primary platforms
  - status: `In Progress`
  - shipped baseline:
    - initial primary-target cap validation already landed on `main`
  - remaining active work:
    - `PLUXX-120` active PR `#137`
    - `PLUXX-121` delegated to `Blocks`
- `PLUXX-125` Define Pluxx product branding and launch asset system
  - status: `In Progress`
  - delegate: `Blocks`
  - deliverable: a real product-brand track separate from plugin `brand` schema support

## Execution Queue

### Milestone 1: Core Product Contract

This is the immediate product-contract gap after the recent `userConfig`, publish, and npm-release work.

- `PLUXX-113` Add canonical `userConfig` and install-time secret handling across primary targets
  - status: `Done`
  - shipped in commit `a9a6326`

- `PLUXX-114` Add a canonical permissions schema across Claude Code, Codex, Cursor, and OpenCode
  - status: `In Progress`
  - deliverable: one truthful `permissions` primitive compiled across the core four
  - shipped baseline:
    - `PLUXX-117` done
    - first compiler slice already landed on `main`
  - subtasks:
    - `PLUXX-117` Design the canonical permissions model from primary-host behaviors
      - status: `Done`
    - `PLUXX-118` Compile canonical permissions into primary target generators
      - status: `In Progress`
      - delegate: `Blocks`
    - `PLUXX-119` Add lint, test, and docs coverage for permission mappings
      - status: `In Progress`
      - active PR: `#138`
      - delegate: `Blocks`
  - dependency chain:
    - `PLUXX-117` -> `PLUXX-118` -> `PLUXX-119`

- `PLUXX-115` Add build-time target cap validation for primary platforms
  - status: `In Progress`
  - deliverable: proactive warnings/errors for the primary-target limits that can silently break plugins
  - shipped baseline:
    - initial primary-target cap validation already landed on `main`
  - subtasks:
    - `PLUXX-120` Catalog primary-target hard caps in platform-rules
      - status: `In Progress`
      - active PR: `#137`
      - delegate: `Blocks`
    - `PLUXX-121` Enforce primary-target cap validation in lint and build
      - status: `In Progress`
      - delegate: `Blocks`
  - dependency chain:
    - `PLUXX-120` -> `PLUXX-121`

- `PLUXX-50` Add `pluxx publish` command for plugin distribution
  - status: `Done`
  - shipped scope:
    - publish v1 contract and dry-run behavior
    - `pluxx publish` implementation
    - marketplace submission-prep docs
    - npm release as `@orchid-labs/pluxx`
    - tag-based GitHub Actions release workflow
  - completed child work:
    - `PLUXX-122`
    - `PLUXX-123`
    - `PLUXX-124`

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

### Brand / Launch Assets

- `PLUXX-125` Define Pluxx product branding and launch asset system
  - status: `In Progress`
  - delegate: `Blocks`
  - deliverable:
    - explicit Pluxx product-brand direction
    - launch asset checklist
    - follow-on site/docs/assets tasks where needed

## Closed / Folded Work

These are no longer part of the active execution map.

- `PLUXX-113`
  - completed and shipped
- `PLUXX-50`
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

1. land `PLUXX-119` / PR `#138`
2. land `PLUXX-120` / PR `#137`
3. finish `PLUXX-118`
4. finish `PLUXX-121`
5. move into `PLUXX-43` / `PLUXX-62`
6. define the first real Pluxx product-brand system in `PLUXX-125`

That sequence closes the biggest remaining product-contract gaps in order:

- permissions
- target-cap validation
- richer auth/discovery
- product-brand coherence
