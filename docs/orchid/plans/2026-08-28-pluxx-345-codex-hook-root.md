# PLUXX-345 — Codex bundled hook root resolution

## Objective

Make every Pluxx-generated Codex bundled hook command reach its bundle-owned wrapper or readiness script when `CODEX_PLUGIN_ROOT` is unset, while remaining safe when a documented root variable is valid or stale.

## Authority

- Linear issue: PLUXX-345
- Repository: `orchidautomation/pluxx`
- Base branch: `main`
- Implementation branch: `codex/pluxx-345-codex-hook-root`
- Risk: Elevated — generated cross-host hook/runtime contract

## Current failure

Codex `hooks/hooks.json` currently invokes bundle files through `${CODEX_PLUGIN_ROOT}`. Codex does not establish that variable for the shell command, so the command collapses to `/hooks/...` before the file-relative wrapper fallback can run. Current first-party Codex hook documentation instead describes `PLUGIN_ROOT` and the compatibility alias `CLAUDE_PLUGIN_ROOT` for plugin execution.

The generated wrapper also trusts a configured root without confirming it is the root containing the wrapper. A stale environment hint can therefore select the wrong bundle.

## Implementation

1. **Codex generator contract**
   - In `src/generators/codex/index.ts`, emit wrapper and readiness launch commands using the documented `PLUGIN_ROOT` contract instead of `CODEX_PLUGIN_ROOT`.
   - Build Codex wrapper scripts with `PLUGIN_ROOT` as the host root input while continuing to export Pluxx's normalized `PLUXX_PLUGIN_ROOT`.
   - Keep Claude, Cursor, and OpenCode generation unchanged.

2. **Wrapper root validation and fallback**
   - In `src/hook-command-env.ts`, derive the wrapper-relative bundle root from `import.meta.url`.
   - Accept the configured host root only when it resolves to the same bundle root that owns the wrapper; otherwise fall back to the wrapper-relative root.
   - Normalize/export `PLUGIN_ROOT` and `PLUXX_PLUGIN_ROOT` from the proven bundle root.
   - Preserve workspace-root payload/env precedence from PLUXX-344.

3. **Regression coverage**
   - Update Codex manifest expectations in `tests/build.test.ts` from `CODEX_PLUGIN_ROOT` to `PLUGIN_ROOT` for ordinary hooks, readiness hooks, matcher groups, and expanded event coverage.
   - Execute the exact generated manifest command from an unrelated workspace with the documented root variable unset.
   - Cover a valid documented root and a stale documented root; both must reach the installed wrapper and bundle command.
   - Extend focused wrapper tests in `tests/hook-command-env.test.ts` for unset, valid, and stale host-root environments without consuming hook stdin.
   - Assert non-Codex host outputs remain unchanged.

4. **Contract documentation**
   - Update `docs/runtime-contract.md` and the Codex hook row in `docs/core-four-primitive-matrix.md` to describe the documented root variable, wrapper-relative fallback, stale-hint rejection, and workspace-root separation.

## Owned paths

- `src/generators/codex/index.ts`
- `src/hook-command-env.ts`
- `tests/build.test.ts`
- `tests/hook-command-env.test.ts`
- `docs/runtime-contract.md`
- `docs/core-four-primitive-matrix.md`

## Forbidden paths

- Release/version files
- MDP or SendLens repositories/artifacts
- Installer/release publication code unless a test proves the generator fix cannot be delivered without it
- Claude, Cursor, or OpenCode generator behavior beyond regression assertions
- Linear status or release-readiness state

## Acceptance criteria

- No generated Codex bundled hook command depends on `CODEX_PLUGIN_ROOT`.
- Exact manifest commands do not collapse to `/hooks/*` or `/.codex/*` when the host root variable is absent.
- Ordinary command wrappers and readiness commands launch from an unrelated workspace.
- Unset, valid, and stale documented root-variable cases select the actual installed bundle.
- SessionStart and UserPromptSubmit command handlers exit 0 in generated behavioral fixtures.
- Hook stdin and PLUXX_HOOK_WORKSPACE_ROOT behavior remain intact.
- Claude, Cursor, and OpenCode output expectations remain unchanged.
- Runtime docs and matrix match generated behavior.

## Validation

Run in this order:

1. `npm install`
2. `npx vitest run tests/hook-command-env.test.ts tests/build.test.ts`
3. `npm run typecheck`
4. `npm run build`
5. `npm test`
6. `npm run release:check`

If the full suite or release gate fails for unrelated existing fixtures, preserve the focused passing evidence, identify the exact unrelated failure, and do not weaken tests or acceptance criteria.

## Delivery

- One commit series on `codex/pluxx-345-codex-hook-root`.
- One PR to `main`, created through Orchid Closeout's validated PR wrapper.
- Add GitHub label `ai:autofix-enabled`.
- Stop at Ready for Human; Brandon alone may merge.
