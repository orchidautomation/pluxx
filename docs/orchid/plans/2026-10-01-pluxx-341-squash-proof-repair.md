# PLUXX-341 squash proof repair

## Observed failure

PR #509 was squashed into `main` as `891cfb922062832b2888b7b72cd387ed3dc14a6b`. Its tree matches the PR head, but the current 0.1.46 proof receipt still names `92422674721f63eaa7e53c4c742d05744ae302ef`, which is not an ancestor of the squash commit. Merge-SHA CI run 36935076752 failed at `npm run proof:check` for that exact reason. No `v0.1.46` tag or package publication is authorized while trusted `main` is red.

## Repair

1. In a detached worktree at the exact merged commit, rerun build, typecheck, the complete test suite, packaged Node runtime, and dry-run packaging. Do not treat PR-head CI as merge-SHA proof.
2. On a new issue branch from the merged commit, replace the current release-prep receipt with a truthful receipt bound to the tested merge commit and its actual passing commands. Update the claim summary to match. Preserve historical 0.1.45 receipts and the published-version distinction.
3. Run proof freshness and affected release checks on the repaired branch. Open a PR linked to PLUXX-341 and require its full CI. Because the receipt points to the tested `main` ancestor, either merge or squash of this metadata repair leaves that tested commit reachable.
4. Verify the repair merge SHA and its required checks. Only then create the immutable `v0.1.46` tag from exact trusted `main` and verify the release workflow, npm package, and GitHub asset before any SendLens dependency update.

## Rollback

Leave 0.1.46 unpublished if the exact-merge validation, repair PR checks, or release workflow fails. A post-merge source fix uses another reviewed PR; do not push directly to `main` or move an immutable tag.
