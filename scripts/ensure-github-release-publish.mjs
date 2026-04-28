#!/usr/bin/env node

import { readFileSync } from 'node:fs'

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))
const expectedTag = `v${pkg.version}`

const failures = []

if (process.env.GITHUB_ACTIONS !== 'true') {
  failures.push('npm publish must run from GitHub Actions trusted publishing, not a local shell')
}

if (process.env.GITHUB_WORKFLOW && process.env.GITHUB_WORKFLOW !== 'Release') {
  failures.push(`expected GitHub workflow "Release", got "${process.env.GITHUB_WORKFLOW}"`)
}

if (process.env.GITHUB_REF_TYPE !== 'tag') {
  failures.push(`expected a tag-triggered release, got ref type "${process.env.GITHUB_REF_TYPE || 'unknown'}"`)
}

if (process.env.GITHUB_REF_NAME !== expectedTag) {
  failures.push(`expected release tag "${expectedTag}", got "${process.env.GITHUB_REF_NAME || 'unknown'}"`)
}

if (failures.length > 0) {
  console.error('Refusing to publish @orchid-labs/pluxx outside the trusted GitHub release flow.')
  for (const failure of failures) {
    console.error(`- ${failure}`)
  }
  console.error('')
  console.error('Release flow: bump package.json, commit, push main, then push the matching vX.Y.Z tag.')
  process.exit(1)
}
