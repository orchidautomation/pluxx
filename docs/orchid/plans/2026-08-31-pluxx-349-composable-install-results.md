# PLUXX-349 — Composable install planning and structured per-target results

## Context and current behavior

Pluxx already owns deterministic core-four host evidence in
`src/host-detection.ts`. `pluxx install --dry-run --json` exposes that report,
but generated GitHub release installers do not consume it. The generated
`install.sh --agents` currently selects every built core-four target, special
cases only a missing Claude CLI, streams decorative child output, and returns no
machine-readable per-target terminal record.

Each generated host installer in `src/cli/publish.ts` performs checksum,
ownership, staging, verification/setup, swap, and rollback work independently.
The templates share transaction helpers but not a public result protocol. An
already-current owned install is replaced again, and an aggregate caller must
infer install/update/skip/failure state from prose and exit codes.

## Objective

Make generated release installation a composable public contract while
preserving the existing human front door and safety behavior:

1. expose one deterministic aggregate plan based on the reusable core-four
   host-detection contract;
2. give every selected target exactly one structured terminal result;
3. distinguish `installed`, `updated`, `unchanged`, `skipped`, and `failed`;
4. make a verified already-current owned install a real no-op;
5. keep aggregate missing-host semantics permissive and explicit-target
   semantics strict; and
6. keep checksum, ownership, verification/setup, transaction, and rollback
   failures visible with bounded corrective action.

## Scope and design

### Shared contract

Add exported TypeScript contract types and validation/rendering helpers in a
small installer-contract module. The versioned JSON envelope will carry the
plugin/release identity, selection mode, deterministic core-four plan, and one
terminal result per selected target. Result records will use a closed state
union:

- `installed`
- `updated`
- `unchanged`
- `skipped` plus a stable reason and human action when relevant
- `failed` plus a bounded error summary and corrective action

Generated shell will emit newline-safe JSON through Node helpers rather than
constructing JSON with shell interpolation. `--json` will reserve stdout for
the final envelope; `--quiet` will suppress decorative progress while leaving
stderr failures and required operator action intact. Human mode remains the
default.

### Detection and planning

Refactor the core-four evidence inventory in `src/host-detection.ts` into data
that can also render the generated-installer detector without changing current
TypeScript detection behavior. Generated `install.sh` will evaluate the same
machine-level evidence classes in stable core-four order against the active
`HOME`, `PATH`, supported app locations, user config, and existing install
locations. Project-only evidence remains explanatory and never selects a host.

`--agents`/`--all` is aggregate mode: built targets are planned in stable order,
detected targets run, and absent targets produce `skipped` with a stable
`host-not-detected` reason. Any explicit `--<host>` flag is authoritative:
that target is planned even when not detected, and a missing required host
prerequisite yields `failed` instead of `skipped`. Multiple explicit flags
remain deterministic. The plan is available without applying changes through
a machine-readable planning option, and execution reuses that exact selection.

### Per-host execution and idempotency

Every generated host installer will accept the common internal/public result
options and emit one result record. It will classify a fresh destination as
`installed`, a prior current owned destination as `unchanged`, and a successful
replacement/adoption as `updated`.

Before starting a swap, add a fail-closed current-install preflight that checks:

- the normal ownership ledger identity and install path;
- owned entry integrity (no missing, modified, or unowned bundle files);
- candidate/installed manifest identity and version;
- target-specific owned companion surfaces that the installer is responsible
  for (Claude marketplace state where applicable, Codex registrations/config
  prerequisites where installer-managed, and OpenCode wrapper/skill ledgers).

Only a fully current, owned, verified installer state may return `unchanged`.
Legacy unowned installs still follow the existing one-time adoption path and
report `updated`; damaged or incomplete state follows existing repair/refusal
rules rather than being mislabeled unchanged. No-op detection must occur before
the destination swap and must not weaken secret reuse/reconfigure behavior.

The top-level installer will capture child JSON and child exit status, convert
unexpected child failure into exactly one bounded `failed` result, continue far
enough to report a truthful partial-failure summary, and exit nonzero whenever
any target failed. It will never report success before the child installer has
completed its existing verification/setup and transaction commit.

## Out of scope

- MDP Rust CLI policy, version/update logic, or branded summary copy.
- New hosts or guessed Agent Plugins destinations.
- Publishing, releasing, active-home installation, or merging.
- The PLUXX-186 React/embeddable install UI.
- Changes to the native/portable capability boundary.

## Acceptance mapping

