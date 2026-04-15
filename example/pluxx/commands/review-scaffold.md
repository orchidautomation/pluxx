---
description: Review a Pluxx scaffold critically before shipping
argument-hint: "[focus optional]"
---

Use the Pluxx scaffold review workflow.

Arguments: $ARGUMENTS

## What To Do

1. Use the `pluxx-review-scaffold` skill.
2. Review the current scaffold critically instead of rewriting it blindly.
3. Focus on the requested area if the argument names one.
4. Use findings-first output tied to files.
5. Run `pluxx doctor`, `pluxx lint`, or `pluxx test` only when they materially improve the review.

Return concrete findings first, then a brief summary of residual risks or follow-up work.
