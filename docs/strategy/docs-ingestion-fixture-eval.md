# Docs Ingestion Fixture Eval

Generated: 2026-04-23T18:17:05.754Z

This snapshot compares the current sourced-context extraction paths across real MCP-shaped product fixtures.

- Firecrawl provider available: yes
- Baseline = existing scaffold context only (no website/docs inputs)
- Local = website/docs inputs through Pluxx local extraction
- Firecrawl = website/docs inputs through Firecrawl markdown extraction when a key is configured

## Current Read

- local sourced context improved the baseline on 3/3 fixtures in this snapshot
- Firecrawl remains the clearest weak case for the local OSS fallback: product name and some workflow language land, but setup/auth extraction is still weak on that JS-heavy surface
- The Firecrawl-backed path now clearly outperforms the local fallback on the Firecrawl fixture by recovering workflow, setup, and auth signals that the JS-heavy surface hides from the local extractor
- PlayKit shows the local path can still work well when the docs root exposes strong setup and product language in server-rendered HTML
- Sumble shows that even when docs-site detail is light, website + docs seeds can still recover useful product truth like product name and positioning

## Firecrawl

- Fixture kind: example-project
- Project: `example/firecrawl-plugin`
- Website: https://www.firecrawl.dev
- Docs: https://docs.firecrawl.dev/mcp-server

| Provider | Status | Matched Signals | Product | Workflow Hints | Setup Hints | Auth Hints | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| baseline | ok | 0/8 | — | — | — | — | no external sources captured |
| local | ok | 5/8 | Firecrawl | Start scraping today / Aemon powers their AI R&D agent&#x27;s web research with Firecrawl&#x27;s search and scrape. / The API to search, scrape, and interact with the web at scale. | — | — | all sources fetched successfully |
| firecrawl | ok | 8/8 | Firecrawl | Search / Scrape / Scrape a website: | No extra configuration needed — just pass the URL. / AI agents can get started using the onboarding skill at https://www.firecrawl.dev/agent-onboarding/SKILL.md which handles signup and API key creation in one smooth flow. / The skill file contains everything you need: auth setup, API usage, and all available capabilities (scrape, search, crawl, map, browse). | Fetch this skill to sign up your user, get an API key, and start building with Firecrawl. / Get an API key here / AI agents can get started using the onboarding skill at https://www.firecrawl.dev/agent-onboarding/SKILL.md which handles signup and API key creation in one smooth flow. | all sources fetched successfully |

## Sumble

- Fixture kind: example-project
- Project: `example/sumble-plugin`
- Website: https://sumble.com
- Docs: https://docs.sumble.com/api/mcp

| Provider | Status | Matched Signals | Product | Workflow Hints | Setup Hints | Auth Hints | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| baseline | ok | 0/3 | — | — | — | — | no external sources captured |
| local | ok | 3/3 | Sumble | Research primed accounts / MCP / Compatibility | The Sumble API is a RESTful service for enriching CRM data, building lead generation tools, and running market research queries. | — | all sources fetched successfully |
| firecrawl | ok | 3/3 | Sumble | hashtag Research primed accounts / hashtag Research an account / Tech stack | Run the following command in your terminal to install the MCP claude mcp add --transport http sumble https://mcp.sumble.com --scope user / Complete auth and the MCP will be successfully setup | Complete auth and the MCP will be successfully setup | all sources fetched successfully |

## PlayKit

- Fixture kind: synthetic-project
- Website: https://playkit.sh
- Docs: https://docs.playkit.sh

| Provider | Status | Matched Signals | Product | Workflow Hints | Setup Hints | Auth Hints | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| baseline | ok | 0/2 | — | — | — | — | no external sources captured |
| local | ok | 2/2 | PlayKit | Workflow Skills New / Setup Guide / Connect to Clay | Full setup guide, 24 tools reference, and troubleshooting. / Install the PlayKit plugin in one command to get 24 Clay MCP tools + 6 curated workflow skills — including /clay-doc , one command to document any Clay workflow. / Choose your client and install method. | — | all sources fetched successfully |
| firecrawl | ok | 2/2 | PlayKit | design\ workflow / Workflow SkillsNew / Not answers. Confidence. | Full setup guide, 24 tools reference, and troubleshooting. / Most users should use the plugin install above instead. / The installer reads it from your shell env and wires it into the runner — the key is never written to disk. | [mcp servers.playkit.env http headers] "X-API-Key" = "PLAYKIT API KEY" ``` / Export PLAYKIT API KEY first. | all sources fetched successfully |

