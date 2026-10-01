# OpenCode 2 plugin API and installed discovery

## Intent and authority

Begin implementation for PLUXX-355 in `orchidautomation/pluxx` through one Orchid hosted agent. This is Elevated work because the generated host contract, installer, and verification all change. The agent owns only the Pluxx repository. SendLens is a read-only downstream consumer until a separate SENDOSS issue imports a released Pluxx version. Human review controls merge and release.

## Observed behavior and cause

Inspected `origin/main` at `ba697e297f556de6e22ee4b02d2a1dc7a420065d` (2026-09-30). `OpenCodeGenerator.generatePluginWrapper()` in `src/generators/opencode/index.ts` writes `opencode/index.ts` as a named `@opencode-ai/plugin` function that returns V1 `config`, tool, chat, shell, and event hooks. `buildOpenCodeEntryFile()` in `src/opencode-entry.ts` writes another named function that proxies to the bundle. `createOpenCodeInstall()` in `src/cli/install.ts` places the bundle at `~/.config/opencode/plugins/<name>/` and its wrapper at `~/.config/opencode/plugins/<name>.ts`; `verifyOpenCodeInstall()` only checks wrapper text and skill files. Consequently the host can discover two entries, and OpenCode 2.0.20 rejects each for lacking a default plugin object with `id` and `setup`; no MCP server or `setup_doctor` appears. The isolated no-key SendLens 0.1.91 reproduction and logs are recorded in PLUXX-355. Current tests (`tests/build.test.ts`, `tests/install.test.ts`, `tests/verify-install.test.ts`) assert V1 text/layout, so they cannot catch V2 load failure.

OpenCode's [V1 migration guide](https://opencode.ai/v2/docs/build/plugins/migrate-v1/) confirms V1 functions cannot run in V2, requires `Plugin.define({id, setup})`, and documents a dual V1/V2 default object for OpenCode 1.18.29+. Its [V2 plugin API](https://opencode.ai/v2/docs/build/plugins) documents `ctx.mcp.transform(editor.set)`, `ctx.command.transform(editor.add)`, domain hooks, and plugin loading from a configured path. These docs are the API source; installed CLI behavior remains to be proven.

## Outcome and boundaries

An installed Pluxx OpenCode bundle loads exactly once in OpenCode 2, registers its configured MCP server and commands, and preserves the current readiness and hook behavior where the V2 API has a documented equivalent. Preserve the existing V1 implementation for supported OpenCode 1.18.29+ through the documented dual-entrypoint shape. Do not alter other hosts, SendLens generated artifacts, customer credentials, or release publication in this issue. An older OpenCode 1.x build below 1.18.29 is outside the dual-object compatibility claim; report this clearly in diagnostics/docs.

## Contract decisions

| Dimension | Decision and reason |
| --- | --- |
| Entry API | Generate one **default** object with stable canonical plugin `id`, V2 `setup(ctx)`, and V1 `server()` compatibility. Keep V1 code in a separate generated helper, not as another host-visible plugin export. The official migration guide documents this shape. |
| Discovery | Install the bundle outside the auto-discovered `plugins/` directory and keep one thin host-visible entry in `plugins/<name>.ts`. The wrapper default-exports the bundle object. A reinstall migrates only Pluxx-owned old paths transactionally; unowned paths are preserved and produce an actionable collision error. This removes double loading and avoids relying on host deduplication. |
| MCP | Materialize the existing stdio/remote definitions and runtime env at setup, then register each via `ctx.mcp.transform` and `editor.set(name, config)`. Keep transforms synchronous and side-effect free. Missing optional credentials keep the existing no-key behavior; never print secret values. |
| Commands and agents | Register commands via `ctx.command.transform(editor.add)` and preserve canonical prompt/route semantics. V2 agent editor documented here lacks `add`; keep generated agent files/skill companion and explicitly diagnose any agent capability that cannot be represented, rather than claiming native registration. |
| Hooks and readiness | Map V1 `tool.execute.before/after` to `ctx.tool.hook`, `shell.env` to `ctx.shell.hook`, `chat.message` to the appropriate session prompt hook, instructions to context hook, and events to abortable `ctx.event.subscribe`. Preserve fail-closed/fail-open behavior, matching, order, root/workspace env, and readiness gates. If a V1 hook has no safe V2 equivalent, emit a named compatibility diagnostic before claiming parity. |
| Version selection | V2 invokes `setup`; V1 1.18.29+ invokes `server`. One object and one host-visible entry prevent simultaneous setup. Unsupported versions fail with a version-specific action, not a silent missing-MCP success. |
| Failure/retry/no-op | Registration failure surfaces as a plugin load/verify error without partial success claims. Repeat install/verify is idempotent; transactional rollback restores owned previous entry/bundle on failure. No persistent data migration is required beyond the install-path move. |
| Cross-repository order | Pluxx source PR -> merge/release -> SendLens separate issue rebuilds from exact released Pluxx version -> installs/tests SendLens artifact. PLUXX-355 grants no SendLens writes. |

## Expected changed paths
- src/generators/opencode/index.ts
- src/opencode-entry.ts
- src/cli/install.ts
- src/cli/verify-install.ts
- src/distribution-lifecycle.ts
- tests/build.test.ts
- tests/install.test.ts
- tests/verify-install.test.ts
- docs/start-here.md
- docs/todo/queue.md
- docs/todo/master-backlog.md
- docs/roadmap.md

