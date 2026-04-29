---
name: stage-outbound-handoff
description: "Upsert the final records and stage a campaign-tagged outbound handoff."
---

# Stage Outbound Handoff

Use this skill when the deduped and enriched set is ready for the outbound system or SDR queue.

## Workflow

1. Upsert accounts and contacts through `pipeline.*` or `crm.*`, depending on the final owner system.
2. Attach the campaign tag and source notes.
3. Write or update a handoff artifact under `outbound-pipeline/`.
4. Return:
   - count of accounts
   - count of contacts
   - campaign tag
   - exclusions or manual-review items
