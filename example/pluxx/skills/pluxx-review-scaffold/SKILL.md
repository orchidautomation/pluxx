---
name: pluxx-review-scaffold
description: Critically review a Pluxx scaffold before shipping.
---

# Pluxx Review Scaffold

Use this skill when the goal is to review a scaffold, not to rewrite it blindly.

## Workflow

1. Refresh the agent pack:
   - `pluxx agent prepare`
2. Generate or run the review prompt:
   - `pluxx agent prompt review`
   - or `pluxx agent run review --runner codex`
3. Inspect:
   - `INSTRUCTIONS.md`
   - `skills/*/SKILL.md`
   - any relevant docs/site context in `.pluxx/agent/context.md`
4. If needed, run:
   - `pluxx doctor`
   - `pluxx lint`
   - `pluxx test`

## Rules

- Findings first, ordered by severity.
- Focus on bad grouping, missing setup guidance, weak examples, and product/category mismatches.
- Keep recommendations inside Pluxx-managed boundaries unless the user explicitly asks for deeper refactors.
- If there are no findings, say that directly and note residual risks.

## Output

- Return concrete findings tied to files.
- Keep summaries brief after the findings.
