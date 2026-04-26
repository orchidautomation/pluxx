import { describe, expect, it } from 'bun:test'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { resolve } from 'path'

const ROOT = resolve(import.meta.dir, '..')
const CLI_PATH = resolve(ROOT, 'bin/pluxx.js')

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

describe('lint command explainability', () => {
  it('prints native target surfaces for translated and degraded buckets', async () => {
    const projectDir = mkdtempSync(resolve(tmpdir(), 'pluxx-lint-summary-'))
    mkdirSync(resolve(projectDir, 'skills/my-skill'), { recursive: true })
    mkdirSync(resolve(projectDir, 'commands'), { recursive: true })
    mkdirSync(resolve(projectDir, 'agents'), { recursive: true })

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
      const proc = spawnCli(['lint'], projectDir)
      const stdout = await new Response(proc.stdout).text()
      const stderr = await new Response(proc.stderr).text()
      const exitCode = await proc.exited

      expect(exitCode).toBe(0)
      expect(stderr).toBe('')
      expect(stdout).toContain('Core-four mapping:')
      expect(stdout).toContain('commands on codex: weakened to skills/, AGENTS.md')
      expect(stdout).toContain('hooks on open: re-expressed via plugin JS/TS event handlers')
      expect(stdout).toContain('permissions on codex: re-expressed via approvals, sandbox policy, hook matchers, custom agent config')
      expect(stdout).toContain('Lint summary: 0 error(s),')
    } finally {
      rmSync(projectDir, { recursive: true, force: true })
    }
  })
})
