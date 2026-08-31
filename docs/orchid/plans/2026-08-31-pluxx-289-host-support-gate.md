# PLUXX-289 — New-host support acceptance gate and capability matrix

## Context

Pluxx already owns machine-readable host rules, generated compatibility docs,
native-overlay policy, proof receipts, and maintained core-four fixtures. What it
does not own is one reusable gate that says exactly when a generated target may
be described as generated, isolated-installed, discovered, behaviorally
verified, or supported.

That omission now matters. Pluxx 0.1.42 ships a strict Agent Plugins v1 portable
floor, MDP 0.1.101 consumes it, and MDP-218 chose **further narrow: keep Pluxx,
do not switch**. Cursor's current first-party plugin docs explicitly distinguish
portable Agent Plugins (skills and MCP) from Cursor-native rules, agents,
commands, hooks, and variables. Codex still has no documented generic root
Agent Plugins import path. Generated-file presence must therefore never be
promoted into a runtime support claim.

## Objective

Add one repo-owned, evidence-tiered host-support contract that:

1. separates portable Agent Plugins core from native enhancement overlays;
2. makes `unsupported`, `degraded`, and `not-yet-behaviorally-proven`
   first-class outcomes;
3. binds every support claim to the minimum acceptable evidence tier;
4. renders a maintained matrix from the same typed registry tested in code;
5. exercises the gate with one isolated fixture and no active-home mutation;
6. gives SendLens, MDP, and future plugins a stable Pluxx URL to cite.

## Source and product boundaries

- Source ref: `origin/main` at the planning base.
- Writable repository: `orchidautomation/pluxx` only.
- No new host, no target graduation, no version bump, no release, no
  publication, and no active-home installation.
- Do not infer portable hooks, agents, commands, scripts, permissions, or
  background processes from Agent Plugins v1.
- Do not claim real-host discovery from schema, generated-tree, or fake-client
  fixtures.
- Current first-party docs must be refreshed at action time and recorded with
  the retrieval date. Provider docs, not Pluxx assumptions, own capability
  existence; observed fixtures own runtime proof.

## Contract design

Create `src/compatibility/host-support-gate.ts` with closed unions and readonly
registries for:

- claim layer: `portable-core | native-overlay`;
- capability outcome: `portable | native-preserved | translated | degraded |
  unsupported | not-yet-behaviorally-proven`;
- proof tier: `schema | generated-fixture | isolated-installed | discovered |
  behavioral`;
- maintenance tier: `primary | beta | portable`;
- capability dimensions required by PLUXX-289: startup/context delivery,
  portable skills, declared MCP, native commands, specialist agents/subagents,
  structured MCP content, background behavior, local file/script permissions,
  and install/update/uninstall mechanics.

The registry must expose deterministic validation and Markdown rendering. Every
host/dimension claim records its layer, outcome, minimum proof tier, current
evidence tier, exact evidence reference or explicit limitation, first-party
source URLs, and retrieval date. Validation fails closed when:

- a support-like outcome lacks enough evidence;
- portable core claims an out-of-contract capability;
- behavioral support lacks a transcript, structured runtime log, or maintained
  behavioral fixture reference;
- a discovered/install claim is backed only by generation/schema evidence;
- a source URL is absent or not first-party;
- a primary/native claim is not backed by a maintained proof artifact.

## Maintained fixture

Add a small fixture under `test-fixtures/host-support-gate/` containing one
strict Agent Plugins package and its evidence manifest. It must exercise the
validator in an isolated temporary home and prove only package validation plus
fixture-level discovery. It must include negative cases demonstrating that
generated files alone cannot satisfy discovery or behavioral tiers, that
portable hooks/agents are rejected, and that `unsupported`, `degraded`, and
`not-yet-behaviorally-proven` remain valid bounded outcomes.

No test may inspect or mutate Brandon's active host homes.

## Documentation delta

- Add `docs/new-host-support-gate.md` as the reusable checklist and rendered
  capability/evidence matrix.
- Refresh `docs/core-four-provider-docs-audit.md` with action-time first-party
  sources and the portable/native distinction.
