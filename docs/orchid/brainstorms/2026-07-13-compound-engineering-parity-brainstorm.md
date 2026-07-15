---
title: Compound Engineering Primitive Parity - Brainstorm
type: research
date: 2026-07-13
artifact_contract: ce-brainstorm/v1
artifact_readiness: requirements-complete
product_contract_source: linear-pluxx-323
execution: docs-only
---

# Compound Engineering Primitive Parity - Brainstorm

## Goal Capsule

Use Every's Compound Engineering plugin as a real-world pressure test for the Pluxx author-once promise:

> A plugin author should be able to maintain operational intent once and compile the strongest honest version for every Pluxx target.

This is a docs and investigation tranche. It does not authorize compiler implementation or a host expansion.

## The Product Pressure

Compound Engineering 3.19.0 is not primarily a collection of standalone custom agents. It is a coordinated system of:

- 30 user-facing skills
- skill-local specialist prompt assets
- generic subagent dispatch
- host-specific capability selection and fallback
- task and user-input coordination
- scratch and durable artifact contracts
- chained workflows and lifecycle modes
- tests, install adapters, and release validation

The installed Codex version launches delegated specialists reliably. That success is the baseline Pluxx must preserve.

Pluxx can already copy the complete Compound Engineering skill tree into every current target. That is useful, but it is not the same as understanding or compiling the behavior. The skill prose already knows how to invoke Codex's generic `spawn_agent` primitive; Pluxx presently transports that prose and its prompt assets unchanged.

## Core Finding

Pluxx currently conflates two different concepts under the broad idea of "agents":

1. **Standalone agent definitions**: named, independently discoverable agent files with model, sandbox, permission, and runtime configuration.
2. **Delegated workflow orchestration**: a skill dynamically launches generic subagents, supplies specialist prompts, coordinates fan-out, waits, follow-ups, synthesis, fallbacks, and cleanup.

Compound Engineering uses the second pattern heavily and currently ships zero standalone agents. Pluxx models the first pattern materially better than the second.

The resulting product gap is not "Codex cannot launch agents." Codex can, and Compound Engineering proves it. The gap is:

> Pluxx cannot yet recover, represent, translate, explain, or behaviorally prove the orchestration intent that makes those launches reliable.

## Accepted Product Model

Treat orchestration as a distinct canonical compiler bucket instead of overloading `agents`.

### Runtime components

- `instructions`
- `skills`
- `commands`
- `agents` for standalone/custom agent definitions
- `hooks`
- `permissions`
- `runtime`
- `distribution`

### Accepted ninth bucket

- `orchestration`
  - skill-owned specialist roles and prompt assets
  - discovered versus graph-reachable role assets and orphan reporting
  - generic subagent dispatch
  - fan-out and concurrency intent
  - isolation, depth, and cleanup
  - wait, follow-up, cancellation, and synthesis
  - role input/output contracts
  - skill-to-skill routing and workflow graphs
  - execution-engine choice: inline/subagent, goal mode, or dynamic workflow
  - task/goal tracking
  - per-dispatch child-environment inheritance and override
  - blocking user input
  - long-running watch/monitor loops
  - lifecycle events, re-injection guarantees, and idempotency
  - host capability probing and fallback
  - headless, pipeline, autonomous, and return-to-caller modes

Brandon accepted this direction on 2026-07-14 after Hyperframes and Superpowers confirmed the same boundary through typed artifact pipelines, lifecycle activation, durable progress, and review loops. The canonical product model now has nine buckets. Implementation remains pending, so current compiler behavior must still be described as eight implemented buckets plus one accepted, unshipped bucket.

## Three Approaches Considered

### A. Keep orchestration in prose

Continue copying complete skill directories and rely on plugin authors to write host-aware branches inside each skill.

Advantages:

- lowest compiler complexity
- preserves Compound Engineering's current Codex behavior
- no schema migration

Costs:

- "author once" becomes "author every host inside one file"
- Pluxx cannot validate unsupported tool names or missing fallbacks
- migrate cannot recover orchestration relationships
- compatibility reports can claim packaging success without behavior parity
- every plugin author reinvents the same host adapter layer

Conclusion: acceptable as an explicit passthrough escape hatch, not as the long-term product contract.

### B. Extend the existing agents bucket

Add generic dispatch, prompt assets, and workflow relationships to the current agent IR.

Advantages:

