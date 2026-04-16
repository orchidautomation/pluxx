import { describe, expect, it } from 'bun:test'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync } from 'fs'
import { tmpdir } from 'os'
import { resolve } from 'path'
import { introspectMcpServer } from '../src/mcp/introspect'
import { writeMcpScaffold } from '../src/cli/init-from-mcp'

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
  const dir = mkdtempSync(resolve(tmpdir(), 'pluxx-phase2-'))
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

  return { dir, statePath, stubServerPath }
}

describe('Phase 2 CLI flows', () => {
  it('does not write files for init --from-mcp --dry-run', async () => {
    const { dir, statePath, stubServerPath } = createStubServerFixture()
    writeFileSync(
      statePath,
      JSON.stringify({
        serverInfo: {
          name: 'stub-server',
          title: 'Stub Server',
          version: '1.0.0',
          description: 'A fake MCP server.',
        },
        instructions: 'Initial instructions.',
        tools: [
          {
            name: 'FindOrganizations',
            description: 'Search organizations.',
          },
        ],
      }, null, 2),
    )

    try {
      const proc = spawnCli([
        'init',
        '--from-mcp',
        `bun ${stubServerPath} ${statePath}`,
        '--yes',
        '--name',
        'stub-server',
        '--author',
        'Test Author',
        '--dry-run',
        '--json',
      ], dir)

      const stdout = await new Response(proc.stdout).text()
      const stderr = await new Response(proc.stderr).text()
      const exitCode = await proc.exited

      expect(exitCode).toBe(0)
      expect(stderr).toBe('')

      const summary = JSON.parse(stdout) as {
        dryRun: boolean
        createdFiles: string[]
      }
      expect(summary.dryRun).toBe(true)
      expect(summary.createdFiles).toContain('pluxx.config.ts')
      expect(existsSync(resolve(dir, 'pluxx.config.ts'))).toBe(false)
      expect(existsSync(resolve(dir, 'skills'))).toBe(false)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('does not mutate project files for sync --dry-run', async () => {
    const { dir, statePath, stubServerPath } = createStubServerFixture()
    writeFileSync(
      statePath,
      JSON.stringify({
        serverInfo: {
          name: 'stub-server',
          title: 'Stub Server',
          version: '1.0.0',
          description: 'A fake MCP server.',
        },
        instructions: 'Initial instructions.',
        tools: [
          {
            name: 'FindOrganizations',
            description: 'Search organizations.',
          },
        ],
      }, null, 2),
    )

    const source = {
      transport: 'stdio' as const,
      command: 'bun',
      args: [stubServerPath, statePath],
    }
    const introspection = await introspectMcpServer(source)
    await writeMcpScaffold({
      rootDir: dir,
      pluginName: 'stub-server',
      authorName: 'Test Author',
      displayName: 'Stub Server',
      targets: ['claude-code', 'codex'],
      source,
      introspection,
      skillGrouping: 'tool',
      hookMode: 'none',
    })

    const beforeInstructions = readFileSync(resolve(dir, 'INSTRUCTIONS.md'), 'utf-8')

    writeFileSync(
      statePath,
      JSON.stringify({
        serverInfo: {
          name: 'stub-server',
          title: 'Stub Server',
          version: '1.1.0',
          description: 'A fake MCP server.',
        },
        instructions: 'Updated instructions.',
        tools: [
          {
            name: 'FindOrganizations',
            description: 'Search organizations with filters.',
          },
          {
            name: 'SearchTechnologies',
            description: 'Search technologies.',
          },
        ],
      }, null, 2),
    )

    try {
      const proc = spawnCli(['sync', '--dry-run', '--json'], dir)
      const stdout = await new Response(proc.stdout).text()
      const stderr = await new Response(proc.stderr).text()
      const exitCode = await proc.exited

      expect(exitCode).toBe(0)
      expect(stderr).toBe('')

      const summary = JSON.parse(stdout) as {
        dryRun: boolean
        updatedFiles: string[]
      }
      expect(summary.dryRun).toBe(true)
      expect(summary.updatedFiles).toContain('./INSTRUCTIONS.md')
      expect(readFileSync(resolve(dir, 'INSTRUCTIONS.md'), 'utf-8')).toBe(beforeInstructions)
      expect(existsSync(resolve(dir, 'skills/search-technologies/SKILL.md'))).toBe(false)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('does not create symlinks for install --dry-run', async () => {
    const dir = mkdtempSync(resolve(tmpdir(), 'pluxx-install-dry-run-'))
    const homeDir = resolve(dir, 'home')
    mkdirSync(resolve(dir, 'skills/hello'), { recursive: true })
    mkdirSync(resolve(dir, 'dist/claude-code'), { recursive: true })
    mkdirSync(homeDir, { recursive: true })
    writeFileSync(
      resolve(dir, 'skills/hello/SKILL.md'),
      '---\nname: hello\ndescription: Say hello\nversion: 0.1.0\n---\n\n# Hello\n',
    )
    writeFileSync(
      resolve(dir, 'pluxx.config.json'),
      JSON.stringify({
        name: 'dry-run-plugin',
        version: '0.1.0',
        description: 'Install dry run fixture',
        author: { name: 'Test Author' },
        license: 'MIT',
        skills: './skills/',
        targets: ['claude-code'],
        outDir: './dist',
      }, null, 2),
    )

    try {
      const proc = spawnCli(['install', '--dry-run', '--json'], dir, { HOME: homeDir })
      const stdout = await new Response(proc.stdout).text()
      const stderr = await new Response(proc.stderr).text()
      const exitCode = await proc.exited

      expect(exitCode).toBe(0)
      expect(stderr).toBe('')

      const summary = JSON.parse(stdout) as {
        dryRun: boolean
        installTargets: Array<{ platform: string; built: boolean }>
      }
      expect(summary.dryRun).toBe(true)
      expect(summary.installTargets[0]?.platform).toBe('claude-code')
      expect(summary.installTargets[0]?.built).toBe(true)
      expect(existsSync(resolve(homeDir, '.claude/plugins/dry-run-plugin'))).toBe(false)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('fails cleanly in non-interactive mode for plain init', async () => {
    const dir = mkdtempSync(resolve(tmpdir(), 'pluxx-init-non-interactive-'))

    try {
      const proc = spawnCli(['init', 'example-plugin'], dir)
      const stdout = await new Response(proc.stdout).text()
      const stderr = await new Response(proc.stderr).text()
      const exitCode = await proc.exited

      expect(exitCode).toBe(1)
      expect(stdout).toBe('')
      expect(stderr).toContain('interactive terminal')
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('runs pluxx test with JSON output', async () => {
    const dir = mkdtempSync(resolve(tmpdir(), 'pluxx-test-command-'))
    mkdirSync(resolve(dir, 'skills/hello'), { recursive: true })
    writeFileSync(
      resolve(dir, 'skills/hello/SKILL.md'),
      '---\nname: hello\ndescription: Say hello\nversion: 0.1.0\n---\n\n# Hello\n',
    )
    writeFileSync(
      resolve(dir, 'pluxx.config.json'),
      JSON.stringify({
        name: 'test-command-fixture',
        version: '0.1.0',
        description: 'CLI test fixture',
        author: { name: 'Test Author' },
        license: 'MIT',
        skills: './skills/',
        targets: ['claude-code'],
        outDir: './dist',
      }, null, 2),
    )

    try {
      const proc = spawnCli(['test', '--json'], dir)
      const stdout = await new Response(proc.stdout).text()
      const stderr = await new Response(proc.stderr).text()
      const exitCode = await proc.exited

      expect(exitCode).toBe(0)
      expect(stderr).toBe('')

      const summary = JSON.parse(stdout) as {
        ok: boolean
        smoke: { checks: Array<{ platform: string; ok: boolean }> }
      }
      expect(summary.ok).toBe(true)
      expect(summary.smoke.checks.some((check) => check.platform === 'claude-code' && check.ok)).toBe(true)
      expect(existsSync(resolve(dir, 'dist/claude-code/.claude-plugin/plugin.json'))).toBe(true)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('scopes pluxx test linting to the requested target subset', async () => {
    const dir = mkdtempSync(resolve(tmpdir(), 'pluxx-test-target-scope-'))
    mkdirSync(resolve(dir, 'skills/hello'), { recursive: true })
    writeFileSync(
      resolve(dir, 'skills/hello/SKILL.md'),
      `---\nname: hello\ndescription: "${'x'.repeat(1100)}"\nversion: 0.1.0\n---\n\n# Hello\n`,
    )
    writeFileSync(
      resolve(dir, 'pluxx.config.json'),
      JSON.stringify({
        name: 'test-command-fixture',
        version: '0.1.0',
        description: 'CLI test fixture',
        author: { name: 'Test Author' },
        license: 'MIT',
        skills: './skills/',
        targets: ['cursor', 'opencode'],
        outDir: './dist',
      }, null, 2),
    )

    try {
      const proc = spawnCli(['test', '--json', '--target', 'cursor'], dir)
      const stdout = await new Response(proc.stdout).text()
      const stderr = await new Response(proc.stderr).text()
      const exitCode = await proc.exited

      expect(exitCode).toBe(0)
      expect(stderr).toBe('')

      const summary = JSON.parse(stdout) as {
        ok: boolean
        lint: { errors: number }
        build: { targets: string[] }
        smoke: { checks: Array<{ platform: string; ok: boolean }> }
      }
      expect(summary.ok).toBe(true)
      expect(summary.lint.errors).toBe(0)
      expect(summary.build.targets).toEqual(['cursor'])
      expect(summary.smoke.checks).toHaveLength(1)
      expect(summary.smoke.checks[0]?.platform).toBe('cursor')
      expect(summary.smoke.checks[0]?.ok).toBe(true)
      expect(existsSync(resolve(dir, 'dist/cursor/.cursor-plugin/plugin.json'))).toBe(true)
      expect(existsSync(resolve(dir, 'dist/opencode/package.json'))).toBe(false)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})
