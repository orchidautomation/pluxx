---
name: pluxx-verify-install
description: Verify that an installed host bundle is actually visible and healthy.
---

# Pluxx Verify Install

Use this skill when the user wants proof that the built plugin is not just present on disk, but actually visible and healthy in the target host.

## Workflow

1. Identify the target host or hosts.
2. Run:
   - `pluxx verify-install --target <platforms...>`
3. If the installed state still looks wrong, use deeper consumer diagnosis when needed:
   - `pluxx doctor --consumer`
4. Summarize:
   - passed targets
   - failed targets
   - warnings
   - smallest next step

## Rules

- Findings come before reassurance.
- Do not confuse `build` success with install success.
- If a host needs reload, trust, or reinstall, say that explicitly.

## Output

- Return the install-state result clearly.
- Explain the smallest sensible follow-up:
  - reload host
  - trust hooks
  - reinstall
  - publish
