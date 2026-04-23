# Firecrawl Connector Docs Ingestion Proof

Last updated: 2026-04-23

This note captures the first real Firecrawl-backed docs-ingestion comparison on the current fixture set.

It is intentionally separate from the repeatable local harness snapshot at:

- [docs-ingestion-fixture-eval.md](./docs-ingestion-fixture-eval.md)

That fixture harness still requires a local `FIRECRAWL_API_KEY` to rerun the `firecrawl` provider path through `npm run eval:docs-ingestion`.

This proof answers a narrower question:

> If Pluxx uses real Firecrawl extraction on the current fixture surfaces, does the sourced context look materially useful?

The answer is yes.

## Method

I used the same fixture URLs defined in:

- [`scripts/evaluate-docs-ingestion.ts`](../../scripts/evaluate-docs-ingestion.ts)

Local reference point:

- [docs-ingestion-fixture-eval.md](./docs-ingestion-fixture-eval.md)

Firecrawl-backed pass:

- `firecrawl_extract` on each fixture website + docs pair
- `firecrawl_scrape` on Firecrawl's MCP page to verify the lower-level technical terms that matter for scaffold quality

This is a real Firecrawl-backed comparison, but it is not yet the same thing as rerunning the local fixture harness with a local key in the shell.

## Current Read

- Firecrawl-backed ingestion is now proven on the current fixture set.
- Sumble and PlayKit both produce clean, high-signal product/setup/auth/workflow context through Firecrawl.
- Firecrawl itself is still the hardest surface, but Firecrawl extraction clearly recovers more useful workflow and auth truth than the local fallback did on the JS-heavy page.
- The remaining gap is not "does Firecrawl help?" It is:
  - rerun the harness locally with a real key
  - turn one fixture into a visible scaffold before/after demo
  - tighten technical hint extraction so lower-level setup terms stay visible in the structured output

## Fixture Comparison

| Fixture | Local snapshot read | Firecrawl connector read | Takeaway |
| --- | --- | --- | --- |
| Firecrawl | `local` improved baseline but still landed only `2/7` expected signals, with noisy setup/workflow extraction on the JS-heavy surface | Product name, description, workflow inventory, setup path, and auth path all land more cleanly. The docs scrape also confirms technical terms like `Map`, `markdown`, `main content`, `API key`, and remote hosted MCP URL configuration. | Real improvement. Remaining work is preserving more of the low-level technical setup vocabulary in the structured hints instead of compressing it away. |
| Sumble | `local` already landed `3/3` expected signals | Firecrawl keeps `3/3` and adds cleaner setup/auth detail for Claude, Cursor, and ChatGPT custom connector flows | Stable strong case. Firecrawl preserves the useful product truth and improves the operational specificity. |
| PlayKit | `local` already landed `2/2` expected signals | Firecrawl keeps `2/2` and adds stronger Clay positioning plus clearer setup/auth detail around plugin install and Clay session-cookie flow | Stable strong case. Firecrawl improves operator-facing detail even when the base expectation set is small. |

## Captured Firecrawl Reads

### Firecrawl

Sources:

- `https://www.firecrawl.dev`
- `https://docs.firecrawl.dev/mcp-server`

What Firecrawl recovered cleanly:

- product name: `Firecrawl`
- short description: one API for searching, scraping, and interacting with the web as LLM-ready data
- workflow hints:
  - search the web and get full page content
  - scrape any URL into clean structured data
  - interact with pages
  - deep research with an agent
  - browser session management
- setup/auth hints:
  - get an API key
  - run with `npx` or global install
  - use the remote hosted URL or a local MCP server
  - configure host-specific MCP entries

Technical terms additionally verified from the scraped MCP page:

- `Map`
- `markdown`
- `main content`
- `FIRECRAWL_API_KEY`
- remote hosted MCP URL

### Sumble

Sources:

- `https://sumble.com`
- `https://docs.sumble.com/api/mcp`

What Firecrawl recovered cleanly:

- product name: `Sumble`
- short description: account intelligence for sales teams and deep research
- workflow hints:
  - tech stack and active-project discovery
  - buying-signal alerts
  - CRM enrichment
  - downstream data delivery into tools like Clay and Zapier
- setup/auth hints:
  - Claude custom connector flow
  - Cursor MCP JSON configuration
  - ChatGPT app configuration
  - auth completion and endpoint allow-access guidance

### PlayKit

Sources:

- `https://playkit.sh`
- `https://docs.playkit.sh`

What Firecrawl recovered cleanly:

- product name: `PlayKit`
- short description: the MCP that turns agents into Clay experts
- workflow hints:
  - workflow design
  - Clay table build/run/export/documentation
  - provider and integration research
  - personalized outbound copy generation
  - ICP generation
- setup/auth hints:
  - install plugin for a specific runner
  - export `PLAYKIT_API_KEY`
  - reload plugins after install where the host supports it
  - connect Clay with a session cookie
  - re-auth when the cookie expires

## What This Proves

The repo can now honestly say:

- a real Firecrawl-backed docs-ingestion comparison has been captured
- Firecrawl materially improves extracted product context on the current fixtures
- Firecrawl is especially useful for auth/setup/workflow recovery on hosted docs surfaces

The repo should not yet say:

- the local keyed harness has been rerun end-to-end
- the Firecrawl provider path has a fresh reproducible snapshot in `docs-ingestion-fixture-eval.json`
- the before/after scaffold improvement demo is already captured

## Remaining Open Work

1. Rerun `npm run eval:docs-ingestion` with a real local `FIRECRAWL_API_KEY`.
2. Capture one fixture as a visible scaffold-quality before/after artifact.
3. Tighten extraction so technical setup hints like `markdown`, `main content`, and host-specific install details survive more consistently in structured output.
