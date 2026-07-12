import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'fs'
import { resolve } from 'path'

const ROOT = resolve(import.meta.dir, '..')
const releaseWorkflow = readFileSync(resolve(ROOT, '.github/workflows/release.yml'), 'utf-8')
const ciWorkflow = readFileSync(resolve(ROOT, '.github/workflows/ci.yml'), 'utf-8')

describe('release workflow', () => {
  it('uses GitHub Actions runtime versions that avoid the Node 20 deprecation path', () => {
    expect(releaseWorkflow).toMatch(/uses:\s+actions\/checkout@v5/)
    expect(releaseWorkflow).toMatch(/uses:\s+actions\/setup-node@v5/)
    expect(releaseWorkflow).toMatch(/node-version:\s+24/)
    expect(releaseWorkflow).toMatch(/uses:\s+softprops\/action-gh-release@v3/)
    expect(releaseWorkflow).not.toMatch(/uses:\s+softprops\/action-gh-release@v2/)
  })

  it('blocks CI when canonical proof versions or receipts are stale', () => {
    expect(ciWorkflow).toContain('name: Check proof freshness')
    expect(ciWorkflow).toContain('run: npm run proof:check')
    expect(ciWorkflow).toMatch(/uses:\s+actions\/checkout@v5\n\s+with:\n\s+fetch-depth:\s+0/)
  })
})
