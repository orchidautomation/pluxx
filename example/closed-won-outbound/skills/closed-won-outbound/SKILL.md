---
name: closed-won-outbound
description: "Run the full closed-won to lookalikes to personas to dedupe to enrich to handoff workflow."
---

# Closed-Won Outbound

Use this skill when the request is to turn existing customer truth into outbound pipeline.

## Workflow

1. Define the source of truth and seed cohort rules.
2. Pull or summarize the closed-won cohort through `crm.*`.
3. Use specialist agents when the workflow is broad enough:
   - `cohort-analyst`
   - `lookalike-analyst`
   - `persona-scout`
   - `dedupe-guardian`
   - `enrichment-operator`
   - `handoff-reviewer`
4. Keep dedupe ahead of enrichment whenever the candidate set is already large.
5. Write handoff artifacts under `outbound-pipeline/` when the result set is too large for one screen.
6. End with:
   - selected cohort
   - lookalike logic
   - persona target
   - dedupe result
   - enrichment result
   - handoff artifact or next operator step
   - exact adapter gaps
