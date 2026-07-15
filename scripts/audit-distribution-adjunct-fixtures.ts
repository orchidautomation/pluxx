import { createHash } from 'crypto'
import { execFileSync } from 'child_process'
import { lstatSync, readFileSync } from 'fs'
import { resolve } from 'path'
import { assertNoSymlinkComponents } from '../src/fs-transaction'
import { distributionAdjunctFixtures } from '../test-fixtures/distribution-adjunct-fixtures'

function readRoot(fixture: string): string {
  const flag = `--${fixture}-root`
  const index = process.argv.indexOf(flag)
  const value = index >= 0 ? process.argv[index + 1] : undefined
  if (!value) throw new Error(`Missing required ${flag} argument.`)
  return resolve(value)
}

const summaries = distributionAdjunctFixtures.map((fixture) => {
  const root = readRoot(fixture.provenance.fixture)
  const revision = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf-8' }).trim()
  if (revision !== fixture.provenance.revision) {
    throw new Error(`${fixture.provenance.fixture} revision mismatch: expected ${fixture.provenance.revision}, got ${revision}.`)
  }

  for (const item of fixture.items) {
    assertNoSymlinkComponents(root, item.source)
    const path = resolve(root, item.source)
    const stats = lstatSync(path)
    if (!stats.isFile()) throw new Error(`${fixture.provenance.fixture}/${item.source} is not a regular file.`)
    const digest = createHash('sha256').update(readFileSync(path)).digest('hex')
    if (digest !== item.digest) {
      throw new Error(`${fixture.provenance.fixture}/${item.source} digest mismatch: expected ${item.digest}, got ${digest}.`)
    }
    const executable = (stats.mode & 0o111) !== 0
    if (executable !== item.executable) {
      throw new Error(`${fixture.provenance.fixture}/${item.source} executable-mode mismatch.`)
    }
  }

  return {
    fixture: fixture.provenance.fixture,
    revision,
    inventoryDigest: fixture.provenance.digest,
    itemCount: fixture.items.length,
  }
})

process.stdout.write(`${JSON.stringify({ fixtureCount: summaries.length, itemCount: summaries.reduce((sum, row) => sum + row.itemCount, 0), fixtures: summaries }, null, 2)}\n`)
