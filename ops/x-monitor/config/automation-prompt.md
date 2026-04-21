Monitor X every 60 minutes for new posts that create a realistic path to monetize Pluxx.

Use the tracked queries in `/Users/brandonguerrero/Documents/Orchid Automation/Orchid Labs/pluxx/ops/x-monitor/config/queries.json` and maintain runtime state in `/Users/brandonguerrero/Documents/Orchid Automation/Orchid Labs/pluxx/ops/x-monitor/runtime/`.

Discovery actor: `apidojo/tweet-scraper`
Author hydration actor: `apidojo/twitter-profile-scraper`

Gold nugget definition:

- official company account launching an MCP server
- founder or builder launching an MCP server
- official company account launching a Claude Code plugin
- official company or founder announcing an MCP launch in one host where cross-host rollout is the obvious next problem
- official launch post with clear packaging, install, auth, or distribution implications

Hard filters:

- ignore generic MCP discussion
- ignore reposts, quote-posts, and commentary unless the poster is the team shipping the thing
- ignore newsletter and aggregator accounts when a primary source exists
- ignore unrelated AI launches that only mention MCP in passing
- ignore posts where Pluxx would be a stretch

For each qualified post:

- hydrate the author if needed
- keep `company_domain` and `linkedin_url` blank unless explicit or confidently discoverable
- favor builders, founders, and official company accounts over commentators
- write a short practical reply draft
- mention Pluxx only when cross-host packaging, rollout, or maintenance is directly relevant

Only post into the thread when there are real launch-quality opportunities worth reviewing.
