---
name: intake-change-request
description: Intake a change or incident request, gather context, and route the safest next operator step.
when_to_use: Use when a release, incident, rollback, or policy-sensitive docs change needs initial triage.
arguments: [system-or-ticket]
argument-hint: [system-or-ticket]
disable-model-invocation: true
user-invocable: true
allowed-tools: Read Grep Bash(git status *) MCP(linear.list_issues) MCP(github.get_pull_request)
model: inherit
effort: high
context: fork
agent: incident-commander
---

# Intake Change Request

Start by establishing the real unit of work:

- change request
- incident
- rollout
- rollback
- publish

## What To Load

- Triage checklist: [references/triage-checklist.md](references/triage-checklist.md)

## Workflow

1. Identify the system, ticket, PR, or release identifier.
2. Pull the current ticket and repo context before making a plan.
3. Determine whether the request is still in the investigate lane or has reached the execute lane.
4. Route to:
   - `inspect-change-surface`
   - `research-external-impact`
   - `review-risk-and-policy`
   - `rollback-change`
5. If approval or environment context is missing, call that out immediately.
