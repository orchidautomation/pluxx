---
name: verify-installed-state
description: Verify the built and installed plugin state, runtime payload, and host-visible health.
when_to_use: Use when build/install/runtime drift is the concern rather than change execution itself.
arguments: [host-or-plugin]
argument-hint: [host-or-plugin]
disable-model-invocation: true
allowed-tools: Read Bash(pluxx verify-install *) Bash(pluxx doctor *) Bash(pluxx test *)
---

# Verify Installed State

Use this skill to prove that the generated host bundle still matches the intended plugin source and runtime payload.

## Workflow

1. Identify the target host or installed bundle.
2. Run the smallest useful verification path.
3. Separate:
   - source-project issues
   - installed-bundle issues
   - ambient host or environment issues
