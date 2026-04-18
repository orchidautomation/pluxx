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

function createStubServerFixture(overrides: {
  tools?: unknown[]
  instructions?: string
  serverInfo?: Record<string, unknown>
} = {}) {
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
        ...overrides.serverInfo,
      },
      instructions: overrides.instructions ?? 'Prefer the most specific tool for the request.',
      tools: overrides.tools ?? [
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
        mode: string
        runner: string
        quality: { warnings: number; infos: number }
        init: { createdFiles: string[] }
        agent: {
          taxonomy: { enabled: boolean; command?: string[] }
          instructions: { enabled: boolean; command?: string[] }
          review: { enabled: boolean; command?: string[] }
        }
      }

      expect(summary.ok).toBe(true)
      expect(summary.dryRun).toBe(true)
      expect(summary.mode).toBe('standard')
      expect(summary.runner).toBe('codex')
      expect(typeof summary.quality.warnings).toBe('number')
      expect(typeof summary.quality.infos).toBe('number')
      expect(summary.init.createdFiles).toContain('pluxx.config.ts')
      expect(summary.agent.taxonomy.enabled).toBe(false)
      expect(summary.agent.taxonomy.command).toBeUndefined()
      expect(summary.agent.instructions.enabled).toBe(false)
      expect(summary.agent.review.enabled).toBe(false)
      expect(existsSync(resolve(dir, 'pluxx.config.ts'))).toBe(false)
      expect(existsSync(resolve(dir, '.pluxx/agent/context.md'))).toBe(false)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('runs only the taxonomy pass in quick mode when MCP metadata is weak', async () => {
    const { dir, statePath, stubServerPath } = createStubServerFixture({
      tools: [
        {
          name: 'Query',
          description: 'Run things.',
          inputSchema: {
            type: 'object',
            properties: {
              a: { type: 'string' },
              b: { type: 'string' },
            },
          },
        },
      ],
    })

    try {
      const proc = spawnCli([
        'autopilot',
        '--from-mcp',
        `bun ${stubServerPath} ${statePath}`,
        '--runner',
        'codex',
        '--mode',
        'quick',
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
        mode: string
        quality: { warnings: number }
        agent: {
          taxonomy: { enabled: boolean; command?: string[] }
          instructions: { enabled: boolean }
          review: { enabled: boolean }
        }
      }

      expect(summary.mode).toBe('quick')
      expect(summary.quality.warnings).toBeGreaterThan(0)
      expect(summary.agent.taxonomy.enabled).toBe(true)
      expect(summary.agent.taxonomy.command?.slice(0, 3)).toEqual(['codex', 'exec', '--full-auto'])
      expect(summary.agent.instructions.enabled).toBe(false)
      expect(summary.agent.review.enabled).toBe(false)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('supports Cursor as an autopilot runner in thorough dry-run mode', async () => {
    const { dir, statePath, stubServerPath } = createStubServerFixture()

    try {
      const proc = spawnCli([
        'autopilot',
        '--from-mcp',
        `bun ${stubServerPath} ${statePath}`,
        '--runner',
        'cursor',
        '--mode',
        'thorough',
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
        mode: string
        runner: string
        agent: {
          taxonomy: { command: string[] }
          instructions: { command: string[] }
          review: { command: string[]; enabled: boolean }
        }
      }

      expect(summary.ok).toBe(true)
      expect(summary.mode).toBe('thorough')
      expect(summary.runner).toBe('cursor')
      expect(summary.agent.taxonomy.command[0]).toBe('agent')
      expect(summary.agent.taxonomy.command).toContain('-p')
      expect(summary.agent.taxonomy.command).toContain('--workspace')
      expect(summary.agent.taxonomy.command).toContain('--force')
      expect(summary.agent.instructions.command).toContain('--force')
      expect(summary.agent.review.enabled).toBe(true)
      expect(summary.agent.review.command).toContain('-p')
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('supports OpenCode as an autopilot runner in thorough dry-run mode', async () => {
    const { dir, statePath, stubServerPath } = createStubServerFixture()

    try {
      const proc = spawnCli([
        'autopilot',
        '--from-mcp',
        `bun ${stubServerPath} ${statePath}`,
        '--runner',
        'opencode',
        '--attach',
        'http://localhost:4096',
        '--mode',
        'thorough',
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
        mode: string
        runner: string
        agent: {
          taxonomy: { command: string[] }
          instructions: { command: string[] }
          review: { command: string[]; enabled: boolean }
        }
      }

      expect(summary.ok).toBe(true)
      expect(summary.mode).toBe('thorough')
      expect(summary.runner).toBe('opencode')
      expect(summary.agent.taxonomy.command.slice(0, 2)).toEqual(['opencode', 'run'])
      expect(summary.agent.taxonomy.command).toContain('--attach')
      expect(summary.agent.taxonomy.command).toContain('http://localhost:4096')
      expect(summary.agent.instructions.command).toContain('--attach')
      expect(summary.agent.review.enabled).toBe(true)
      expect(summary.agent.review.command).toContain('--attach')
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('rejects --attach for the Cursor autopilot runner', async () => {
    const { dir, statePath, stubServerPath } = createStubServerFixture()

    try {
      const proc = spawnCli([
        'autopilot',
        '--from-mcp',
        `bun ${stubServerPath} ${statePath}`,
        '--runner',
        'cursor',
        '--attach',
        'http://localhost:4096',
        '--name',
        'stub-server',
        '--display-name',
        'Stub Server',
        '--author',
        'Test Author',
        '--dry-run',
      ], dir)

      const stdout = await new Response(proc.stdout).text()
      const stderr = await new Response(proc.stderr).text()
      const exitCode = await proc.exited

      expect(exitCode).toBe(1)
      expect(stdout).toBe('')
      expect(stderr).toContain('--attach is only supported for the opencode runner.')
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('runs the full autopilot flow with the OpenCode runner and attach mode', async () => {
    const { dir, statePath, stubServerPath } = createStubServerFixture()
    const binDir = resolve(dir, '.bin')
    const runnerArgsPath = resolve(dir, 'opencode-runner-args.txt')
    const opencodePath = resolve(binDir, 'opencode')

    mkdirSync(binDir, { recursive: true })
    writeFileSync(
      opencodePath,
      '#!/bin/sh\nprintf "%s\\0" "$@" >> "$PLUXX_RUNNER_ARGS"\nexit 0\n',
    )
    chmodSync(opencodePath, 0o755)

    try {
      const proc = spawnCli([
        'autopilot',
        '--from-mcp',
        `bun ${stubServerPath} ${statePath}`,
        '--runner',
        'opencode',
        '--attach',
        'http://localhost:4096',
        '--mode',
        'thorough',
        '--name',
        'stub-server',
        '--display-name',
        'Stub Server',
        '--author',
        'Test Author',
        '--json',
        '--no-verify',
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
        mode: string
        runner: string
        verify: boolean
        agent: {
          taxonomy: { runnerExitCode?: number }
          instructions: { runnerExitCode?: number }
          review: { runnerExitCode?: number }
        }
      }

      expect(summary.ok).toBe(true)
      expect(summary.mode).toBe('thorough')
      expect(summary.runner).toBe('opencode')
      expect(summary.verify).toBe(false)
      expect(summary.agent.taxonomy.runnerExitCode).toBe(0)
      expect(summary.agent.instructions.runnerExitCode).toBe(0)
      expect(summary.agent.review.runnerExitCode).toBe(0)
      expect(existsSync(resolve(dir, '.pluxx/agent/context.md'))).toBe(true)
      expect(existsSync(resolve(dir, '.pluxx/agent/taxonomy-prompt.md'))).toBe(true)
      expect(existsSync(resolve(dir, '.pluxx/agent/instructions-prompt.md'))).toBe(true)
      expect(existsSync(resolve(dir, '.pluxx/agent/review-prompt.md'))).toBe(true)

      const runnerArgs = readFileSync(runnerArgsPath, 'utf-8').split('\0').filter(Boolean)
      expect(runnerArgs.filter((arg) => arg === 'run').length).toBe(3)
      expect(runnerArgs.filter((arg) => arg === '--attach').length).toBe(3)
      expect(runnerArgs.filter((arg) => arg === 'http://localhost:4096').length).toBe(3)
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
        '--mode',
        'thorough',
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
        mode: string
        runner: string
        quality: { warnings: number; infos: number }
        verification?: { ok: boolean }
        review: boolean
        agent: {
          taxonomy: { runnerExitCode?: number }
          instructions: { runnerExitCode?: number }
          review: { runnerExitCode?: number }
        }
      }

      expect(summary.ok).toBe(true)
      expect(summary.mode).toBe('thorough')
      expect(summary.runner).toBe('claude')
      expect(summary.review).toBe(true)
      expect(typeof summary.quality.warnings).toBe('number')
      expect(typeof summary.quality.infos).toBe('number')
      expect(summary.agent.taxonomy.runnerExitCode).toBe(0)
      expect(summary.agent.instructions.runnerExitCode).toBe(0)
      expect(summary.agent.review.runnerExitCode).toBe(0)
      expect(summary.verification?.ok).toBe(true)

      expect(existsSync(resolve(dir, 'pluxx.config.ts'))).toBe(true)
      expect(existsSync(resolve(dir, '.pluxx/agent/context.md'))).toBe(true)
      expect(existsSync(resolve(dir, '.pluxx/agent/taxonomy-prompt.md'))).toBe(true)
      expect(existsSync(resolve(dir, '.pluxx/agent/instructions-prompt.md'))).toBe(true)
      expect(existsSync(resolve(dir, '.pluxx/agent/review-prompt.md'))).toBe(true)
      expect(existsSync(resolve(dir, 'dist/claude-code/.claude-plugin/plugin.json'))).toBe(true)
      expect(existsSync(resolve(dir, 'dist/codex/.codex-plugin/plugin.json'))).toBe(true)

      const runnerArgs = readFileSync(runnerArgsPath, 'utf-8').split('\0').filter(Boolean)
      expect(runnerArgs.filter((arg) => arg === '-p').length).toBe(3)
      expect(runnerArgs.some((arg) => arg.includes('.pluxx/agent/context.md'))).toBe(true)
      expect(runnerArgs.some((arg) => arg.includes('.pluxx/agent/taxonomy-prompt.md'))).toBe(true)
      expect(runnerArgs.some((arg) => arg.includes('.pluxx/agent/instructions-prompt.md'))).toBe(true)
      expect(runnerArgs.some((arg) => arg.includes('.pluxx/agent/review-prompt.md'))).toBe(true)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('keeps instructions and review packs aligned with taxonomy changes during autopilot runs', async () => {
    const { dir, statePath, stubServerPath } = createStubServerFixture()
    const binDir = resolve(dir, '.bin')
    const claudePath = resolve(binDir, 'claude')
    const taxonomyPath = resolve(dir, '.pluxx/taxonomy.json')
    const instructionsPromptPath = resolve(dir, '.pluxx/agent/instructions-prompt.md')
    const reviewPromptPath = resolve(dir, '.pluxx/agent/review-prompt.md')

    mkdirSync(binDir, { recursive: true })
    writeFileSync(
      claudePath,
      `#!/bin/sh
prompt=""
prev=""
for arg in "$@"; do
  if [ "$prev" = "-p" ]; then
    prompt="$arg"
    break
  fi
  prev="$arg"
done

case "$prompt" in
  *taxonomy-prompt.md*)
    cat > "$PLUXX_TAXONOMY_PATH" <<'EOF'
[
  {
    "dirName": "research",
    "title": "Research",
    "description": "Merged research workflow after taxonomy refinement.",
    "toolNames": ["FindOrganizations", "FindPeople"]
  }
]
EOF
    exit 0
    ;;
  *instructions-prompt.md*)
    if grep -q '\`skills/research/SKILL.md\`' "$PLUXX_INSTRUCTIONS_PROMPT_PATH"; then
      exit 0
    fi
    echo "stale instructions prompt" >&2
    exit 42
    ;;
  *review-prompt.md*)
    if grep -q '\`skills/research/SKILL.md\`' "$PLUXX_REVIEW_PROMPT_PATH"; then
      exit 0
    fi
    echo "stale review prompt" >&2
    exit 43
    ;;
esac

exit 0
`,
    )
    chmodSync(claudePath, 0o755)

    try {
      const proc = spawnCli([
        'autopilot',
        '--from-mcp',
        `bun ${stubServerPath} ${statePath}`,
        '--runner',
        'claude',
        '--mode',
        'thorough',
        '--name',
        'stub-server',
        '--display-name',
        'Stub Server',
        '--author',
        'Test Author',
        '--json',
        '--no-verify',
      ], dir, {
        PATH: `${binDir}:${process.env.PATH ?? ''}`,
        PLUXX_TAXONOMY_PATH: taxonomyPath,
        PLUXX_INSTRUCTIONS_PROMPT_PATH: instructionsPromptPath,
        PLUXX_REVIEW_PROMPT_PATH: reviewPromptPath,
      })

      const stdout = await new Response(proc.stdout).text()
      const stderr = await new Response(proc.stderr).text()
      const exitCode = await proc.exited

      expect(exitCode).toBe(0)
      expect(stderr).toBe('')

      const summary = JSON.parse(stdout) as {
        ok: boolean
        agent: {
          taxonomy: { runnerExitCode?: number }
          instructions: { runnerExitCode?: number }
          review: { runnerExitCode?: number }
        }
      }

      expect(summary.ok).toBe(true)
      expect(summary.agent.taxonomy.runnerExitCode).toBe(0)
      expect(summary.agent.instructions.runnerExitCode).toBe(0)
      expect(summary.agent.review.runnerExitCode).toBe(0)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('suppresses runner logs by default and streams them with --verbose-runner', async () => {
    const run = async (verboseRunner: boolean) => {
      const { dir, statePath, stubServerPath } = createStubServerFixture()
      const binDir = resolve(dir, '.bin')
      const claudePath = resolve(binDir, 'claude')
      const marker = 'PLUXX_RUNNER_STREAM_MARKER'

      mkdirSync(binDir, { recursive: true })
      writeFileSync(
        claudePath,
        `#!/bin/sh\necho "${marker}"\nexit 0\n`,
      )
      chmodSync(claudePath, 0o755)

      try {
        const argv = [
          'autopilot',
          '--from-mcp',
          `bun ${stubServerPath} ${statePath}`,
          '--runner',
          'claude',
          '--mode',
          'thorough',
          '--name',
          'stub-server',
          '--display-name',
          'Stub Server',
          '--author',
          'Test Author',
          '--no-verify',
        ]
        if (verboseRunner) {
          argv.push('--verbose-runner')
        }

        const proc = spawnCli(argv, dir, {
          PATH: `${binDir}:${process.env.PATH ?? ''}`,
        })

        const stdout = await new Response(proc.stdout).text()
        const stderr = await new Response(proc.stderr).text()
        const exitCode = await proc.exited

        expect(exitCode).toBe(0)
        expect(stderr).toBe('')
        return { stdout, marker }
      } finally {
        rmSync(dir, { recursive: true, force: true })
      }
    }

    const normal = await run(false)
    expect(normal.stdout).not.toContain(normal.marker)
    expect(normal.stdout).toContain('Runner logs: suppressed (use --verbose-runner to stream)')

    const verbose = await run(true)
    expect(verbose.stdout).toContain(verbose.marker)
  })

  it('prints explicit auth guidance for OAuth-first remote MCPs', async () => {
    const dir = mkdtempSync(resolve(tmpdir(), 'pluxx-autopilot-auth-'))
    let port = 0
    const server = Bun.serve({
      port: 0,
      fetch(request) {
        const url = new URL(request.url)
        if (url.pathname === '/mcp') {
          return new Response(null, {
            status: 302,
            headers: {
              location: `http://127.0.0.1:${port}/oauth/login`,
            },
          })
        }

        return new Response('<html><body>OAuth login required</body></html>', {
          status: 200,
          headers: {
            'content-type': 'text/html',
          },
        })
      },
    })
    port = server.port

    try {
      const proc = spawnCli([
        'autopilot',
        '--from-mcp',
        `http://127.0.0.1:${server.port}/mcp`,
        '--runner',
        'codex',
        '--yes',
        '--name',
        'oauth-stub',
        '--display-name',
        'OAuth Stub',
        '--author',
        'Test Author',
      ], dir)

      const stdout = await new Response(proc.stdout).text()
      const stderr = await new Response(proc.stderr).text()
      const exitCode = await proc.exited

      expect(exitCode).toBe(1)
      expect(stdout).toBe('')
      expect(stderr).toContain('This MCP server requires authentication')
      expect(stderr).toContain('--auth-env YOUR_ENV_VAR')
      expect(stderr).toContain('OAuth-first')
    } finally {
      server.stop(true)
      rmSync(dir, { recursive: true, force: true })
    }
  })
})
