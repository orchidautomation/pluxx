---
title: PLUXX-341 OpenCode 2 release and SendLens handoff
date: 2026-10-01
linear_issue: PLUXX-341
status: release-prep
---

# PLUXX-341 — Pluxx 0.1.46 release

## Objective

Publish the merged OpenCode 2 support from PLUXX-355 and PLUXX-356, then rebuild and verify SendLens from that exact published package. Source merge and fixture checks do not satisfy SENDOSS-161 installed-host acceptance.

## Source and release boundary

- Trusted `origin/main` contains PR #506 (`ca0bdeb`) and PR #508 (`d2da2a8`).
- `0.1.45` remains the last independently verified public release while this `0.1.46` candidate is reviewed.
- Keep the former release receipts historical. Record fresh proof only after the named checks pass at a committed `0.1.46` ancestor.
- The release must pass `npm run release:check`, packaged runtime verification, and the GitHub PR checks. The release workflow alone publishes npm from a tag on trusted `main`.
- Merge the release-prep PR with a true merge commit so the proof receipt commit remains an ancestor of the tag. Verify exact PR head and receipt ancestry before tagging.

## Handoff and acceptance

1. Merge the reviewed `0.1.46` release-prep PR to `main` and create immutable tag `v0.1.46` on the trusted merge.
2. Verify the release workflow, npm version, GitHub tarball, and artifact identity. Record the release receipt.
3. Update both SendLens manifests to the exact published Pluxx version, rebuild its host bundles, and run the plugin and host validation gates in a separate issue branch and PR.
4. Install that SendLens build in a clean OpenCode 2 profile. Capture `opencode mcp list`, `setup_doctor`, plugin discovery, and the artifact/version identities without credentials or customer data.
5. Close SENDOSS-161 and SENDOSS-176 delivery gate only when the installed proof passes. Keep RELAY-149/-150/-151 in the Relay lane.
