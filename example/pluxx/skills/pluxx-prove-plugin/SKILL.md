---
name: pluxx-prove-plugin
description: Prove a scaffold structurally, install it, and check real workflow behavior.
---

# Pluxx Prove Plugin

Use this skill when the user wants more than source confidence. This is the proof journey for a plugin that should be trusted in real hosts.

This workflow intentionally combines:

- deterministic validation
- build and install
- installed-state verification
- consumer diagnosis
- behavioral proof when workflow nuance matters

## Workflow

1. Start with deterministic trust:
   - `pluxx doctor`
   - `pluxx lint`
   - `pluxx eval`
   - `pluxx test`
2. Build the requested targets:
   - `pluxx build`
   - or `pluxx build --target <platforms...>`
3. If local proof matters, install:
   - `pluxx install --target <platforms...>`
   - add `--trust` when hook-enabled installs require it
4. Verify installed host state:
   - `pluxx verify-install --target <platforms...>`
5. If the install still looks wrong, diagnose the consumer bundle:
   - `pluxx doctor --consumer <installed-path>`
6. If workflow nuance matters, run behavioral proof:
   - `pluxx test --install --trust --behavioral --target <platforms...>`
7. Return:
   - what passed structurally
   - what installed successfully
   - what the host can actually see
   - what the real behavior looked like

## Rules

- Do not confuse build success with install success.
- Do not confuse install success with behavioral success.
- Findings come before reassurance.
- Prefer the guided proof path when the user wants a shareable or trustworthy result, not isolated green checks.

## Output

- Return the proof state clearly:
  - source health
  - install health
  - behavior health
- Explain the smallest sensible next step:
  - reload
  - trust hooks
  - reinstall
  - refine more
  - or publish
