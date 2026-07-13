import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { classifyProviderResult, countChangedLines } from '../scripts/evaluate-docs-ingestion'

describe('docs ingestion benchmark metrics', () => {
  it('distinguishes success, degraded ingestion, and total provider failure', () => {
    expect(classifyProviderResult('baseline', [])).toBe('ok')
    expect(classifyProviderResult('local', [{ status: 'ok' }])).toBe('ok')
    expect(classifyProviderResult('local', [{ status: 'ok' }, { status: 'error' }])).toBe('degraded')
    expect(classifyProviderResult('firecrawl', [{ status: 'error' }])).toBe('error')
    expect(classifyProviderResult('firecrawl', [])).toBe('error')
  })

  it('counts added and removed lines without positional cascade inflation', () => {
    expect(countChangedLines('alpha\nbeta\ngamma', 'alpha\ninserted\nbeta\ngamma')).toBe(1)
    expect(countChangedLines('alpha\nbeta\ngamma', 'alpha\ngamma')).toBe(1)
    expect(countChangedLines('alpha\nbeta\ngamma', 'alpha\nchanged\ngamma')).toBe(2)
    expect(countChangedLines('alpha\nbeta', 'alpha\nbeta')).toBe(0)
  })

  it('keeps the committed snapshot status aligned with captured source outcomes', () => {
    const snapshot = JSON.parse(readFileSync(
      resolve(import.meta.dir, '../docs/strategy/docs-ingestion-fixture-eval.json'),
      'utf8',
    )) as {
      fixtureResults: Array<{
        fixture: { fixtureKind: string }
        results: Array<{
          provider: 'baseline' | 'local' | 'firecrawl'
          status: string
          sourceSummary: Array<{ status: string }>
          scaffoldDelta: { available: boolean }
        }>
      }>
    }

    for (const fixture of snapshot.fixtureResults) {
      for (const result of fixture.results) {
        expect(result.status).toBe(classifyProviderResult(result.provider, result.sourceSummary))
        if (fixture.fixture.fixtureKind === 'synthetic-project') {
          expect(result.scaffoldDelta.available).toBe(false)
        }
      }
    }
  })
})
