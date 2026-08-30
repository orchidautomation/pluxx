# PLUXX-346 — Agent Plugins v1 portable target

## Context and current behavior

Pluxx currently accepts eleven native or host-specific targets through
`src/schema.ts::TargetPlatform`, dispatches them through the closed
`GENERATORS` table in `src/generators/index.ts`, validates generated manifests
through `src/bundle-check.ts`, and packages built targets through
`src/cli/publish.ts`. There is no `agent-plugins` target in any of those paths.

PLUXX-347 is now merged. Its fail-closed policy lives in
`src/agent-plugins-native-overlay-contract.ts` and exports
`getAgentPluginsNativeOverlayContractAllowlist()`,
`validateAgentPluginsNativeOverlayContract()`, and
`lintUndocumentedAgentPluginsExtensionEmission()`. The authoritative matrix
currently permits the Agent Plugins portable floor while recording negative
decisions for undocumented client-extension hook paths. The portable emitter
must consume that policy rather than infer a native layout.

The existing `Generator` base class already provides project-root containment,
skill copying, and canonical MCP shaping. Those helpers are useful, but the new
target must emit the Agent Plugins v1 schema rather than reuse a native host
manifest or silently copy scripts, hooks, commands, agents, assets, passthrough
content, permissions, readiness companions, or shared runtime material.

## Objective

Add `agent-plugins` as a first-class, strict portable-core Pluxx output that:

1. emits a root `plugin.json`, immediate-child `skills/<skill>/SKILL.md`, and
   optional root `mcp.json` only when representable;
2. reports every non-portable configured capability as an explicit
   preserve/translate/degrade/drop decision;
3. fails closed on undocumented reverse-domain client-extension output;
4. participates in build, test, dry-run install planning, and GitHub release
   archive planning without changing the native core-four outputs; and
5. is proven by installed Cursor and Codex discovery fixtures before any
   release-readiness claim.

## Scope

- Add the target to schema, CLI parsing/help, generator routing, compatibility
  inventory, bundle checks, test routing, install planning, and publish assets.
- Implement one dedicated portable generator and validator.
- Preserve the existing native Claude Code, Cursor, Codex, and OpenCode
  generators byte-for-byte unless a shared type/list update is required.
- Produce deterministic degradation diagnostics for hooks, agents, commands,
  permissions, runtime/readiness, scripts/assets/passthrough, and metadata that
  the portable schema cannot carry.
- Add checked-in fixtures proving valid and invalid package shapes plus clean
  installed discovery in Cursor and Codex.
- Update the capability and distribution docs required by the new target.

## Out of scope

- No `com.cursor/hooks`, `com.openai/hooks`, or other assumed extension output.
- No portable-hook claim and no translation of native agents, commands, or
  permission policy into undocumented fields.
- No MDP adoption, version bump, npm publication, GitHub release, installation
  into Brandon's active homes, or removal of existing Pluxx targets.
- No graduation of beta host targets and no broad installer redesign.

## Assumptions and decisions

- Agent Plugins v1 is the common package floor, not a replacement for Pluxx.
- The output directory remains `dist/agent-plugins/` under the configured
  `outDir`.
- A portable archive is a GitHub release asset but does not receive a generated
  native-host installer until a first-party compatible-client installation
  contract is represented safely. Dry-run install planning may report manual or
  client-managed installation rather than invent a path.
- Any MCP transport, authentication, placeholder, or path form that cannot be
  expressed exactly in Agent Plugins v1 is rejected or degraded explicitly;
  it is never rewritten optimistically.
- Installed fixture identifiers already present in the PLUXX-347 matrix are
  design evidence only until this issue records real client execution.

## Acceptance mapping

| Acceptance criterion | Implementation | Proof |
| --- | --- | --- |
| `pluxx build --target agent-plugins` emits a valid package | Add the target enum/list entries and a dedicated generator that emits the closed manifest, skill, and MCP surface | Focused generator/schema tests validate exact inventory and schema |
| `pluxx test --target agent-plugins` checks shape and containment | Add portable validation to the test command and bundle checker | Valid fixture passes; traversal, nested-skill, malformed frontmatter/manifest/MCP, missing reference, and unsupported-field fixtures fail deterministically |
| Publish dry-run includes the portable artifact | Extend release asset discovery/planning while leaving native installer targets closed | Publish-plan and archive-contract snapshots include versioned/latest portable archives and no invented installer |
| Cursor and Codex clean installs discover skills and MCP | Add isolated compatible-client fixtures using pinned client versions or existing test seams | Installed-behavior receipts bind client version, artifact hash, discovered skill, and MCP registration separately |
| No hook or undocumented extension is emitted | Run every candidate extension through the PLUXX-347 policy; default to an empty extension set | Negative tests reject `com.cursor/hooks` and `com.openai/hooks`; archive inventory contains neither |
| Native outputs remain green | Keep native generators unchanged and run core-four regression suites | Existing build, lint, install, publish, and release-smoke suites pass |
| Capability docs separate portable and native behavior | Update generated/maintained compatibility docs from the same source used by tests | Doc-sync test and focused documentation assertions pass |
| MDP-221 can consume the target | Preserve canonical Pluxx config authoring and produce stable archive/output names | Add a consumer-shaped fixture with MDP-like skills/MCP/hooks and assert portable degradation plus valid output |

## Affected files and symbols

- `src/schema.ts::TargetPlatform`, `PlatformOverridesSchema`, and config types:
  add the portable target without changing the default core-four set.
