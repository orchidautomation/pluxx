import { describe, expect, it } from 'bun:test'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { resolve } from 'path'
import { doctorProject } from '../src/cli/doctor'

const ROOT = resolve(import.meta.dir, '..')

function createProjectFixture(): string {
  const dir = mkdtempSync(resolve(tmpdir(), 'pluxx-doctor-'))
  mkdirSync(resolve(dir, 'skills/hello'), { recursive: true })
  writeFileSync(
    resolve(dir, 'skills/hello/SKILL.md'),
    '---\nname: hello\ndescription: Say hello\nversion: 0.1.0\n---\n\n# Hello\n',
  )
  writeFileSync(resolve(dir, 'INSTRUCTIONS.md'), '# Instructions\n')
  writeFileSync(
    resolve(dir, 'pluxx.config.json'),
    JSON.stringify({
      name: 'doctor-fixture',
      version: '0.1.0',
      description: 'Doctor fixture',
      author: { name: 'Test Author' },
      license: 'MIT',
      userConfig: [
        {
          key: 'fixture-api-key',
          title: 'Fixture API Key',
          description: 'Access token used by the fixture MCP.',
          type: 'secret',
          required: true,
          envVar: 'FIXTURE_API_KEY',
        },
      ],
      skills: './skills/',
      instructions: './INSTRUCTIONS.md',
      hooks: {
        sessionStart: [
          { type: 'command', command: 'bash "${PLUGIN_ROOT}/scripts/check-env.sh"' },
        ],
      },
      mcp: {
        fixture: {
          transport: 'http',
          url: 'https://example.com/mcp',
          auth: {
            type: 'bearer',
            envVar: 'FIXTURE_API_KEY',
            headerName: 'Authorization',
            headerTemplate: 'Bearer ${value}',
          },
        },
      },
      targets: ['claude-code', 'cursor'],
      outDir: './dist',
    }, null, 2),
  )
  return dir
}

describe('doctorProject', () => {
  it('returns warnings and infos without failing a healthy project', async () => {
    const dir = createProjectFixture()

    try {
      const report = await doctorProject(dir)

      expect(report.ok).toBe(true)
      expect(report.errors).toBe(0)
      expect(report.warnings).toBeGreaterThanOrEqual(1)
      expect(report.checks.some((check) => check.code === 'hooks-trust-required' && check.level === 'warning')).toBe(true)
      expect(report.checks.some((check) => check.code === 'mcp-auth-env' && check.level === 'info')).toBe(true)
      expect(report.checks.some((check) => check.code === 'user-config-declared' && check.level === 'info')).toBe(true)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('fails when no config is present', async () => {
    const dir = mkdtempSync(resolve(tmpdir(), 'pluxx-doctor-empty-'))

    try {
      const report = await doctorProject(dir)
      expect(report.ok).toBe(false)
      expect(report.errors).toBe(1)
      expect(report.checks.some((check) => check.code === 'config-not-found')).toBe(true)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('reports malformed MCP scaffold metadata as a blocking error', async () => {
    const dir = createProjectFixture()
    mkdirSync(resolve(dir, '.pluxx'), { recursive: true })
    writeFileSync(resolve(dir, '.pluxx/mcp.json'), '{broken')

    try {
      const report = await doctorProject(dir)
      expect(report.ok).toBe(false)
      expect(report.checks.some((check) => check.code === 'mcp-metadata-invalid' && check.level === 'error')).toBe(true)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('warns when MCP scaffold metadata has weak tool metadata', async () => {
    const dir = createProjectFixture()
    mkdirSync(resolve(dir, '.pluxx'), { recursive: true })
    writeFileSync(
      resolve(dir, '.pluxx/mcp.json'),
      JSON.stringify({
        version: 1,
        source: {
          transport: 'http',
          url: 'https://example.com/mcp',
        },
        serverInfo: {
          name: 'fixture',
        },
        settings: {
          pluginName: 'doctor-fixture',
          displayName: 'Doctor Fixture',
          skillGrouping: 'workflow',
          requestedHookMode: 'none',
          generatedHookMode: 'none',
          generatedHookEvents: [],
        },
        tools: [
          { name: 'tool_1', description: 'N/A' },
          { name: 'search_accounts' },
        ],
        skills: [],
        managedFiles: ['INSTRUCTIONS.md'],
      }, null, 2),
    )

    try {
      const report = await doctorProject(dir)
      expect(report.checks.some((check) => check.code === 'mcp-metadata-quality-weak' && check.level === 'warning')).toBe(true)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('does not warn on terse but valid tool descriptions', async () => {
    const dir = createProjectFixture()
    mkdirSync(resolve(dir, '.pluxx'), { recursive: true })
    writeFileSync(
      resolve(dir, '.pluxx/mcp.json'),
      JSON.stringify({
        version: 1,
        source: {
          transport: 'http',
          url: 'https://example.com/mcp',
        },
        serverInfo: {
          name: 'fixture',
        },
        settings: {
          pluginName: 'doctor-fixture',
          displayName: 'Doctor Fixture',
          skillGrouping: 'workflow',
          requestedHookMode: 'none',
          generatedHookMode: 'none',
          generatedHookEvents: [],
        },
        tools: [
          { name: 'check_status', description: 'Check status' },
          { name: 'list_tables', description: 'List tables' },
        ],
        skills: [],
        managedFiles: ['INSTRUCTIONS.md'],
      }, null, 2),
    )

    try {
      const report = await doctorProject(dir)
      expect(report.checks.some((check) => check.code === 'mcp-metadata-quality-weak')).toBe(false)
      expect(report.checks.some((check) => check.code === 'mcp-metadata-quality-ok' && check.level === 'success')).toBe(true)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('prints stable JSON from the CLI', async () => {
    const dir = createProjectFixture()

    try {
      const proc = Bun.spawn(['bun', resolve(ROOT, 'bin/pluxx.js'), 'doctor', '--json'], {
        cwd: dir,
        stdout: 'pipe',
        stderr: 'pipe',
      })
      const stdout = await new Response(proc.stdout).text()
      const stderr = await new Response(proc.stderr).text()
      const exitCode = await proc.exited

      expect(exitCode).toBe(0)
      expect(stderr).toBe('')

      const report = JSON.parse(stdout) as {
        ok: boolean
        errors: number
        warnings: number
        infos: number
        checks: Array<{ code: string }>
      }

      expect(report.ok).toBe(true)
      expect(typeof report.errors).toBe('number')
      expect(typeof report.warnings).toBe('number')
      expect(typeof report.infos).toBe('number')
      expect(Array.isArray(report.checks)).toBe(true)
      expect(report.checks.some((check) => check.code === 'config-valid')).toBe(true)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})
