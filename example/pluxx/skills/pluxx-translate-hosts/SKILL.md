---
name: pluxx-translate-hosts
description: Review preserve, translate, degrade, and drop behavior across Claude Code, Cursor, Codex, and OpenCode.
---

# Pluxx Translate Hosts

Use this skill when the user needs to understand how a Pluxx source project maps into the core four.

The goal is not to promise fake parity. The goal is to preserve author intent and explain where each host gets a native surface, a translated equivalent, a weaker equivalent, or no honest equivalent.

## Workflow

1. Run or inspect current validation output:
   - `pluxx lint`
   - `pluxx build --target claude-code cursor codex opencode`
2. Review the highest-risk surface:
   - commands and argument UX
   - specialist agents/subagents
   - hooks and trust behavior
   - permissions and tool approval intent
   - MCP, auth, and runtime materialization
3. Explain the mapping by bucket:
   - instructions
   - skills
   - commands
   - agents
   - hooks
   - permissions
   - runtime
   - distribution
4. For every important caveat, classify it as:
   - preserve
   - translate
   - degrade
   - drop
5. Recommend the best source-shape fix when a degraded host could be improved by moving intent to commands, agents, permissions, hooks, or runtime config.

## Rules

- Do not flatten host-specific nuance into “supported everywhere.”
- Do not hand-edit generated `dist/` as the fix; fix the source project.
- Prefer improving source authoring shape over adding target-specific hacks.

## Output

- concise preserve/translate/degrade/drop matrix
- highest-value source-shape fix
- target-specific caveats users need to know before publishing
