---
name: pluxx-bootstrap-runtime
description: Install, upgrade, or validate the local Pluxx CLI runtime before running deeper workflows.
---

# Pluxx Bootstrap Runtime

Use this skill when the machine is missing `pluxx`, is on a stale version, or when the user wants the smoother local operator path instead of relying on `npx` every time.

## Workflow

1. Detect the current runtime:
   - `pluxx --version`
   - or `npx @orchid-labs/pluxx --version` when local `pluxx` is missing
2. If `pluxx` is missing, explain the best install path:
   - `npm install -g @orchid-labs/pluxx@latest`
3. If `pluxx` is present but stale, prefer:
   - `pluxx upgrade`
   - or `pluxx upgrade --version x.y.z`
4. Explain when `npx @orchid-labs/pluxx` is the better fallback:
   - ephemeral use
   - no global install desired
   - locked-down machine
5. After bootstrapping, point to the next sensible workflow:
   - import
   - migrate
   - build and install
   - troubleshoot install

## Rules

- Do not hide the difference between a global install and an `npx` fallback.
- Prefer `pluxx upgrade` over repeating raw npm commands when the CLI already exists.
- If Node or npm is missing, say that clearly instead of pretending Pluxx can self-install without it.
- If the host plugin is present but the underlying CLI is missing, call that out directly as a runtime prerequisite problem.

## Output

- Say whether `pluxx` is already available.
- Return the exact next command.
- Explain whether a global install or `npx` is the better fit.
