## What This Plugin Provides

- Auto-configured MCP connection to Megamind (synced Slack + Fathom data in Postgres)
- `/megamind:pulse [client]` — client health snapshot
- `/megamind:daily-update [client]` — standup generator from synced data
- `/megamind:post-call [client]` — call processing with action items and follow-up draft
- `client-intel` skill — auto-invoked when you ask about clients naturally

## Data Flow

Megamind pre-syncs data from Slack and Fathom into Neon Postgres. The MCP server exposes query tools. This plugin connects to that server.

- Slack messages: ~15 min fresh
- Fathom calls: ~60 min fresh

## Environment Variable

`MEGAMIND_API_KEY` must be set in your shell. Get a key from the Megamind admin.

## Client IDs

Case-insensitive slugs. Run `list_clients()` to discover all available clients.
