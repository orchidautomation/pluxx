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
    expect(releaseWorkflow).toContain('Verify npm publication')
    expect(releaseWorkflow).toContain('already exists with matching integrity; skipping immutable npm publish')
    expect(releaseWorkflow).toContain('npm view "@orchid-labs/pluxx@${EXPECTED_VERSION}" version')
    expect(releaseWorkflow).toContain('npm publish "./${{ steps.pack.outputs.package_file }}"')
    expect(releaseWorkflow).toContain('dist.integrity')
    expect(releaseWorkflow).toContain('overwrite_files: true')
    expect(releaseWorkflow).toContain('Verify GitHub release asset')
    expect(releaseWorkflow).toContain('gh release view "$TAG" --json tagName,assets')
  })
})
