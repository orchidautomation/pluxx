# Author-Once Hardening

Last updated: 2026-05-04

## Doc Links

- Role: thorough TODO file for closing the gap between the Pluxx vision and the current author-once reality
- Related:
  - [docs/start-here.md](../start-here.md)
  - [docs/todo/queue.md](./queue.md)
  - [docs/todo/master-backlog.md](./master-backlog.md)
  - [docs/roadmap.md](../roadmap.md)
  - [docs/pluxx-plugin-surface-audit.md](../pluxx-plugin-surface-audit.md)
  - [docs/core-primitives.md](../core-primitives.md)
  - [docs/core-four-primitive-matrix.md](../core-four-primitive-matrix.md)
  - [docs/core-four-provider-docs-audit.md](../core-four-provider-docs-audit.md)
  - [docs/core-four-translation-hit-list.md](../core-four-translation-hit-list.md)
  - [docs/primitive-compiler-hardening-architecture.md](../primitive-compiler-hardening-architecture.md)
- Update together:
  - [docs/todo/queue.md](./queue.md)
  - [docs/todo/master-backlog.md](./master-backlog.md)
  - [docs/roadmap.md](../roadmap.md)
  - [docs/primitive-compiler-hardening-architecture.md](../primitive-compiler-hardening-architecture.md)

This doc is the initiative-level TODO for making Pluxx truly feel like:

> author once, ship native everywhere, trust the result

For average users, that promise also has to be reachable through the self-hosted Pluxx plugin surface, not only through the raw CLI.

It is not the same as the broader compiler-hardening architecture doc.
That doc explains the system shape.
This doc is the sharper execution list for closing the remaining gap between the current product and the vision.

## Current Gap

Pluxx is already a real cross-host compiler.

What is not done yet is the stronger claim:

> one canonical source project can express the richest practical plugin intent once, and Pluxx can preserve or honestly translate that intent across Claude Code, Cursor, Codex, and OpenCode without expert-only cleanup.

Today the main shortcomings are:

- the compiler is ahead of the canonical authoring model
- the proof stack is ahead of the onboarding simplicity
- several primitives still preserve only part of the host-native intent
- behavioral parity is still weaker than structural parity
- import and migrate still lose meaning too early in some paths
- the plugin-guided path still depends too much on operator literacy instead of feeling like the obvious safe default for normal users

## Definition Of Done

This initiative is done when all of the following are true:

- a sophisticated maintainer can author a rich plugin from one Pluxx source project without needing host-specific patch files for common cases
- the 8 canonical primitives can carry the meaningful intent that the core four expose today
- `lint`, `doctor`, `build`, `test`, `install`, and `verify-install` all explain the same translation truth
- the compiler registry is the single source of truth for preserve / translate / degrade / drop behavior
- the flagship and stress-fixture examples prove installed behavior, not just output shape
- `init`, `autopilot`, and later `migrate` land much closer to final-quality source projects without manual reshaping
- a new user can understand the Pluxx authoring model quickly from the front door docs and one reference plugin
- the self-hosted `pluxx-plugin` makes the common workflows feel guided, safe, and understandable for users who should not need deep repo or CLI knowledge

## Non-Goals

Do not let this initiative sprawl into:

- the future trust / distribution control plane
- secondary host expansion ahead of core-four depth
- marketplace business logic
- GTM materials that do not improve the author-once product
- trying to force fake cross-host sameness where honest degradation is the right outcome
- rebuilding a second execution engine inside the plugin instead of keeping the CLI as the system of record

## Workstreams

### 1. Canonical Primitive Depth

Goal:

- make the 8 canonical primitives rich enough that the source model is not the bottleneck

TODO:

- deepen `skills` from a shared parser into a richer canonical skill spec
- keep pushing the richer shared `skills` metadata layer into more generator, proof, and translation-registry consumers
- keep pushing `commands` beyond `argument-hint` into stronger native host emission and registry-backed explainability now that argument shape, examples, routing, and workflow relationships survive the canonical parser
- finish the deeper hook registry rollout so event truth, field preservation, and degradation rules are not duplicated
- keep `agents` centered on canonical delegation intent, tuning hints, isolation posture, and permission intent
- continue splitting `runtime` internally into MCP/auth, readiness, and payload support
- continue splitting `distribution` internally into identity, branding, install surface, and publish surface
- identify any host-native intent still living only in generator-local logic and pull it up into canonical IR

