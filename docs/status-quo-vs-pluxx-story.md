# Status Quo vs Pluxx

This is a working strategy and positioning draft for Pluxx.

The goal is to capture the full story:

- what teams had to do before
- what Pluxx changes
- why the core-four problem is real
- how the product helps at the workflow, platform, and CI layers
- which audiences may feel this pain most acutely

This document is intentionally broader than homepage copy. It should be usable as raw material for:

- launch posts
- deck narrative
- README framing
- docs positioning
- sales or partnership conversations

## One-Line Positioning

Pluxx is the cross-host compiler for agent plugins.

It lets teams import an MCP or an existing host-native plugin, normalize the author's intent into one maintained source project, and compile the best native outputs for Claude Code, Cursor, Codex, and OpenCode.

## The Problem in Plain English

Before Pluxx, a team did not really have "a plugin."

They had:

- a good plugin on one host
- three more hosts they wanted to support
- and a growing pile of translation work they had to do by hand

That translation work was rarely just file copying.

It usually meant:

- learning four extension systems
- learning four packaging surfaces
- learning four different ways of expressing commands, agents, hooks, permissions, and MCP runtime wiring
- accepting that one host would be the "real" implementation and the others would always lag behind

So the real pain was not plugin generation.

The real pain was:

- portability
- drift
- trust
- maintenance

## What Teams Had To Do Before Pluxx

If a team wanted a serious presence across Claude Code, Cursor, Codex, and OpenCode, they had to do all of the following manually.

### 1. Pick a Primary Host

Usually the team picked the host they liked best or the host they started with first:

- Claude Code
- Cursor
- Codex
- OpenCode

That host became the "real" plugin.

Everything else became a port.

### 2. Rebuild the Same Plugin Multiple Times

A workflow that looked elegant on one host often had to be manually re-expressed on the others.

Examples:

- a Claude-native command might not map cleanly to Codex
- a Claude skill-scoped tool restriction might need to become Cursor subagent behavior
- an OpenCode code-first hook might need a completely different expression elsewhere
- a Codex custom agent might need to become markdown agent guidance or a different specialist surface on another host

### 3. Relearn Runtime Wiring Per Host

The team also had to figure out:

- where MCP config belongs
- how auth is expressed
- which host supports inline auth versus platform-managed auth
- how local runtimes, scripts, and helper assets get shipped
- what install layout each host expects

### 4. Maintain Multiple Sources of Truth

Without a compiler layer, teams often ended up with:

- multiple repos
- multiple plugin folders in one repo
- copied instructions drifting apart
- copied skills drifting apart
- copied commands drifting apart
- "temporary" host hacks that became permanent

### 5. Debug Compatibility By Trial and Error

Even after the files existed, teams still had to ask:

- is the scaffold actually coherent?
- are these workflows grouped correctly?
- does this host silently ignore a field?
- did we preserve the real behavior or just the rough shape?
- is this installable, shippable, and supportable?

That is exactly the kind of slow, expensive work platform teams hate.

## Why The Core Four Problem Is Real

The fragmentation is not imagined.

The official docs make it clear that the core four are genuinely different:

- Claude Code has strong plugin-native surfaces for commands, skills, hooks, agents, and MCP
- Cursor has plugins, rules, skills, hooks, and subagents, but not the same semantics in the same places
- Codex has plugins, AGENTS.md, custom agents, hooks, and MCP, but command parity is different and some behavior lives outside the plugin bundle
- OpenCode is much more code-first for commands, hooks, runtime behavior, and agent config

So the important truth is:

Pluxx is not abstracting away four identical systems.

Pluxx is abstracting away four materially different systems that still need to preserve roughly the same user-facing workflow meaning.

## What Pluxx Changes

Pluxx introduces a compiler model between author intent and host-native output.

Instead of this:

```text
author idea -> one host-native plugin -> three manual ports
```

Pluxx changes the flow to this:

```text
MCP or host-native plugin
-> canonical Pluxx source project
-> validation + optional agent refinement
-> native core-four outputs
```

That means the source of truth becomes:

- one maintained Pluxx project
- one canonical plugin model
- one place to preserve semantic intent

Rather than:

- whichever host happened to be implemented first

## The Core Product Promise

Pluxx should let a team:

1. import an MCP or a strong single-host plugin
2. normalize the author's intent into one maintained source project
3. compile the best native outputs for Claude Code, Cursor, Codex, and OpenCode
4. make translation and degradation explicit instead of hiding them
5. validate the result repeatedly in CI and local workflows

