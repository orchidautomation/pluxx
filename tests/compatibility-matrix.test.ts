import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { getPlatformCompatibilityMatrix, renderCompatibilityMatrixMarkdown } from '../src/compatibility/matrix'

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
})
