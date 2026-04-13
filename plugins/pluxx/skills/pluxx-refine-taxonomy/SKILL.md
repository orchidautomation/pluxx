---
name: pluxx-refine-taxonomy
description: Use when the user wants to improve the generated skill taxonomy for a Pluxx scaffold, merge or split skills, or make the MCP feel more product-shaped without breaking managed boundaries.
---

# Pluxx Refine Taxonomy

Use this skill when the initial MCP scaffold is valid but the generated skills are too lexical, too fragmented, or not aligned with the product.

## Workflow

1. Refresh the agent pack:
   - `bunx pluxx agent prepare`
   - add `--website`, `--docs`, or `--context` when useful
2. Generate the taxonomy prompt pack:
   - `bunx pluxx agent prompt taxonomy`
3. Prefer runner mode when available:
   - `bunx pluxx agent run taxonomy --runner codex`
   - `bunx pluxx agent run taxonomy --runner claude`
   - `bunx pluxx agent run taxonomy --runner opencode`
4. Keep changes inside:
   - the generated block in `INSTRUCTIONS.md`
   - the generated block in each `skills/*/SKILL.md`
5. Re-run:
   - `bunx pluxx lint`
   - `bunx pluxx test`

## Rules

- Preserve all custom-note blocks.
- Do not rewrite auth wiring or target config while refining taxonomy.
- Favor a small set of product-shaped skills over one skill per tool when the MCP represents real workflows.
- If the grouping is already good enough, say so instead of churning files.

## Output

- Explain what changed in the taxonomy and why.
- Call out any remaining weak buckets or follow-up work.