This is a stronger promise than:

- "generate some files"

It is much closer to:

- "build once, ship honestly across the core four"

## What Pluxx Enables Operationally

### `pluxx init --from-mcp`

This is the sharpest entry path for teams with a live MCP.

It gives them:

- source scaffold
- initial workflow grouping
- baseline instructions
- host-aware structure
- native bundle targets

Instead of starting from nothing.

### `pluxx migrate`

This matters for teams that already invested heavily in one host.

It lets them say:

- "we already built this well in Claude Code"
- "we already have a Cursor-native plugin"
- "we already have a Codex or OpenCode implementation"

And then convert that into a canonical Pluxx project rather than rewriting from scratch.

That is a major adoption unlock.

### `pluxx doctor`

This is a trust tool.

It helps teams answer:

- is the source project valid?
- are the configured paths present?
- does the runtime make sense?
- what does this project still assume about its source host?

This matters because platform teams do not just want generation.

They want supportability.

### `pluxx doctor --consumer`

This is a second trust tool from the other side.

It inspects the built or installed bundle from the consumer perspective.

That is important because there are really two questions:

- is the source project healthy?
- is the thing that got installed or shipped healthy?

Pluxx gives teams both.

### `pluxx lint`

Lint is where portability becomes legible.

It helps teams see:

- host-specific incompatibilities
- non-portable fields
- degraded buckets
- warnings that should be addressed before shipping

This is especially useful for mature teams because it turns compatibility into something reviewable and enforceable.

### `pluxx eval`

`eval` is one of the most important parts of the story.

It is not just a validity check.

It is a quality gate.

It answers questions like:

- does the scaffold feel coherent?
- are the workflows grouped well?
- do the instructions explain the product clearly?
- did the migration preserve the important behavior?

This is the difference between:

- "the plugin exists"

and:

- "the plugin is actually good"

### `pluxx build`

This is the compiler step.

It takes the canonical source project and emits the best native outputs it can for:

- Claude Code
- Cursor
- Codex
- OpenCode

The important point is that `build` should not just copy files where possible.

It should:

- preserve where parity exists
- translate where a different native surface can carry the same meaning
- degrade honestly where parity does not exist
- never fake parity that is not real

### `pluxx test`

This gives teams repeatable confidence that the compiler output still works.

It matters because the real question is not:

- "did build run?"

It is:

- "did build produce something we would actually trust?"

### `pluxx agent prepare` and `pluxx agent run`

This is where Pluxx becomes more than deterministic scaffolding.

The product split is:

- deterministic structure from Pluxx
- semantic refinement from the host runner

That means:

- Pluxx owns reproducible structure
- the agent helps improve taxonomy, instructions, and overall coherence
- the team still gets a deterministic compiler underneath

This is the right split.

### `pluxx autopilot`

Autopilot matters because many teams do not want to stitch together the flow manually.

It offers a high-level path for:

- scaffold
- prepare context
- run the refinement passes
- keep the workflow moving

### `pluxx mcp proxy --record` / `--replay`

This is underrated but strategically strong.

It gives teams:

- deterministic MCP sessions
- better debugging
- repeatable CI
- a way to avoid depending on flaky or expensive live sessions during validation

This matters a lot for mature organizations.

They do not just want a nice CLI.

They want something they can operationalize.

## The Compiler Story

One of the strongest improvements in Pluxx is the shift from:

- file copier

to:

- semantic compiler

That is now grounded in the eight compiler buckets:

1. `instructions`
2. `skills`
3. `commands`
4. `agents`
5. `hooks`
6. `permissions`
7. `runtime`
8. `distribution`

And in the explicit translation modes:

- `preserve`
- `translate`
- `degrade`
- `drop`

This matters because it gives the product a truthful internal model.

Instead of pretending every host supports the same thing in the same way, Pluxx can now say:

- here is what this bucket means canonically
- here is how it maps on each host
- here is where the compiler preserves or rewrites it
- here is where fidelity is weaker

That is a much stronger product story than "we support four platforms."

## What This Means For CI/CD

Pluxx is unusually good for CI/CD because it separates:

- canonical authoring
- deterministic compilation
- validation
- optional semantic refinement

A strong CI flow can look like:

```bash
pluxx doctor
pluxx lint
pluxx build
pluxx test
pluxx eval
```

And for harder MCP cases:

```bash
pluxx mcp proxy --record tape.json
pluxx mcp proxy --replay tape.json
```

This helps teams:

- validate portability repeatedly
- verify translation behavior
- catch drift before it ships
- build trust in the plugin pipeline

