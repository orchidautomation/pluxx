---
name: research-external-impact
description: Research external vendor, dependency, or policy changes that might affect the planned rollout.
when_to_use: Use when the change depends on third-party APIs, vendor docs, or policy updates outside the repo.
arguments: [vendor-or-dependency]
argument-hint: [vendor-or-dependency]
disable-model-invocation: true
allowed-tools: Read Grep MCP(runbooks.search_pages) MCP(changeops-local.readiness_status)
agent: external-research-scout
---

# Research External Impact

Use this skill when the internal repo is not enough to assess change risk.

## Workflow

1. Identify the outside system or dependency.
2. Pull the current vendor or policy context.
3. Summarize what changed, what could break, and what evidence is still missing.
4. Feed the findings into `review-risk-and-policy`.