- smaller public taxonomy change
- reuses existing agent translation and proof work

Costs:

- preserves the conceptual confusion between standalone agents and dynamic subagent workflows
- makes host capability fallback and workflow state awkward agent fields
- risks turning `agents` into a catch-all orchestration system

Conclusion: viable implementation shortcut, weak product model.

### C. Add an orchestration bucket

Model workflow coordination separately and reference skills, commands, specialist roles, and runtime capabilities from it.

Advantages:

- matches Compound Engineering's actual architecture
- keeps standalone custom agents truthful
- creates one home for cross-host capability adapters
- supports validation, degradation reporting, migration, and behavioral proof
- can preserve opaque prompt assets while compiling the relationships around them

Costs:

- new schema and translation registry
- more migration and proof work
- host capabilities differ enough that some targets will remain best effort

Conclusion: recommended.

## Best-Effort Compilation Contract

"Best effort" should not mean "the build emitted files." For every supported host and orchestration field, Pluxx should report one of:

- `preserve`: native host behavior carries the intent directly
- `translate`: Pluxx maps the intent to a different native surface
- `degrade`: Pluxx emits a documented fallback with known loss
- `drop`: no safe representation exists; output and validation say so explicitly

A target is only behavior-proven when a maintained workflow exercise shows the expected delegation and synthesis result in the real host. Byte-preserved skill trees and fixture-only builds are packaging evidence, not runtime parity.

## Canonical Intent Versus Opaque Content

Pluxx does not need to understand every sentence in a specialist prompt. It should understand the operational relationships around that prompt.

Canonical intent should include:

- role identity and purpose
- owning skill or workflow
- prompt-asset path
- dispatch conditions
- required capabilities
- input and output contract
- parallel/sequential grouping
- isolation and model tier preferences
- failure and fallback policy
- synthesis owner
- execution engine and return/tail ownership

Prompt prose, examples, references, and domain judgment can remain authored content.

## Host Portfolio Implication

Compound Engineering and Pluxx overlap on Claude Code, Cursor, Codex, OpenCode, GitHub Copilot, and Cline. Compound Engineering also supports Kimi, Grok, Devin, Factory Droid, Qwen, Pi, and Antigravity. Pluxx additionally targets OpenHands, Warp, Gemini CLI, Roo Code, and Amp.

This audit does not recommend blindly adding every Compound Engineering destination. It recommends separating two decisions:

1. Can Pluxx compile orchestration honestly for its current 11 targets?
2. Which missing host families deserve a first-class target based on product demand and native capability?

Antigravity versus the existing Gemini CLI target deserves a dedicated provider-strategy review because Compound Engineering documents Antigravity as the successor path while Pluxx still treats Gemini CLI as a beta generator.

## Scope Boundaries

In scope:

- current Compound Engineering source and installed Codex package
- all 11 Pluxx targets
- canonical primitive taxonomy and missing primitive candidates
- import/migrate fidelity
- preservation, translation, degradation, and proof boundaries
- docs and Linear scoping

Out of scope:

- compiler or schema implementation
- adding new Pluxx targets
- modifying Compound Engineering
- publishing, installing, or replacing the user's working plugin
- claiming runtime parity from generated-file inspection

## Decision and Next Step

`orchestration` is approved as a distinct compiler bucket. The first implementation tranche should define the minimal host-neutral contract against three fixtures before adding fields opportunistically: CE delegation, Hyperframes artifact-driven workflows, and Superpowers lifecycle/review orchestration.

## Related Artifacts

- [Primitive audit and requirements](../requirements/2026-07-13-compound-engineering-primitive-audit.md)
- [Comparative orchestration patterns](../requirements/2026-07-14-orchestration-reference-patterns.md)
- [Accepted orchestration decision](../decisions/2026-07-14-orchestration-primitive.md)
- [Phased parity plan](../plans/2026-07-13-compound-engineering-parity-plan.md)
- [PLUXX-323](https://linear.app/orchid-automation/issue/PLUXX-323/audit-compound-engineering-plugin-primitives-and-cross-host-pluxx)
- [Every Compound Engineering plugin](https://github.com/EveryInc/compound-engineering-plugin)
- [HeyGen Hyperframes](https://github.com/heygen-com/hyperframes)
- [obra/superpowers](https://github.com/obra/superpowers)
- [Codex subagent configuration](https://learn.chatgpt.com/docs/agent-configuration/subagents?surface=app)