Acceptance criteria:

- each primitive has a clear compiler-owned representation
- primitive docs and code agree about what the source model can express
- generator-specific parsing glue is materially reduced
- author intent survives farther through the pipeline before any degradation happens

### 2. Shared Translation Truth

Goal:

- ensure one source of truth decides what each host can actually preserve

TODO:

- keep `src/validation/platform-rules.ts` and the shared registries authoritative
- eliminate duplicated translation truth from generators, lint warnings, doctor output, and docs tables
- make every preserve / translate / degrade / drop rule traceable to one registry-backed source
- tighten the translation notes for host-extended vs portable surfaces
- make docs rows and machine-readable compatibility output derive from the same truth wherever practical

Acceptance criteria:

- a primitive/field/event rule is defined once
- `lint`, `doctor`, `build`, and docs describe the same outcome
- provider-doc audit refreshes can be applied systematically instead of by hunting parallel strings

### 3. Behavioral Proof Over Shape Proof

Goal:

- make installed behavior the standard of truth, not merely emitted files

TODO:

- keep expanding installed behavioral proof for the flagship and stress-fixture plugins
- add targeted proof for richer hook behavior, delegated agents, risky-action flows, readiness gates, and runtime bootstrap chains
- keep `doctor --consumer` and `verify-install` honest about actual launchability
- add proof where host-local reload, cache, or plugin discovery behavior can drift from bundle shape
- keep the Exa, docs-ops, platform-change-ops, and self-hosted Pluxx examples current as regression surfaces

Acceptance criteria:

- each major primitive has at least one real installed-behavior proof path
- release confidence does not depend on inspecting generated files by hand
- examples catch regressions that unit tests alone would miss

### 4. Import Quality Before Migrate Ambition

Goal:

- make raw import and scaffold generation land closer to a maintainable final source project

TODO:

- improve `init --from-mcp` so it recovers more workflow shape, argument intent, runtime packaging, and auth guidance
- keep tightening `autopilot` so it produces stronger commands, agents, and instruction structure automatically
- reduce lossy import paths in installed-MCP discovery
- preserve richer hook and auth meaning earlier in the import pipeline
- use the Exa example as the pressure test for “how close to final quality does first pass get”

Acceptance criteria:

- raw MCP import creates a source project that already feels Pluxx-native, not like a thin dump
- the remaining manual refinement is about product judgment, not missing compiler understanding

### 5. Authoring Simplicity And Front Door Clarity

Goal:

- make the product easier to understand and easier to use without internal repo knowledge

TODO:

- keep `docs/start-here.md`, `docs/todo/queue.md`, `docs/todo/master-backlog.md`, `docs/roadmap.md`, README, and Linear aligned
- simplify the explanation of the author-once model around the 8 primitives
- make it obvious when to use `init`, `autopilot`, `migrate`, `sync`, `doctor`, `eval`, and `test --install`
- keep one reference plugin and one stress fixture as the canonical learning path
- reduce places where the product still assumes expert Pluxx literacy
- keep the `pluxx-plugin` thin but polished as the average-user operator surface over the CLI
- make the plugin-first path for import, validate, refine, build, install, verify, sync, autopilot, and publish feel obvious
- improve “what Pluxx did / what degraded / what to do next” explanation quality in the plugin-guided flow
- make sure plugin UX aligns with the real CLI lifecycle instead of inventing a parallel mental model

Acceptance criteria:

- a new maintainer can understand the authoring model quickly
- docs point to a small number of trustworthy entrypoints
- the public product story matches the actual repo truth
- an average user can successfully use the plugin layer without needing to already think like a Pluxx maintainer

### 6. Plugin-Guided Average-User Path

Goal:

- make the self-hosted `pluxx-plugin` the easiest trustworthy way for normal users to use Pluxx without weakening the CLI-centered architecture

TODO:

- keep [docs/pluxx-plugin-surface-audit.md](../pluxx-plugin-surface-audit.md) current as the source of truth for plugin coverage
- identify which CLI workflows should feel first-class in the plugin and which should remain maintainer-only
- improve plugin guidance around:
  - import
  - migrate
  - validate
  - prepare context
  - refine taxonomy
  - rewrite instructions
  - review scaffold
  - build and install
  - verify install
  - sync
  - autopilot
  - publish
