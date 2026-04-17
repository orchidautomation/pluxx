# Launch Narrative And Problem Statement

Last updated: 2026-04-17

This is the canonical launch narrative for the OSS wedge.

## Core Problem (One Sentence)

MCP teams can build useful servers quickly, but shipping and maintaining official plugins across Claude Code, Codex, Cursor, and OpenCode creates ongoing packaging drift and release overhead.

## Wedge Statement (One Sentence)

Pluxx turns one live MCP into one maintained plugin source project, then compiles and validates native bundles for each major coding-agent host.

## Category Framing

Pluxx should be framed as:

- an MCP-to-plugin authoring and maintenance layer
- a cross-host plugin compiler with deterministic structure
- the OSS source-of-truth workflow for official MCP plugin distribution

Pluxx should not be framed as:

- an MCP hosting platform
- a generic AI orchestration runtime
- a spec-first SDK generator

## Differentiation vs Spec-First Tools (Speakeasy/Stainless)

Spec-first tools primarily optimize API contracts and SDK generation from specs.

Pluxx optimizes plugin authoring and maintenance for live MCP distributions:

- starts from real MCP behavior (import + sync), not only a static API contract
- produces host-native plugin bundles, instructions, and wiring for coding-agent ecosystems
- keeps one maintained source project over time instead of hand-maintaining per-host plugin repos
- combines deterministic scaffold/verification with optional host-agent semantic refinement

Concise comparison line:

> Speakeasy/Stainless help API teams ship SDKs from specs; Pluxx helps MCP teams ship and maintain official plugins across agent hosts from one source project.

## Messaging Pillars (Reusable Across Surfaces)

1. One source of truth
Pluxx replaces multi-repo plugin sprawl with one maintained project.

2. Deterministic first, AI-assisted second
Pluxx owns structure and validation; Codex/Claude refine semantics inside managed boundaries.

3. Built for real MCP operations
Import, sync, doctor, test, and build are part of one repeatable maintenance loop.

4. Cross-host distribution without drift
Generate native outputs for Claude Code, Codex, Cursor, and OpenCode from the same source.

5. OSS wedge now, trust layer later
Lead with open-source authoring leverage; expand later into hosted release confidence and distribution controls.

## Surface-Ready Variants

### Website hero line

Stop maintaining four plugin repos for one MCP.

### README positioning line

Pluxx is the MCP-to-plugin authoring and maintenance layer that keeps one source project for Claude Code, Codex, Cursor, and OpenCode.

### Social line

If your MCP is real, plugin drift is real. Pluxx keeps one source project and compiles native bundles for each host.

### Outreach line

Pluxx helps MCP teams turn one live MCP into a maintained, official multi-agent plugin distribution workflow.

## Red Lines

- Do not position Pluxx as an MCP host.
- Do not describe Pluxx as a generic no-opinion plugin framework.
- Do not lead launch messaging with monetization mechanics.
- Do not collapse Pluxx into "just another SDK generator".