- `src/generators/index.ts::GENERATORS` and a new
  `src/generators/agent-plugins/` module: route and generate the portable
  package.
- `src/generators/base.ts`: reuse only safe containment/MCP helpers; add a
  narrowly scoped helper only if portable MCP serialization cannot remain
  inside the new generator.
- `src/agent-plugins-native-overlay-contract.ts`: consume the merged public
  policy. Do not weaken its matrix or negative decisions to make tests pass.
- `src/bundle-check.ts::MANIFEST_DESCRIPTORS` and portable validation code:
  verify root manifest identity, references, file inventory, and containment.
- `src/cli/index.ts` target parsing/help and test/install-plan routing: expose
  the target and an honest compatible-client/manual plan.
- `src/cli/publish.ts` target classification and release assets: archive the
  portable package without treating it as a native installer target.
- `src/validation/platform-rules.ts`, `src/compatibility/matrix.ts`, and related
  summaries: record portable capabilities and explicit degradations.
- Focused new tests under `tests/agent-plugins*.test.ts`, plus existing schema,
  build, lint, install-plan, publish, archive, and release-smoke tests touched by
  target enumeration.
- `docs/agent-plugins-native-overlay-contract.md`, the maintained capability
  matrix, and distribution documentation only where the shipped target changes
  product truth. Preserve renderer/doc byte-sync contracts.

## Ordered implementation steps

1. **Define the closed target contract.** Add `agent-plugins` to type-safe target
   inventories while leaving defaults and native smoke sets unchanged. Add a
   portable capability profile that marks skills and supported MCP as portable
   and all other compiler buckets as degraded/native.
2. **Implement strict portable serialization.** Generate root `plugin.json`,
   immediate-child skills, and optional `mcp.json`. Validate names, metadata,
   regular-file shape, symlink/path containment, frontmatter limits, MCP
   transports/placeholders, and deterministic JSON ordering before publishing
   the staged directory.
3. **Bind the PLUXX-347 guard.** Validate the complete candidate output
   inventory with `lintUndocumentedAgentPluginsExtensionEmission()` and refuse
   any reverse-domain path absent from the proven allowlist. Render explicit
   degradation output for configured native-only capabilities.
4. **Wire commands and bundle verification.** Support build and test target
   flags, add manifest/reference/inventory checks, and ensure staging rollback
   remains atomic on validation failure.
5. **Wire planning and publishing.** Include portable archives in GitHub release
   plans and checksums. Keep `INSTALLER_TARGETS` native-only; expose an honest
   install-plan result rather than writing unproven client paths.
6. **Add adversarial and regression fixtures.** Cover valid skills/MCP, empty
   portable core, nested skills, symlinks/traversal, malformed metadata,
   unsupported MCP/auth, hooks/agents/commands, undocumented extensions,
   deterministic degradation, and native core-four parity.
7. **Add installed-client proof.** In isolated homes, load the exact portable
   artifact in pinned Cursor and Codex clients and record discovery separately
   for skills and MCP. A schema-only test is insufficient.
8. **Synchronize product truth.** Update the authoritative matrix/docs and the
   PLUXX-346 Linear evidence with the exact verified head. Stop at one PR.

## Tests and validation

Focused checks:

- Typecheck and build.
- New portable generator/validator tests.
- Target parsing, config schema, lint/degradation, bundle-check, install-plan,
  publish-plan, archive/checksum, and MDP-shaped consumer fixture tests.
- PLUXX-347 policy and doc byte-sync tests.

Broader regression:

- Existing core-four build, lint, install, verify-install, publish, and release
  smoke suites.
- `npm run pack:check` and the repository's standard CI/release checks where
  practical without publishing.

Manual/installed proof:

- Fresh isolated Cursor and Codex homes, pinned client identities, exact
  portable archive checksum, skill discovery evidence, and MCP discovery/run
  evidence. Record explicit degradation if a client cannot load a component.

## Compatibility, migration, and rollout

- Existing configs remain valid and retain the core-four defaults.
- Existing generated native bundles and installer names remain unchanged.
- Adoption is opt-in by adding `agent-plugins` to `targets`.
- MDP-221 remains a separate consumer PR after this target is merged and, if
  required by repository release policy, released.
- Do not advertise portable hooks or client extensions. Native overlays remain
  separate Pluxx artifacts.

## Risks and safety boundaries

- **False portability:** fail closed on unknown fields, paths, namespaces, and
  MCP forms; do not relax PLUXX-347 evidence.
- **Silent feature loss:** emit deterministic degradation decisions and assert
  them for MDP-shaped input.
- **Path escape or symlink smuggling:** validate resolved paths and regular-file
  shape before staging/publishing.
- **Release regression:** keep native installer classification closed and run
  archive/checksum parity tests.
- **Fixture overclaim:** installed proof must bind real client versions and
  artifact hashes; mocks remain unit evidence only.

## Rollback and observability

Rollback is a revert of the implementation commit/PR. Because the target is
opt-in and no release occurs in this lane, existing configs and native outputs
remain the immediate fallback. Diagnostics, archive inventories, fixture
receipts, and CI results are the observation surfaces.

## Blockers and readiness verdict

- PLUXX-345 and MDP-211 are complete.
- PLUXX-347 is merged at `796cb85998210c2a464fe3b419bf4c4cf2495b92`
  and provides the required evidence gate.
- No product decision or repository dependency remains unresolved.

**Readiness: `READY_TO_PIN`.** Hosted Orchid may implement against the pinned
source branch, open one PR, and stop before merge, release, or installation.
