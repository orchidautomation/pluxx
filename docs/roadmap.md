# Roadmap

Last updated: 2026-05-01

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
  - [docs/pluxx-plugin-surface-audit.md](./pluxx-plugin-surface-audit.md)
  - [docs/pluxx-self-hosted-core-four-proof.md](./pluxx-self-hosted-core-four-proof.md)
  - [docs/core-four-provider-docs-audit.md](./core-four-provider-docs-audit.md)
  - [docs/core-four-translation-hit-list.md](./core-four-translation-hit-list.md)
  - [docs/core-four-maintenance-routine.md](./core-four-maintenance-routine.md)
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

## Current Priority Order

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
- the next translation follow-ons are now clearer and narrower:
  - finish the deeper hook-registry rollout so generator routing and docs rows read registry-backed truth
  - continue the new shared `skills` parser into a richer canonical skill spec and translation-aware metadata layer
  - continue the `commands` IR pass beyond `argument-hint` preservation into richer argument/routing metadata
  - reduce lossy import paths in `migrate` and installed-MCP discovery
  - continue the runtime registry rollout now that installed hook env parity also translates across Cursor, Codex, and OpenCode
- the current execution spec for that compiler-hardening tranche now lives in:
  - [docs/primitive-compiler-hardening-architecture.md](./primitive-compiler-hardening-architecture.md)
- example and packaged-runtime parity are back in sync:
  - `examples/prospeo-mcp` now bundles its `scripts/` payload and points at the official `@prospeo/prospeo-mcp-server` package
- the release gate is green again as of 2026-04-30:
  - `npm test`
  - `npm run release:check`
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
- the published npm package now includes the Claude plugin-agent manifest fix
- the public `pluxx test --install --trust --behavioral` path now reflects the same Claude state as the repo-local Exa proof
- the remaining Exa rerun gap is now narrower and host-local:
  - fresh Cursor CLI reruns currently hit a local macOS keychain/auth issue on this machine
- the Exa example also sharpened the import-quality question:
  - a raw import or migration can already get to a credible starting point
  - the next product leverage is making that first pass recover more of the final workflow architecture and packaging quality automatically
- the next proof steps are capturing at least one polished in-app walkthrough beyond Codex, then running a real authenticated publish plus rollback against a safe private target

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
- improve install/update clarity and release distribution UX
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

The next npm cut is now primarily an operations step rather than a code-confidence step.

The remaining release checklist is:

- bump `package.json` to the next version
- commit and push the release-prep fixes and source-of-truth updates
- push the matching `vX.Y.Z` tag to trigger the GitHub Actions publish workflow
- verify the npm package version, GitHub release, and attached tarball after the workflow completes

## What This Roadmap Is Optimizing For

The near-term question is no longer whether Pluxx is mechanically credible.

The near-term question is whether Pluxx can become the default way to maintain one plugin source project and ship native outputs across the core four.

## Next OSS Leverage After The Current Block

These matter, but they are not the immediate center:

### Import and discovery depth

- import beyond plain `tools/list`
- better use of MCP resources and resource templates
- more product-shaped imported scaffolds

### Auth depth

- more truthful remote MCP auth handling
- OAuth-ready scaffold support
- clearer auth hints and validation

### Eval and regression confidence

- stronger `pluxx eval` coverage
- more stable fixtures around prompt-pack quality
- reference-plugin and docs-ingestion fixtures

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
