import { describe, expect, it } from 'bun:test'
import { resolve } from 'path'

const ROOT = resolve(import.meta.dir, '..')

describe('core-four release proof command', () => {
  it('runs the hermetic checked-proof and compatibility gate without replay writes', async () => {
    const proc = Bun.spawn([
      process.execPath,
      '--import',
      'tsx',
      resolve(ROOT, 'scripts/check-core-four-release-proof.ts'),
      '--skip-replay',
    ], {
      cwd: ROOT,
      env: { PATH: process.env.PATH ?? '', NO_COLOR: '1' },
      stdout: 'pipe',
      stderr: 'pipe',
    })
    const [stdout, stderr, exitCode] = await Promise.all([
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
      proc.exited,
    ])
    expect(exitCode, stderr).toBe(0)
    expect(stderr).toBe('')
    const report = JSON.parse(stdout)
    expect(report.ok).toBe(true)
    expect(report.sourceInventoryCount).toBe(44)
    expect(report.receiptCount).toBe(12)
    expect(report.fieldOutcomeCount).toBe(324)
    expect(report.degradedOutcomeCount).toBe(324)
    expect(report.replay).toBe('skipped-by-explicit-test-flag')
  })
})
