# Portable Delegation Model

This document defines the truthful portable subset of agent and subagent delegation that Pluxx should preserve across the core four:

- Claude Code
- Cursor
- Codex
- OpenCode

The goal is not to invent a universal multi-agent runtime.

The goal is to preserve the author's specialist intent and re-express it in the strongest native surface each host supports.

## Canonical Delegation Fields

These fields are the portable subset Pluxx should understand canonically:

| Canonical field | Meaning |
|---|---|
| `mode: subagent` | this specialist is intended for delegated execution rather than as the default top-level worker |
| `hidden: true` | this specialist should stay out of the main user-facing surface where the host supports that distinction |
| `model` | preferred model for the specialist |
| `model_reasoning_effort` | preferred reasoning depth where the host supports it |
| `sandbox_mode` | stronger execution isolation when the host supports it |
| `permission.edit` | whether the specialist should stay read-only or may edit files |
| `permission.bash."*"` | whether the specialist should avoid, ask for, or allow shell execution |
| `permission.task."*"` | whether the specialist may delegate further subtasks |

## Mapping Rules

| Intent | Claude Code | Cursor | Codex | OpenCode |
|---|---|---|---|---|
| delegated specialist | preserve in native agent frontmatter | translate into Cursor subagent markdown plus behavioral guidance | translate into native `.codex/agents/*.toml` plus developer-instruction guidance | preserve in native `config.agent` definitions |
| hidden delegated specialist | preserve where supported | translate into body guidance because Cursor does not expose the same hidden flag in subagent frontmatter | translate into developer-instruction guidance | preserve in native `hidden` config |
| no further delegation | preserve where supported | translate into explicit subagent note | translate into developer-instruction note | preserve in native `permission.task` |
| read-only specialist | preserve where supported | translate into explicit subagent note | translate into developer-instruction note | preserve in native `permission.edit` |

## Portable Guarantees

Pluxx should guarantee:

1. `mode: subagent` is never silently dropped.
2. `permission.task."*"` is always preserved either natively or as explicit behavioral guidance.
3. `hidden: true` is preserved natively where possible and translated into specialist guidance otherwise.
4. a migrated specialist remains understandable as a delegated worker on every core host, even when the exact syntax differs.

## Non-Goals

Pluxx should not:

- promise that every host exposes identical delegation controls
- emulate unsupported orchestration semantics in userland hooks
- treat raw source-host frontmatter as portable truth without translation

## Practical Compiler Rule

When a host lacks a direct delegation field, Pluxx should:

1. preserve the specialist itself
2. keep the specialist discoverable in the host's native surface
3. inject explicit behavioral guidance that carries the lost delegation intent

That is a truthful translation.
