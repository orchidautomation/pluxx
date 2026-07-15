# Roadmap

Last updated: 2026-07-14

## Doc Links

- Role: execution direction
- Related:
  - [docs/start-here.md](./start-here.md)
  - [docs/todo/queue.md](./todo/queue.md)
  - [docs/todo/master-backlog.md](./todo/master-backlog.md)
  - [docs/todo/success-checklist.md](./todo/success-checklist.md)
  - [docs/oss-wedge-and-trust-layer.md](./oss-wedge-and-trust-layer.md)
  - [docs/flagship-docs-ops-plugin.md](./flagship-docs-ops-plugin.md)
  - [docs/platform-change-ops-reference-plugin.md](./platform-change-ops-reference-plugin.md)
  - [docs/docs-ops-core-four-proof.md](./docs-ops-core-four-proof.md)
  - [docs/exa-research-example.md](./exa-research-example.md)
  - [docs/release-distribution-proof-map.md](./release-distribution-proof-map.md)
  - [docs/runtime-contract.md](./runtime-contract.md)
  - [docs/core-four-primitive-proof-ledger.md](./core-four-primitive-proof-ledger.md)
  - [docs/pluxx-plugin-surface-audit.md](./pluxx-plugin-surface-audit.md)
  - [docs/orchid/decisions/2026-06-26-pluxx-next-ship-review.md](./orchid/decisions/2026-06-26-pluxx-next-ship-review.md)
  - [docs/pluxx-self-hosted-core-four-proof.md](./pluxx-self-hosted-core-four-proof.md)
  - [docs/core-four-provider-docs-audit.md](./core-four-provider-docs-audit.md)
  - [docs/core-four-reliability-register.md](./core-four-reliability-register.md)
  - [docs/core-four-translation-hit-list.md](./core-four-translation-hit-list.md)
  - [docs/core-four-maintenance-routine.md](./core-four-maintenance-routine.md)
  - [docs/todo/author-once-hardening.md](./todo/author-once-hardening.md)
  - [Compound Engineering primitive audit](./orchid/requirements/2026-07-13-compound-engineering-primitive-audit.md)
  - [Orchestration reference-pattern audit](./orchid/requirements/2026-07-14-orchestration-reference-patterns.md)
  - [Accepted orchestration decision](./orchid/decisions/2026-07-14-orchestration-primitive.md)
  - [Compound Engineering parity plan](./orchid/plans/2026-07-13-compound-engineering-parity-plan.md)
  - [PLUXX-324 transactional migrate plan](./orchid/plans/2026-07-14-pluxx-324-transactional-migrate.md)
  - [Linear](https://linear.app/orchid-automation)
- Update together:
  - [docs/start-here.md](./start-here.md)
  - [docs/todo/queue.md](./todo/queue.md)
  - [docs/todo/master-backlog.md](./todo/master-backlog.md)

This doc is direction, not the day-to-day execution queue.

If you are new to the repo, read [start-here.md](./start-here.md) first.
For the live operational queue, use [docs/todo/queue.md](./todo/queue.md).
For the broadest repo-native backlog, use [docs/todo/master-backlog.md](./todo/master-backlog.md).
For the broadest completeness checklist, use [docs/todo/success-checklist.md](./todo/success-checklist.md).
For the product strategy behind this roadmap, use [OSS wedge and trust layer](./oss-wedge-and-trust-layer.md).

## Product Frame

Pluxx has two layers:

1. an OSS authoring substrate
2. a later trust / distribution layer

The current build center is the OSS authoring substrate.

That means Pluxx should become excellent at:

- import
- scaffold
- refine
- lint
- doctor
- eval
- build
- test
- install
- upgrade
- sync

before it spends serious energy on an operated control plane.

The current next ship decision is to make Codex companion apply and verify first-class:

- apply generated Codex companion config safely, with reviewable diffs or backups
- verify active project/user config, plugin cache state, generated companion artifacts, and known Codex caveats
- cover idempotency, stale config, malformed companion artifacts, and absent companion files
- align execution with `PLUXX-226`, `PLUXX-264`, and `PLUXX-248`

See [docs/orchid/decisions/2026-06-26-pluxx-next-ship-review.md](./orchid/decisions/2026-06-26-pluxx-next-ship-review.md).

The transactional install-ownership slice is now implemented across the core-four local and generated release-installer paths. It stages and validates candidate bundles, retains rollback backups through post-install work, hashes owned files, preserves modified/unowned content, adds conservative Codex config unapply, and makes verification content-aware even when versions match.

The full v0.1.31 audit-remediation tranche is merged. Main now includes safer ingestion, reliable Autopilot checkpoints and write boundaries, stronger semantic evaluation and field-level translation truth, atomic authoring/build mutations, transactional ownership-aware installs, hardened release recovery, and proof freshness governance.

## Current Priority Order

Proof governance now distinguishes unit, bundle-contract, fake-home install, installed-runtime, and real-host behavior evidence. Canonical version/freshness checks run in CI through [proof-freshness.md](./proof-freshness.md) and [proof-manifest.json](./proof-manifest.json); historical April/May proof stays available without being treated as current.

The active audit closeout slice is PLUXX-322 release recovery. The 0.1.32 release PR is merged and immutable tag `v0.1.32` exists at `188527e`, but the first release run failed before publication because its shallow checkout could not reach the proof receipt commit. The focused recovery PR restores full history and a controlled existing-tag dispatch; merge, dispatch, public artifact verification, and archive remain coordinator-owned.

### 1. Product clarity and source-of-truth coherence

Make the repo front door and planning surfaces tell the same story.

This includes:

- start-here
- queue
- master backlog
- roadmap
- README
- site hero and metadata
- Linear
- the audit-to-implementation closure plan in [docs/core-four-translation-hit-list.md](./core-four-translation-hit-list.md)
- the primitive-by-host proof ledger in [docs/core-four-primitive-proof-ledger.md](./core-four-primitive-proof-ledger.md)

The closure plan is now narrower than it was before:

- row-level translation docs are done
- hook translation explainability and fixture closure are materially stronger
- build and doctor now explain non-preserve mappings with more native-surface detail
- the former fixture/proof block is now closed:
  - richer skill fixtures
  - runtime/MCP fixtures
  - instruction-intent proof
  - native Cursor/Codex/OpenCode fixture coverage
  - migration normalization proof
  - install-lifecycle explainability proof
- the remaining closure work is now mainly public proof packaging, install/distribution polish, and future host-refresh maintenance tracked in [docs/core-four-translation-hit-list.md](./core-four-translation-hit-list.md)
- the next reliability pass should now run from [docs/core-four-reliability-register.md](./core-four-reliability-register.md):
  - Claude Code and Codex stay the priority hosts
  - the immediate focus is agents, hooks, settings/discovery, and distribution-edge proof rather than broad compiler rewrites
- the next concrete OSS-authoring robustness slice is Codex companion apply/verify:
  - make generated readiness, hook, MCP approval, and companion config artifacts operational and verifiable instead of advisory only
  - keep the work aligned with `PLUXX-226`, `PLUXX-264`, `PLUXX-248`, and [docs/orchid/decisions/2026-06-26-pluxx-next-ship-review.md](./orchid/decisions/2026-06-26-pluxx-next-ship-review.md)
  - transactional install ownership now covers conservative reinstall/uninstall, rollback, and content drift across the core four
- local stdio import quality is now stronger for the common "I already have an MCP" path:
  - `init --from-mcp` auto-recovers `passthrough` for project-relative runtimes such as `./build/index.js`
  - `lint` catches unbundled stdio runtime payloads earlier
  - `doctor --consumer` now makes broken installed `.mcp.json` runtime references obvious
  - Claude-generated local stdio MCP output now anchors project-local runtime paths under `${CLAUDE_PLUGIN_ROOT}` instead of assuming plugin-root cwd
  - `lint` now warns when MCP startup or custom runtime hooks depend on installer-owned `scripts/check-env.sh`
  - build output and install-time MCP materialization now share the same stdio path normalization, so host-specific root vars no longer leak between Claude, Cursor, and Codex bundles
  - Codex local installs now rewrite plugin-owned stdio MCP command/arg paths to absolute installed plugin paths, so installed MCP launch no longer depends on workspace cwd
  - `lint` now warns when global stdio MCP config uses host-specific root vars such as `${CLAUDE_PLUGIN_ROOT}`
  - `doctor --consumer` now warns when an installed bundle still carries the wrong host root contract in stdio MCP config
  - the recommended native-runtime pattern now explicitly splits `load-env.sh`, `bootstrap-runtime.sh`, and `start-mcp.sh`
  - source-project runtime payload checks now treat `scripts/`, `assets/`, and `passthrough` as one bundled runtime surface when validating local stdio startup paths
  - `doctor --consumer` now reports which known runtime script-role files are present in an installed bundle
  - `install`, `doctor --consumer`, and `verify-install` now fail bundles whose actual stdio entry scripts still chain runtime startup through installer-owned `scripts/check-env.sh`
- runtime readiness is now a real compiler-owned runtime surface:
  - source config can declare refresh dependencies, gate polling, and timeout policy once
  - Claude Code, Cursor, and OpenCode now emit generated readiness behavior from that shared primitive
  - Codex now bundles translated hooks at `hooks/hooks.json` and keeps `.codex/readiness.generated.json` plus `.codex/hooks.generated.json` companions for explanation/debugging
  - `lint` and `doctor` now explain the remaining Codex feature-gate and best-effort prompt-entry degradation for named skill/command readiness targets
  - the compiler now also treats `runtime` more explicitly as internal MCP/auth, readiness, and payload subcontracts
  - the readiness translation notes shared by generators, `lint`, and `doctor` now come from one registry instead of parallel drift-prone wording
- host-visible branding completeness is now surfaced earlier:
  - `lint` warns when Cursor or Codex can render richer branding but the plugin is missing `brand.icon` and/or `brand.screenshots`
  - `doctor` surfaces the same source-project warning before a plugin is treated as finished
- installed MCP discovery now closes the adjacent "I already configured this MCP in a host" path:
  - `pluxx discover-mcp` lists configured MCP servers from Claude Code, Cursor, Codex, and OpenCode config locations
  - `pluxx init --from-installed-mcp <host:name>` imports the selected MCP into a maintained Pluxx source project
  - literal secret values are not copied into generated project config
  - Claude MCP discovery now follows the real live CLI sources: project `.mcp.json` plus user/local `~/.claude.json`, and it no longer treats `settings.json` `mcpServers` as active install sources
  - duplicate Claude same-name MCPs across `.mcp.json`, top-level `~/.claude.json`, and nested local `projects[...]` entries now get path-qualified selectors instead of ambiguous duplicate ids
  - duplicate Claude same-name MCPs across nested local `projects[...]` blocks in `~/.claude.json` now also stay distinct, and the path-qualified selector is proven through `init --from-installed-mcp`
- the next translation follow-ons are now clearer and narrower:
  - finish the deeper hook-registry rollout so generator routing and docs rows read registry-backed truth
  - keep pushing the richer `skills` metadata layer into more generator, proof, and translation-registry consumers
  - keep pushing the richer `commands` IR into more native host emission and registry-backed explainability
  - reduce lossy import paths in `migrate` and installed-MCP discovery
  - continue the runtime registry rollout now that installed hook env parity also translates across Cursor, Codex, and OpenCode
- the command/skill authoring seam is materially stronger than it was:
  - `src/commands.ts` now preserves `when_to_use`, argument arrays, examples, explicit skill routing, agent routing, and context hints
  - Codex and OpenCode command companions now carry that richer metadata instead of flattening commands back to `argument-hint` plus template only
  - `init --from-mcp` now emits `when_to_use`, canonical `arguments`, and explicit `skill` routing into generated command frontmatter
  - `src/skills.ts` now parses frontmatter as YAML, reports unsupported shapes with source locations, and exposes canonical support-file metadata for `examples/`, helper `scripts/`, and neighboring references
  - audited skill and hook field outcomes now drive generator companions, lint/doctor summaries, primitive bucket modes, and generated compatibility docs from one registry
  - Agent Mode manual-project context now consumes those richer command and skill seams directly
  - Codex command routing guidance in `AGENTS.md` now reads from the same shared command translation seam as `.codex/commands.generated.json`
  - skill-frontmatter translation notes for Codex and OpenCode now explicitly cover `when_to_use`, `user-invocable`, `model`, and `effort`
  - hook translation notes for prompt/failClosed/loop_limit now also route through the shared hook registry, and Claude prompt-hook warnings are event-aware instead of claiming all prompt hooks degrade
  - Cursor now also drops unsupported hook events from generated `hooks/hooks.json` instead of only warning in lint
  - Codex/OpenCode non-command hook-type degradation now warns through the shared hook registry, and the generated Codex hook companion records dropped `http` / `mcp_tool` / `agent` hook types explicitly
  - `migrate` now preserves richer hook entries on the first canonical pass, including prompt/http/mcp_tool hook types and adjacent fields like matcher, model, failClosed, loop_limit, async, shell, headers, allowedEnvVars, and input payloads
  - native Codex agent migrate now preserves `sandbox_mode` instead of dropping it during TOML import
- the current execution spec for that compiler-hardening tranche now lives in:
  - [docs/primitive-compiler-hardening-architecture.md](./primitive-compiler-hardening-architecture.md)
- the sharper initiative TODO for finishing the author-once gap now lives in:
  - [docs/todo/author-once-hardening.md](./todo/author-once-hardening.md)
- the same initiative now explicitly includes the self-hosted `pluxx-plugin` as the average-user operator path over the CLI:
  - use [docs/pluxx-plugin-surface-audit.md](./pluxx-plugin-surface-audit.md) as the coverage and UX truth source
- the main author-once hardening tranche is now materially closed:
  - remaining work is follow-on proof packaging, host-refresh maintenance, extra behavioral depth for edge-case flows, and continued plugin-guided UX simplification
- the current tranche also closed several formerly explicit author-once gaps:
  - the behavioral proof harness now supports expected-failure cases and host-specific runner args for maintained smoke fixtures
  - maintained smoke fixtures can now declare an explicit `commandId` plus required output markers, so command-proof cases fail when the prompt does not reference the command or the output shape stays vague
  - `example/docs-ops`, `example/exa-plugin`, and `example/platform-change-ops` now each carry maintained behavioral smoke configs with command-specific assertions
  - `doctor --consumer` and `verify-install` now execute generated Claude/Cursor bundled permission-hook scripts and fail if they emit unusable decisions
  - `src/agent-translation-registry.ts` now drives degraded-field messaging for Cursor, Codex, and OpenCode, and generated agent surfaces now emit the same translation story that `lint` uses
  - manifest-less Claude sources, Cursor nested rules plus nested `AGENTS.md` provenance, Codex `AGENTS.override.md`, and OpenCode configured instruction files plus package entrypoints now survive migrate and are copied into the canonical source project
  - MCP migrate now merges generic and host-native MCP sources instead of first-file-wins, so native auth blobs such as platform auth and multi-header header maps survive under `platforms.<host>.mcpServers.<server>`
  - installed-MCP discovery now preserves those same native auth blobs, and `init --from-installed-mcp` carries them into generated `platforms.<host>.mcpServers.<server>` config with derived install-time `userConfig` entries for multi-header auth
  - richer canonical skill metadata now survives into emitted Codex/OpenCode skill companions instead of mostly living in Agent Mode and migrate
  - `pluxx build` now checks generated manifests and package outputs for source version drift and missing referenced bundle files before publish
- local full-suite proof is now also more explicit operationally:
  - `npm test` now acquires a same-worktree suite lock and fails fast instead of creating misleading cross-test flakes when multiple full proof jobs hit the same repo-local fixture paths
  - the follow-on is deeper fixture isolation so more proof paths can run independently without sharing cwd or repo-local temp state
- local MCP proof is now safer and more deterministic:
  - new recordings use a versioned schema and default recursive credential redaction before persistence
  - replay strictly validates tapes, does not consume an expectation on mismatch, reports unused interactions, and supports valid schema-v1 tapes
- installed consumer-bundle integrity is stricter:
  - generated-shape Claude bundles now fail `doctor --consumer` and `verify-install` when `hooks/hooks.json` is malformed or points at missing bundle-owned targets, even though the Claude manifest omits `hooks`
  - Claude bundles now also fail `doctor --consumer` and `verify-install` when the manifest redundantly points `hooks` at the standard `./hooks/hooks.json` file that current Claude auto-loads anyway
  - hook-bearing Claude installs now also warn when a checked Claude settings layer sets `disableAllHooks = true`, because current Claude CLI `2.1.140` probes showed that suppressing `SessionStart` settings-hook execution across user, project, and local layers
  - `bun scripts/probe-claude-hooks-runtime.ts --json` now gives maintained isolated headless Claude evidence that user, project, and local `SessionStart` settings hooks fire by default, `--setting-sources user,project` drops local hooks, a user-layer `disableAllHooks` suppresses an otherwise-present local hook, installed plugin `SessionStart` hooks execute before the expected unauthenticated `/login` response, and duplicate-manifest plugin bundles surface Claude's duplicate hooks-file load error
  - malformed bundled Codex `hooks/hooks.json` now fails `doctor --consumer` and `verify-install` instead of passing on file presence alone
  - missing Codex `.app.json` surfaces referenced by the manifest now also fail `doctor --consumer` and `verify-install`
  - hook-bearing Codex plugin installs now warn when the checked project and user Codex config both omit the canonical `[features].hooks = true` hook flag; `codex_hooks` is deprecated and no longer treated as current guidance
  - `bun scripts/probe-codex-hooks-interactive-runtime.ts --json` now gives maintained trusted interactive Codex hook evidence too: on May 13, 2026 both trusted `UserPromptSubmit` variants and both trusted `SessionStart` variants timed out with no project-local hook side effect and no `/hooks` review gate, while the `codex_hooks` prompt path emitted a deprecation message pointing users to `[features].hooks`
  - the optional `--include-enable-hooks-cli` hook scenarios now show that the current CLI feature path `--enable hooks` still does not execute the project-local hook in the June 24 headless probe or the earlier trusted interactive probes
  - `verify-install` now treats the Codex active cache as stale when a same-version cache copy does not match the active local install contents, not only when the manifest version differs
  - hook-bearing Codex installs now also warn when the checked project is not trusted in the user Codex config for project-local hook loading
  - `verify-install` now prints the concrete installed-bundle Codex warning code, explanation, and fix inline instead of only surfacing a warning count
  - generated Codex hooks now use the official nested matcher-group schema instead of the older flat entry shape
  - `PLUXX-308` adds the missing installed-agent lifecycle: `pluxx install` and `pluxx codex apply` sync generated custom agents into the active `CODEX_HOME/agents/<plugin>/`; `verify-install` checks that state; uninstall removes only unchanged owned registrations
  - `bun scripts/probe-codex-agents-runtime.ts --json` now gives maintained isolated headless Codex custom-agent evidence; on 2026-05-13 it showed an explicit project-local `proof` agent request producing `spawn_agent` plus `wait` in `codex exec --json` and returning `CUSTOM_AGENT_PROOF`, a project-local `explorer.toml` override returning `CUSTOM_EXPLORER_OVERRIDE`, a project-local `proof.toml` beating a same-name user-local `~/.codex/agents/proof.toml` by returning `PROJECT_AGENT_PROOF`, a discovered project `.agents/skills/proof-skill/SKILL.md` being inherited cleanly and returning `SKILL_PROOF_TOKEN_PROJECT_DISCOVERY`, a parent `.codex/config.toml` `[[skills.config]] enabled = false` entry being ignored and still returning `SKILL_PROOF_TOKEN_DISABLED_IGNORED`, an agent-local `[[skills.config]] path = "./skills/proof-skill/SKILL.md"` entry failing to preload an undiscovered `skills/` path and instead returning `SKILL_PROOF_MISSING`, and the maintained `sandbox-readonly` scenario still writing `sandbox-proof.txt` and returning `SANDBOX_WRITE_PROOF` despite `sandbox_mode = "read-only"`
  - `bun scripts/probe-codex-agents-interactive-runtime.ts --json` now gives maintained trusted interactive Codex custom-agent evidence too: on 2026-05-13 the `sandbox-readonly-trusted` scenario stayed `interactive-proof-observed`, surfaced `SANDBOX_WRITE_PROOF`, and wrote `sandbox-proof.txt` with `interactive-readonly`, while the writable control stayed side-effect-matched with `interactive-writable`
  - `bun scripts/probe-codex-mcp-runtime.ts --json` now gives maintained isolated headless Codex MCP evidence too: on 2026-06-24 default project-scoped `.codex/config.toml` and user-scoped `CODEX_HOME/config.toml` both reached `initialize`, `notifications/initialized`, and `tools/list`, then emitted a real `mcp_tool_call` item that failed with `user cancelled MCP tool call` before server-side `tools/call`; approved project-root and user-root config reached `tools/call` and returned `MCP_PROOF_MARKER_ALLOWED`; inherited delegated project/user root MCP also succeeded, including explicit child-agent `mcp_servers = {}` override cases; agent-local inline MCP and inline approval did not activate in that run; `codex mcp list` still did not expose the project-scoped server, and the same command did expose the user-scoped server
  - `pluxx migrate` now warns when native Codex `.codex/agents/*.toml` files declare agent-local `mcp_servers` or approval stanzas, because current canonical agent migration still preserves only the simpler native agent fields and would otherwise silently drop the live-proven delegated MCP shape
  - `bun scripts/probe-codex-hooks-runtime.ts --json` now gives maintained isolated headless evidence that `hooks-no-trust`, `hooks-trusted`, and `codex-hooks-trusted` all return `OK` without firing the hook side effect
  - Pluxx now compiles that proven Codex MCP allow-path into `.codex/config.generated.toml` when top-level canonical `MCP(...)` rules are concrete enough to materialize per-tool approvals, while keeping `.codex/permissions.generated.json` as the broader advisory mirror
  - `pluxx lint` now also warns when a Codex target combines canonical `agents/` plus root MCP config, because maintained local proof now includes explicit custom-agent `mcp_servers = {}` scenarios that still inherited approved project/user root MCP, and upstream Codex issue `#20135` reports the same ceiling: custom agents inherit parent MCP servers from active project/user config, and there is still no documented reliable opt-out for non-MCP or least-privilege subagents
  - `doctor --consumer` and `verify-install` now also inspect checked Codex project/user config layers for those generated approvals and warn when the companion exists but its per-tool stanzas have not actually been merged yet
  - the remaining Codex runtime gap is now narrower: whether reviewed hooks can ever fire at all, especially headlessly, whether canonical authoring should preserve agent-local MCP config instead of only warning during migrate, how far the new `.codex/config.generated.toml` approval companion should go now that project-root, user-root, inherited delegated MCP, and empty child-MCP override paths are live-proven while agent-local inline approval no longer activates in the latest probe, and deeper custom-agent config proof beyond the now-pinned read-only sandbox mismatch, `skills.config` caveats, model precedence cases, and installed-plugin skill preload
- example and packaged-runtime parity are back in sync:
  - `examples/prospeo-mcp` now bundles its `scripts/` payload and points at the official `@prospeo/prospeo-mcp-server` package
- the self-hosted `example/pluxx` source project now also carries maintained behavioral smoke cases for:
  - `verify-install`
  - `translate-hosts` with a Codex hooks focus
- historical release-gate evidence from 2026-05-19 remains available but is not current proof:
  - `npm test` passed
  - `npm run release:check` passed
- the canonical repository version is `@orchid-labs/pluxx@0.1.32`, tagged as `v0.1.32` at `188527e`; the historical published baseline remains 0.1.31 while release recovery is pending
- the release/distribution/proof boundary is now explicit:
  - [docs/release-distribution-proof-map.md](./release-distribution-proof-map.md)
  - [docs/core-four-primitive-proof-ledger.md](./core-four-primitive-proof-ledger.md)
  - current primary bundle-contract and fake-home fronts remain Claude Code, Cursor, Codex, and OpenCode
  - Gemini CLI remains a beta generator target until it has release-smoke and installer parity
  - `pluxx publish --github-release` covers primary-front release assets, tagged and bounded-download installers with checksum verification, install-scoped locking, ownership-aware staged/signal-safe rollback, release-identity and remote-byte validation, and partial-state reconciliation; `pluxx publish --npm` covers the npm-backed OpenCode wrapper path
  - marketplace submission APIs, a managed trust/distribution control plane, automatic remote rollback/unpublish orchestration, and live credentialed publish/rollback proof remain open release gaps
- OpenClaw should stay in scope only as a beta-target lane until a native generator, validator/doctor path, and behavioral smoke proof exist:
  - [docs/openclaw-target-evaluation.md](./openclaw-target-evaluation.md)

### 2. Flagship reference plugin

Build one maximal reference plugin that proves Pluxx handles rich native host depth, not just basic MCP wrappers.

The chosen first example is:

- a Docsalot-style `docs-ops` plugin
- built from one maintained source project
- used to prove supporting files, scripts, richer commands, reviewer/research patterns, and truthful cross-host translation

Use [docs/flagship-docs-ops-plugin.md](./flagship-docs-ops-plugin.md) as the concrete spec.

The current status is stronger than a pure scaffold:

- `example/docs-ops` exists
- it is wired to Orchid's public Docsalot MCP endpoint for read-only proof
- OpenCode compatibility is now more honest and native:
  - agent output prefers `permission`
  - legacy agent `tools` is compatibility input, not the preferred emitted shape
  - `skill` / `task` permission keys are now treated as native host surfaces
- it now builds, installs, and passes `verify-install` across Claude Code, Cursor, Codex, and OpenCode:
  - `docs/docs-ops-core-four-proof.md`
- it now includes a concrete Orchid Accordion before/after rewrite artifact
- it has now been installed and used in Codex through the local plugin surface
- it now also completes the same read-only inspect and rewrite workflow through the official Claude Code, Cursor, Codex, and OpenCode CLIs:
  - `docs/docs-ops-core-four-proof.md`
- it now also separates the private write/publish lane from the public Orchid MCP proof and proves that contract mechanically through install/runtime config plus publish gating:
  - `docs/docs-ops-authenticated-publish-path.md`
- a second public example now also exists for a different shape of product:
  - `example/exa-plugin`
  - `docs/exa-research-example.md`
- a third maintained example now exists as the maximal enterprise stress fixture:
  - `example/platform-change-ops`
  - `docs/platform-change-ops-reference-plugin.md`
- that Platform Change Ops example intentionally combines:
  - remote MCPs
  - local stdio runtime packaging
  - runtime readiness
  - risky-action hooks
  - canonical permissions
  - delegated agents
  - rich install/distribution metadata
- that Platform Change Ops example now also installs and passes `verify-install` across Claude Code, Cursor, Codex, and OpenCode from the source project
- installed stdio MCP verification is now stricter than shape-only proof:
  - `doctor --consumer` and `verify-install` smoke-launch the installed stdio command
  - `platform-change-ops` now includes a real long-lived local MCP runtime to satisfy that proof honestly
- Claude native installed-state verification now resolves the real cache bundle path (`~/.claude/plugins/cache/<marketplace>/<plugin>/<version>`) instead of the older direct plugin-directory assumption
- that Exa example proves a clean-room subagent-heavy research operator pack with richer brand metadata from one maintained source project across the core four
- that Exa example now also has real workflow proof in:
  - Claude Code app
  - Cursor CLI
  - Codex Desktop app
  - OpenCode CLI
- that workflow proof is broader than before, but managed Claude settings behavior beyond the current file-based verifier, broader Claude hook-event coverage, and plugin-agent unsupported-field constraints still remain open reliability rows rather than closed proof
- the published npm package now includes the Claude plugin-agent manifest fix
- the public `pluxx test --install --trust --behavioral` path now reflects the same Claude state as the repo-local Exa proof
- the remaining Exa rerun gap is now narrower and host-local:
  - fresh Cursor CLI reruns currently hit a local macOS keychain/auth issue on this machine
- the Exa example also sharpened the import-quality question:
  - a raw import or migration can already get to a credible starting point
  - the next product leverage is making that first pass recover more of the final workflow architecture and packaging quality automatically
- the next proof steps are capturing at least one polished in-app walkthrough beyond Codex, then running a real authenticated publish plus rollback against a safe private target
- the next compiler-hardening follow-ons are now narrower than the earlier gap list:
  - push richer skill metadata into more native host emission and proof consumers
  - push richer command IR into more native host emission and install-time proof
  - add live environment proof for delegated agents, reload/discovery quirks, and publish/recovery flows beyond deterministic failure/reconciliation fixtures

This is the strongest next proof surface for:

- product credibility
- docs
- demos
- regression fixtures
- outbound proof

It is now split into two reference tracks:

- `docs-ops` for the flagship public proof and live workflow story
- `platform-change-ops` for the maximal enterprise all-primitive stress fixture

### 3. Docs and website ingestion proof

Turn docs ingestion from “implemented” into “obviously useful.”

The current focus is:

- connector-backed Firecrawl proof now captured:
  - `docs/strategy/firecrawl-connector-docs-ingestion-proof.md`
- keyed local Firecrawl harness snapshot now captured:
  - `docs/strategy/docs-ingestion-fixture-eval.md`
- live before/after demo now captured:
  - `docs/strategy/docs-ingestion-scaffold-before-after.md`
- bounded safe-fetch policy, untrusted-source boundary, and explicit local/Firecrawl provenance/privacy now part of the ingestion contract:
  - `docs/strategy/docs-url-ingestion.md`
- fixture evaluation now measures visible scaffold file/line deltas as well as recovered terms
- better extracted signal quality

### 4. Release-grade Pluxx plugin

Make the self-hosted Pluxx plugin feel polished, real, and easy to install.

The plugin should stay thin.
The CLI should stay the execution engine.

The plugin workflow coverage gap is now closed in the maintained source project and the repo-local Codex dogfood plugin.

Use [docs/pluxx-plugin-surface-audit.md](./pluxx-plugin-surface-audit.md) as the concrete reference.

The latest local self-hosted core-four proof is documented in:

- [docs/pluxx-self-hosted-core-four-proof.md](./pluxx-self-hosted-core-four-proof.md)

The next plugin-specific work is:

- keep `example/pluxx`, `plugins/pluxx`, and the published `pluxx-plugin` repo aligned
- the self-hosted plugin now has an explicit runtime bootstrap path:
  - `pluxx-bootstrap-runtime`
  - `/pluxx:bootstrap-runtime`
- the self-hosted plugin now also has guided refinement and proof paths for average-user operator flows:
  - `pluxx-refine-plugin`
  - `/pluxx:refine-plugin`
  - `pluxx-prove-plugin`
  - `/pluxx:prove-plugin`
- the self-hosted plugin now also has a dedicated host-translation review path:
  - `pluxx-translate-hosts`
  - `/pluxx:translate-hosts`
- the self-hosted plugin now has an explicit installed-bundle troubleshooting path:
  - `pluxx-troubleshoot-install`
  - `/pluxx:troubleshoot-install`
- improve install/update clarity and release distribution UX
- keep [docs/release-distribution-proof-map.md](./release-distribution-proof-map.md) current as the short release/distribution/proof source of truth
- treat [docs/proof-and-install.md](./proof-and-install.md) as the first repo-native public proof/install landing page, then push it into a cleaner visual public asset
- keep the flagship public example page aligned with repo truth:
  - `site/examples/docs-ops-flagship.mdx`
- evaluate whether a `gh skill`-compatible export belongs as an additional distribution channel for the skills-only slice of Pluxx output
- keep the plugin/autopilot story honest: starting from a raw MCP should already aim for the strongest native mix of skills, commands, arguments, and specialist agents/subagents, not just a flat skill dump
- keep improving how much mature Claude-first plugin intent `migrate` can preserve on the first canonical Pluxx pass so examples like Exa need less manual tightening

### 5. Customer discovery and GTM learning

Run two learning lanes in parallel:

- MCP vendors
- internal AI platform / DevEx teams

This is for learning and proof, not for prematurely building the full trust layer.

### 6. Next release

The canonical repository version is `0.1.32`, and immutable tag `v0.1.32` exists at `188527e`; the historical published baseline remains 0.1.31. The first release run failed before npm publication or GitHub release creation because its shallow checkout could not reach the current receipt commit. Current repository-validation and fake-home-install receipts remain tied to committed 0.1.32 state; historical 0.1.31 proof was not carried forward as current.

The next npm cut should stay primarily an operations step rather than a code-confidence rescue step.

- prepare and review the 0.1.32 package, proof, and source-of-truth changes in PLUXX-322
- run targeted proof/version/release checks, official serial `npm test`, and `npm run release:check`
- merge the focused recovery PR after substantive checks and review are green
- dispatch the existing `v0.1.32` tag through the trusted main workflow without moving or recreating it
- verify the npm package version, GitHub release, attached tarball, and CLI after the workflow completes

## What This Roadmap Is Optimizing For

The near-term question is no longer whether Pluxx is mechanically credible.

The near-term question is whether Pluxx can become the default way to maintain one plugin source project and ship native outputs across the core four.

## Next OSS Leverage After The Current Block

These matter, but they are not the immediate center:

### Mature-plugin orchestration parity

- use Compound Engineering 3.19.0, Hyperframes, and Superpowers as pinned reference fixtures
- preserve its reliable Codex skill-owned generic-subagent behavior
- keep the restored PLUXX-324 migration gate green: deterministic supported-manifest reconciliation, provenance, staged schema validation, and no destination publication on failure
- implement the accepted ninth `orchestration` bucket without overloading standalone `agents`
- represent typed artifact dataflow, bounded dispatch, artifact completion, and targeted repair from Hyperframes
- represent lifecycle activation/re-injection, reachable versus orphaned roles, mandatory gates, durable progress/resume, and review loops from Superpowers
- represent safe per-dispatch child-environment inheritance and overrides across existing capability, permission, and runtime payloads
- compile honest preserve/translate/degrade/drop outcomes across all 11 current targets
- keep copied payload, generated fixture, installed state, and real-host behavior as separate evidence tiers
- review Antigravity versus Gemini CLI and any other CE-only destinations as a later host-portfolio decision, not automatic scope
- use [the primitive audit](./orchid/requirements/2026-07-13-compound-engineering-primitive-audit.md), [three-reference comparison](./orchid/requirements/2026-07-14-orchestration-reference-patterns.md), [accepted decision](./orchid/decisions/2026-07-14-orchestration-primitive.md), and [phased plan](./orchid/plans/2026-07-13-compound-engineering-parity-plan.md) as the decision and sequencing artifacts

### Import and discovery depth

- import beyond plain `tools/list`
- better use of MCP resources and resource templates
- more product-shaped imported scaffolds

### Auth depth

- more truthful remote MCP auth handling
- OAuth-ready scaffold support
- clearer auth hints and validation

### Eval and regression confidence

- `pluxx eval` now separates scaffold contracts from an eight-criterion deterministic semantic rubric
- warning and failure thresholds are configurable per project
- adversarial incoherence, the self-hosted plugin, the flagship plugin, and docs-ingestion projects are maintained regression inputs
- model-assisted grading remains optional future depth, not a prerequisite for deterministic release confidence

### Migration and sync depth

- stronger `pluxx migrate`
- safer `pluxx sync`
- clearer change visibility after sync

### Compatibility truthfulness

- keep the core-four matrix current
- keep preserve/translate/degrade/drop visible
- use the row-level appendices in:
  - [docs/core-four-primitive-matrix.md](./core-four-primitive-matrix.md)
  - [docs/core-four-branding-metadata-audit.md](./core-four-branding-metadata-audit.md)
  as the current translation contract
- do not imply equal support where the repo cannot prove it
- use [docs/core-four-provider-docs-audit.md](./core-four-provider-docs-audit.md) to refresh the machine-readable rules and generated compatibility docs after each major host-doc review
- use [docs/core-four-translation-hit-list.md](./core-four-translation-hit-list.md) to close the remaining registry, generator, explainability, and proof work for every mapped row

## Strategic Horizon: Trust / Distribution Layer

This is strategically important, but it is not the current execution queue.

Potential surfaces:

- organization-wide rollout
- managed distribution
- signing / provenance / attestations
- compatibility verification artifacts
- runtime health and adoption visibility
- approval and policy controls

This is the clearest plausible paid extension of the OSS wedge.

But Pluxx should earn the right to build it by first becoming the best OSS authoring substrate.

## Explicitly Deferred

These may become important later, but they should not drive the roadmap now:

- plugin marketplace / commerce
- private registry complexity beyond initial design
- skill-pack economy bets
- deep enterprise governance before real demand exists
- trying to support every host equally

## Linear Note

Use [Linear](https://linear.app/orchid-automation) for issue-by-issue sequencing, ownership, and project-level detail.
