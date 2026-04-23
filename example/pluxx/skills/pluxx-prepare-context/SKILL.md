---
name: pluxx-prepare-context
description: Ingest website docs, product docs, and local context into the Pluxx agent pack.
---

# Pluxx Prepare Context

Use this skill when the user wants better semantic refinement because the default MCP scaffold does not yet have enough product context.

## Workflow

1. Identify the context sources:
   - website URL
   - docs URL
   - local context files
2. Run:
   - `pluxx agent prepare`
   - include `--website`, `--docs`, `--context`, and provider flags when they matter
3. Summarize the written artifacts:
   - `.pluxx/sources.json`
   - `.pluxx/docs-context.json`
   - `.pluxx/agent/context.md`
4. Recommend the next best pass:
   - `pluxx-refine-taxonomy`
   - `pluxx-rewrite-instructions`
   - `pluxx-review-scaffold`

## Rules

- Keep sourced context deterministic and inspectable.
- Do not pretend ingestion itself improved the scaffold; it prepares the refinement inputs.
- Call out when the ingested sources still look weak or noisy.

## Output

- Tell the user what was ingested.
- Point to the context artifacts that now exist.
- Recommend the next semantic workflow.