## Execution steps

1. **S1, regression baseline (AC1/AC2):** Add an installed-artifact test to `tests/verify-install.test.ts` (new test) that builds a fixture, installs to a fake HOME, invokes OpenCode 2.0.20 plugin listing/MCP listing or an equivalent official host loader, and asserts one active ID plus visible MCP. Before repair it must reproduce missing default export or absent MCP. Keep the fixture keyless. Add a free-model `setup_doctor` session check as manual corroboration, not a substitute for automated load proof.
2. **S2, generated V2 contract (AC1/AC3):** Change `OpenCodeGenerator.generatePackageJson()` and `generatePluginWrapper()` in `src/generators/opencode/index.ts`. Generate a V2 default definition through `@opencode/plugin` with `setup(ctx)` and a separate V1 `server()` method. Introduce proposed generator helpers `buildOpenCodeV2McpDefinitions(pluginRoot: string, workspaceRoot: string): Record<string, McpServerConfig>` and `registerOpenCodeV2(ctx: PluginContext): Promise<() => void>` (exact imported SDK type may vary with checked package; observable contract is a one-time domain registration and cleanup). Port MCP, commands, readiness, hooks, instructions, and event cleanup using documented V2 domains. Keep existing V1 output behavior under `server()` and add a package dependency on a checked compatible `@opencode/plugin` version; avoid wildcard compatibility claims.
3. **S3, one installed entry (AC2/AC4):** Change `buildOpenCodeEntryFile()` / `isCurrentOpenCodeEntryFile()` in `src/opencode-entry.ts`, and `getOpenCodeEntryPath()`, `createOpenCodeInstall()`, `verifyOpenCodeInstall()` and uninstall ownership paths in `src/cli/install.ts`. Generate a default-only proxy, move the installed bundle to a non-discovered owned location, keep skills synced, and ensure old owned layout is removed only after the new one verifies. Update the `opencode` install path in `src/distribution-lifecycle.ts`. Preserve unowned files. Update `src/cli/verify-install.ts` to report V2 entry shape, single discovery, and MCP registration probe rather than only matching text.
4. **S4, contract and host proof (AC1-AC5):** Update `tests/build.test.ts`, `tests/install.test.ts`, `tests/verify-install.test.ts` with generated shape, root/workspace, permission/readiness, ownership/rollback, missing dependency, and V1 compatibility cases. Run `npm run build`, `npm run typecheck`, focused Vitest via the repo runner, then `npm test` if practical. In an isolated profile, test installed output using OpenCode 2.0.20 and a free model: one plugin ID, configured MCP, and `setup_doctor`; do not expose credentials. If 2.0.20 or the free model is unavailable, state exactly which host proof is missing and do not assert installed parity.
5. **S5, truth and review (AC5):** Update `docs/start-here.md`, `docs/todo/queue.md`, `docs/todo/master-backlog.md`, `docs/roadmap.md` only where their host-compatibility claims change, plus focused install docs if they state the old path. Commit/push the Pluxx implementation branch and open one PR against `main` linked to PLUXX-355. Keep source completion separate from Pluxx release and downstream SendLens validation.

## Acceptance map

| Criterion | Steps | Discriminating proof |
| --- | --- | --- |
| AC1: OpenCode 2 loads one active generated plugin and MCP without credentials | S1,S2,S4 | New installed-artifact test fails against current V1 entry, passes with default `id/setup`; isolated `opencode plugin list` shows one ID and `opencode mcp list` shows fixture server. |
| AC2: no double discovery or stale owned wrapper | S1,S3,S4 | `tests/install.test.ts` verifies exactly one host-visible entry; reinstall from old owned layout removes collision, unowned duplicate causes explicit error, rollback retains previous usable install. |
| AC3: V2 commands/hooks/readiness work and V1 1.18.29+ remains usable | S2,S4 | `tests/build.test.ts` executes representative MCP gate, command invocation, tool matcher, prompt/readiness and cleanup; host V2 exercise plus a pinned supported V1 smoke; unsupported mappings are diagnosed. |
| AC4: verification rejects false success | S3,S4 | `tests/verify-install.test.ts` fails for V1-only entry, missing default setup, duplicate discovery and missing MCP; passes only when installed artifact loads. |
| AC5: docs and downstream handoff reflect tested support | S4,S5 | PR records exact source checks and host version, no-key/free-model proof, residual gaps, and linked SendLens follow-up. |

## Recovery, risk, and readiness

The install path move is the main migration risk. Use existing transactional install ownership checks and test rollback before deleting old owned paths. Reverting the PR restores the previous generator; a released rollback requires reinstalling the prior generated bundle and does not rewrite customer state. V2 API docs are current evidence, but implementation must pin a compatible SDK and validate actual signatures. No deployed/consumer parity is inferred from source tests.

**Ready for hosted implementation** on the pushed source commit once the ticket pins this plan's remote bytes, source ref/commit, and exact allowed paths, then native Orchid delegation is verified. The immediate executor action is S1, followed by S2-S5. One Pluxx PR is reviewable because all changes serve one host-load result; SendLens is a separate repository and PR after the Pluxx release.
