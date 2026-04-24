# Orchid Read-Only Demo

Last updated: 2026-04-24

This note records the first real read-only validation of the flagship `docs-ops` example against Orchid's public Docsalot MCP surface.

The separate authenticated publish lane is now documented in:

- `ORCHID-AUTHENTICATED-PUBLISH-PATH.md`

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

Read-only proof artifact now captured at:

- `demo-rewrites/orchid-components-accordion.before.md`
- `demo-rewrites/orchid-components-accordion.after.md`

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
- the flagship example can also produce a concrete read-only before/after rewrite artifact on a real page
- a separate core-four build/install/verify proof now exists at:
  - `docs/docs-ops-core-four-proof.md`
- the flagship example can be installed into Codex and used against the live Orchid Docsalot MCP through the plugin surface
- the remaining gap is no longer "can we read and rewrite?" but "when do we get a real private publish sandbox to prove the authenticated authoring lane end to end?"

## Codex Installed Plugin Proof

The Codex path is now proven end to end.

Install flow:

```bash
pluxx install --target codex --trust
pluxx verify-install --target codex
```

Then, after adding the local plugin in the Codex UI, the plugin was used successfully with prompts like:

```text
Use [@docs-ops](plugin://docs-ops@local-plugins) to inspect the Orchid Docsalot surface and summarize the page at components/accordion in 3 bullets.
```

and:

```text
Use [@docs-ops](plugin://docs-ops@local-plugins) to rewrite the Orchid page at components/accordion so it has better examples and best practices, but keep it read-only.
```

That confirms:

- the generated Codex bundle installs cleanly
- the plugin appears natively in Codex
- the plugin can call the live Orchid Docsalot MCP
- the installed plugin produces useful inspect and rewrite output

For the full story, see:

- [docs/orchid-docs-ops-codex-walkthrough.md](../../docs/orchid-docs-ops-codex-walkthrough.md)

## Next Proof Steps

1. decide whether the Accordion rewrite should stay the canonical read-only proof or whether a second page should join it
2. keep the clean public-facing packaging of the flagship proof improving
3. supply a real private authoring endpoint plus credential for a safe sandbox target
4. test a true authoring publish plus rollback loop only after that private path is available
