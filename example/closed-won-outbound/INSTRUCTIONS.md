## Closed-Won Outbound Example

Use this plugin when the user wants to turn existing closed-won CRM truth into a net-new outbound pipeline.

This is a workflow example, not a generic tool dump.

The expected operator path is:

1. pull closed-won accounts or deals from the source of truth
2. select or score a best-customer seed cohort
3. find lookalike companies
4. map the right personas
5. deduplicate against CRM state
6. enrich the remaining accounts and contacts
7. upsert the result into a campaign-tagged outbound pipeline
8. produce a concise operator handoff

## What This Example Is Proving

This example is meant to prove that Pluxx can express:

- a higher-value GTM workflow
- multiple specialist agents
- multiple MCP groups
- stateful artifact handoff
- explicit native-vs-adapter boundaries

It is not claiming that every backing integration is already live in this repo.

## MCP Grouping

Treat the runtime as five operator-facing groups:

- `crm.*`
  closed-won input, CRM lookup, dedupe context
- `lead.*`
  lookalikes, personas, contact discovery, enrichment
- `research.*`
  website, product, hiring, and public context validation
- `pipeline.*`
  campaign tagging, prospect staging, handoff queue writes
- `runtime.*`
  artifacts, checkpoints, and operator-facing summaries

If a real provider stack splits those differently, preserve the same workflow boundaries in the user-facing plan.

## Workflow Rules

- Start from closed-won truth, not from generic top-of-funnel search.
- Do not jump from one good customer to a giant list of unqualified companies.
- Make the seed cohort logic explicit before generating lookalikes.
- Treat dedupe as a real workflow stage, not a cleanup detail at the end.
- Validate persona and company fit before enrichment when public signals are weak.
- Keep campaign tags, source notes, and exclusion reasons attached to the final handoff.
- If a provider adapter is missing, say which boundary is missing instead of pretending the workflow is end to end.

## Output Rules

A strong result from this plugin should leave the operator with:

- the selected seed cohort and why it was chosen
- the lookalike criteria used
- the persona target and exclusions
- the deduped and enriched pipeline count
- the exact remaining gaps or adapter dependencies
- a compact handoff summary
