import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import {
  replaceGeneratedCoreFourPrimitiveSection,
} from '../src/compatibility/core-four-primitives'
import { getPlatformCompatibilityMatrix, renderCompatibilityMatrixMarkdown, renderCompatibilityMatrixMdx } from '../src/compatibility/matrix'

const ROOT = resolve(import.meta.dir, '..')

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
    for (const relativePath of [
      'docs/core-four-primitive-matrix.md',
      'site/overview/core-four-primitive-matrix.mdx',
    ]) {
      const checkedIn = readFileSync(resolve(ROOT, relativePath), 'utf-8')

      expect(checkedIn).toBe(replaceGeneratedCoreFourPrimitiveSection(checkedIn))
    }
  })
})
