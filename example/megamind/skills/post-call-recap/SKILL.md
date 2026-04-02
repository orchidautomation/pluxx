---
name: post-call-recap
description: Use when the user wants a post-call recap, call summary, follow-up draft, next steps list, or Slack-ready recap from the latest Megamind call data.
---

# Megamind Post-Call Recap

Generate a post-call recap from the latest Megamind transcript, recent Slack context, and any extra user context.

## Workflow

1. Identify the client.
2. Pull in parallel:
   - `get_client_pulse(client_id, days=3)`
   - `get_messages(client_id, days=3)`
3. Fetch the most recent call transcript with `get_call_transcript(call_id)`.
4. If multiple same-day calls exist, fetch them all in parallel and use the most complete one.
5. Ask the user for any missing offline context before drafting.
6. Produce a recap with Summary and Next Steps.

## Output Rules

- Use the client's own terminology when possible.
- Keep bullets short and specific.
- Cross-reference Slack for names, deliverables, and prior context.
- Assign clear ownership in Next Steps when the transcript supports it.
