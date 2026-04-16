import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { resolve } from 'path'
import { introspectMcpServer } from '../src/mcp/introspect'
import { writeMcpScaffold } from '../src/cli/init-from-mcp'

const ROOT = resolve(import.meta.dir, '..')
let testDir = ''
let statePath = ''
let stubServerPath = ''

beforeEach(() => {
  testDir = mkdtempSync(resolve(tmpdir(), 'pluxx-cli-sync-'))
  statePath = resolve(testDir, 'server-state.json')
  stubServerPath = resolve(testDir, 'stub-server.js')

  mkdirSync(testDir, { recursive: true })

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
})

afterEach(() => {
  rmSync(testDir, { recursive: true, force: true })
})

describe('CLI sync command', () => {
  it('returns a JSON summary and preserves mixed-ownership files with custom edits', async () => {
    writeFileSync(
      statePath,
      JSON.stringify({
        serverInfo: {
          name: 'stub-server',
          title: 'Stub Server',
          version: '1.0.0',
          description: 'A fake MCP server for CLI sync tests.',
        },
        instructions: 'Initial instructions.',
        tools: [
          {
            name: 'FindOrganizations',
            description: 'Search organizations.',
          },
          {
            name: 'FindPeople',
            description: 'Search people.',
          },
        ],
      }, null, 2),
    )

    const source = {
      transport: 'stdio' as const,
      command: 'bun',
      args: [stubServerPath, statePath],
      env: {
        STUB_API_KEY: '${STUB_API_KEY}',
      },
    }

    const introspection = await introspectMcpServer(source)
    await writeMcpScaffold({
      rootDir: testDir,
      pluginName: 'stub-server',
      authorName: 'Test Author',
      displayName: 'Stub Server',
      targets: ['claude-code', 'codex'],
      source,
      introspection,
      skillGrouping: 'tool',
      hookMode: 'safe',
    })

    writeFileSync(
      resolve(testDir, 'skills/find-people/SKILL.md'),
      readFileSync(resolve(testDir, 'skills/find-people/SKILL.md'), 'utf-8').replace(
        'Add custom guidance, examples, or caveats here. This section is preserved across `pluxx sync --from-mcp`.',
        'Keep this custom follow-up note.',
      ),
    )

    writeFileSync(
      statePath,
      JSON.stringify({
        serverInfo: {
          name: 'stub-server',
          title: 'Stub Server',
          version: '1.1.0',
          description: 'A fake MCP server for CLI sync tests.',
        },
        instructions: 'Updated instructions.',
        tools: [
          {
            name: 'FindOrganizations',
            description: 'Search organizations with richer filters.',
          },
          {
            name: 'SearchTechnologies',
            description: 'Search technologies.',
          },
        ],
      }, null, 2),
    )

    const proc = Bun.spawn(
      ['bun', resolve(ROOT, 'bin/pluxx.js'), 'sync', '--json'],
      {
        cwd: testDir,
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
      addedFiles: string[]
      updatedFiles: string[]
      removedFiles: string[]
      preservedFiles: string[]
    }

    expect(summary.addedFiles).toContain('skills/search-technologies/SKILL.md')
    expect(summary.preservedFiles).toContain('skills/find-people/SKILL.md')
    expect(summary.updatedFiles).toContain('./INSTRUCTIONS.md')
    expect(summary.removedFiles).toEqual(['commands/find-people.md'])
  })
})
