---
name: client-intel
description: Auto-invoke when user asks about client status, recent activity, what happened with a client, catch me up, any updates, or references synced Slack/Fathom data. Uses Megamind MCP tools to query pre-synced data.
---

# Client Intelligence Skill

Uses Megamind MCP tools to answer client questions from synced Slack and Fathom data.

## Trigger Phrases

- "What's going on with [client]?"
- "Catch me up on [client]"
- "Any updates from [person]?"
- "What did we discuss with [client]?"
- "Search for [topic] in [client] messages"

## Tool Selection

| Question Type | Megamind Tool | Follow-up |
|--------------|---------------|-----------|
| Status overview | `get_client_pulse(client_id)` | Fetch transcripts + messages in parallel |
| Specific topic | `search_messages(query)` or `search_calls(query)` | Read results |
| Person info | `get_people(client_id)` | Contact details + engagement |
| Call content | `get_call_transcript(call_id)` | Full transcript |

## Standard Workflow

For broad client questions ("what's going on", "catch me up"):

1. `get_client_pulse(client_id)` — always start here for the index
2. In PARALLEL:
   - `get_call_transcript(call_id)` for EACH call ID returned
   - `get_messages(client_id, days)` for full Slack history
3. Synthesize all data, then answer the question

## Client IDs

Client IDs are case-insensitive slugs. Common ones: sendoso, cognition, gates.
If unsure, call `list_clients()` to discover available clients.
