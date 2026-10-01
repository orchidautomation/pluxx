# OpenCode 2 compatibility candidate

PLUXX-355 changes the generated OpenCode entry and installation contract. This is source-candidate work; the public Pluxx 0.1.45 release and previously generated consumer bundles do not acquire V2 support automatically.

## Entry and installation

Generated bundles default-export one stable plugin ID with V2 `setup(ctx)` and V1 `server(context)`. Supporting functions are private. The package pins `@opencode/plugin` to 2.0.20 and declares V1 `@opencode-ai/plugin >=1.18.29`. The default object follows the [official dual-entry migration contract](https://opencode.ai/v2/docs/build/plugins/migrate-v1/).

Local installs place the bundle at `~/.config/opencode/pluxx/<name>` and one default-only wrapper at `~/.config/opencode/plugins/<name>.ts`. Skills remain at `~/.config/opencode/skills/<name>-<skill>`. Generated release installers use the same default layout and compute the wrapper import for custom paths.

An unchanged ownership ledger is required to remove the legacy discovered bundle at `plugins/<name>`. Unowned or modified legacy bundles remain intact and cause an actionable collision error. Bundle, wrapper, skills, and ownership changes roll back together on a handled install failure. Interrupted release installs retain existing transaction recovery behavior; users should inspect retained backups before retrying.

## Translation and limits

| Surface | V2 behavior |
| --- | --- |
| MCP | Registers local/remote configuration with `ctx.mcp.transform`; keeps runtime environment references and plugin/workspace roots distinct. |
| Commands | Registers executors with `ctx.command.transform`; substitutes `$ARGUMENTS` and numbered arguments, preserves attachments/delivery, and gates command admission on readiness. |
| Tool hooks | Registers before/after hooks, preserves matcher order and fail-open/fail-closed behavior, and recognizes namespaced MCP tools for readiness. |
| Shell and prompt hooks | Uses `shell.create.before` and `session.prompt`; shell hooks execute the existing command contract. |
| Instructions | Adds text system parts to context, compaction, generation, and title requests without duplication. |
| Events | Uses an abortable event subscription; setup failure and unload dispose prior registrations. |
| Agents | V2's documented agent editor cannot add agents. Bundled files remain, with an explicit unsupported-native-registration warning. Command routing to a named agent requires that agent to exist in host configuration. |
| Global permissions | V2 has no global config transform equivalent. Bundles with canonical global permissions fail closed with an explicit diagnostic rather than loading with silently weakened policy. |

V1 preserves the original config/hook handlers through `server()`. Releases below 1.18.29 are outside the object-entry compatibility window. V1 hook regression and pinned SDK typechecking prove source behavior; an actual V1 host session remains a separate check.

`verify-install` checks the default entry, duplicate legacy discovery, ownership drift, and an installed `setup()` registration probe with the configured MCP names. The probe loads code and registers into a test context without connecting MCP or invoking hooks. It does not prove real-host loading, a successful MCP handshake, or a model session. Missing runtime imports and registration failures are errors.

## Proof and remaining acceptance

The automated fixture suite covers installed discovery, MCP/commands, roots, V1 handlers, pinned SDK signatures, readiness, matched hooks, cleanup, negative verification, owned migration, unowned preservation, and rollback. Build and typecheck pass. The affected generator, local installer, doctor, verification, and V2 contract checks pass. The generated release installer regression also proves saved-configuration migration and rollback after a companion collision. The full suite was interrupted after stalling in an autopilot subprocess; it is not a passing full-suite result.

The isolated official Linux CLI reports **OpenCode v2.0.20** inside the sandbox. Its `plugin list` and `mcp list` commands cannot start the local server: the sandbox rejects `listen` with `EPERM`. Running the downloaded CLI outside the sandbox was rejected by automatic approval review. Consequently active plugin/MCP listing, the keyless free-model `setup_doctor` session, and a live V1 session remain unverified; no installed-host parity claim is made.

Required release order: complete live host acceptance and review -> merge/release Pluxx -> rebuild SendLens using the exact released Pluxx version in its separate issue -> install and validate that downstream artifact. This change grants no downstream edits or release publication.
