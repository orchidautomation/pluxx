# Releasing Pluxx

This is the maintainer flow for shipping new versions of `@orchid-labs/pluxx`.

For plugin bundle distribution from a Pluxx source project, use [Release Distribution Proof Map](./release-distribution-proof-map.md) and [pluxx publish v1 contract](./publish-v1-contract.md). This file is about releasing the Pluxx CLI package itself.

## What Happens Automatically

This repo now has a tag-based GitHub Actions workflow at [`.github/workflows/release.yml`](../.github/workflows/release.yml).

When you push a tag like `v0.1.1`, GitHub Actions will:

1. install Node dependencies
2. verify the tag commit belongs to the current trusted `origin/main` history
3. run `npm run release:check`
4. verify the tag matches `package.json` version
5. run `npm publish --provenance --access public`
6. create a GitHub release and attach the packed npm tarball

That means GitHub pushes do **not** update npm by themselves. Only a versioned tag release does.

The workflow also has a maintainer-only recovery dispatch for an existing release tag. Dispatch it from the `main` workflow ref and provide the existing `vX.Y.Z` tag. The recovery checks out the immutable tag tree separately from the trusted workflow code, requires the dispatch SHA to remain exact current `origin/main`, proves that the tag commit belongs to that history, and verifies tag/package identity.

Recovery reruns build, typecheck, the full test suite, packaged-runtime verification, and dry-run packaging against the exact tag tree. It then binds an ephemeral proof overlay and external recovery receipt to the exact tag commit, tree, and candidate artifact hashes. The normal proof checker must pass; the committed tag manifest is restored; the checkout must be clean; and the final npm tarball plus downloaded GitHub asset must match the validated candidate hashes. The receipt is attached to the GitHub release. Recovery does not create or move tags.

Do not publish this package from a local shell. The package lifecycle now refuses local `npm publish` and only allows the trusted GitHub release workflow on a matching `vX.Y.Z` tag. This keeps npm provenance intact and avoids depending on local npm auth.

That package-release rule is separate from `pluxx publish`, which packages a user's built plugin bundles and generated installers for distribution.

The workflow rejects normal tag pushes and recovery dispatches when the tag commit is outside current `origin/main` history. Repository administrators should also restrict `v*` tag creation and preserve any configured GitHub release approvals: workflow code is loaded from the tagged commit, so GitHub-side tag governance remains part of the trust boundary.

## One-Time Setup

Choose one npm auth path:

### Preferred: npm trusted publishing

Configure npm trusted publishing for this package/repo/workflow:

- package: `@orchid-labs/pluxx`
- repository: `orchidautomation/pluxx`
- workflow file: `.github/workflows/release.yml`

This is the modern npm path. It avoids long-lived publish tokens and automatically generates provenance attestations for public packages published from GitHub-hosted runners.

### Fallback: `NPM_TOKEN`

If you do not want to configure trusted publishing yet, add a repository secret named `NPM_TOKEN`.

The workflow supports both modes:

- if `NPM_TOKEN` exists, it publishes with that token
- otherwise, it attempts npm trusted publishing via GitHub OIDC

## Release Steps

1. Update the package version in [package.json](../package.json).
2. Commit and push the version bump to `main`.
3. Create and push the matching tag.

Example:

```bash
git checkout main
git pull --ff-only

npm version patch --no-git-tag-version
git add package.json
git commit -m "Release 0.1.1"
git push origin main

git tag v0.1.1
git push origin v0.1.1
```

When a release-prep PR contains current receipts bound to an ancestor commit, merge it with a true merge commit. Do not squash or rebase that PR: rewriting its commits makes the receipt SHA unreachable and the proof checker fails closed. Before tagging, verify both the exact PR head and every current receipt commit are ancestors of the trusted `main` commit:

```bash
git merge-base --is-ancestor <exact-pr-head> <trusted-main-commit>
git merge-base --is-ancestor <current-receipt-commit> <trusted-main-commit>
```

If the trusted release workflow fails before publication for a recoverable infrastructure or proof-topology reason, do not move or recreate the tag and do not publish locally. Merge a reviewed workflow fix to `main`, then dispatch `Release` from exact current `main` with the existing tag. The default recovery input is currently `v0.1.41`.

You can use `patch`, `minor`, or `major` depending on the release.

## Runtime Cost Guard

The expensive release gate is `npm run release:check`. It already runs build, typecheck, the full test suite, packaged runtime verification, and a dry-run pack.

`prepublishOnly` is intentionally lightweight. It only checks that publish is happening from the trusted GitHub tag workflow and rebuilds the package before npm upload. It does **not** rerun the full test suite, because the tag workflow has already completed the release gate immediately before publish.

## Verification

After the workflow finishes:

```bash
npm view @orchid-labs/pluxx version
npx @orchid-labs/pluxx --help
```

Check:

- the npm package version is live
- the GitHub release exists for the tag
- the attached tarball is present on the release

## Failure Cases

The workflow intentionally fails if:

- the tag commit is not contained in current trusted `origin/main` history
- the tag does not match `package.json` version
- a recovery dispatch does not run from `main`
- the recovery workflow SHA or trusted-code checkout is not exact current `origin/main`
- the requested recovery tag is missing, malformed, not checked out, or not contained in trusted `main` history
- the tagged checkout is dirty, the proof overlay changes anything except the proof manifest, or restoration does not return it to a clean state
- candidate, final package, npm publication, or downloaded GitHub asset integrity differs
- `npm run release:check` fails
- npm auth is not configured correctly

## Notes

- The published package is scoped: `@orchid-labs/pluxx`
- The public invocation path is `npx @orchid-labs/pluxx ...`
- The published CLI runtime is Node `>=18`
- The package-level runtime source of truth is [docs/runtime-contract.md](./runtime-contract.md)
- Release automation uses GitHub Actions Node 24 and `softprops/action-gh-release@v3` so the GitHub release step stays off the Node 20 action runtime path

## References

- [npm trusted publishing](https://docs.npmjs.com/trusted-publishers)
- [Generating provenance statements](https://docs.npmjs.com/generating-provenance-statements/)
- [Publishing Node.js packages with GitHub Actions](https://docs.github.com/en/actions/use-cases-and-examples/publishing-packages/publishing-nodejs-packages)
