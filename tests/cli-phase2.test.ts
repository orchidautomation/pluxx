import { describe, expect, it } from 'bun:test'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync } from 'fs'
import { tmpdir } from 'os'
import { resolve } from 'path'
import { introspectMcpServer } from '../src/mcp/introspect'
import { writeMcpScaffold } from '../src/cli/init-from-mcp'

const ROOT = resolve(import.meta.dir, '..')
const CLI_INDEX_PATH = resolve(ROOT, 'src/cli/index.ts')
const originalArgv = [...process.argv]
const originalCwd = process.cwd()

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

      expect(exitCode, stderr).toBe(0)
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

  it('can scaffold from an already installed Codex MCP config', async () => {
    const { dir, statePath, stubServerPath } = createStubServerFixture()
    mkdirSync(resolve(dir, '.codex'), { recursive: true })
    writeFileSync(
      statePath,
      JSON.stringify({
        serverInfo: {
          name: 'installed-stub',
          title: 'Installed Stub',
          version: '1.0.0',
          description: 'A fake installed MCP server.',
        },
        instructions: 'Use the installed MCP config.',
        tools: [
          {
            name: 'FindOrganizations',
            description: 'Search organizations.',
          },
        ],
      }, null, 2),
    )
    writeFileSync(resolve(dir, '.codex/config.toml'), `
[mcp_servers.installed_stub]
command = "bun"
args = ["${stubServerPath}", "${statePath}"]
env = { STUB_API_KEY = "$STUB_API_KEY" }
`)

    try {
      const proc = spawnCli([
        'init',
        '--from-installed-mcp',
        'codex:installed_stub',
        '--host',
        'codex',
        '--yes',
        '--name',
        'installed-stub',
        '--author',
        'Test Author',
        '--dry-run',
        '--json',
      ], dir)

      const stdout = await new Response(proc.stdout).text()
      const stderr = await new Response(proc.stderr).text()
      const exitCode = await proc.exited

      expect(exitCode, stderr).toBe(0)
      expect(stderr).toBe('')

      const summary = JSON.parse(stdout) as {
        dryRun: boolean
        source: string
        createdFiles: string[]
      }
      expect(summary.dryRun).toBe(true)
      expect(summary.source).toContain('codex:installed_stub')
      expect(summary.createdFiles).toContain('pluxx.config.ts')
      expect(existsSync(resolve(dir, 'pluxx.config.ts'))).toBe(false)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('can scaffold from a nested Claude project-scoped installed MCP selector', async () => {
    const { dir, statePath, stubServerPath } = createStubServerFixture()
    const homeDir = resolve(dir, 'home')
    mkdirSync(homeDir, { recursive: true })
    mkdirSync(resolve(dir, 'workspace-a'), { recursive: true })
    mkdirSync(resolve(dir, 'workspace-b'), { recursive: true })

    writeFileSync(
      statePath,
      JSON.stringify({
        serverInfo: {
          name: 'installed-stub',
          title: 'Installed Stub',
          version: '1.0.0',
          description: 'A fake installed MCP server.',
        },
        instructions: 'Use the installed Claude MCP config.',
        tools: [
          {
            name: 'FindOrganizations',
            description: 'Search organizations.',
          },
        ],
      }, null, 2),
    )
    writeFileSync(resolve(homeDir, '.claude.json'), JSON.stringify({
      projects: {
        [resolve(dir, 'workspace-a')]: {
          mcpServers: {
            installed_stub: {
              url: 'https://workspace-a.example.com/mcp',
            },
          },
        },
        [resolve(dir, 'workspace-b')]: {
          mcpServers: {
            installed_stub: {
              command: 'bun',
              args: [stubServerPath, statePath],
              env: {
                STUB_API_KEY: '$STUB_API_KEY',
              },
            },
          },
        },
      },
    }, null, 2))

    try {
      const proc = spawnCli([
        'init',
        '--from-installed-mcp',
        'claude-code:installed_stub@user:.claude.json:projects/workspace-b',
        '--host',
        'claude-code',
        '--yes',
        '--name',
        'installed-stub',
        '--author',
        'Test Author',
        '--dry-run',
        '--json',
      ], dir, { HOME: homeDir })

      const stdout = await new Response(proc.stdout).text()
      const stderr = await new Response(proc.stderr).text()
      const exitCode = await proc.exited

      expect(exitCode, stderr).toBe(0)
      expect(stderr).toBe('')

      const summary = JSON.parse(stdout) as {
        dryRun: boolean
        source: string
        createdFiles: string[]
      }
      expect(summary.dryRun).toBe(true)
      expect(summary.source).toContain('claude-code:installed_stub@user:.claude.json:projects/workspace-b')
      expect(summary.createdFiles).toContain('pluxx.config.ts')
      expect(existsSync(resolve(dir, 'pluxx.config.ts'))).toBe(false)
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

  it('writes sourced context artifacts during init --from-mcp when docs and website URLs are provided', async () => {
    const { dir, statePath, stubServerPath } = createStubServerFixture()
    writeFileSync(
      statePath,
      JSON.stringify({
        serverInfo: {
          name: 'firecrawl',
          title: 'Firecrawl',
          version: '1.0.0',
          description: 'Generated from the firecrawl MCP server.',
          websiteUrl: 'https://www.firecrawl.dev/',
        },
        instructions: 'Prefer the most specific Firecrawl tool for the request.',
        tools: [
          {
            name: 'scrape',
            description: 'Scrape a single page into markdown.',
            inputSchema: {
              type: 'object',
              properties: {
                url: { type: 'string' },
              },
              required: ['url'],
            },
          },
        ],
      }, null, 2),
    )

    try {
      const websiteUrl = 'https://firecrawl.dev/'
      const docsUrl = 'https://firecrawl.dev/docs/mcp'
      const originalFetch = globalThis.fetch
      const originalLog = console.log
      const logged: string[] = []
      try {
        console.log = (...args: unknown[]) => {
          logged.push(args.join(' '))
        }
        globalThis.fetch = async (input, init) => {
          const request = new Request(input, init)
          if (request.url === websiteUrl || request.url === `${websiteUrl}`) {
            return new Response(
              '<!doctype html><html><head><title>Firecrawl</title><meta name="description" content="Turn websites into clean markdown and structured data."></head><body><h1>Firecrawl</h1><h2>Map sites</h2><p>Use onlyMainContent when you want cleaner extraction.</p></body></html>',
              { headers: { 'Content-Type': 'text/html; charset=utf-8' } },
            )
          }
          if (request.url === docsUrl || request.url === `${docsUrl}` || request.url === 'https://firecrawl.dev/docs') {
            return new Response(
              '<!doctype html><html><head><title>Firecrawl MCP</title><meta name="description" content="Turn websites into clean markdown and structured data."></head><body><h1>Firecrawl MCP</h1><h2>Scrape pages</h2><p>Set the Firecrawl API key before using the hosted endpoint.</p></body></html>',
              { headers: { 'Content-Type': 'text/html; charset=utf-8' } },
            )
          }
          return originalFetch(input, init)
        }

        process.chdir(dir)
        process.argv = [
          'bun',
          'pluxx',
          'init',
          '--from-mcp',
          `bun ${stubServerPath} ${statePath}`,
          '--yes',
          '--name',
          'firecrawl',
          '--display-name',
          'Firecrawl',
          '--author',
          'Firecrawl',
          '--website',
          websiteUrl,
          '--docs',
          docsUrl,
          '--ingest-provider',
          'local',
          '--json',
        ]

        const { main } = await import(`${CLI_INDEX_PATH}?phase2-context-artifacts`)
        await main()

        const stdout = logged.join('\n')
        expect(stdout).not.toBe('')

        const summary = JSON.parse(stdout) as {
          contextInputs?: string[]
          ingestion?: { requestedProvider: string; resolvedProvider: string }
          createdFiles: string[]
        }

        expect(summary.contextInputs).toEqual([
          websiteUrl,
          docsUrl,
          websiteUrl.replace(/\/$/, '/docs'),
        ])
        expect(summary.ingestion).toEqual({
          requestedProvider: 'local',
          resolvedProvider: 'local',
          fallbackToLocalOnError: false,
        })
        expect(summary.createdFiles).toContain('.pluxx/sources.json')
        expect(summary.createdFiles).toContain('.pluxx/docs-context.json')
        expect(existsSync(resolve(dir, '.pluxx/sources.json'))).toBe(true)
        expect(existsSync(resolve(dir, '.pluxx/docs-context.json'))).toBe(true)

        const config = readFileSync(resolve(dir, 'pluxx.config.ts'), 'utf-8')
        const instructions = readFileSync(resolve(dir, 'INSTRUCTIONS.md'), 'utf-8')
        const sources = JSON.parse(readFileSync(resolve(dir, '.pluxx/sources.json'), 'utf-8')) as {
          ingestion?: { requestedProvider: string; resolvedProvider: string }
        }

        expect(config).toContain('description: "Turn websites into clean markdown and structured data."')
        expect(config).toContain(`websiteURL: ${JSON.stringify(websiteUrl)}`)
        expect(instructions).toContain('## Sourced Context')
        expect(instructions).toContain('Auth hints: Set the Firecrawl API key before using the hosted endpoint.')
        expect(sources.ingestion).toEqual({
          requestedProvider: 'local',
          resolvedProvider: 'local',
          fallbackToLocalOnError: false,
        })
      } finally {
        console.log = originalLog
        globalThis.fetch = originalFetch
      }
    } finally {
      process.argv = [...originalArgv]
      process.chdir(originalCwd)
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('fails clearly when init --from-mcp requests firecrawl ingestion without an API key', async () => {
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
            name: 'query',
            description: 'Run a query.',
            inputSchema: { type: 'object', properties: {} },
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
        '--display-name',
        'Stub Server',
        '--author',
        'Test Author',
        '--website',
        'https://example.com',
        '--json',
        '--ingest-provider',
        'firecrawl',
      ], dir, {
        FIRECRAWL_API_KEY: '',
        PLUXX_FIRECRAWL_API_KEY: '',
      })

      const stdout = await new Response(proc.stdout).text()
      const stderr = await new Response(proc.stderr).text()
      const exitCode = await proc.exited

      expect(exitCode).toBe(1)
      expect(stdout).toBe('')
      expect(stderr).toContain('Firecrawl ingestion requires FIRECRAWL_API_KEY')
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

  it('can build and install in one command with --install', async () => {
    const dir = mkdtempSync(resolve(tmpdir(), 'pluxx-build-install-'))
    const homeDir = resolve(dir, 'home')
    mkdirSync(resolve(dir, 'skills/hello'), { recursive: true })
    mkdirSync(homeDir, { recursive: true })
    writeFileSync(
      resolve(dir, 'skills/hello/SKILL.md'),
      '---\nname: hello\ndescription: Say hello\nversion: 0.1.0\n---\n\n# Hello\n',
    )
    writeFileSync(
      resolve(dir, 'pluxx.config.json'),
      JSON.stringify({
        name: 'install-build-fixture',
        version: '0.1.0',
        description: 'Build install fixture',
        author: { name: 'Test Author' },
        license: 'MIT',
        skills: './skills/',
        targets: ['codex'],
        outDir: './dist',
      }, null, 2),
    )

    try {
      const proc = spawnCli(['build', '--install', '--json'], dir, { HOME: homeDir })
      const stdout = await new Response(proc.stdout).text()
      const stderr = await new Response(proc.stderr).text()
      const exitCode = await proc.exited

      expect(exitCode).toBe(0)
      expect(stderr).toBe('')

      const summary = JSON.parse(stdout) as {
        install?: {
          enabled: boolean
          installTargets: Array<{ platform: string }>
        }
      }

      expect(summary.install?.enabled).toBe(true)
      expect(summary.install?.installTargets[0]?.platform).toBe('codex')
      expect(existsSync(resolve(homeDir, '.codex/plugins/install-build-fixture'))).toBe(true)
      expect(existsSync(resolve(homeDir, '.agents/plugins/marketplace.json'))).toBe(true)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('can test and install in one command with --install', async () => {
    const dir = mkdtempSync(resolve(tmpdir(), 'pluxx-test-install-'))
    const homeDir = resolve(dir, 'home')
    mkdirSync(resolve(dir, 'skills/hello'), { recursive: true })
    mkdirSync(homeDir, { recursive: true })
    writeFileSync(
      resolve(dir, 'skills/hello/SKILL.md'),
      '---\nname: hello\ndescription: Say hello\nversion: 0.1.0\n---\n\n# Hello\n',
    )
    writeFileSync(
      resolve(dir, 'pluxx.config.json'),
      JSON.stringify({
        name: 'install-test-fixture',
        version: '0.1.0',
        description: 'Test install fixture',
        author: { name: 'Test Author' },
        license: 'MIT',
        skills: './skills/',
        targets: ['codex'],
        outDir: './dist',
      }, null, 2),
    )

    try {
      const proc = spawnCli(['test', '--install', '--json'], dir, { HOME: homeDir })
      const stdout = await new Response(proc.stdout).text()
      const stderr = await new Response(proc.stderr).text()
      const exitCode = await proc.exited

      expect(exitCode).toBe(0)
      expect(stderr).toBe('')

      const summary = JSON.parse(stdout) as {
        ok: boolean
        install?: {
          enabled: boolean
          installTargets: Array<{ platform: string }>
          verification?: {
            ok: boolean
            checks: Array<{ platform: string; ok: boolean; consumerPath: string }>
          }
        }
      }

      expect(summary.ok).toBe(true)
      expect(summary.install?.enabled).toBe(true)
      expect(summary.install?.installTargets[0]?.platform).toBe('codex')
      expect(summary.install?.verification?.ok).toBe(true)
      expect(summary.install?.verification?.checks[0]?.platform).toBe('codex')
      expect(summary.install?.verification?.checks[0]?.ok).toBe(true)
      expect(summary.install?.verification?.checks[0]?.consumerPath).toContain('.codex/plugins/install-test-fixture')
      expect(existsSync(resolve(homeDir, '.codex/plugins/install-test-fixture'))).toBe(true)
      expect(existsSync(resolve(homeDir, '.agents/plugins/marketplace.json'))).toBe(true)
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
