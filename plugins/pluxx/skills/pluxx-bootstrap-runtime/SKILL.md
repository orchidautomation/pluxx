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
   - preview with `pluxx upgrade --dry-run --json`
   - report the resolved target, comparison, invocation source, and rollback command
   - obtain approval before the global npm mutation
   - run `pluxx upgrade --json` or `pluxx upgrade --version x.y.z --json`
   - verify that `activePathAfter`, `activePackageAfter`, and `activeVersionAfter` match the requested Pluxx runtime
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
- Do not execute an upgrade until the user has seen the resolved target and rollback command.
- If verification fails after npm reports success, surface the rollback command and do not claim the runtime is upgraded.
- If Node or npm is missing, say that clearly instead of pretending Pluxx can self-install without it.
- If the host plugin is present but the underlying CLI is missing, call that out directly as a runtime prerequisite problem.

## Output

- Say whether `pluxx` is already available.
- Return the exact next command.
- Explain whether a global install or `npx` is the better fit.
