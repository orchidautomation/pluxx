---
description: Get a client health snapshot from Megamind (synced Slack + Fathom data)
argument-hint: "[client|all] [days:14]"
---

Get a client pulse from Megamind. Pass a client slug or use "all" for a cross-client summary.

Arguments: $ARGUMENTS
- args[0] = client_id (default: omit for cross-client summary)
- args[1] = days (default: 14)

## Workflow

1. If a client is specified, start with `get_client_pulse(client_id, days=14)`.
2. In parallel, fetch every transcript and the full Slack history.
3. Return: health assessment, wins, risks, unanswered items, next actions.

If the argument is `all` or omitted, produce a ranked cross-client summary.
