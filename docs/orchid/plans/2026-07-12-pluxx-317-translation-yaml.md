---
title: Translation Truth and YAML - Plan
type: refactor
date: 2026-07-12
artifact_contract: ce-unified-plan/v1
artifact_readiness: implementation-ready
product_contract_source: linear-pluxx-317
execution: code
---

# Translation Truth and YAML - Plan

## Goal Capsule

- Make field outcomes the executable source of truth for skill and hook translation across generators, lint, doctor, compatibility summaries, and generated docs.
- Replace regex and comma-based skill frontmatter parsing with normalized YAML nodes that retain source provenance and expose unsupported shapes explicitly.
- Keep scope to PLUXX-317; command and agent parser migrations are not part of this change.
- Stop if a required supported shape cannot be represented without weakening existing canonical metadata behavior.

---

## Product Contract

### Problem Frame

Bucket-level `preserve` claims currently contradict field-level loss in skills and hooks. The shared skill reader also treats valid YAML as line-oriented text, so multiline scalars, quoted commas, nested values, and arrays can be misread or silently ignored.

### Requirements

#### Translation truth

- R1. One field-level registry must describe skill and hook outcomes per core-four host with `preserve`, `translate`, `degrade`, or `drop`, native surfaces, and explanation text.
- R2. Primitive skill and hook modes must be derived from their field outcomes, so `preserve` cannot coexist with an unreported weaker outcome.
- R3. Generators, lint, doctor summaries, compatibility renderers, and generated docs must consume the same modeled truth.
- R4. Compatibility output must remain byte-deterministic across repeated generation.

#### YAML metadata

- R5. Skill frontmatter must be parsed by a real YAML parser into normalized top-level metadata nodes with source line/column provenance.
- R6. Supported scalar, multiline scalar, quoted-comma, sequence, and nested hook shapes must normalize consistently into canonical skill metadata.
- R7. Invalid YAML and unsupported value shapes must be represented explicitly for lint instead of being silently ignored.
- R8. Existing frontmatter rewrite paths must preserve original YAML text except for the fields they intentionally change.

### Acceptance Examples

- AE1. Given `allowed-tools: ["Read, carefully", Bash]`, parsing returns two values and retains the comma inside the quoted item.
- AE2. Given a block scalar description, parsing returns the complete scalar and provenance points to the description node.
- AE3. Given nested hook mappings and sequence-form `paths`, canonical metadata retains their structured values.
- AE4. Given a supported key with an unsupported mapping where a string is required, lint reports that key, shape, and source location.
- AE5. Given a platform with any degraded or dropped audited skill/hook field, its primitive bucket is not labeled `preserve`.

### Scope Boundaries

- Do not migrate command or agent frontmatter parsers in this ticket.
- Do not change host capability claims beyond audited skill and hook fields.
- Do not alter install, publish, runtime, or permission behavior.

---

## Planning Contract

### Key Technical Decisions

- KTD1. Add the maintained `yaml` package as a runtime dependency and parse with document APIs that expose node ranges; a JSON-only conversion would lose provenance.
- KTD2. Normalize top-level metadata once in `src/skills.ts`, retaining raw frontmatter lines for narrow rewrite compatibility and exposing diagnostics for invalid or unsupported nodes.
- KTD3. Introduce shared translation registry types and aggregate helpers, then express skill and hook truth through those helpers. A mixed primitive with partial field loss is `degrade`; `drop` is reserved for primitives whose audited fields all drop.
- KTD4. Keep field registries independent of a particular plugin instance. Bucket truth describes audited capability, while lint reports only fields actually present in the source.
- KTD5. Generate field-detail rows from registry order rather than object iteration or filesystem order to preserve determinism.

### Sequencing

Implement YAML normalization and its tests first, then the translation registry and derived bucket capabilities, then connect consumers and regenerate documentation. This separates parser failures from truth-model failures during validation.

### Risks and Dependencies

- The `yaml` dependency becomes runtime package surface and requires lockfile plus supply-chain review.
- Existing Claude visibility rewrites depend on raw frontmatter lines; tests must prove their narrow-edit behavior remains intact.
- Changing bucket modes will intentionally change doctor/lint summaries and generated matrix docs; snapshots must be regenerated from the registry rather than hand-edited.

---

## Implementation Units

### U1. YAML-backed normalized skill metadata

