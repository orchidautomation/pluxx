---
title: PLUXX-329 Frozen Core-Four Release Gate Decision
date: 2026-07-14
status: accepted
---

# PLUXX-329 Frozen Core-Four Release Gate Decision

## Decision

Release readiness for the frozen orchestration portfolio is owned by one hermetic `npm run core-four:proof` command. CI calls it directly and `release:check` calls it once before build, tests, runtime package verification, and dry-run packing.

The gate consumes the existing compiler and receipt truth. It does not add a second capability matrix or publish-specific proof implementation.

## Required Proof

- three pinned fixtures and exactly 44 revision/digest/executable inventory rows
- exactly 12 Claude Code, Cursor, Codex, and OpenCode receipts with 176 adjunct outcomes and 324 orchestration outcomes
- current registry, fixture, version, compiler, ownership, and evidence bindings
- discovery environment-unavailable 12/12, activation unsupported 12/12, behavior environment-unavailable 12/12, and 324/324 degraded outcomes
- two byte-deterministic 12-case replays for both symlink-root and copied-install preimages
- fail-closed content, collision, missing, stale, executable-mode, unsafe-location, nested-link, retarget, and dangling-link handling
- maintained compatibility output equal to current compiler rendering without rewriting files during the gate

## Boundaries

Generated Codex marketplace or OpenCode loader registration is installed-topology evidence only. It cannot satisfy discovery, activation, or behavioral evidence. The seven secondary hosts remain excluded. The gate has no mutable external dependency and reads no live plugin configuration.

## Release Seam

`release:check` is the narrowest authoritative release-readiness seam. `prepublishOnly`, npm packing, and `pluxx publish` retain their existing responsibilities and do not duplicate repository fixture proof.

## Residual Claim Boundary

The Phase 0–6 stack is ready for PR packaging. It is not proof of real-host workflow execution; that requires separately bound executable host receipts.
