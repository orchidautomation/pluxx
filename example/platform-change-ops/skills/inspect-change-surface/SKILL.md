---
name: inspect-change-surface
description: Inspect the current blast radius across code, services, docs, and incidents.
when_to_use: Use after intake when you need the real surface area before risk review or execution.
arguments: [repo-or-service]
argument-hint: [repo-or-service]
disable-model-invocation: true
allowed-tools: Read Grep Bash(git diff *) MCP(datadog.query_metrics) MCP(pagerduty.list_incidents) MCP(runbooks.search_pages)
context: fork
agent: release-reviewer
---

# Inspect Change Surface

Map the real blast radius before proposing rollout or rollback work.

## What To Load

- Dependency map guide: [references/dependency-map-guide.md](references/dependency-map-guide.md)

## Workflow

1. Identify the affected repo, service, or docs surface.
2. Pull live health, recent incidents, and runbook references.
3. Summarize:
   - directly affected systems
   - likely downstream dependencies
   - missing visibility
4. Hand off to `review-risk-and-policy` when the surface is clear.
