# 2026-06-26 Pluxx Next Ship Review

## Context

This review answers: what is Pluxx now, what has recently shipped, and what should ship next to make it stronger and more robust.

Sources checked:

- Repo docs: `docs/start-here.md`, `docs/todo/queue.md`, `docs/todo/master-backlog.md`, `docs/roadmap.md`, `docs/core-four-reliability-register.md`, `docs/release-distribution-proof-map.md`, `docs/pluxx-plugin-surface-audit.md`
- Recent commits on `main` through `73a8686 Add install reference syntax parser (#377)`
- Linear projects and issues, especially:
  - `Pluxx Primitive Compiler Hardening`
  - `Pluxx Cross-Host Robustness From Superpowers`
  - `Pluxx Install Surface and Trust UX`
  - `Competitive readiness`
  - `Pluxx OSS Launch / GTM`
  - `PLUXX-196`, `PLUXX-226`, `PLUXX-248`, `PLUXX-264`, `PLUXX-191`, `PLUXX-193`, `PLUXX-188`, `PLUXX-190`
- AgentRig public repo cloned read-only at `/private/tmp/agentrig-review-20260626`

## Product Read

Pluxx is no longer mainly a theoretical cross-host compiler. It is now an OSS authoring substrate for maintaining one plugin source project and producing native outputs for Claude Code, Cursor, Codex, and OpenCode.

The sharp wedge is still:

- import or migrate real MCP-backed/native plugin surfaces
- maintain one canonical source project
- compile honest native host outputs
- verify installed state and runtime behavior
- keep source, generated bundle, installed bundle, docs, and proof aligned

The wrong move would be to collapse the story into generic "build once, run anywhere" distribution copy. Linear issue `PLUXX-196` already calls out AgentRig as a real competitor on that broad framing. Pluxx should keep winning on authoring, compilation, maintenance, and proof, while selectively borrowing install/trust ideas.

## Recently Shipped

The recent shipped work is mostly robustness and installed-state hardening:

- install reference syntax parsing
- local docs ingestion cleanup
- Codex companion apply command
- centralized host install discovery truth
- tighter Node runtime launcher contract
- stronger MCP sync metadata validation
- generated bundle drift checks
- Codex cache content verification during install checks
- deeper core-four reliability proof
- docs/runtime contract updates
- shared command and agent capability truth
- generated hook portability hardening
- host adapter bundle behavior tests
- release workflow runtime update
- saved installer `userConfig` reuse on reinstall
- release `v0.1.22`

This means the next work should not be another broad rewrite. The codebase has already been moving toward tighter contracts. The next slice should deepen that into one visibly useful workflow.

## AgentRig Ideas Worth Stealing

AgentRig has several product ideas Pluxx should absorb without copying its category posture:

- Selection installs: install only selected skills, MCPs, or hooks from a larger plugin.
- Closure checks: refuse selected installs when required files or dependencies live outside the selected artifact root.
- Install ledger: record files and JSON writes with hashes so uninstall/prune only removes values the tool still owns.
- Trust tiers: separate discovery from installability; listed is not installable, reviewed/official is.
- External repo provenance: scanned repos are useful source material, not trusted registry artifacts.
- Rigs: named profiles that apply multiple plugins together.
- Security hooks: block forbidden staged files and run secret/misconfig checks.

The Pluxx-shaped version should be compiler-first: make those concepts support source-project authoring, installed verification, and distribution proof rather than turning Pluxx into only a registry installer.

## Recommended Next Ship

Ship a first-class Codex companion apply and verify workflow.

This maps directly to existing Linear:

- `PLUXX-226`: Make Codex companion application and verification a first-class workflow
- `PLUXX-264`: Implement a Codex apply flow for generated hooks, readiness, and companion config
- `PLUXX-248`: Add Codex hook apply/verify workflow and hook behavioral proof

Why this is the best next slice:

- It improves real robustness where Pluxx currently has an honest gap: Codex cannot natively preserve every primitive from generated bundle files alone.
- It makes generated companion artifacts operational instead of advisory.
- It continues the recent shipped pattern: installed-state and runtime truth over file-shape claims.
- It is concrete enough to ship and test, unlike a broad trust-layer/control-plane push.
- It gives public docs a sharper claim: Pluxx does not just warn about host degradation; it helps apply and verify the external state needed to make the target behave.

Minimum shippable behavior:

- Add or complete a `pluxx codex apply` path that reads generated Codex companion artifacts from a built plugin.
- Apply safe, reviewable config stanzas for hooks, readiness, MCP approvals, and other companion config where current host behavior requires external wiring.
- Back up or diff target config before modifying it.
- Print exactly what was applied, skipped, already present, or unsafe.
- Add `pluxx codex verify` or fold verification into `verify-install` so the tool checks active project/user config, plugin cache state, generated companion artifacts, and known Codex caveats.
- Add tests for idempotency, stale config, malformed companion artifacts, and no-op behavior when companion files are absent.
- Update docs and the self-hosted Pluxx plugin workflow so users can discover the path from inside a host.

## Follow-On Slice

After Codex companion apply/verify, ship install ownership tracking.

This maps to:

- `PLUXX-191`: Track install ownership for safe uninstall and prune flows
- `PLUXX-193`: Prototype multi-plugin environment apply workflow
- `PLUXX-188`: Define discovery index vs installable registry contract
- `PLUXX-190`: Design trust tiers and policy language for plugin installs

AgentRig's ledger pattern is the useful model here. Pluxx should track installed files and host JSON writes with hashes, then use that ledger for conservative uninstall, prune, reinstall, and "what did Pluxx touch?" diagnostics.

## Defer

Defer these until the apply/verify and ledger layers are real:

- broad managed trust/distribution control plane
- marketplace submission APIs
- generic registry-first positioning
- new first-class host expansion beyond the current beta lanes
- multi-plugin rigs as a product centerpiece

Those can matter later, but they are weaker than improving the concrete install/runtime truth today.

## Repo Hygiene Note

The Orchid repo preflight found the repo usable but missing the standard `docs/orchid/*` artifact tree and the private scratch ignore entry. This decision note starts the durable artifact path. A future repo-hygiene task should run the full Orchid repo setup if the team wants all standard artifact folders and hooks installed.
