# Docs Ingestion Fixture Eval

Generated: 2026-04-21T10:09:35.542Z

This snapshot compares the current sourced-context extraction paths across real MCP-shaped product fixtures.

- Firecrawl provider available: no
- Baseline = existing scaffold context only (no website/docs inputs)
- Local = website/docs inputs through Pluxx local extraction
- Firecrawl = website/docs inputs through Firecrawl markdown extraction when a key is configured

## Current Read

- local sourced context improved the baseline on 3/3 fixtures in this snapshot
- the Firecrawl provider path is wired into the harness but was skipped in this snapshot because no FIRECRAWL_API_KEY was configured
- Firecrawl remains the clearest weak case for the local OSS fallback: product name and auth signal land, but workflow/setup extraction is still noisy on that JS-heavy surface
- PlayKit shows the local path can still work well when the docs root exposes strong setup and product language in server-rendered HTML
- Sumble shows that even when docs-site detail is light, website + docs seeds can still recover useful product truth like product name and positioning

## Firecrawl

- Fixture kind: example-project
- Project: `example/firecrawl-plugin`
- Website: https://www.firecrawl.dev
- Docs: https://docs.firecrawl.dev/mcp-server

| Provider | Status | Matched Signals | Product | Workflow Hints | Setup Hints | Auth Hints | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| baseline | ok | 0/7 | — | — | — | — | no external sources captured |
| local | ok | 2/7 | Firecrawl | Start scraping today / Use well-known tools | Python Node.js cURL CLI Copy code 1 # pip install firecrawl-py 2 from firecrawl import Firecrawl 3 4 app = Firecrawl ( api_key = "fc-YOUR_API_KEY" ) 5 6 # Scrape a website: 7 app . / Check out our repo [ 03 / 06 ] · Features // Zero configuration // We handle the hard stuff We handle the hard stuff JavaScript rendering, smart wait, media parsing, actions, and more. | Fetch this skill to sign up your user, get an API key, and start building with Firecrawl. | all sources fetched successfully |
| firecrawl | skipped | 0/7 | — | — | — | — | FIRECRAWL_API_KEY not configured |

## Sumble

- Fixture kind: example-project
- Project: `example/sumble-plugin`
- Website: https://sumble.com
- Docs: https://docs.sumble.com/api/mcp

| Provider | Status | Matched Signals | Product | Workflow Hints | Setup Hints | Auth Hints | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| baseline | ok | 0/3 | — | — | — | — | no external sources captured |
| local | ok | 3/3 | Sumble | MCP / Compatibility / Claude instructions | — | — | all sources fetched successfully |
| firecrawl | skipped | 0/3 | — | — | — | — | FIRECRAWL_API_KEY not configured |

## PlayKit

- Fixture kind: synthetic-project
- Website: https://playkit.sh
- Docs: https://docs.playkit.sh

| Provider | Status | Matched Signals | Product | Workflow Hints | Setup Hints | Auth Hints | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| baseline | ok | 0/2 | — | — | — | — | no external sources captured |
| local | ok | 2/2 | PlayKit | Setup Guide / Quick Setup / Connect to Clay | Full setup guide, 24 tools reference, and troubleshooting. / Choose your client and install method. | claude mcp add --transport http playkit \ https://mcp.playkit.sh/mcp \ --header "X-API-Key: YOUR_API_KEY " ~/.claude.json Copy { "mcpServers" : { "playkit" : { "type" : "http" , "url" : "https://mcp.playkit.sh/mcp" , "headers" : { "X-API-Key" : " YOUR_API_KEY " } } } } Codex uses TOML config and requires API keys in environment variables. | all sources fetched successfully |
| firecrawl | skipped | 0/2 | — | — | — | — | FIRECRAWL_API_KEY not configured |

