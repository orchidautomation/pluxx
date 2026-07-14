import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'fs'
import { createHash } from 'crypto'
import { resolve } from 'path'
import {
  replaceGeneratedCoreFourPrimitiveSection,
} from '../src/compatibility/core-four-primitives'
import { getPlatformCompatibilityMatrix, renderCompatibilityMatrixMarkdown, renderCompatibilityMatrixMdx } from '../src/compatibility/matrix'
import { summarizeOrchestrationRuntimeReceipts } from '../src/orchestration-runtime-proof'
import { OrchestrationSchema } from '../src/orchestration'
import {
  ceOrchestrationFixture,
  hyperframesOrchestrationFixture,
  superpowersOrchestrationFixture,
} from '../test-fixtures/orchestration-fixtures'

const ROOT = resolve(import.meta.dir, '..')

function stableReceiptDigest(receipt: Record<string, unknown>): string {
  const { receiptDigest: _receiptDigest, ...withoutDigest } = receipt
  const sort = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(sort)
    if (!value || typeof value !== 'object') return value
    return Object.fromEntries(Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => [key, sort(entry)]))
  }
  return createHash('sha256').update(JSON.stringify(sort(withoutDigest))).digest('hex')
}

function loadProofSummary() {
  const receipts = ['compound-engineering', 'hyperframes', 'superpowers'].flatMap(fixture =>
    ['claude-code', 'cursor', 'codex', 'opencode'].map(platform => JSON.parse(readFileSync(resolve(
      ROOT,
      'tests/fixtures/orchestration-runtime-receipts',
      fixture,
      `${platform}.json`,
    ), 'utf-8'))),
  )
  const expected = [
    { fixture: 'compound-engineering', orchestration: ceOrchestrationFixture },
    { fixture: 'hyperframes', orchestration: hyperframesOrchestrationFixture },
    { fixture: 'superpowers', orchestration: superpowersOrchestrationFixture },
  ].map(({ fixture, orchestration }) => ({
    fixture,
    plugin: `orchestration-${fixture}`,
    version: '0.1.0',
    orchestrationDigest: createHash('sha256').update(JSON.stringify(OrchestrationSchema.parse(orchestration))).digest('hex'),
  }))
  return summarizeOrchestrationRuntimeReceipts(receipts, expected)
}

describe('compatibility matrix', () => {
  it('covers all 11 target platforms', () => {
    const rows = getPlatformCompatibilityMatrix()

    expect(rows).toHaveLength(11)
    expect(rows.find((row) => row.platform === 'claude-code')?.verification).toContain('Release smoke')
    expect(rows.find((row) => row.platform === 'cursor')?.verification).toContain('Release smoke')
    expect(rows.find((row) => row.platform === 'codex')?.verification).toContain('Release smoke')
    expect(rows.find((row) => row.platform === 'opencode')?.verification).toContain('Release smoke')
    expect(rows.find((row) => row.platform === 'github-copilot')?.verification).not.toContain('Release smoke')
  })

  it('keeps docs/compatibility.md in sync with the renderer', () => {
    const generated = renderCompatibilityMatrixMarkdown()
    const checkedIn = readFileSync(resolve(ROOT, 'docs/compatibility.md'), 'utf-8')

    expect(checkedIn).toBe(generated)
  })

  it('keeps the public compatibility MDX page in sync with the renderer', () => {
    const generated = renderCompatibilityMatrixMdx()
    const checkedIn = readFileSync(resolve(ROOT, 'site/how-it-works/compatibility-limits.mdx'), 'utf-8')

    expect(checkedIn).toBe(generated)
  })

  it('keeps generated core-four primitive matrix docs in sync with the registry renderer', () => {
    const proofSummary = loadProofSummary()
    for (const relativePath of [
      'docs/core-four-primitive-matrix.md',
      'site/overview/core-four-primitive-matrix.mdx',
    ]) {
      const checkedIn = readFileSync(resolve(ROOT, relativePath), 'utf-8')

      expect(checkedIn).toBe(replaceGeneratedCoreFourPrimitiveSection(checkedIn, proofSummary))
      expect(checkedIn).toContain('validated deterministic `fake-home-install` receipts')
      expect(checkedIn).toContain('real-host discovery is environment-unavailable in all 12 cases')
      expect(checkedIn).toContain('tests/fixtures/orchestration-runtime-receipts')
    }
  })

  it('fails closed when checked receipt content no longer matches its digest', () => {
    const receipt = JSON.parse(readFileSync(resolve(
      ROOT,
      'tests/fixtures/orchestration-runtime-receipts/compound-engineering/codex.json',
    ), 'utf-8'))
    receipt.evidence.installed.status = 'failed'
    expect(() => summarizeOrchestrationRuntimeReceipts([receipt])).toThrow('digest does not match')
  })

  it('fails closed when expected canonical fixture identity is stale', () => {
    const receipts = ['claude-code', 'cursor', 'codex', 'opencode'].map(platform => JSON.parse(readFileSync(resolve(
      ROOT,
      `tests/fixtures/orchestration-runtime-receipts/compound-engineering/${platform}.json`,
    ), 'utf-8')))
    expect(() => summarizeOrchestrationRuntimeReceipts(receipts, [{
      fixture: 'compound-engineering',
      plugin: 'orchestration-compound-engineering',
      version: '0.1.0',
      orchestrationDigest: '0'.repeat(64),
    }])).toThrow('is not source-fresh')
  })

  it('fails closed when a self-consistent receipt is stale against the registry', () => {
    const receipt = JSON.parse(readFileSync(resolve(
      ROOT,
      'tests/fixtures/orchestration-runtime-receipts/compound-engineering/codex.json',
    ), 'utf-8'))
    receipt.fieldOutcomes[0].declared.rationale = 'stale receipt rationale'
    receipt.fieldOutcomes[0].effective.rationale = 'stale receipt rationale'
    receipt.receiptDigest = stableReceiptDigest(receipt)
    expect(() => summarizeOrchestrationRuntimeReceipts([receipt])).toThrow('stale against the compiler registry')
  })
})
