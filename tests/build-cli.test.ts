import { describe, expect, it } from 'bun:test'
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { resolve } from 'path'

const ROOT = resolve(import.meta.dir, '..')
const CLI_PATH = resolve(ROOT, 'src/cli/index.ts')

function spawnCli(argv: string[], cwd: string) {
  return Bun.spawn(['bun', CLI_PATH, ...argv], {
    cwd,
    env: {
      ...process.env,
    },
    stdout: 'pipe',
    stderr: 'pipe',
  })
}

function writeBaseConfig(projectDir: string, targets: string[]) {
  writeFileSync(
    resolve(projectDir, 'pluxx.config.json'),
    JSON.stringify({
      name: 'test-plugin',
      version: '0.1.0',
      description: 'test',
      author: { name: 'Test Author' },
      skills: './skills/',
      targets,
      outDir: './dist',
    }, null, 2),
  )
}

describe('build command lint gate', () => {
  it('fails build when lint has errors for the selected target', async () => {
    const projectDir = mkdtempSync(resolve(tmpdir(), 'pluxx-build-lint-error-'))
    mkdirSync(resolve(projectDir, 'skills/wrong-dir'), { recursive: true })
    writeBaseConfig(projectDir, ['opencode'])
    writeFileSync(
      resolve(projectDir, 'skills/wrong-dir/SKILL.md'),
      [
        '---',
        'name: my-skill',
        `description: "${'x'.repeat(1100)}"`,
        '---',
        '',
        '# My Skill',
      ].join('\n'),
    )

    try {
      const proc = spawnCli(['build', '--json'], projectDir)
      const stdout = await new Response(proc.stdout).text()
      const stderr = await new Response(proc.stderr).text()
      const exitCode = await proc.exited

      expect(exitCode).toBe(1)
      expect(stderr).toBe('')

      const result = JSON.parse(stdout) as {
        ok: boolean
        reason: string
        lint: { errors: number; warnings: number }
      }
      expect(result.ok).toBe(false)
      expect(result.reason).toBe('lint-errors')
      expect(result.lint.errors).toBeGreaterThan(0)
      expect(existsSync(resolve(projectDir, 'dist/opencode/package.json'))).toBe(false)
    } finally {
      rmSync(projectDir, { recursive: true, force: true })
    }
  })

  it('allows build when lint only has warnings for the selected target', async () => {
    const projectDir = mkdtempSync(resolve(tmpdir(), 'pluxx-build-lint-warning-'))
    mkdirSync(resolve(projectDir, 'skills/my-skill'), { recursive: true })
    writeBaseConfig(projectDir, ['codex'])
    writeFileSync(
      resolve(projectDir, 'skills/my-skill/SKILL.md'),
      [
        '---',
        'name: my-skill',
        'description: "A valid skill"',
        '---',
        '',
        '# My Skill',
      ].join('\n'),
    )
    writeFileSync(resolve(projectDir, 'AGENTS.md'), 'x'.repeat(40000))

    try {
      const proc = spawnCli(['build', '--json'], projectDir)
      const stdout = await new Response(proc.stdout).text()
      const stderr = await new Response(proc.stderr).text()
      const exitCode = await proc.exited

      expect(exitCode).toBe(0)
      expect(stderr).toBe('')

      const result = JSON.parse(stdout) as {
        ok: boolean
        lint: { errors: number; warnings: number }
        outputPaths: string[]
      }
      expect(result.ok).toBe(true)
      expect(result.lint.errors).toBe(0)
      expect(result.lint.warnings).toBeGreaterThan(0)
      expect(result.outputPaths).toContain('./dist/codex/')
      expect(existsSync(resolve(projectDir, 'dist/codex/.codex-plugin/plugin.json'))).toBe(true)
    } finally {
      rmSync(projectDir, { recursive: true, force: true })
    }
  })
  it('scopes lint gating to the requested target subset', async () => {
    const projectDir = mkdtempSync(resolve(tmpdir(), 'pluxx-build-target-scope-'))
    mkdirSync(resolve(projectDir, 'skills/my-skill'), { recursive: true })
    writeBaseConfig(projectDir, ['cursor', 'opencode'])
    writeFileSync(
      resolve(projectDir, 'skills/my-skill/SKILL.md'),
      [
        '---',
        'name: my-skill',
        `description: "${'x'.repeat(1100)}"`,
        '---',
        '',
        '# My Skill',
      ].join('\n'),
    )

    try {
      const proc = spawnCli(['build', '--target', 'cursor', '--json'], projectDir)
      const stdout = await new Response(proc.stdout).text()
      const stderr = await new Response(proc.stderr).text()
      const exitCode = await proc.exited

      expect(exitCode).toBe(0)
      expect(stderr).toBe('')

      const result = JSON.parse(stdout) as {
        ok: boolean
        targets: string[]
        lint: { errors: number; warnings: number }
      }
      expect(result.ok).toBe(true)
      expect(result.targets).toEqual(['cursor'])
      expect(result.lint.errors).toBe(0)
      expect(existsSync(resolve(projectDir, 'dist/cursor/.cursor-plugin/plugin.json'))).toBe(true)
      expect(existsSync(resolve(projectDir, 'dist/opencode/package.json'))).toBe(false)
    } finally {
      rmSync(projectDir, { recursive: true, force: true })
    }
  })

  it('prints native target surfaces in the build summary for translated buckets', async () => {
    const projectDir = mkdtempSync(resolve(tmpdir(), 'pluxx-build-summary-'))
    mkdirSync(resolve(projectDir, 'skills/my-skill'), { recursive: true })
    mkdirSync(resolve(projectDir, 'commands'), { recursive: true })
    mkdirSync(resolve(projectDir, 'agents'), { recursive: true })
    writeBaseConfig(projectDir, ['claude-code', 'codex', 'opencode'])
    writeFileSync(
      resolve(projectDir, 'pluxx.config.json'),
      JSON.stringify({
        name: 'summary-plugin',
        version: '0.1.0',
        description: 'summary fixture',
        author: { name: 'Test Author' },
        skills: './skills/',
        commands: './commands/',
        agents: './agents/',
        instructions: './INSTRUCTIONS.md',
        hooks: {
          sessionStart: [{ command: './scripts/check.sh' }],
        },
        permissions: {
          allow: ['Read(src/**)'],
        },
        mcp: {
          fixture: {
            transport: 'http',
            url: 'https://example.com/mcp',
          },
        },
        targets: ['claude-code', 'codex', 'opencode'],
        outDir: './dist',
      }, null, 2),
    )
    writeFileSync(
      resolve(projectDir, 'skills/my-skill/SKILL.md'),
      ['---', 'name: my-skill', 'description: "A valid skill"', '---', '', '# My Skill'].join('\n'),
    )
    writeFileSync(resolve(projectDir, 'commands/run.md'), '# Run\n')
    writeFileSync(
      resolve(projectDir, 'agents/research.md'),
      ['---', 'name: research', 'description: "Research specialist."', '---', '', '# Research'].join('\n'),
    )
    writeFileSync(resolve(projectDir, 'INSTRUCTIONS.md'), '# Instructions\n')

    try {
      const proc = spawnCli(['build'], projectDir)
      const stdout = await new Response(proc.stdout).text()
      const stderr = await new Response(proc.stderr).text()
      const exitCode = await proc.exited

      expect(exitCode).toBe(0)
      expect(stderr).toBe('')
      expect(stdout).toContain('Core-four mapping:')
      expect(stdout).toContain('commands')
      expect(stdout).toContain('hooks')
      expect(stdout).toContain('permissions')
      expect(stdout).toContain('commands on codex: weakened to skills/, AGENTS.md')
      expect(stdout).toContain('hooks on open: re-expressed via plugin JS/TS event handlers')
    } finally {
      rmSync(projectDir, { recursive: true, force: true })
    }
  })
})
