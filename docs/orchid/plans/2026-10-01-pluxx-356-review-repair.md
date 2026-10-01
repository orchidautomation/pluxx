# PLUXX-356 post-merge OpenCode review repair

## Goal

Close confirmed source gaps from the PLUXX-355 post-merge review before any new Pluxx release. Keep the source boundary separate from release publication and downstream SendLens installation.

## Changes

1. Reject OpenCode 2 setup when event hooks request `failClosed`, because its asynchronous event subscription cannot block the triggering operation. Keep V1 and synchronous V2 tool-hook behavior.
2. Derive the release install directory from a custom OpenCode plugin root while preserving an explicit install-directory override.
3. On installer rerun, restore one legacy backup only when its bytes match the previous ownership ledger. Preserve ambiguous and modified backups for manual inspection.
4. Correct review-confirmed documentation and redundant source branches; mark the live-host-proof review comment stale based on the separate recorded 2.0.20 and 1.18.29 fixture checks.

## Verification and exit

Run build, typecheck, the OpenCode 2 fixture suite, affected generated-installer cases, and whitespace checks. Record broad-suite limitations and require PR CI/review before merge. Do not publish a Pluxx release or claim downstream SendLens parity in this issue.
