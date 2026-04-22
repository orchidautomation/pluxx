# Orchid Read-Only Demo

Last updated: 2026-04-22

This note records the first real read-only validation of the flagship `docs-ops` example against Orchid's public Docsalot MCP surface.

## Endpoint

- MCP URL: `https://orchid-docs.docsalot.dev/api/mcp`
- Auth: none for the public read-side MCP surface

Docsalot's public docs describe hosted MCP endpoints at:

- `https://{subdomain}-docs.docsalot.dev/api/mcp`

and note that hosted MCP is only available for public documentation.

## Protocol Validation

The endpoint initialized successfully over JSON-RPC with no API key.

Observed server info:

- `name`: `orchid-docs`
- `version`: `1.0.0`
- `protocolVersion`: `2025-03-26`

The public tools exposed today are:

- `list_pages`
- `get_page`
- `search_docs`

That means the current Orchid Docsalot MCP surface is a real read-only content access layer.

It is not the write/publish surface.

## Pages Tested

The first two target pages were:

- `components/accordion`
- `components/api/response`

These map to the public URLs:

- `https://orchid-docs.docsalot.dev/components/accordion`
- `https://orchid-docs.docsalot.dev/components/api/response`

## What The MCP Returned

### `components/accordion`

The MCP returned:

- frontmatter title: `Accordions`
- description: `A dropdown component for toggling content`
- full page content including:
  - the example accordion snippet
  - props for `title`, `description`, `defaultOpen`, `icon`, and `iconType`

### `components/api/response`

The MCP returned:

- frontmatter title: `Response Types`
- description: `Display API response values`
- full page content including:
  - the `<ResponseField>` explanation
  - the example snippet
  - props for `name`, `type`, `default`, and `required`

## Immediate Rewrite Opportunities

These are content observations from the read-only pass, not published changes.

### Accordion page

Strong already:

- short and clear
- includes a concrete snippet
- prop descriptions are readable

Could be stronger:

- add one sentence explaining when to prefer `Accordion` vs `AccordionGroup`
- add a short "best for" framing before the snippet
- make the icon support guidance less buried
- consider a more product-shaped example title than `I am an Accordion.`

### Response Types page

Strong already:

- clear purpose
- simple example
- property descriptions are consistent

Could be stronger:

- explain earlier why `<ResponseField>` matters in an API docs workflow
- distinguish response-field usage from more general field-list usage
- add a slightly more realistic response example than `username`
- make "required" behavior easier to scan in the props section

## What This Proves For Pluxx

This demo proves that the `docs-ops` example is now grounded in a real public MCP surface.

It shows:

- one maintained source project can target a real Docsalot endpoint
- no API key is needed for the public read-side workflow
- the flagship example can inspect, list, and pull real pages today
- the remaining gap is not "can we read docs?" but "how do we prove rewrite/publish workflows cleanly?"

## Next Proof Steps

1. capture one before/after rewrite artifact for an Orchid page
2. decide whether that artifact should stay read-only in repo or become a true write/publish demo
3. if true publish is desired, identify the separate authenticated write path outside the public MCP surface
