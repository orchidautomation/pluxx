# Docs Ingestion Scaffold Before/After

Last updated: 2026-04-23

## Doc Links

- Role: visible docs-ingestion proof asset
- Related:
  - [firecrawl-connector-docs-ingestion-proof.md](./firecrawl-connector-docs-ingestion-proof.md)
  - [docs-ingestion-fixture-eval.md](./docs-ingestion-fixture-eval.md)
  - [docs-url-ingestion.md](./docs-url-ingestion.md)
  - [first-proof-demo-asset-pack.md](../first-proof-demo-asset-pack.md)
  - [docs/start-here.md](../start-here.md)
  - [docs/todo/queue.md](../todo/queue.md)
  - [docs/todo/master-backlog.md](../todo/master-backlog.md)
- Update together:
  - [firecrawl-connector-docs-ingestion-proof.md](./firecrawl-connector-docs-ingestion-proof.md)
  - [docs/start-here.md](../start-here.md)
  - [docs/todo/queue.md](../todo/queue.md)
  - [docs/todo/master-backlog.md](../todo/master-backlog.md)
  - [docs/roadmap.md](../roadmap.md)

This is the missing visible proof for the docs-ingestion lane.

It shows one scaffold rebuilt from the same MCP metadata twice:

1. baseline, with no sourced docs context
2. Firecrawl-enriched, with sourced website/docs context folded back into the deterministic scaffold

The goal is simple:

> Prove that docs ingestion changes real scaffold output, not just internal eval rows.

## Why This Demo Uses Stored MCP Metadata

This demo intentionally holds the MCP surface constant.

Instead of depending on a fresh live Sumble auth flow, it reuses the MCP scaffold metadata already captured in:

- [`example/sumble-plugin/.pluxx/mcp.json`](../../example/sumble-plugin/.pluxx/mcp.json)

That means the only thing changing here is the sourced docs context.

The docs inputs are still live:

- website: `https://sumble.com`
- docs: `https://docs.sumble.com/api/mcp`
- provider: `firecrawl`

## Reproduce

```bash
FIRECRAWL_API_KEY=... npm run demo:docs-ingestion
```

That command runs:

- [`scripts/generate-docs-ingestion-demo.ts`](../../scripts/generate-docs-ingestion-demo.ts)

and rewrites the committed demo artifacts under:

- [`docs/strategy/docs-ingestion-sumble-demo/`](./docs-ingestion-sumble-demo/)

## Captured Artifacts

```text
docs/strategy/docs-ingestion-sumble-demo/
  baseline-INSTRUCTIONS.md
  firecrawl-INSTRUCTIONS.md
  baseline-pluxx.config.ts
  firecrawl-pluxx.config.ts
  sources.json
  docs-context.json
```

Concrete files:

- [baseline-INSTRUCTIONS.md](./docs-ingestion-sumble-demo/baseline-INSTRUCTIONS.md)
- [firecrawl-INSTRUCTIONS.md](./docs-ingestion-sumble-demo/firecrawl-INSTRUCTIONS.md)
- [baseline-pluxx.config.ts](./docs-ingestion-sumble-demo/baseline-pluxx.config.ts)
- [firecrawl-pluxx.config.ts](./docs-ingestion-sumble-demo/firecrawl-pluxx.config.ts)
- [sources.json](./docs-ingestion-sumble-demo/sources.json)
- [docs-context.json](./docs-ingestion-sumble-demo/docs-context.json)

## What Changed

### 1. The Scaffold Description Became Product-Shaped

Baseline:

```md
Sumble plugin scaffold for account research and contact discovery workflows.
```

Firecrawl-enriched:

```md
Sumble provides account intelligence data, enabling sales teams to do deep research. Use it to better inform your targeting and outreach.
```

This is the main front-door improvement: the scaffold stops sounding like generic generator output and starts sounding like the actual product.

### 2. `INSTRUCTIONS.md` Gained Real Sourced Context

Baseline `INSTRUCTIONS.md` has workflow and tool routing, but no product/docs-derived context block.

Firecrawl-enriched `INSTRUCTIONS.md` adds:

```md
## Sourced Context

- Workflow hints: Tech stack | Active projects | Org structure | Company and people profiles | Access Sumble your way | Sumble Web | Sumble Signals | Sumble Enrich
- Setup hints: Run the following command in your terminal to install the MCP claude mcp add --transport http sumble https://mcp.sumble.com --scope user | Complete auth and the MCP will be successfully setup
- Auth hints: Complete auth and the MCP will be successfully setup
```

That is the visible proof that sourced docs context is making the deterministic scaffold more operational, not just more verbose.

### 3. Provenance Artifacts Show Exactly What Fed The Improvement

The generated provenance files are committed too:

- [sources.json](./docs-ingestion-sumble-demo/sources.json) records the exact URLs that were selected
- [docs-context.json](./docs-ingestion-sumble-demo/docs-context.json) records the extracted product name, short description, workflow hints, setup hints, and auth hints

On the current Sumble demo run, the selected inputs are intentionally small:

- `https://sumble.com`
- `https://docs.sumble.com/api/mcp`
- `https://docs.sumble.com/`

That keeps the proof legible and avoids turning the demo into crawl exhaust.

## What This Proves

The repo can now honestly claim:

- docs ingestion has a real scaffold-quality before/after demo
- the improvement is visible in committed scaffold files, not only in eval output
- the demo is reproducible from a committed MCP metadata snapshot plus live docs inputs
- Firecrawl-backed ingestion improves both the top-line product description and the setup/auth/workflow guidance that lands in `INSTRUCTIONS.md`

## Honest Boundary

This is still a scoped proof, not the final state of the feature.

It does **not** prove:

- that every docs surface produces equally strong improvements
- that live authenticated MCP import plus docs ingestion has been fully productized for every vendor
- that the weak fixture cases are solved

It **does** prove the product claim that mattered most:

> Docs ingestion now changes a real Pluxx scaffold in a way a user can see.

## Next Work After This Demo

The next docs-ingestion work should focus on:

1. improving the weak fixtures exposed by the eval harness
2. tightening workflow/setup/auth extraction further
3. deciding whether docs ingestion remains a context-prep layer or grows into a more explicit scaffold-comparison product surface
