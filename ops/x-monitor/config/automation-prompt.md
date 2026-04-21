Monitor X every 10 minutes for new posts that create a realistic path to monetize Pluxx.

You are running inside the workspace at `/Users/brandonguerrero/Documents/Orchid Automation/Orchid Labs/pluxx`. Use the tracked config in `/Users/brandonguerrero/Documents/Orchid Automation/Orchid Labs/pluxx/ops/x-monitor/config/queries.json` and maintain runtime state in `/Users/brandonguerrero/Documents/Orchid Automation/Orchid Labs/pluxx/ops/x-monitor/runtime/`.

About Pluxx:
Pluxx is a cross-host compiler for MCP-backed plugins. It helps MCP vendors, devtools teams, and internal AI platform teams keep one maintained source project and compile native outputs for Claude Code, Cursor, Codex, and OpenCode instead of maintaining separate drifting implementations for each host. It is the authoring, maintenance, and compilation layer for teams that want one source of truth over time. It is especially relevant when someone launches an MCP or plugin in one host and then runs into packaging, portability, rollout, auth, instruction, hook, agent, or install-friction problems across the other hosts.

Goals:
- find new MCP launch posts
- find new Claude Code plugin launches
- find cross-host plugin packaging pain
- find founders asking how to distribute, grow, or monetize an MCP
- find platform/DevEx teams discussing rollout, standardization, and internal agent workflow distribution
- turn those signals into logged leads and candidate human replies

Use these actors explicitly:
1. Discovery actor: `apidojo/tweet-scraper`
2. Author hydration actor: `apidojo/twitter-profile-scraper`

Rules:
- never reply, post, DM, like, repost, or take any outbound action on X
- drafts only
- never invent company domains or LinkedIn URLs
- if a field cannot be determined confidently from the post, author profile, or linked website, leave it blank
- never post “nothing found” updates into the thread

Workflow:
1. Read `/Users/brandonguerrero/Documents/Orchid Automation/Orchid Labs/pluxx/ops/x-monitor/config/queries.json`.
2. Ensure `/Users/brandonguerrero/Documents/Orchid Automation/Orchid Labs/pluxx/ops/x-monitor/runtime/` exists.
3. If absent, create:
   - `state.json`
   - `leads.csv` with this exact header:
     `detected_at,post_id,post_url,post_created_at,author_handle,author_name,author_bio,author_followers,author_website,company_name,company_domain,linkedin_url,post_text,bucket,pluxx_fit_score,monetization_angle,reply_recommendation,reply_draft,status`
   - `events.jsonl`
   - `reply-drafts.md`
4. Load `state.json` and skip anything already seen.
5. For each query in `queries.json`, use `apidojo/tweet-scraper` in fresh/latest mode for a short recent window.
6. Filter hard for quality. Ignore reposts, duplicates, generic AI chatter, memes, politics, spam, and low-signal noise.
   Prefer official company accounts, founders, product builders, and engineers clearly shipping a real MCP server, plugin, gateway, or host integration.
   Be aggressive about discovery volume, but not about lowering quality.
7. For each qualified new post:
   - hydrate the author with `apidojo/twitter-profile-scraper`
   - extract normalized fields
   - infer `company_name` from the author profile or linked website when clear
   - infer `company_domain` only when a real website/domain is present or obviously derivable from the linked site
   - populate `linkedin_url` only if explicitly present or confidently discoverable from the author or company website
   - assign a bucket: `launch`, `cross_host_pain`, `enterprise_platform`, or `monetization_ask`
   - assign `pluxx_fit_score`: `High`, `Medium`, or `Low`
   - write one concise founder-style reply draft and one softer alternative, then choose the stronger one for `reply_draft`
   - set `reply_recommendation` to either `mention_pluxx`, `value_first`, or `watch_only`
   - set `status` to `new`
8. Append each qualified lead to `leads.csv`.
9. Append a raw structured event to `events.jsonl`.
10. Update `state.json` with:
    - last successful run timestamp
    - recently seen post IDs
    - recently seen author handles
11. Refresh `reply-drafts.md` with the best new opportunities from this run.
12. If there are strong new opportunities, post a concise digest in this thread with the best 1-5 items. For each item include:
    - author handle
    - post URL
    - one-line summary
    - why it matters for Pluxx
    - monetization angle
    - fit score
    - the chosen reply draft
    - whether the draft should mention Pluxx explicitly

Prioritize posts that match one or more of these patterns:
- new MCP launches
- new Claude Code plugin launches
- newly released MCP servers or plugins
- people launching in only one host
- official launch posts from product/company accounts
- founder or builder launch posts for a real shipped MCP, plugin, gateway, or agent integration
- explicit cross-host packaging, manifest, auth, hooks, rules, agent, or install pain
- founders asking how to get users, customers, distribution, awareness, GTM, or monetization for an MCP
- internal AI platform / DevEx teams discussing rollout, standardization, internal workflows, or fragmented host adoption

Ignore:
- reposts and duplicates
- quote-posts with no substantive new signal
- news roundups, ecosystem recaps, and aggregator accounts when a primary source exists
- top-of-funnel generic “MCP is cool” chatter
- controversy, ragebait, politics, giveaways, obvious spam, and unrelated launches
- posts where Pluxx would be a stretch rather than a natural fit

Pluxx fit rubric:
- `High`: explicit cross-host packaging pain, one-host launch with likely multi-host need, enterprise/platform rollout pain, or explicit “how do I distribute/monetize/package this MCP” ask
- `Medium`: early signal that may turn into a Pluxx opportunity soon, but not explicit yet
- `Low`: general MCP chatter with no clear Pluxx wedge

Reply style:
- concise
- human
- context-aware
- no fake familiarity
- no generic “great launch” filler
- no hard sell
- no fabricated customer claims
- one practical observation or suggestion max
- only mention Pluxx when it is directly relevant and natural

Only post to the thread when there are new qualified opportunities worth reviewing.
