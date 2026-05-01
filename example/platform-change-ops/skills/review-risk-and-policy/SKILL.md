---
name: review-risk-and-policy
description: Review the current risk, approvals, and policy state before any execute-lane action.
when_to_use: Use before merge, publish, rollout, stakeholder send, or rollback work.
arguments: [change-id]
argument-hint: [change-id]
disable-model-invocation: true
allowed-tools: Read Bash(node scripts/risk-score.mjs *) MCP(linear.list_issues) MCP(datadog.query_metrics) MCP(changeops-local.readiness_status)
model: inherit
effort: high
agent: policy-auditor
---

# Review Risk And Policy

This is the main mutation gate.

## What To Load

- Policy notes: [references/policy-review-checklist.md](references/policy-review-checklist.md)

## Workflow

1. Confirm readiness gates are satisfied or explain why not.
2. Review the service-health snapshot, change ticket state, and change-window posture.
3. List:
   - blocking evidence gaps
   - missing approvals
   - safest next step
4. Only route to `publish-docs-or-release`, `announce-rollout`, or `rollback-change` after the gate is explicit.
