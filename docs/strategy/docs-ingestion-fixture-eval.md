# Docs Ingestion Fixture Eval

Generated: 2026-07-12T11:49:16.796Z

This snapshot compares the current sourced-context extraction paths across real MCP-shaped product fixtures.

- Firecrawl provider available: yes
- Baseline = existing scaffold context only (no website/docs inputs)
- Local = website/docs inputs through Pluxx local extraction
- Firecrawl = website/docs inputs through Firecrawl markdown extraction when a key is configured
- Visible scaffold delta = changed user-facing scaffold files plus added/removed lines (LCS-based)

## Current Read

- local sourced context improved the baseline on 2/3 fixtures in this snapshot
- PlayKit shows the local path can still work well when the docs root exposes strong setup and product language in server-rendered HTML
- Sumble shows that even when docs-site detail is light, website + docs seeds can still recover useful product truth like product name and positioning

## Firecrawl

- Fixture kind: example-project
- Project: `example/firecrawl-plugin`
- Website: https://www.firecrawl.dev
- Docs: https://docs.firecrawl.dev/mcp-server

| Provider | Status | Matched Signals | Visible Scaffold Delta | Product | Workflow Hints | Setup Hints | Auth Hints | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| baseline | ok | 0/8 | n/a | — | — | — | — | no external sources captured |
| local | error | 0/8 | n/a | — | — | — | — | All requested remote sources failed. seed:error (Remote fetch exceeded 1048576 byte limit..), seed:error (Remote fetch exceeded 1048576 byte limit..), inferred-root:error (Remote fetch exceeded 1048576 byte limit..) |
| firecrawl | error | 0/8 | n/a | — | — | — | — | All requested remote sources failed. seed:error 402 (Firecrawl scrape failed with 402 Payment Required.), seed:error 402 (Firecrawl scrape failed with 402 Payment Required.), inferred-root:error 402 (Firecrawl scrape failed with 402 Payment Required.) |

## Sumble

- Fixture kind: example-project
- Project: `example/sumble-plugin`
- Website: https://sumble.com
- Docs: https://docs.sumble.com/api/mcp

| Provider | Status | Matched Signals | Visible Scaffold Delta | Product | Workflow Hints | Setup Hints | Auth Hints | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| baseline | ok | 0/3 | 0 files / 0 lines | — | — | — | — | no external sources captured |
| local | ok | 3/3 | 2 files / 13 lines (INSTRUCTIONS.md, pluxx.config.ts) | Sumble | Go from signup to your first search result in minutes. / With your API key in hand, you can query Sumble's organization search endpoint. / Once you're logged in, you land on the organization search view. | Sumble is now listed in the Claude and Chat GPT app directories, so you can install it with one click on those platforms. / On Claude and Chat GPT you can install Sumble directly from the app directory. / Run the following command in your terminal to install the MCP claude mcp add --transport http sumble https://mcp.sumble.com --scope user Start Claude by running the claude command Go to /mcp and find the sumble mcp and click enter Complete auth and the MCP will be successfully setup | Go to Chat GPT settings (cmd + , on mac) Navigate to 'Apps' Click on 'Create App' Enter Name: Sumble MCP Server URL: https://mcp.sumble.com Accept conditions and continue Complete the auth flow Use Sumble MCP in your Chat GPT chat / Go to Claude web app or desktop app (if desktop app - navigate to chat on the top) Go to preferences (or cmd + ,) > Connectors -> Add a custom connector Enter Name: Sumble Remote URL: https://mcp.sumble.com Complete the auth flow Use Sumble MCP in Claude chat / Run the following command in your terminal to install the MCP claude mcp add --transport http sumble https://mcp.sumble.com --scope user Start Claude by running the claude command Go to /mcp and find the sumble mcp and click enter Complete auth and the MCP will be successfully setup | all sources fetched successfully |
| firecrawl | error | 0/3 | n/a | — | — | — | — | All requested remote sources failed. seed:error 402 (Firecrawl scrape failed with 402 Payment Required.), seed:error 402 (Firecrawl scrape failed with 402 Payment Required.), inferred-root:error 402 (Firecrawl scrape failed with 402 Payment Required.) |

## PlayKit

- Fixture kind: synthetic-project
- Website: https://playkit.sh
- Docs: https://docs.playkit.sh

| Provider | Status | Matched Signals | Visible Scaffold Delta | Product | Workflow Hints | Setup Hints | Auth Hints | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| baseline | ok | 0/2 | n/a | — | — | — | — | no external sources captured |
| local | ok | 2/2 | n/a | PlayKit | design workflow / Workflow Skills New / Knowledge Tools | Full setup guide, 25 tools reference, and troubleshooting. / Remove and reinstall claude mcp remove playkit claude mcp add --transport http playkit https://mcp.playkit.sh/mcp --header "X-API-Key: YOUR API KEY" | claude mcp add --transport http playkit https://mcp.playkit.sh/mcp --header "X-API-Key: YOUR API KEY" / { "mcp Servers": { "playkit": { "type": "http", "url": "https://mcp.playkit.sh/mcp", "headers": { "X-API-Key": "YOUR API KEY" } } } } / [mcp servers.playkit ] url = "https://mcp.playkit.sh/mcp" [mcp servers.playkit.env http headers ] "X-API-Key" = "PLAYKIT API KEY" | all sources fetched successfully |
| firecrawl | error | 0/2 | n/a | — | — | — | — | All requested remote sources failed. seed:error 402 (Firecrawl scrape failed with 402 Payment Required.), seed:error 402 (Firecrawl scrape failed with 402 Payment Required.) |

