import { describe, expect, it } from 'bun:test'
import { resolve } from 'path'

const ROOT = resolve(import.meta.dir, '..')
const CLI_PATH = resolve(ROOT, 'bin/pluxx.js')
const CORE_FOUR = ['claude-code', 'cursor', 'codex', 'opencode']

interface SmokeResult {
  ok: boolean
  config?: {
    ok: boolean
    name?: string
    version?: string
  }
  lint?: {
    errors: number
    warnings: number
  }
  build?: {
    ok: boolean
    targets: string[]
  }
  smoke?: {
    ok: boolean
    checks: Array<{
      platform: string
      requiredPath: string
      ok: boolean
    }>
  }
}

interface DoctorResult {
  ok: boolean
  errors: number
  warnings: number
  infos: number
  checks: Array<{
    level: string
    code: string
  }>
}

async function expectCoreFourConsumerDoctor(cwd: string): Promise<void> {
  for (const platform of CORE_FOUR) {
    const report = await runCliJson<DoctorResult>(cwd, 'doctor', '--consumer', '--json', `./dist/${platform}`)
    expect(report.ok).toBe(true)
    expect(report.errors).toBe(0)
    expect(report.checks.some((check) => check.code === 'consumer-platform-detected')).toBe(true)
    expect(report.checks.some((check) => check.code === 'consumer-manifest-valid')).toBe(true)
  }
}

async function runCliJson<T>(cwd: string, ...argv: string[]): Promise<T> {
  const proc = Bun.spawn(['bun', CLI_PATH, ...argv], {
    cwd,
    stdout: 'pipe',
    stderr: 'pipe',
  })

  const stdout = await new Response(proc.stdout).text()
  const stderr = await new Response(proc.stderr).text()
  const exitCode = await proc.exited

  expect(exitCode).toBe(0)
  expect(stderr).toBe('')

  return JSON.parse(stdout) as T
}

describe('release smoke', () => {
  it('validates example/megamind across the core four with the real CLI', async () => {
    const cwd = resolve(ROOT, 'example/megamind')

    const doctor = await runCliJson<DoctorResult>(cwd, 'doctor', '--json')
    expect(doctor.ok).toBe(true)
    expect(doctor.errors).toBe(0)
    expect(doctor.checks.some((check) => check.code === 'config-valid')).toBe(true)

    const result = await runCliJson<SmokeResult>(
      cwd,
      'test',
      '--json',
      '--target',
      ...CORE_FOUR,
    )

    expect(result.ok).toBe(true)
    expect(result.config?.ok).toBe(true)
    expect(result.build?.targets).toEqual(CORE_FOUR)
    expect(result.smoke?.ok).toBe(true)
    expect(result.smoke?.checks.every((check) => check.ok)).toBe(true)
    await expectCoreFourConsumerDoctor(cwd)
  })

  it('validates examples/prospeo-mcp across the core four with the real CLI', async () => {
    const cwd = resolve(ROOT, 'examples/prospeo-mcp')

    const doctor = await runCliJson<DoctorResult>(cwd, 'doctor', '--json')
    expect(doctor.ok).toBe(true)
    expect(doctor.errors).toBe(0)
    expect(doctor.checks.some((check) => check.code === 'config-valid')).toBe(true)

    const result = await runCliJson<SmokeResult>(
      cwd,
      'test',
      '--json',
      '--target',
      ...CORE_FOUR,
    )

    expect(result.ok).toBe(true)
    expect(result.config?.ok).toBe(true)
    expect(result.build?.targets).toEqual(CORE_FOUR)
    expect(result.smoke?.ok).toBe(true)
    expect(result.smoke?.checks.every((check) => check.ok)).toBe(true)
    await expectCoreFourConsumerDoctor(cwd)
  })
})
