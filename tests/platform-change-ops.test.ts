import { describe, expect, it } from 'bun:test'
import { resolve } from 'path'

const ROOT = resolve(import.meta.dir, '..')
const CLI_PATH = resolve(ROOT, 'bin/pluxx.js')
const EXAMPLE_ROOT = resolve(ROOT, 'example/platform-change-ops')
const CORE_FOUR = ['claude-code', 'cursor', 'codex', 'opencode']

interface DoctorResult {
  ok: boolean
  errors: number
  warnings: number
  checks: Array<{ code: string }>
}

interface SmokeResult {
  ok: boolean
  build?: {
    ok: boolean
    targets: string[]
  }
}

async function runCliJson<T>(cwd: string, ...argv: string[]): Promise<{ data: T, stderr: string, exitCode: number }> {
  const proc = Bun.spawn(['bun', CLI_PATH, ...argv], {
    cwd,
    stdout: 'pipe',
    stderr: 'pipe',
  })

  const stdout = await new Response(proc.stdout).text()
  const stderr = await new Response(proc.stderr).text()
  const exitCode = await proc.exited

  return {
    data: JSON.parse(stdout) as T,
    stderr,
    exitCode,
  }
}

describe('platform change ops example', () => {
  it('builds as an intentionally warning-heavy all-primitive fixture', async () => {
    const doctor = await runCliJson<DoctorResult>(EXAMPLE_ROOT, 'doctor', '--json')
    expect(doctor.exitCode).toBe(0)
    expect(doctor.data.ok).toBe(true)
    expect(doctor.data.errors).toBe(0)
    expect(doctor.data.warnings).toBeGreaterThan(0)
    expect(doctor.data.checks.some((check) => check.code === 'hooks-trust-required')).toBe(true)

    const result = await runCliJson<SmokeResult>(
      EXAMPLE_ROOT,
      'test',
      '--json',
      '--target',
      ...CORE_FOUR,
    )

    expect(result.exitCode).toBe(0)
    expect(result.data.ok).toBe(true)
    expect(result.data.build?.ok).toBe(true)
    expect(result.data.build?.targets).toEqual(CORE_FOUR)
    expect(result.stderr).toContain('templated header Codex cannot express exactly')
    expect(result.stderr).toContain('dropped unsupported prompt-based hook')
    expect(result.stderr).toContain('dropped unsupported hook field "failClosed"')
    expect(result.stderr).toContain('dropped unsupported hook field "loop_limit"')
  })
})
