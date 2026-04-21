# X Monitor

Project-backed workspace for monitoring X for MCP launch and monetization signals that could turn into revenue opportunities for Pluxx.

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
  One normalized row per qualified opportunity.
- `events.jsonl`
  Append-only raw event log for debugging and auditability.
- `reply-drafts.md`
  Latest candidate replies for manual review.

## Lead columns

The automation should keep this CSV header order:

```csv
detected_at,post_id,post_url,post_created_at,author_handle,author_name,author_bio,author_followers,author_website,company_name,company_domain,linkedin_url,post_text,bucket,pluxx_fit_score,monetization_angle,reply_recommendation,reply_draft,status
```

## Recommended automation shape

- Type: `heartbeat`
- Destination: current thread
- Cadence: every 10 minutes
- Workspace: this repo
- Output policy: only post into the thread when new qualified opportunities exist

## Actor split

Recommended Apify split:

- Discovery: `scraperx/x-twitter-posts-search`
- Author hydration: `apidojo/twitter-profile-scraper`

This split keeps the monitor optimized for fresh search results while using a cheaper profile-oriented actor for author enrichment.
