# Releasing Pluxx

This is the maintainer flow for shipping new versions of `@orchid-labs/pluxx`.

## What Happens Automatically

This repo now has a tag-based GitHub Actions workflow at [`.github/workflows/release.yml`](../.github/workflows/release.yml).

When you push a tag like `v0.1.1`, GitHub Actions will:

1. install Bun + dependencies
2. run `bun run release:check`
3. verify the tag matches `package.json` version
4. run `npm publish --access public`
5. create a GitHub release and attach the packed npm tarball

That means GitHub pushes do **not** update npm by themselves. Only a versioned tag release does.

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

You can use `patch`, `minor`, or `major` depending on the release.

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

- the tag does not match `package.json` version
- `bun run release:check` fails
- npm auth is not configured correctly

## Notes

- The published package is scoped: `@orchid-labs/pluxx`
- The public invocation path is `npx @orchid-labs/pluxx ...`
- The CLI is still Bun-backed at runtime, so users still need Bun installed

## References

- [npm trusted publishing](https://docs.npmjs.com/trusted-publishers)
- [Generating provenance statements](https://docs.npmjs.com/generating-provenance-statements/)
- [Publishing Node.js packages with GitHub Actions](https://docs.github.com/en/actions/use-cases-and-examples/publishing-packages/publishing-nodejs-packages)
