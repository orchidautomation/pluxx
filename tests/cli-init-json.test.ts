import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { resolve } from 'path'

const ROOT = resolve(import.meta.dir, '..')
let testDir = ''
let stubServerPath = ''

beforeEach(() => {
  testDir = mkdtempSync(resolve(tmpdir(), 'pluxx-cli-json-'))
  stubServerPath = resolve(testDir, 'stub-server.js')
  mkdirSync(testDir, { recursive: true })

  writeFileSync(
    stubServerPath,
    `import * as readline from 'readline'

const rl = readline.createInterface({ input: process.stdin, crlfDelay: Infinity })

function send(message) {
  process.stdout.write(JSON.stringify(message) + '\\n')
}

rl.on('line', (line) => {
  const message = JSON.parse(line)

  if (message.method === 'initialize') {
    send({
      jsonrpc: '2.0',
      id: message.id,
      result: {
        protocolVersion: '2025-03-26',
        capabilities: { tools: { listChanged: false } },
        serverInfo: {
          name: 'stub-server',
          title: 'Stub Server',
          version: '1.0.0',
          description: 'A fake MCP server for CLI JSON tests.'
        },
        instructions: 'Use the fake tools carefully.'
      }
    })
    return
  }

  if (message.method === 'tools/list') {
    send({
      jsonrpc: '2.0',
      id: message.id,
      result: {
        tools: [{
          name: 'FindOrganizations',
          description: 'Search organizations.'
        }, {
          name: 'FindPeople',
          description: 'Search people.'
        }]
      }
    })
  }
})`,
  )
})

afterEach(() => {
  rmSync(testDir, { recursive: true, force: true })
})

describe('CLI init JSON summary', () => {
  it('reports the applied hook mode instead of the requested no-op safe mode', async () => {
    const cwd = mkdtempSync(resolve(tmpdir(), 'pluxx-cli-init-'))

    try {
      const proc = Bun.spawn(
        [
          'bun',
          resolve(ROOT, 'bin/pluxx.js'),
          'init',
          '--from-mcp',
          `bun ${stubServerPath}`,
          '--yes',
          '--name',
          'stub-server',
          '--display-name',
          'Stub Server',
          '--author',
          'Test Author',
          '--targets',
          'claude-code,codex',
          '--grouping',
          'workflow',
          '--hooks',
          'safe',
          '--json',
        ],
        {
          cwd,
          stdout: 'pipe',
          stderr: 'pipe',
        },
      )

      const stdout = await new Response(proc.stdout).text()
      const stderr = await new Response(proc.stderr).text()
      const exitCode = await proc.exited

      expect(exitCode).toBe(0)
      expect(stderr).toBe('')

      const summary = JSON.parse(stdout) as {
        requestedHookMode: string
        hookMode: string
        hookEvents: string[]
        files: string[]
        quality: { warnings: number; infos: number }
        notes: string[]
        nextSteps: string[]
      }

      expect(summary.requestedHookMode).toBe('safe')
      expect(summary.hookMode).toBe('none')
      expect(summary.hookEvents).toEqual([])
      expect(summary.files).not.toContain('scripts/check-env.sh')
      expect(typeof summary.quality.warnings).toBe('number')
      expect(typeof summary.quality.infos).toBe('number')
      expect(summary.notes[0]).toContain('No safe hooks were generated')
      expect(summary.nextSteps[2]).toBe('Run: pluxx install --target claude-code')
    } finally {
      rmSync(cwd, { recursive: true, force: true })
    }
  })

  it('applies auth env placeholders and safe hooks for stdio MCP scaffolds', async () => {
    const cwd = mkdtempSync(resolve(tmpdir(), 'pluxx-cli-init-'))

    try {
      const proc = Bun.spawn(
        [
          'bun',
          resolve(ROOT, 'bin/pluxx.js'),
          'init',
          '--from-mcp',
          `bun ${stubServerPath}`,
          '--yes',
          '--name',
          'stub-server',
          '--display-name',
          'Stub Server',
          '--author',
          'Test Author',
          '--targets',
          'claude-code,codex',
          '--grouping',
          'workflow',
          '--auth-env',
          'STUB_API_KEY',
          '--hooks',
          'safe',
          '--json',
        ],
        {
          cwd,
          stdout: 'pipe',
          stderr: 'pipe',
        },
      )

      const stdout = await new Response(proc.stdout).text()
      const stderr = await new Response(proc.stderr).text()
      const exitCode = await proc.exited

      expect(exitCode).toBe(0)
      expect(stderr).toBe('')

      const summary = JSON.parse(stdout) as {
        requestedHookMode: string
        hookMode: string
        hookEvents: string[]
        files: string[]
        quality: { warnings: number; infos: number }
        notes: string[]
        nextSteps: string[]
      }

      expect(summary.requestedHookMode).toBe('safe')
      expect(summary.hookMode).toBe('safe')
      expect(summary.hookEvents).toEqual(['sessionStart'])
      expect(summary.files).toContain('scripts/check-env.sh')
      expect(typeof summary.quality.warnings).toBe('number')
      expect(typeof summary.quality.infos).toBe('number')
      expect(summary.notes[0]).toContain('sessionStart')
      expect(summary.nextSteps[2]).toBe('Run: pluxx install --trust --target claude-code')

      const config = readFileSync(resolve(cwd, 'pluxx.config.ts'), 'utf-8')
      const script = readFileSync(resolve(cwd, 'scripts/check-env.sh'), 'utf-8')

      expect(config).toContain('"STUB_API_KEY": "${STUB_API_KEY}"')
      expect(config).toContain('sessionStart')
      expect(script).toContain('STUB_API_KEY')
    } finally {
      rmSync(cwd, { recursive: true, force: true })
    }
  })
})