- add sharper troubleshooting and “next best action” guidance to plugin-facing flows
- reduce points where the plugin assumes users understand the repo layout, host caveats, or command sequencing already
- verify that the plugin improves comprehension and success rate rather than only exposing the CLI indirectly

Acceptance criteria:

- the plugin feels like a guided operator surface, not a thin bag of prompts that assumes internal knowledge
- plugin workflows route cleanly into deterministic CLI execution
- average users can get useful results without learning the entire compiler model first
- the plugin never diverges from the CLI truth underneath it

### 7. Host-Asymmetry Honesty

Goal:

- make Pluxx powerful without pretending all hosts are the same

TODO:

- keep portable-core intent separate from host-power-feature intent
- explicitly document where a host supports richer native behavior than the portable substrate
- add sharper warnings where a host feature is companion-only, feature-gated, or best-effort
- avoid “universal bundle shape” thinking where host-specific outputs are the correct result

Acceptance criteria:

- authors understand what is portable versus host-extended
- richer native host features are used where appropriate
- degradation is explicit and trusted, not surprising

## Primitive-Specific TODO

### Instructions

- define the canonical instruction blocks that Pluxx owns versus prose that remains manual
- tighten how Cursor rules, Claude instructions, Codex instructions, and OpenCode runtime guidance derive from one source
- ensure size limits, routing caveats, and host-specific caveats are registry-backed
- prove that instruction intent survives import, build, and installed usage

### Skills

- keep evolving `src/skills.ts` as the richer canonical skill model
- preserve identity, invocation hints, related files, scripts, context, agent ties, and richer supporting metadata
- reduce line-oriented markdown assumptions where hosts expose more structure
- make build, lint, migrate, and proof consume the same skill truth

### Commands

- keep the richer argument, example, routing, command-to-skill, and command-to-agent model authoritative
- improve native host emission and explainability from that richer model
- keep degraded command companions honest where a host lacks a native analog
- prove argument-bearing commands across the core four

### Agents

- keep shared agent metadata authoritative
- preserve delegation posture, reasoning/tuning hints, and permission intent more uniformly
- keep subagent/native-specialist proof current across Claude, Cursor, Codex, and OpenCode
- make migration/import preserve more native agent meaning before rebuild

### Hooks

- finish the shared hook registry rollout
- preserve richer event truth and field support from the provider-doc audit
- keep prompt hooks, command hooks, risky-action hooks, session hooks, and MCP/tool hooks clearly separated
- prove installed hook behavior where hosts genuinely support it
- reduce remaining lossy hook migration paths

### Permissions

- keep canonical `allow` / `ask` / `deny` authoritative
- preserve skill-scoped and workflow-scoped intent where hosts can carry it
- keep OpenCode native permission-first output strong without weakening other hosts
- improve behavioral proof for risky-action enforcement and tool approval flows

### Runtime

- keep MCP/auth, readiness, and payload support as explicit internal subcontracts
- improve auth translation, especially where templated headers, env-backed headers, OAuth-first remotes, or local bootstrap logic diverge
- keep installed env parity, runtime launchability, and runtime payload checks strong across all four hosts
- continue proving local stdio packaging and long-lived runtime behavior in installed state

### Distribution

- keep identity, branding, install surface, and publish surface clearly modeled
- improve install/update/reload guidance and plugin discovery clarity per host
- keep branded metadata completeness surfaced early
- continue tightening install and publish UX so shipping feels routine, not fragile

## Execution Order

This is the recommended order for finishing the initiative:

1. canonical primitive depth
2. shared translation truth
3. behavioral proof over shape proof
4. import quality before `migrate` ambition
5. authoring simplicity and front-door clarity
6. plugin-guided average-user path
7. host-asymmetry honesty as a constant rule across every other workstream

Within the primitives, the current highest-signal order remains:

1. hooks
2. agents
3. instructions
4. runtime
5. skills
6. commands
7. permissions
8. distribution

## Success Checks

Use these questions to evaluate whether the initiative is actually working:

- can a sophisticated example be authored once without host-local patch files for common cases?
- does the canonical model explain more than the generators do?
- do the examples prove installed behavior instead of just shaped output?
- do `lint` and `doctor` explain the same reality that the generators implement?
- are import and autopilot outputs getting closer to final-quality plugin shape?
- can a new maintainer understand what Pluxx wants them to author?
- can an average user succeed through the plugin layer without needing expert-only context?

If the answer to any of those is still “not reliably,” this initiative is not done.
