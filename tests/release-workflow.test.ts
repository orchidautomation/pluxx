import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { parse } from 'yaml'
import { spawnSync } from 'child_process'

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
    expect(releaseWorkflow).toContain('Verify npm publication')
    expect(releaseWorkflow).toContain('already exists with matching integrity; skipping immutable npm publish')
    expect(releaseWorkflow).toContain('npm view "@orchid-labs/pluxx@${EXPECTED_VERSION}" version')
    expect(releaseWorkflow).toContain('npm publish "./${{ steps.pack.outputs.package_file }}"')
    expect(releaseWorkflow).toContain('dist.integrity')
    expect(releaseWorkflow).toContain('overwrite_files: true')
    expect(releaseWorkflow).toContain('Verify GitHub release asset')
    expect(releaseWorkflow).toContain('gh release view "$TAG" --json tagName,assets')
    expect(releaseWorkflow).toContain('gh release download "$TAG" --pattern "$PACKAGE_FILE" --dir "$DOWNLOAD_DIR"')
    expect(releaseWorkflow).toContain('EXPECTED_INTEGRITY="${{ steps.pack.outputs.package_integrity }}"')
    expect(releaseWorkflow).toContain('openssl dgst -sha512 -binary "$DOWNLOAD_DIR/$PACKAGE_FILE"')
    expect(releaseWorkflow).toContain('test "$RELEASE_INTEGRITY" = "$EXPECTED_INTEGRITY"')
    expect(releaseWorkflow).not.toContain('2>/dev/null || true')
    expect(releaseWorkflow).toContain("grep -Eiq 'E404|404 Not Found|is not in this registry'")
  })

  it('runs the release integrity gates in production order', () => {
    const workflow = parse(releaseWorkflow) as { jobs: { publish: { steps: Array<{ name?: string }> } } }
    const names = workflow.jobs.publish.steps.map((step) => step.name)
    expect(names.indexOf('Pack release tarball')).toBeLessThan(names.indexOf('Verify packaged Node runtime'))
    expect(names.indexOf('Verify packaged Node runtime')).toBeLessThan(names.indexOf('Publish to npm'))
    expect(names.indexOf('Publish to npm')).toBeLessThan(names.indexOf('Verify npm publication'))
    expect(names.indexOf('Verify npm publication')).toBeLessThan(names.indexOf('Create GitHub release'))
    expect(names.indexOf('Create GitHub release')).toBeLessThan(names.indexOf('Verify GitHub release asset'))
    for (const step of workflow.jobs.publish.steps as Array<{ name?: string; run?: string }>) {
      if (!step.run) continue
      const syntax = spawnSync('bash', ['-n'], { input: step.run, encoding: 'utf-8' })
      expect(syntax.status, `${step.name}: ${syntax.stderr}`).toBe(0)
    }
  })

  it('blocks CI when canonical proof versions or receipts are stale', () => {
    expect(ciWorkflow).toContain('name: Check proof freshness')
    expect(ciWorkflow).toContain('run: npm run proof:check')
    expect(ciWorkflow).toMatch(/uses:\s+actions\/checkout@v5\n\s+with:\n\s+fetch-depth:\s+0/)
  })
})
