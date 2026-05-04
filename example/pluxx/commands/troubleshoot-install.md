---
description: Diagnose why a locally installed plugin still is not visible or healthy in the host
argument-hint: "[targets or installed-path optional]"
---

Use the Pluxx install troubleshooting workflow.

Arguments: $ARGUMENTS

## What To Do

1. Use the `pluxx-troubleshoot-install` skill.
2. Start with `pluxx verify-install --target ...` for the requested host or hosts.
3. If the installed state still looks wrong, run `pluxx doctor --consumer` against the installed bundle path when that materially improves diagnosis.
4. Classify the failure clearly:
   - missing bundle
   - stale host cache or discovery state
   - missing runtime payload
   - wrong auth or runtime materialization
   - reload still required
5. Return findings before reassurance.
6. End with the smallest next step that should actually unblock the user.
