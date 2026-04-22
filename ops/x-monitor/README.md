# X Monitor

Project-backed workspace for monitoring X for MCP, Claude Code plugin, and distribution signals that could turn into real revenue opportunities for Pluxx.

## Structure

- `config/queries.json`
  First-pass search queries for discovery.
- `config/automation-prompt.md`
  Prompt to paste into a Codex heartbeat automation.
- `runtime/`
  Local state written by the automation. This directory is intentionally ignored by git.

## Runtime files

The automation should create and maintain these files inside `runtime/`:

- `state.json`
  Dedupe state, last successful run timestamp, and recently seen post IDs / authors.
- `leads.csv`
  One normalized row per qualified opportunity, including lightweight website/company research.
- `events.jsonl`
  Append-only raw event log for debugging and auditability.
- `reply-drafts.md`
  Latest candidate replies for manual review.

## Lead columns

The automation should keep this CSV header order:

```csv
detected_at,post_id,post_url,post_created_at,author_handle,author_name,author_bio,author_followers,author_website,company_name,company_domain,linkedin_url,docs_url,github_url,post_text,bucket,pluxx_fit_score,monetization_angle,research_summary,pluxx_wedge,evidence_urls,reply_recommendation,reply_draft,status
```

## Recommended automation shape

- Type: `cron`
- Execution environment: `local`
- Cadence: every 4 hours
- Workspace: this repo
- Output policy: only open an inbox item when new qualified opportunities exist

## Actor split

Recommended Apify split:

- Discovery (primary, given current account access): `apidojo/tweet-scraper`
- Discovery (optional upgrade if rental access returns): `scraperx/x-twitter-posts-search`
- Author hydration: `apidojo/twitter-profile-scraper`

This split keeps the monitor reliable with the actors that currently run on the account, while still leaving room to upgrade discovery quality later.

## Quality bar

The monitor should prefer:

- official company accounts
- founders with a clear company and real website
- product builders shipping a real MCP, Claude Code plugin, skill pack, marketplace listing, gateway, or agent integration
- teams likely to need multi-host packaging, rollout, auth, install, or workflow standardization
- leads where a quick Firecrawl pass can confirm what the product does and expose a clear Pluxx wedge

The monitor should reject:

- reposts, aggregators, and ecosystem roundups
- generic MCP chatter with no company or product
- anonymous or low-context personal accounts with no company signal
- launches that are interesting but obviously not a natural Pluxx fit