For mature internal teams, this is a major selling point.

It turns plugin authoring into something closer to a build system than a pile of handcrafted adapters.

## Why This Helps Teams Specifically

Pluxx helps different teams in different ways.

### Internal AI Platform Teams

These teams care about:

- standards
- repeatability
- supportability
- CI
- policy and trust

Pluxx helps them:

- centralize plugin authoring
- standardize how plugins are built
- support multiple agent hosts without multiplying maintenance cost

### MCP Vendors

These teams care about:

- distribution
- adoption
- reach
- reducing integration burden

Pluxx helps them:

- turn one MCP into a real plugin maintenance and distribution layer
- meet users in the tools they already use
- avoid maintaining four plugin implementations by hand

### DevEx / Tooling Teams

These teams care about:

- workflow quality
- platform coverage
- internal leverage

Pluxx helps them:

- preserve a single semantic workflow model
- evolve it over time
- ship that workflow into multiple host environments

### Agencies / Consultancies

These teams care about:

- repeatable client delivery
- portability
- time-to-value

Pluxx helps them:

- standardize a plugin authoring layer across client environments
- reuse the same playbook without rewriting the same plugin logic everywhere

## Best Audience Hypothesis Right Now

The best first audience is probably not hobbyists.

The stronger first audiences are:

- internal AI platform teams at more mature organizations
- MCP vendors that want distribution across multiple agent hosts
- devtools teams building one workflow surface that needs to exist in multiple agent environments

Why:

- they already feel the multi-host pain
- they are more likely to care about validation and CI
- they value one maintained source project
- they are more likely to appreciate explicit compiler behavior than "magic generation"

The strongest emotional hook for them is probably:

- "Stop maintaining four plugin systems by hand."

Or slightly more polished:

- "Bring your best plugin from one host. Get best-native outputs on the other three."

## Mature Team Angle

If the audience is a more mature internal team, the story gets even stronger:

- Pluxx reduces duplicated platform work
- Pluxx makes compatibility legible
- Pluxx improves reviewability
- Pluxx gives them deterministic validation
- Pluxx makes plugin support less dependent on one expert who knows all four host systems

That is a serious organizational value proposition.

It is not just developer convenience.

It is:

- lower maintenance burden
- stronger internal standards
- better long-term portability

## Messaging Angles Worth Testing

### Angle 1: Cross-Host Compiler

Pluxx is the cross-host compiler for agent plugins.

Good for:

- technical buyers
- internal platform teams
- mature organizations

### Angle 2: One Maintained Source Project

Stop maintaining four drifting plugin implementations.

Good for:

- practical buyers
- vendors
- teams already feeling maintenance pain

### Angle 3: MCP Distribution Layer

Turn one MCP into a real cross-host plugin surface.

Good for:

- MCP vendors
- tool builders
- launch messaging

### Angle 4: Deterministic Structure + Agent Refinement

Let Pluxx own the structure. Let the host agent refine the meaning.

Good for:

- people who worry that "AI generation" means untrustworthy output
- teams that want reproducibility without losing semantic quality

## Good Product Truths To Keep Repeating

- Pluxx is not trying to make the hosts identical.
- Pluxx is trying to preserve intent and compile the strongest native output each host supports.
- Degradation is a product virtue when it is explicit and truthful.
- `eval` matters because validity is not the same thing as quality.
- `doctor --consumer` matters because built bundles need inspection too.
- CI support matters because mature teams need a plugin pipeline, not just scaffolding.
- MCP replay matters because deterministic debugging is part of trust.

## Things To Explore Next

- evaluate docs ingestion as a first-class input surface for `init`, `autopilot`, and `agent prepare`
- test whether the best first audience is internal platform teams, MCP vendors, or both
- decide whether launch messaging should lead with:
  - cross-host compiler
  - one maintained source project
  - MCP distribution layer
- sharpen the strongest proof example for launch:
  - Sumble
  - Firecrawl
  - PlayKit
  - LeadKit
- decide how much of the CI story should be front-and-center in public messaging versus saved for technical buyers
- explore whether "plugin supply chain" is useful language or too infrastructure-heavy

## Working Summary

The old world looked like this:

- build once on one host
- rebuild manually on the others
- accumulate drift
- debug compatibility by hand

Pluxx changes that to:

- import or scaffold once
- maintain one canonical source project
- compile honest native outputs for the core four
- validate them with deterministic tooling
- refine the semantic layer with the host agent you already use

That is the real story.
