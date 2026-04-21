import { describe, expect, it } from 'bun:test'
import { resolveDocsIngestionProvider } from '../src/cli/docs-ingestion'

describe('docs ingestion provider contract', () => {
  it('falls back to local when auto mode has no Firecrawl key', () => {
    const selection = resolveDocsIngestionProvider('auto', {})

    expect(selection.requestedProvider).toBe('auto')
    expect(selection.resolvedProvider).toBe('local')
    expect(selection.fallbackOrder).toEqual(['firecrawl', 'local'])
    expect(selection.firecrawl.available).toBe(false)
  })

  it('resolves auto mode to firecrawl when FIRECRAWL_API_KEY is present', () => {
    const selection = resolveDocsIngestionProvider('auto', {
      FIRECRAWL_API_KEY: 'test-key',
    })

    expect(selection.requestedProvider).toBe('auto')
    expect(selection.resolvedProvider).toBe('firecrawl')
    expect(selection.firecrawl.available).toBe(true)
  })

  it('requires FIRECRAWL_API_KEY for explicit firecrawl mode', () => {
    expect(() => resolveDocsIngestionProvider('firecrawl', {})).toThrow(
      'Docs ingestion provider "firecrawl" requires FIRECRAWL_API_KEY in the environment.',
    )
  })

  it('resolves local mode deterministically', () => {
    const selection = resolveDocsIngestionProvider('local', {})

    expect(selection.requestedProvider).toBe('local')
    expect(selection.resolvedProvider).toBe('local')
    expect(selection.fallbackOrder).toEqual(['local'])
  })
})