- Link the gate from `docs/compatibility.md`,
  `docs/core-four-primitive-matrix.md`, and the generated site compatibility
  surface without duplicating host quirks.
- Update `docs/start-here.md`, `docs/todo/queue.md`,
  `docs/todo/master-backlog.md`, and `docs/roadmap.md` to mark PLUXX-289 as the
  active support-policy lane and PLUXX-309 as its downstream docs refresh.
- Keep public claims explicit: Cursor documents Agent Plugins local loading;
  Codex portable import remains undocumented and native-only; fixture evidence
  is not real-host proof.

## Acceptance mapping

| Linear acceptance criterion | Implementation | Proof |
| --- | --- | --- |
| Minimum evidence checklist exists | Typed tier/outcome contract plus `docs/new-host-support-gate.md` | Unit tests cover all tier transitions and fail-closed cases |
| Portable and native overlays are separate | Each matrix row carries an explicit layer and portable-contract validator | Tests reject portable hooks/agents/commands and native-overclaim mixing |
| Bounded negative outcomes are first-class | Closed outcome union and renderer definitions | Snapshot/semantic assertions cover unsupported, degraded, and unproven rows |
| One maintained fixture exercises the gate | Isolated Agent Plugins fixture with evidence manifest | Temp-home validation/discovery fixture passes; overclaim variants fail |
| Downstreams can cite one matrix | Stable public doc plus generated site mirror/link | Docs/link and byte-sync tests pass |
| Current first-party docs are linked | Action-time source registry with `2026-08-31` retrieval date | Tests require first-party URLs and current date |
| Gaps produce follow-ups | Document exact residual gaps and link existing PLUXX-309 / any newly required Linear issues | Readback confirms relations and docs identify owners without claiming closure |

## Owned files

- `src/compatibility/host-support-gate.ts`
- `scripts/generate-host-support-gate.ts`
- `tests/host-support-gate.test.ts`
- `test-fixtures/host-support-gate/`
- `docs/new-host-support-gate.md`
- `docs/core-four-provider-docs-audit.md`
- `docs/core-four-primitive-matrix.md`
- `docs/compatibility.md`
- `site/how-it-works/compatibility-limits.mdx`
- `docs/start-here.md`
- `docs/todo/queue.md`
- `docs/todo/master-backlog.md`
- `docs/roadmap.md`
- `package.json` only if a deterministic generation/check script is required.

## Forbidden files and actions

- Do not alter generators, schema target lists, installers, publishers, version
  files, release workflows, proof receipts, or active-home paths.
- Do not alter Agent Plugins v1 schema/overlay policy to make a fixture pass.
- Do not merge, tag, publish, release, deploy, or install into a real host.

## Ordered implementation

1. Refresh official Claude Code, Cursor, Codex, OpenCode, and Agent Plugins
   sources; record canonical URLs, retrieval date, and unsupported gaps.
2. Implement the closed support-gate registry, tier ordering, validation, and
   deterministic renderer.
3. Add the strict isolated fixture plus adversarial evidence/overclaim tests.
4. Generate the reusable support-gate doc and synchronize compatibility/site
   links.
5. Update current-truth planning docs without reopening MDP-218.
6. Run focused tests, generation byte-sync, typecheck, build, docs/link checks,
   and the practical full suite.
7. Commit, push, open one PR against `main`, and stop for Brandon's review.

## Validation

- `npm run typecheck`
- `npm run build`
- focused Vitest for `tests/host-support-gate.test.ts` and compatibility rules
- deterministic regeneration followed by a clean diff
- repository docs/link checks and `git diff --check`
- `npm test` when the known long suite is practical; disclose any baseline-only
  failure rather than weakening the focused gate

## Rollback

Revert the delivery PR. The change is additive policy/docs/test infrastructure
and does not mutate generated host packages, releases, or installed state.

## Readiness

No dependency remains. PLUXX-289 is ready for one bounded implementation lane
and one human-merge PR. PLUXX-309 remains downstream and blocked until this gate
is merged.
