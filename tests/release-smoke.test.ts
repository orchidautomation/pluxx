import { describe, expect, it } from 'bun:test'
import { existsSync, mkdirSync, readFileSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { resolve } from 'path'

const ROOT = resolve(import.meta.dir, '..')
const CLI_PATH = resolve(ROOT, 'bin/pluxx.js')
const CORE_FOUR = ['claude-code', 'cursor', 'codex', 'opencode']
const RELEASE_SMOKE_PROJECTS = [
  'example/megamind',
  'examples/prospeo-mcp',
  'example/firecrawl-plugin',
  'example/pluxx',
  'example/exa-plugin',
  'example/docs-ops',
]
const COMMAND_BEHAVIORAL_PROOF_PROJECTS = [
  'example/pluxx',
  'example/exa-plugin',
  'example/docs-ops',
  'example/platform-change-ops',
]
const RELEASE_SMOKE_PROJECT_ENV: Record<string, Record<string, string>> = {
  'examples/prospeo-mcp': {
    PROSPEO_API_KEY: 'pluxx-release-smoke-prospeo-api-key',
  },
}

interface BehavioralSmokeTarget {
  prompt: string
  commandId?: string
  require?: string[]
  forbid?: string[]
}

interface BehavioralSmokeCase {
  name: string
  commandId?: string
  targets: Partial<Record<typeof CORE_FOUR[number], BehavioralSmokeTarget>>
}

interface BehavioralSmokeConfig {
  cases: BehavioralSmokeCase[]
}

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

async function expectCoreFourConsumerDoctor(cwd: string, env: Record<string, string>): Promise<void> {
  for (const platform of CORE_FOUR) {
    const report = await runCliJsonWithEnv<DoctorResult>(cwd, env, 'doctor', '--consumer', '--json', `./dist/${platform}`)
    expect(report.ok).toBe(true)
    expect(report.errors).toBe(0)
    expect(report.checks.some((check) => check.code === 'consumer-platform-detected')).toBe(true)
    expect(report.checks.some((check) => check.code === 'consumer-manifest-valid')).toBe(true)
  }
}

function readJsonFile<T>(path: string): T {
  return JSON.parse(readFileSync(path, 'utf-8')) as T
}

function promptReferencesCommand(prompt: string, commandId: string): boolean {
  const normalizedPrompt = prompt.toLowerCase()
  const normalizedCommandId = commandId.toLowerCase()
  return normalizedPrompt.includes(`/${normalizedCommandId}`)
    || normalizedPrompt.includes(`:${normalizedCommandId}`)
    || normalizedPrompt.includes(`command ${normalizedCommandId}`)
    || normalizedPrompt.includes(`command \`${normalizedCommandId}\``)
    || normalizedPrompt.includes(normalizedCommandId)
}

function expectExplicitCommandBehavioralProof(projectPath: string): void {
  const cwd = resolve(ROOT, projectPath)
  const configPath = resolve(cwd, '.pluxx/behavioral-smoke.json')
  expect(existsSync(configPath)).toBe(true)

  const config = readJsonFile<BehavioralSmokeConfig>(configPath)
  expect(Array.isArray(config.cases)).toBe(true)
  expect(config.cases.length).toBeGreaterThan(0)

  for (const behavioralCase of config.cases) {
    expect(typeof behavioralCase.commandId).toBe('string')
    expect(behavioralCase.commandId?.length).toBeGreaterThan(0)

    for (const platform of CORE_FOUR) {
      const target = behavioralCase.targets[platform]
      expect(target).toBeDefined()
      expect(typeof target?.prompt).toBe('string')
      expect(promptReferencesCommand(target!.prompt, behavioralCase.commandId!)).toBe(true)
      expect(Array.isArray(target?.require)).toBe(true)
      expect(target?.require?.length).toBeGreaterThan(0)
      expect(Array.isArray(target?.forbid)).toBe(true)
      expect(target?.forbid?.length).toBeGreaterThan(0)
    }
  }
}

async function runCliJson<T>(cwd: string, ...argv: string[]): Promise<T> {
  return runCliJsonWithEnv<T>(cwd, {}, ...argv)
}

function buildReleaseSmokeEnv(env: Record<string, string>): Record<string, string> {
  const inheritedKeys = [
    'PATH',
    'SHELL',
    'TMPDIR',
    'TMP',
    'TEMP',
    'USER',
    'LOGNAME',
    'CI',
    'NO_COLOR',
    'FORCE_COLOR',
    'NPM_CONFIG_CACHE',
    'npm_config_cache',
    'BUN_INSTALL',
  ]
  const output: Record<string, string> = {}

  for (const key of inheritedKeys) {
    const value = process.env[key]
    if (typeof value === 'string') output[key] = value
  }

  return {
    ...output,
    ...env,
  }
}

async function runCliJsonWithEnv<T>(cwd: string, env: Record<string, string>, ...argv: string[]): Promise<T> {
  const proc = Bun.spawn([process.execPath, CLI_PATH, ...argv], {
    cwd,
    env: buildReleaseSmokeEnv(env),
    stdout: 'pipe',
    stderr: 'pipe',
  })

  const stdout = await new Response(proc.stdout).text()
  const stderr = await new Response(proc.stderr).text()
  const exitCode = await proc.exited

  const command = `${process.execPath} ${[CLI_PATH, ...argv].join(' ')}`
  expect(exitCode, `Command failed: ${command}\nstdout:\n${stdout}\nstderr:\n${stderr}`).toBe(0)
  expect(stderr, `Command wrote stderr: ${command}\nstdout:\n${stdout}\nstderr:\n${stderr}`).toBe('')

  return JSON.parse(stdout) as T
}

describe('bundle contract and isolated fake-home install proof', () => {
  for (const projectPath of RELEASE_SMOKE_PROJECTS) {
    it(`validates ${projectPath} bundles and installed files across the core four`, async () => {
      const cwd = resolve(ROOT, projectPath)
      const isolatedHome = resolve(
        tmpdir(),
        'pluxx-release-smoke-home',
        `${process.pid}`,
        projectPath.replace(/[^A-Za-z0-9_.-]+/g, '-'),
      )
      rmSync(isolatedHome, { recursive: true, force: true })
      mkdirSync(isolatedHome, { recursive: true })
      const env = {
        HOME: isolatedHome,
        CODEX_HOME: resolve(isolatedHome, '.codex'),
        ...RELEASE_SMOKE_PROJECT_ENV[projectPath],
      }

      const doctor = await runCliJsonWithEnv<DoctorResult>(cwd, env, 'doctor', '--json')
      expect(doctor.ok).toBe(true)
      expect(doctor.errors).toBe(0)
      expect(doctor.checks.some((check) => check.code === 'config-valid')).toBe(true)

      const result = await runCliJsonWithEnv<SmokeResult>(
        cwd,
        env,
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
      await expectCoreFourConsumerDoctor(cwd, env)
    }, 600_000)
  }
})

describe('behavioral smoke proof fixtures', () => {
  for (const projectPath of COMMAND_BEHAVIORAL_PROOF_PROJECTS) {
    it(`keeps explicit command-proof behavioral fixtures for ${projectPath}`, () => {
      expectExplicitCommandBehavioralProof(projectPath)
    })
  }
})
