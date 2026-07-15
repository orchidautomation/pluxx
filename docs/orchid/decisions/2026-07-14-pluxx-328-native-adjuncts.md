---
title: Recover Native Adjuncts Inside the Distribution Bucket
type: decision
date: 2026-07-14
status: accepted
decision_owner: Brandon Guerrero
product_contract_source: linear-pluxx-328
implementation_status: phase-5-complete-local
---

# Recover Native Adjuncts Inside the Distribution Bucket

## Decision

Native manifests, registration catalogs, lifecycle entrypoints, helper payloads, host-native extensions, and source-only release/install evidence remain compiler-owned adjuncts of the existing `distribution` bucket. They do not become a tenth canonical bucket or a second capability table.

The adjunct source contract binds every row to source fixture/plugin identity and version, pinned revision, canonical inventory digest, exact file digest, executable mode, canonical owner, availability, and evidence tier. Receipts separately bind the compiled plugin identity/version so fixture evidence cannot be confused with the generated artifact. Host outcomes are compiled as preserve, translate, degrade, or drop for Claude Code, Cursor, Codex, and OpenCode only.

## Pinned Inventory

- Compound Engineering `f871e4b4308f5a175b38ccada51d80dd67bab4fc`, inventory digest `4c82f2038ca4fd09a7b19473d3b890e2d0b10b1e6c9c19f1971c64b5ec33a1d5`: 12 rows.
- Hyperframes `6933e8acda57268da9a40e0adf3d99c85059d2b5`, inventory digest `24b7f88fdbafe069b5e895ffc5a54aa88ea1e4d4b54dacfbf25ad028cd3f2635`: 15 rows.
- Superpowers `d884ae04edebef577e82ff7c4e143debd0bbec99`, inventory digest `05366194b55a6d1bbd61fb9dd3327ec5a55b026a80bf779edb815e26494cbed8`: 17 rows.
- Total: 44 exact source rows compiled across four hosts into 176 receipt rows.

The checked receipt portfolio records 44 identity translations, 112 source-inspected degradations, and 20 intentional drops. It records no copied-output preservation because the pinned repositories are inspected external fixtures rather than vendored publication inputs. Present files recovered by `pluxx migrate` are separately proven to publish through the existing transactional file-mutation layer with exact digest, mode, identity, and collision checks.

## Refusal And Ownership Contract

- Manifest identity or overlapping host-native field ambiguity refuses publication.
- Owner values derive from the nine canonical compiler buckets and host values derive from the existing core-four install/discovery registry; there is no adjunct capability table.
- Duplicate adjunct identities, path escapes or symbolic-link components, unavailable required inputs, missing declared entrypoints, digest/mode mismatches, reserved targets, and any pre-existing or co-publishable non-manifest target collision refuse before partial output.
- The migration boundary refuses local override material and never treats it as a publishable adjunct.
- Payloads and `distribution/adjuncts.receipt.json` publish in one filesystem transaction and roll back together.
- Generated adjunct receipts are installed through the existing install-ownership layer. Copy installs bind the exact receipt entry; symlink installs bind the owned bundle root and matching installed receipt bytes.
- Receipt validation recomputes the canonical source inventory digest, current registry outcomes, owned-output topology, compiler output digest, and receipt digest. Runtime proof additionally cross-binds receipt and ownership record digests to exact SHA-256 facts before ownership can count as proven.

## Evidence Boundary

Twelve deterministic `fake-home-install` receipts bind source fixture/plugin identity and version, compiled plugin identity and version, pinned revision/inventory digest, host, 44-row inventory, 176 compiled outcomes, exact compiler digest, installed receipt digest, and ownership evidence. The pinned-source audit independently rehashed all 44 files and executable modes against the three exact revisions. Generated catalogs or registration files remain isolated artifacts. They are not evidence that a real host discovered or activated the plugin.

Phase 3 residual truth remains authoritative: real-host discovery is environment-unavailable in all 12 cases, activation is unsupported, behavioral runtime is environment-unavailable, and all 324 orchestration outcomes remain degraded.

## Phase 6 Handoff

Phase 6 should make this frozen core-four portfolio release-gating: rerun the exact-revision 44-file source audit, verify receipt freshness and exact 12-case determinism, exercise both symlink and copied install-ownership preimages, validate migration/generator compatibility-doc derivation, and preserve the unchanged real-host evidence boundary. Secondary hosts remain outside the initiative.

## Related Artifacts

- [PLUXX-328 implementation plan](../plans/2026-07-14-pluxx-328-native-adjuncts.md)
- [Orchestration primitive decision](./2026-07-14-orchestration-primitive.md)
- [Compound Engineering parity plan](../plans/2026-07-13-compound-engineering-parity-plan.md)
- [Core-four primitive matrix](../../core-four-primitive-matrix.md)
