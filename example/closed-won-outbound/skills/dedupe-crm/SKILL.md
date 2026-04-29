---
name: dedupe-crm
description: "Remove accounts and contacts that already exist or should be excluded based on CRM state."
---

# Dedupe CRM

Use this skill before enrichment or handoff.

## Workflow

1. Query `crm.*` for existing account, contact, lead, and opportunity state.
2. Remove:
   - existing active pipeline
   - already-owned outbound targets
   - blocked or excluded accounts
   - duplicate contacts
3. Keep exclusion reasons attached to the result set.
4. Escalate ambiguous duplicates instead of guessing.
