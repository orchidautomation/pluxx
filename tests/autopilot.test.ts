import { describe, expect, it } from 'bun:test'
import { chmodSync, existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { resolve } from 'path'

const ROOT = resolve(import.meta.dir, '..')

function spawnCli(argv: string[], cwd: string, env: Record<string, string> = {}) {
  return Bun.spawn(['bun', resolve(ROOT, 'bin/pluxx.js'), ...argv], {
    cwd,
    env: {
      ...process.env,
      ...env,
    },
    stdout: 'pipe',
    stderr: 'pipe',
  })
}

function createStubServerFixture() {
  const dir = mkdtempSync(resolve(tmpdir(), 'pluxx-autopilot-'))
  const statePath = resolve(dir, 'server-state.json')
  const stubServerPath = resolve(dir, 'stub-server.js')

  writeFileSync(
    stubServerPath,
    `import { readFileSync } from 'fs'
import * as readline from 'readline'

const statePath = process.argv[2]
const rl = readline.createInterface({ input: process.stdin, crlfDelay: Infinity })

function readState() {
  return JSON.parse(readFileSync(statePath, 'utf-8'))
}

function send(message) {
  process.stdout.write(JSON.stringify(message) + '\\n')
}

rl.on('line', (line) => {
  const message = JSON.parse(line)
  const state = readState()

  if (message.method === 'initialize') {
    send({
      jsonrpc: '2.0',
      id: message.id,
      result: {
        protocolVersion: '2025-03-26',
        capabilities: { tools: { listChanged: false } },
        serverInfo: state.serverInfo,
        instructions: state.instructions,
      }
    })
    return
  }

  if (message.method === 'tools/list') {
    send({
      jsonrpc: '2.0',
      id: message.id,
      result: {
        tools: state.tools
      }
    })
  }
})`,
  )

  writeFileSync(
    statePath,
    JSON.stringify({
      serverInfo: {
        name: 'stub-server',
        title: 'Stub Server',
        version: '1.0.0',
        description: 'A fake MCP server for autopilot tests.',
      },
      instructions: 'Prefer the most specific tool for the request.',
      tools: [
        {
          name: 'FindOrganizations',
          description: 'Search organizations.',
          inputSchema: {
            type: 'object',
            properties: {
              query: { type: 'string' },
            },
            required: ['query'],
          },
        },
        {
          name: 'FindPeople',
          description: 'Search people.',
          inputSchema: {
            type: 'object',
            properties: {
              role: { type: 'string' },
            },
          },
        },
      ],
    }, null, 2),
  )

  return { dir, statePath, stubServerPath }
}

describe('autopilot command', () => {
  it('supports dry-run JSON output without writing files', async () => {
    const { dir, statePath, stubServerPath } = createStubServerFixture()

    try {
      const proc = spawnCli([
        'autopilot',
        '--from-mcp',
        `bun ${stubServerPath} ${statePath}`,
        '--runner',
        'codex',
        '--name',
        'stub-server',
        '--display-name',
        'Stub Server',
        '--author',
        'Test Author',
        '--json',
        '--dry-run',
      ], dir)

      const stdout = await new Response(proc.stdout).text()
      const stderr = await new Response(proc.stderr).text()
      const exitCode = await proc.exited

      expect(exitCode).toBe(0)
      expect(stderr).toBe('')

      const summary = JSON.parse(stdout) as {
        ok: boolean
        dryRun: boolean
        runner: string
        init: { createdFiles: string[] }
        agent: { taxonomy: { command: string[] } }
      }

      expect(summary.ok).toBe(true)
      expect(summary.dryRun).toBe(true)
      expect(summary.runner).toBe('codex')
      expect(summary.init.createdFiles).toContain('pluxx.config.ts')
      expect(summary.agent.taxonomy.command.slice(0, 3)).toEqual(['codex', 'exec', '--full-auto'])
      expect(existsSync(resolve(dir, 'pluxx.config.ts'))).toBe(false)
      expect(existsSync(resolve(dir, '.pluxx/agent/context.md'))).toBe(false)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('runs the full autopilot flow with a headless runner and verifies the scaffold', async () => {
    const { dir, statePath, stubServerPath } = createStubServerFixture()
    const binDir = resolve(dir, '.bin')
    const runnerArgsPath = resolve(dir, 'runner-args.txt')
    const claudePath = resolve(binDir, 'claude')

    mkdirSync(binDir, { recursive: true })
    writeFileSync(
      claudePath,
      '#!/bin/sh\nprintf "%s\\0" "$@" >> "$PLUXX_RUNNER_ARGS"\nexit 0\n',
    )
    chmodSync(claudePath, 0o755)

    try {
      const proc = spawnCli([
        'autopilot',
        '--from-mcp',
        `bun ${stubServerPath} ${statePath}`,
        '--runner',
        'claude',
        '--name',
        'stub-server',
        '--display-name',
        'Stub Server',
        '--author',
        'Test Author',
        '--targets',
        'claude-code,codex',
        '--json',
      ], dir, {
        PATH: `${binDir}:${process.env.PATH ?? ''}`,
        PLUXX_RUNNER_ARGS: runnerArgsPath,
      })

      const stdout = await new Response(proc.stdout).text()
      const stderr = await new Response(proc.stderr).text()
      const exitCode = await proc.exited

      expect(exitCode).toBe(0)
      expect(stderr).toBe('')

      const summary = JSON.parse(stdout) as {
        ok: boolean
        runner: string
        verification?: { ok: boolean }
        agent: {
          taxonomy: { runnerExitCode?: number }
          instructions: { runnerExitCode?: number }
        }
      }

      expect(summary.ok).toBe(true)
      expect(summary.runner).toBe('claude')
      expect(summary.agent.taxonomy.runnerExitCode).toBe(0)
      expect(summary.agent.instructions.runnerExitCode).toBe(0)
      expect(summary.verification?.ok).toBe(true)

      expect(existsSync(resolve(dir, 'pluxx.config.ts'))).toBe(true)
      expect(existsSync(resolve(dir, '.pluxx/agent/context.md'))).toBe(true)
      expect(existsSync(resolve(dir, '.pluxx/agent/taxonomy-prompt.md'))).toBe(true)
      expect(existsSync(resolve(dir, '.pluxx/agent/instructions-prompt.md'))).toBe(true)
      expect(existsSync(resolve(dir, 'dist/claude-code/.claude-plugin/plugin.json'))).toBe(true)
      expect(existsSync(resolve(dir, 'dist/codex/.codex-plugin/plugin.json'))).toBe(true)

      const runnerArgs = readFileSync(runnerArgsPath, 'utf-8').split('\0').filter(Boolean)
      expect(runnerArgs.filter((arg) => arg === '-p').length).toBe(2)
      expect(runnerArgs.some((arg) => arg.includes('.pluxx/agent/context.md'))).toBe(true)
      expect(runnerArgs.some((arg) => arg.includes('.pluxx/agent/taxonomy-prompt.md'))).toBe(true)
      expect(runnerArgs.some((arg) => arg.includes('.pluxx/agent/instructions-prompt.md'))).toBe(true)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})
