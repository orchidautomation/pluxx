---
name: docs-rollback-change
description: Prepare a rollback path for a bad docs publish or docs change. Use when the user explicitly wants recovery or rollback.
arguments: [target]
disable-model-invocation: true
---

# Docs Rollback Change

Use this skill when the task is: recover from a bad docs change safely.

## What To Load

- Recovery guidance: [references/recovery-playbook.md](references/recovery-playbook.md)

## Workflow

1. Identify the rollback target:
   - page
   - release
   - publish window
2. Describe the safest recovery path.
3. Call out what must be preserved and what can be reverted.
4. Keep the plan practical and reversible.

## Rules

- Do not rewrite history blindly.
- Do not add unrelated cleanup to a rollback.
- Keep the recovery path minimal.
