---
name: pluxx-troubleshoot-install
description: Diagnose why a locally installed Pluxx plugin is still not visible or healthy in the target host.
---

# Pluxx Troubleshoot Install

Use this skill when the plugin already built or installed, but the host still does not look right.

## Workflow

1. Identify the host or hosts that still look broken.
2. Start with install-state proof:
   - `pluxx verify-install --target <platforms...>`
3. If the installed state still looks wrong or the user says the host UI is still stale, run deeper installed-bundle diagnosis:
   - `pluxx doctor --consumer <installed-path>`
4. Use the verification and consumer-doctor output to classify the problem:
   - bundle missing
   - stale host cache
   - stale marketplace/discovery state
   - wrong runtime/auth materialization
   - missing runtime payload
   - reload/restart still required
5. Return the smallest recovery action:
   - reload or restart the host
   - reinstall the plugin
   - reinstall with `--trust`
   - reinstall with the real env var exported
   - rebuild before reinstall

## Rules

- Findings come before reassurance.
- Do not say an install is healthy just because files exist on disk.
- Prefer `pluxx verify-install` before guessing at host state.
- Use `pluxx doctor --consumer` when it materially improves diagnosis, not as ritual.
- If you do not know the installed bundle path yet, derive it from the host target or from the verification output before guessing.

## Output

- Say what failed and in which host.
- Say whether install-state proof passed or failed.
- If consumer diagnosis ran, summarize the key finding.
- End with the smallest next step that should actually unblock the user.