- **Goal:** Satisfy R5-R8 with one parser and explicit diagnostics.
- **Requirements:** R5, R6, R7, R8; AE1-AE4.
- **Files:** `package.json`, `package-lock.json`, `src/skills.ts`, `tests/skills.test.ts`, `tests/lint.test.ts`.
- **Approach:** Parse the delimited frontmatter as YAML, retain top-level node provenance, normalize known fields by expected type, and expose parse/shape diagnostics without discarding raw lines used by serializers.
- **Test scenarios:** multiline descriptions; quoted commas; flow and block arrays; nested hook objects; booleans; invalid YAML; supported keys with wrong node kinds; deterministic provenance line/column; unchanged narrow serialization.
- **Verification:** `npx vitest run tests/skills.test.ts tests/lint.test.ts`.

### U2. Unified field-level skill and hook translation registry

- **Goal:** Satisfy R1-R2 and remove false `preserve` claims.
- **Requirements:** R1, R2; AE5.
- **Files:** `src/translation-registry/types.ts`, `src/translation-registry/skills.ts`, `src/translation-registry/hooks.ts`, compatibility shims in `src/skill-translation-registry.ts` and `src/hook-translation-registry.ts`, `src/validation/platform-rules.ts`, `tests/platform-rules.test.ts`.
- **Approach:** Model ordered field entries and platform outcomes, derive primitive capabilities from their aggregate, and preserve existing public helper APIs where practical.
- **Test scenarios:** every audited field has all core-four outcomes; aggregate mode follows weakest outcome; no preserved primitive contains an unreported weaker outcome; current field warning messages remain registry-backed.
- **Verification:** `npx vitest run tests/platform-rules.test.ts tests/hooks-warning.test.ts tests/lint.test.ts`.

### U3. Consumer and generated-doc alignment

- **Goal:** Satisfy R3-R4 across CLI summaries and public compatibility truth.
- **Requirements:** R3, R4.
- **Files:** `src/compatibility/core-four-primitives.ts`, `src/cli/primitive-summary.ts`, `src/cli/doctor.ts`, `src/cli/lint.ts`, `scripts/generate-compatibility-matrix.ts`, generated compatibility docs, `tests/compatibility-matrix.test.ts`, `tests/doctor.test.ts`, `tests/lint-cli.test.ts`.
- **Approach:** Render field details and derived modes from the same ordered registry, regenerate checked-in docs, and assert a second generation produces no diff.
- **Test scenarios:** skill/hook detail rows match field truth; doctor and lint surface derived non-preserve modes; generated docs remain in sync; repeated generation is stable.
- **Verification:** `npm run generate:compatibility`, repeat generation, then `npx vitest run tests/compatibility-matrix.test.ts tests/doctor.test.ts tests/lint-cli.test.ts`.

### U4. Planning and product-truth closeout

- **Goal:** Keep durable repo and Linear truth aligned with the shipped implementation.
- **Requirements:** R1-R8.
- **Files:** the narrow canonical planning/proof docs affected by the implementation, including the PLUXX-317 plan and translation truth docs.
- **Approach:** Update only docs whose claims changed, then comment on PLUXX-317 and update PLUXX-312's Execution Index or leave an equivalent parent comment.
- **Test scenarios:** generated docs pass sync tests; no stale claim says skills/hooks preserve every audited field.
- **Verification:** doc-link audit plus repository and Linear closeout checks.

---

## Verification Contract

| Gate | Command | Done signal |
|---|---|---|
| Skills and YAML | `npx vitest run tests/skills.test.ts` | All normalized YAML and provenance cases pass. |
| Platform rules | `npx vitest run tests/platform-rules.test.ts tests/hooks-warning.test.ts` | Derived skill/hook truth matches registry outcomes. |
| Compatibility | `npm run generate:compatibility` followed by `npx vitest run tests/compatibility-matrix.test.ts` | Generated docs are current and a repeat generation is clean. |
| Lint and doctor | `npx vitest run tests/lint.test.ts tests/lint-cli.test.ts tests/doctor.test.ts` | Unsupported shapes and translation outcomes are explicit. |
| Build | `npm run build` | Runtime bundle and declarations build. |
| Typecheck | `npm run typecheck` | TypeScript reports no errors. |
| Full suite | `npm test` | Official serial suite passes in this worktree. |

The final diff also receives CE code review and dependency/supply-chain security review before PR creation.

---

## Definition of Done

- U1-U4 satisfy their traced requirements and tests.
- No core-four skill or hook primitive is labeled `preserve` while an audited field has an unreported weaker outcome.
- Valid supported YAML shapes parse consistently, and invalid or unsupported shapes produce explicit diagnostics with provenance.
- Generated compatibility outputs are deterministic and checked in.
- Targeted checks, build, typecheck, and the serial full suite pass after review fixes.
- Required repo docs and Linear issue/parent truth are current.
- The focused PR links PLUXX-317/GitHub issue #407, carries `ai:autofix-enabled`, and has no unresolved actionable CI or review feedback.
- Abandoned experimental code and unrelated changes are absent from the diff.
