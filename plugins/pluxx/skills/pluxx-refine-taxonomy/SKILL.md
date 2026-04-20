---
name: pluxx-refine-taxonomy
description: Improve Pluxx skill grouping without breaking managed sections.
---

# Pluxx Refine Taxonomy

Use this skill when the initial MCP scaffold is valid but the generated skills are too lexical, too fragmented, or not aligned with the product.

## Workflow

1. Refresh the agent pack:
   - `pluxx agent prepare`
   - add `--website`, `--docs`, or `--context` when useful
2. Generate the taxonomy prompt pack:
   - `pluxx agent prompt taxonomy`
3. Prefer runner mode when available:
   - `pluxx agent run taxonomy --runner codex`
   - `pluxx agent run taxonomy --runner claude`
   - `pluxx agent run taxonomy --runner opencode`
4. Keep changes inside:
   - the generated block in `INSTRUCTIONS.md`
   - the generated block in each `skills/*/SKILL.md`
5. Re-run:
   - `pluxx lint`
   - `pluxx test`

## Rules

- Preserve all custom-note blocks.
- Do not rewrite auth wiring or target config while refining taxonomy.
- Favor a small set of product-shaped skills over one skill per tool when the MCP represents real workflows.
- Avoid misleading labels and merge tiny singleton/admin-only skills unless they represent a real standalone workflow.
- Keep setup/onboarding, account-admin, and runtime workflows separated when appropriate.
- If the grouping is already good enough, say so instead of churning files.

## Output

- Explain what changed in the taxonomy and why.
- Call out any remaining weak buckets or follow-up work.
