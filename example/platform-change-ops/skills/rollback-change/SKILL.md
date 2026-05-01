---
name: rollback-change
description: Prepare the rollback sequence, required approvals, and stakeholder order for a release reversal.
when_to_use: Use when the safest next step is reversal instead of continued rollout.
arguments: [release-or-change-id]
argument-hint: [release-or-change-id]
disable-model-invocation: true
allowed-tools: Read Bash(git log *) MCP(github.get_pull_request) MCP(changeops-local.record_audit_event)
agent: rollback-planner
---

# Rollback Change

## What To Load

- Rollback playbook: [references/rollback-playbook.md](references/rollback-playbook.md)

## Workflow

1. Identify the exact artifact to reverse.
2. Confirm the latest safe known-good state.
3. Spell out:
   - rollback step
   - operator preconditions
   - comms sequence
   - post-rollback verification
4. If rollback evidence is weak, stop and say what is missing.
