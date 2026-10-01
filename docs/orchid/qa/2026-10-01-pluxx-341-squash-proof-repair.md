# PLUXX-341 merged-commit proof repair

PR #509 merged as squash commit `891cfb922062832b2888b7b72cd387ed3dc14a6b`. The merge tree matches its reviewed head, but the previous current receipt named unreachable commit `92422674721f63eaa7e53c4c742d05744ae302ef`. Merge-SHA CI run [36935076752](https://github.com/orchidautomation/pluxx/actions/runs/36935076752) failed at proof freshness before build or tests. No 0.1.46 tag was created.

The exact merged commit was checked in a detached worktree with Node 24.15.0:

| Check | Result |
| --- | --- |
| `npm run build` | Passed |
| `npm run typecheck` | Passed |
| `npm test -- tests/opencode-v2.test.ts tests/doctor.test.ts tests/install.test.ts tests/verify-install.test.ts` | Passed, 145 tests in four files |
| `node scripts/verify-node-package-runtime.mjs` | Passed against a locally packed package |
| `node scripts/run-npm-pack.mjs --dry-run` | Passed |

The exact-merge local full suite was interrupted by the runner after partial passes and is not counted as a pass. The repaired branch and its eventual merge SHA must each pass required full CI before the immutable tag release. This receipt covers repository and isolated package behavior; it does not claim a public npm package or installed consumer host.