| Acceptance criterion | Implementation | Proof |
| --- | --- | --- |
| Deterministic core-four plan without copied host logic | Shared detection inventory plus generated aggregate planner | TypeScript parity tests and temporary HOME/PATH/config aggregate fixtures |
| Exactly one terminal result per selected target | Versioned result schema, child protocol, aggregate collector | JSON schema/state/count assertions including partial failure |
| Already-current owned install is a no-op | Ownership/identity/companion preflight before swap | Repeat each core-four generated installer and assert `unchanged` plus unchanged destination/ledger metadata |
| Aggregate absent hosts skip; explicit absent host fails | Selection-mode-aware planner and prerequisite gate | Mixed-host fixtures and explicit missing-prerequisite fixtures |
| Quiet/JSON output has no decoration | Shared output gates; stderr retains errors/actions | stdout/stderr snapshot assertions for success and failure |
| Existing safety behavior remains | Reuse current checksum, ownership, staging, verification/setup, rollback code | Existing tamper, ownership, lock, signal, runtime, companion, and rollback tests remain green |
| Downstream adoption needs no prose scraping | Document schema, flags, exit rules, examples | Consumer contract section in install lifecycle/distribution docs |

## Affected files and ownership

Primary implementation ownership for the single lane:

- `src/host-detection.ts`
- new `src/install-contract.ts` (or an equivalently narrow shared module)
- `src/cli/publish.ts`
- `src/index.ts` only if the public contract must be exported there
- `tests/host-detection.test.ts`
- `tests/publish.test.ts` and narrowly related generated-installer fixtures
- `docs/core-four-install-update-lifecycle.md`
- `docs/release-distribution-proof-map.md` only if its product-truth summary
  needs the new contract

Forbidden without escalation: MDP files, release/version files, workflows,
active user homes/config, portable Agent Plugins semantics, unrelated roadmap
or backlog rewrites.

## Ordered implementation steps

1. Define the closed plan/result schemas, stable reason/action fields, selection
   modes, JSON validation, and human rendering contract.
2. Make the reusable host-evidence inventory renderable to generated installers
   while preserving existing `detectHostFamilies()` behavior and order.
3. Add aggregate plan/JSON/quiet flags and strict explicit-target semantics to
   generated `install.sh`; keep existing default human behavior compatible.
4. Add the common child result protocol to all four host installers and ensure
   failure traps cannot produce zero or duplicate terminal records.
5. Add fail-closed current-owned-install preflight and return `unchanged`
   before swap only when bundle and installer-managed companion state are
   current; preserve legacy adoption, verification/setup, rollback, locking,
   and reconfiguration semantics.
6. Aggregate child results, render one concise human summary, and set the final
   exit status from terminal states without hiding partial success or actions.
7. Add temporary HOME/PATH/config and fake-release fixtures for all four hosts,
   mixed detection, repeat no-op, explicit missing prerequisite, quiet/JSON,
   update, and partial failure. Retain adversarial existing tests.
8. Document the stable consumer protocol and exact aggregate versus explicit
   behavior. Avoid release or downstream MDP claims.

## Tests and validation

Focused:

- `npm test -- --run tests/host-detection.test.ts tests/publish.test.ts` (or the
  repository-supported equivalent focused Vitest invocation)
- generated top-level planner JSON for empty, mixed, and all-host fake homes
- each core-four per-host installer for fresh, update, unchanged, and failure
- aggregate partial failure and strict explicit missing-prerequisite cases
- existing checksum, ownership, lock, rollback, runtime, Codex, and OpenCode
  generated-installer tests

Required repository checks:

- `npm test`
- `npm run typecheck`
- `npm run build`
- `npm pack --dry-run` (use `npm run pack:check` if repository tooling requires
  the wrapper)

## Compatibility, rollout, and rollback

Existing human installer commands remain valid. New machine-readable flags are
additive. `--agents` becomes host-aware by design; explicit flags preserve
strict intent. The JSON schema is versioned so MDP can adopt it without binding
to prose. Rollback is a revert of this PR; no published artifact or user-home
migration occurs in this lane.

## Risks and stop conditions

- Do not classify an install as unchanged from version or file presence alone.
- Do not turn explicit prerequisite failures into silent skips.
- Do not print progress to JSON stdout.
- Do not emit success until existing verification/setup and commit paths finish.
- Stop and escalate if a target-specific no-op check cannot prove all
  installer-owned companion state without weakening current ownership rules.
- Stop before merge, release, deployment, or MDP changes.

## Readiness verdict

Dependencies PLUXX-301 and PLUXX-256 are complete, the issue is already In
Progress with no blockers, and the repository has maintained generated-installer
fixtures for every affected safety surface.

**Readiness: `READY_TO_PIN`.** Execute one issue-bound implementation lane and
deliver one cumulative PR for Brandon-only merge.
