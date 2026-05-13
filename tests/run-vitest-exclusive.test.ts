import { afterEach, describe, expect, it } from 'bun:test'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { resolve } from 'path'

const ROOT = resolve(import.meta.dir, '..')
const TMP_ROOTS: string[] = []

function makeTempDir(prefix: string): string {
  const dir = mkdtempSync(resolve(tmpdir(), prefix))
  TMP_ROOTS.push(dir)
  return dir
}

afterEach(() => {
  while (TMP_ROOTS.length > 0) {
    rmSync(TMP_ROOTS.pop()!, { recursive: true, force: true })
  }
})

describe('exclusive vitest runner', () => {
  it('refuses a second full-suite run when the worktree lock is already held', async () => {
    const projectDir = makeTempDir('pluxx-vitest-lock-active-')

    writeFileSync(
      resolve(projectDir, '.pluxx-vitest.lock'),
      `${JSON.stringify({
        pid: process.pid,
        startedAt: '2026-05-12T00:00:00.000Z',
        command: ['vitest', 'run', 'tests/eval.test.ts'],
      }, null, 2)}\n`,
      'utf-8',
    )

    const proc = Bun.spawn(['node', resolve(ROOT, 'scripts/run-vitest-exclusive.mjs'), 'tests/meta-cli.test.ts'], {
      cwd: projectDir,
      stdout: 'pipe',
      stderr: 'pipe',
    })

    const stdout = await new Response(proc.stdout).text()
    const stderr = await new Response(proc.stderr).text()
    const exitCode = await proc.exited

    expect(exitCode).toBe(1)
    expect(stdout).toBe('')
    expect(stderr).toContain('Refusing to start a second full Pluxx test run in the same worktree.')
    expect(stderr).toContain('This suite uses repo-local fixtures and should be serialized per worktree.')
    expect(stderr).toContain(`Active test run: pid=${process.pid}`)
    expect(stderr).toContain('command=vitest run tests/eval.test.ts')
  })

  it('clears a stale worktree lock before delegating to Vitest', async () => {
    const projectDir = makeTempDir('pluxx-vitest-lock-stale-')
    const vitestDir = resolve(projectDir, 'node_modules/vitest')
    mkdirSync(vitestDir, { recursive: true })

    writeFileSync(
      resolve(projectDir, '.pluxx-vitest.lock'),
      `${JSON.stringify({
        pid: 999999,
        startedAt: '2026-05-12T00:00:00.000Z',
        command: ['vitest', 'run', 'tests/old.test.ts'],
      }, null, 2)}\n`,
      'utf-8',
    )

    writeFileSync(
      resolve(vitestDir, 'vitest.mjs'),
      `console.log('stub vitest ok')
console.log(process.argv.slice(2).join(' '))
`,
      'utf-8',
    )

    const proc = Bun.spawn(['node', resolve(ROOT, 'scripts/run-vitest-exclusive.mjs'), 'tests/meta-cli.test.ts'], {
      cwd: projectDir,
      stdout: 'pipe',
      stderr: 'pipe',
    })

    const stdout = await new Response(proc.stdout).text()
    const stderr = await new Response(proc.stderr).text()
    const exitCode = await proc.exited

    expect(exitCode).toBe(0)
    expect(stdout).toContain('stub vitest ok')
    expect(stdout).toContain('run tests/meta-cli.test.ts')
    expect(stderr).toBe('')
    expect(existsSync(resolve(projectDir, '.pluxx-vitest.lock'))).toBe(false)
    expect(readFileSync(resolve(vitestDir, 'vitest.mjs'), 'utf-8')).toContain('stub vitest ok')
  })
})
