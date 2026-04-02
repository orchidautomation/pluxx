---
name: daily-update
description: Use when the user wants a daily update, standup, Done/Doing/Blockers draft, or Slack-ready client status update from Megamind data.
---

# Megamind Daily Update

Draft a clean client update from Megamind data plus any user-supplied context.

## Workflow

1. Identify the client.
2. Default to a concise Slack-ready format unless the user asks for a different one.
3. Pull:
   - `get_client_pulse(client_id, days=7)`
   - `get_messages(client_id, days=7)`
4. For any calls that happened today, fetch each transcript with `get_call_transcript(call_id)` in parallel.
5. Ask the user if they want to add any context that would not appear in Slack or Fathom.
6. Draft the update.

## Output Rules

- Organize the draft as Done, Doing, and Blockers.
- Keep bullets concrete and specific.
- Prefer 8 to 15 words per bullet.
- If there are no blockers, write `None`.
- Skip low-value internal noise.
