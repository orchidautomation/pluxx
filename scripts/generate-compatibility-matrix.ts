import { readFileSync, writeFileSync } from 'fs'
import { createHash } from 'crypto'
import { dirname, resolve } from 'path'
import { fileURLToPath } from 'url'
import { replaceGeneratedCoreFourPrimitiveSection } from '../src/compatibility/core-four-primitives'
import { renderCompatibilityMatrixMarkdown, renderCompatibilityMatrixMdx } from '../src/compatibility/matrix'
import { summarizeOrchestrationRuntimeReceipts } from '../src/orchestration-runtime-proof'
import { OrchestrationSchema } from '../src/orchestration'
import {
  ceOrchestrationFixture,
  hyperframesOrchestrationFixture,
  superpowersOrchestrationFixture,
} from '../test-fixtures/orchestration-fixtures'

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const proofReceipts = ['compound-engineering', 'hyperframes', 'superpowers'].flatMap(fixture =>
  ['claude-code', 'cursor', 'codex', 'opencode'].map(platform => JSON.parse(readFileSync(resolve(
    rootDir,
    'tests/fixtures/orchestration-runtime-receipts',
    fixture,
    `${platform}.json`,
  ), 'utf-8'))),
)
const expectedProofFixtures = [
  { fixture: 'compound-engineering', orchestration: ceOrchestrationFixture },
  { fixture: 'hyperframes', orchestration: hyperframesOrchestrationFixture },
  { fixture: 'superpowers', orchestration: superpowersOrchestrationFixture },
].map(({ fixture, orchestration }) => ({
  fixture,
  plugin: `orchestration-${fixture}`,
  version: '0.1.0',
  orchestrationDigest: createHash('sha256').update(JSON.stringify(OrchestrationSchema.parse(orchestration))).digest('hex'),
}))
const proofSummary = summarizeOrchestrationRuntimeReceipts(proofReceipts, expectedProofFixtures)

const compatibilityPath = resolve(rootDir, 'docs', 'compatibility.md')

writeFileSync(compatibilityPath, renderCompatibilityMatrixMarkdown())
console.log(`Wrote ${compatibilityPath}`)

const siteCompatibilityPath = resolve(rootDir, 'site', 'how-it-works', 'compatibility-limits.mdx')
writeFileSync(siteCompatibilityPath, renderCompatibilityMatrixMdx())
console.log(`Wrote ${siteCompatibilityPath}`)

for (const outputPath of [
  resolve(rootDir, 'docs', 'core-four-primitive-matrix.md'),
  resolve(rootDir, 'site', 'overview', 'core-four-primitive-matrix.mdx'),
]) {
  const current = readFileSync(outputPath, 'utf-8')
  writeFileSync(outputPath, replaceGeneratedCoreFourPrimitiveSection(current, proofSummary))
  console.log(`Wrote ${outputPath}`)
}
