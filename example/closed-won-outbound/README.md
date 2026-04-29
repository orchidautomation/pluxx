# Closed-Won Outbound Example

This directory is a first-class Pluxx example for a higher-value GTM motion:

- closed-won deals in
- best-customer cohort selection
- lookalike company discovery
- persona mapping
- CRM dedupe
- enrichment
- CRM upsert and handoff out

It is intentionally not a thin MCP wrapper.

The point is to show that Pluxx can express a real outbound workflow from one maintained source project using:

- commands
- skills
- specialist agents
- multi-MCP wiring
- hooks
- permissions
- user config
- public-facing docs and packaging

## Why This Example Matters

The existing public examples already prove:

- hosted docs workflows with `docs-ops`
- clean-room research architecture with `exa-plugin`

This example adds a third shape:

- a concrete revenue workflow that starts from existing CRM truth and turns that into ready-to-contact pipeline

That matters because it pressure-tests whether Pluxx can model an operator workflow that is:

- stateful
- multi-system
- dedupe-sensitive
- partially adapter-driven
- valuable even before every provider integration is native

## Source Shape

The source project models these workflow entrypoints:

- `closed-won-outbound`
- `segment-best-customers`
- `find-lookalikes`
- `map-buying-committee`
- `dedupe-crm`
- `enrich-prospects`
- `stage-outbound-handoff`
- `review-workflow-gaps`

And these specialist agents:

- `cohort-analyst`
- `lookalike-analyst`
- `persona-scout`
- `dedupe-guardian`
- `enrichment-operator`
- `handoff-reviewer`

## Runtime Model

This example uses the same operator-facing MCP grouping style called out in the Linear spec:

- `crm.*`
- `lead.*`
- `research.*`
- `pipeline.*`
- `runtime.*`

Those group names are modeled directly in `pluxx.config.ts`.

Important:

- the current MCP URLs are illustrative placeholders
- this example is source-project real and buildable
- it is not yet a live provider-proof pack like `docs-ops` or the Exa example

Before shipping this against a real stack, replace the placeholder MCP URLs with actual adapters.

## Native Today Vs Adapter Gaps

Native in Pluxx today:

- source project structure
- commands, skills, and specialist agents
- multi-MCP wiring
- hooks and setup checks
- permission modeling
- user-config prompts for required auth
- brand metadata and assets
- build/install/verify surfaces

Expected as thin provider adapters:

- closed-won pull and CRM record lookup
- lookalike company discovery
- persona search and enrichment
- campaign-tagged upsert into CRM or outbound system
- artifact writeback and operator handoff

Still honest placeholders in v1:

- exact best-customer scoring heuristic
- exact Ocean-style lookalike ranking parity
- exact provider mix behind `lead.*`
- behavioral smoke against live endpoints

## Local Validation

From this directory:

```bash
node ../../bin/pluxx.js doctor
node ../../bin/pluxx.js lint
node ../../bin/pluxx.js build
```

That validates the source project and generated bundles.

Do not treat `install` or behavioral smoke as proof of the business workflow until the placeholder MCP URLs have been replaced with real adapters.
