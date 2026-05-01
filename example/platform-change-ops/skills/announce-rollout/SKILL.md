---
name: announce-rollout
description: Draft or send rollout, incident, or rollback stakeholder updates with evidence-backed language.
when_to_use: Use after risk review when the next job is communication, not more investigation.
arguments: [audience]
argument-hint: [audience]
disable-model-invocation: true
allowed-tools: Read MCP(slack.post_message) MCP(linear.list_issues)
agent: comms-writer
---

# Announce Rollout

## Workflow

1. State what changed, why it matters, and current operator confidence.
2. Include links to tickets, PRs, incidents, and runbooks.
3. Distinguish:
   - plan
   - execution
   - rollback
4. Avoid overclaiming when rollout evidence is incomplete.
