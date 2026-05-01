---
name: publish-docs-or-release
description: Gate a docs publish or release only after evidence and approvals are in place.
when_to_use: Use only when the user is explicitly in the execute lane.
arguments: [scope]
argument-hint: [scope]
disable-model-invocation: true
allowed-tools: Read Write Bash(git status *) Bash(git diff *) MCP(github.merge_pull_request) MCP(changeops-local.open_change_window)
agent: release-reviewer
---

# Publish Docs Or Release

This skill is intentionally execute-lane only.

## Workflow

1. Reconfirm the approval state and target environment.
2. Run the helper checks:
   - `scripts/assert-change-window.sh`
   - `scripts/risk-score.mjs`
3. Summarize the exact execution step and its remaining risk.
4. Stop if approval or service health is ambiguous.
