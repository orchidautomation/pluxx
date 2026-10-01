# OpenCode 2 compatibility candidate

PLUXX-355 changes the generated OpenCode entry and installation contract. This is source-candidate work; the public Pluxx 0.1.45 release and previously generated consumer bundles do not acquire V2 support automatically.

## Entry and installation

Generated bundles default-export one stable plugin ID with V2 `setup(ctx)` and V1 `server(context)`. Supporting functions are private. The package pins `@opencode/plugin` to 2.0.20 and declares V1 `@opencode-ai/plugin >=1.18.29`. The default object follows the [official dual-entry migration contract](https://opencode.ai/v2/docs/build/plugins/migrate-v1/).

OpenCode 2 event subscriptions observe events asynchronously and cannot enforce `failClosed` event hooks. A generated bundle with that configuration fails V2 setup with an explicit diagnostic; use the supported V1 bridge or remove that policy until a synchronous V2 hook is available. Tool hooks retain their fail-closed behavior through V2 hook callbacks.

Local installs place the bundle at `~/.config/opencode/pluxx/<name>` and one default-only wrapper at `~/.config/opencode/plugins/<name>.ts`. Skills remain at `~/.config/opencode/skills/<name>-<skill>`. Generated release installers use the same default layout and compute the wrapper import for custom paths.

An unchanged ownership ledger is required to remove the legacy discovered bundle at `plugins/<name>`. Unowned or modified legacy bundles remain intact and cause an actionable collision error. Migration checks run before the already-current exit, validate the legacy path against its own ledger (including custom roots and dangling symlinks), and keep temporary legacy backups outside discovery. Bundle, wrapper, skills, and ownership changes roll back together on a handled install failure. On rerun after an interruption, the release installer restores one verified owned legacy backup before retrying migration. Ambiguous or modified backups require manual inspection and remain untouched.

## Translation and limits

| Surface | V2 behavior |
| --- | --- |
| MCP | Registers local/remote configuration with `ctx.mcp.transform`; keeps runtime environment references and plugin/workspace roots distinct. |
| Commands | Registers executors with `ctx.command.transform`; substitutes `$ARGUMENTS` and numbered arguments, preserves attachments/delivery, and gates command admission on readiness through the prompt bridge once per command. |
| Tool hooks | Registers before/after hooks, runs after hooks for completed, failed, and cancelled tools, preserves matcher order and fail-open/fail-closed behavior, and recognizes namespaced MCP tools for readiness. |
| Shell and prompt hooks | Uses `shell.create.before` and `session.prompt`; shell hooks execute the existing command contract. |
| Instructions | Adds text system parts to context, compaction, generation, and title requests without duplication. |
| Events | Uses an abortable event subscription; setup failure and unload dispose prior registrations. |
| Agents | V2's documented agent editor cannot add agents. Bundled files remain, with an explicit unsupported-native-registration warning. Command routing to a named agent requires that agent to exist in host configuration. |
| Global permissions | V2 has no global config transform equivalent. Bundles with canonical global permissions fail closed with an explicit diagnostic rather than loading with silently weakened policy. |

V1 preserves the original config/hook handlers through `server()`. Releases below 1.18.29 are outside the object-entry compatibility window. V1 hook regression and pinned SDK typechecking prove source behavior. An isolated OpenCode 1.18.29 smoke also loads the installed default wrapper through the V1 bridge, exposes the doctor command, and connects the fixture MCP server.

`verify-install` checks the default entry, duplicate legacy discovery, ownership drift, and installed V1 `server()`/config and V2 `setup()` probes with the configured MCP names. Duplicate legacy discovery has its own move-aside advisory. The probe loads code and registers into a test context without connecting MCP or running domain hooks; the V1 config hook runs during setup to materialize MCP definitions. It does not prove real-host loading, a successful MCP handshake, or a model session. Missing runtime imports and registration failures are errors.

## Proof and remaining acceptance

The automated fixture suite covers installed discovery, MCP/commands, roots, V1 handlers, pinned SDK signatures, readiness, matched hooks, cleanup, negative verification, owned migration, unowned preservation, and rollback. Build and typecheck pass. The affected generator, local installer, doctor, verification, and V2 contract checks pass. The generated release installer regression also proves saved-configuration migration and rollback after a companion collision. Review repair validation passes 57 focused contract/verifier/lifecycle tests and 82 generated-installer tests. The earlier CI run failed three stale test/doc expectations; those expectations are now synchronized. Current full-suite and CI results are recorded on PR #506, independently of the earlier interrupted local run.

On 2026-10-01, user-approved checks outside the sandbox passed with the official Linux **OpenCode 2.0.20** CLI and a fresh keyless profile. Native discovery listed exactly one `v2-proof` entry; MCP listing reported `fixture` connected. A free `opencode/big-pickle` session called `fixture.setup_doctor` once and received the fixture result `{ "status": "ready", "proof": "pluxx-355-keyless-host" }`. The same generated bundle on **OpenCode 1.18.29** connected MCP and exposed the doctor command through the V1 config hook. These are fixture host checks, not downstream SendLens validation.

The host proof aligns XDG configuration with the installed HOME layout and uses an available localhost service port. Explicit V2 `plugins` configuration requires a directory rather than a wrapper file, so the checks use native wrapper discovery. Initial cold listings were empty before a workspace session was run; repeat listings after the successful tool session showed the active plugin and connected MCP. This startup observation remains a host caveat. The isolated test service was stopped after the checks.

Required release order: complete live host acceptance and review -> merge/release Pluxx -> rebuild SendLens using the exact released Pluxx version in its separate issue -> install and validate that downstream artifact. This change grants no downstream edits or release publication.
