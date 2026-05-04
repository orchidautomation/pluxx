---
name: pluxx-refine-plugin
description: Take a valid scaffold and turn it into a product-shaped, host-honest plugin.
---

# Pluxx Refine Plugin

Use this skill when the first scaffold exists, but it still feels too lexical, too generic, or too weak to ship as a serious plugin source.

This workflow intentionally bundles several internal stages that advanced operators may think of separately:

- context preparation
- taxonomy shaping
- instruction rewriting
- findings-first scaffold review
- host-translation review when that is the real blocker

## Workflow

1. Identify the real refinement target:
   - missing product context
   - weak taxonomy
   - generic instructions
   - host-translation confusion
   - broad scaffold quality concerns
2. If context is weak, prepare it first:
   - `pluxx agent prepare --website ... --docs ...`
3. Tighten the scaffold as one coordinated refinement pass instead of several disconnected edits.
4. Use the granular workflows only when they materially sharpen the pass:
   - `pluxx-prepare-context`
   - `pluxx-refine-taxonomy`
   - `pluxx-rewrite-instructions`
   - `pluxx-review-scaffold`
5. Re-run the smallest useful structural checks:
   - `pluxx lint`
   - `pluxx eval`
   - `pluxx test`
6. Return:
   - what changed
   - what stayed intentionally unchanged
   - what still needs proof rather than more copywriting

## Rules

- Keep the visible user job simple: “make this plugin feel real,” not “pick one of four adjacent micro-workflows.”
- Group recommendations by user job and host reality, not by file names alone.
- Do not pretend host parity where translation or degradation is the honest answer.
- If the scaffold already reads well, do not churn wording just to look busy.

## Output

- Explain the refinement pass in workflow terms, not as a file-by-file changelog.
- Call out the core-four translation story when it matters.
- Make the next step obvious:
  - prove it
  - sync later
  - or publish
