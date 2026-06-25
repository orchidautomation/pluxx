import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'fs'
import { resolve } from 'path'

const ROOT = resolve(import.meta.dir, '..')
const releaseWorkflow = readFileSync(resolve(ROOT, '.github/workflows/release.yml'), 'utf-8')

describe('release workflow', () => {
  it('uses GitHub Actions runtime versions that avoid the Node 20 deprecation path', () => {
    expect(releaseWorkflow).toMatch(/uses:\s+actions\/checkout@v5/)
    expect(releaseWorkflow).toMatch(/uses:\s+actions\/setup-node@v5/)
    expect(releaseWorkflow).toMatch(/node-version:\s+24/)
    expect(releaseWorkflow).toMatch(/uses:\s+softprops\/action-gh-release@v3/)
    expect(releaseWorkflow).not.toMatch(/uses:\s+softprops\/action-gh-release@v2/)
  })
})
