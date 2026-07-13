import { createHash } from 'crypto'
import { describe, expect, it, mock } from 'bun:test'
import { chmodSync, existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { resolve } from 'path'
import { createDurableCheckpoint } from '../src/cli/checkpoints'

const ROOT = resolve(import.meta.dir, '..')
const CLI_INDEX_PATH = resolve(ROOT, 'src/cli/index.ts')
const INTROSPECT_PATH = resolve(ROOT, 'src/mcp/introspect.ts')
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
  it('rolls back from durable state without requiring source, runner, or network access', async () => {
    const dir = mkdtempSync(resolve(tmpdir(), 'pluxx-autopilot-rollback-'))
    const projectFile = resolve(dir, 'project.txt')

    try {
      writeFileSync(resolve(dir, '.gitignore'), 'existing-rule\n')
      writeFileSync(projectFile, 'before autopilot\n')
      mkdirSync(resolve(dir, '.pluxx', 'agent'), { recursive: true })
      writeFileSync(resolve(dir, '.pluxx', 'agent', 'taxonomy-run-result.json'), 'preexisting result\n')
      const checkpoint = await createDurableCheckpoint(dir, 'initial', { includeAgentResults: true })
      writeFileSync(projectFile, 'after autopilot\n')
      writeFileSync(resolve(dir, '.pluxx', 'agent', 'taxonomy-run-result.json'), 'current result\n')
      writeFileSync(resolve(dir, '.pluxx', 'agent', 'instructions-run-result.json'), 'new result\n')
      writeFileSync(resolve(dir, '.pluxx/autopilot-state.json'), JSON.stringify({
        version: 1,
        behaviorFingerprint: 'fingerprint',
        source: 'unreachable-source',
        runner: 'claude',
        mode: 'standard',
        behavior: {
          source: 'unreachable-source',
          runner: 'claude',
          mode: 'standard',
          pluginName: 'fixture',
          displayName: 'Fixture',
          authorName: '',
          targets: ['codex'],
          installTargets: [],
          grouping: 'workflow',
          requestedHookMode: 'none',
          runtimeAuthMode: 'inline',
          oauthWrapper: false,
          approveMcpTools: false,
          contextPaths: [],
          reviewRequested: false,
          verify: true,
          installRequested: false,
          trustRequested: false,
          behavioralRequested: false,
        },
        initialCheckpoint: checkpoint.directory,
        latestCheckpoint: checkpoint.directory,
        completedStages: [],
        checkpoints: {},
        updatedAt: new Date().toISOString(),
      }))

      const proc = spawnCli(['autopilot', '--rollback', '--json'], dir)
      const stdout = await new Response(proc.stdout).text()
      const stderr = await new Response(proc.stderr).text()
      const exitCode = await proc.exited

      expect(exitCode).toBe(0)
      expect(stderr).toBe('')
      expect(JSON.parse(stdout)).toEqual(expect.objectContaining({ ok: true, rolledBack: true }))
      expect(readFileSync(projectFile, 'utf-8')).toBe('before autopilot\n')
      expect(readFileSync(resolve(dir, '.gitignore'), 'utf-8')).toBe('existing-rule\n')
      expect(existsSync(resolve(dir, '.pluxx', ['autopilot', 'state.json'].join('-')))).toBe(false)
      expect(existsSync(resolve(dir, '.pluxx', 'checkpoints'))).toBe(false)
      expect(readFileSync(resolve(dir, '.pluxx', 'agent', 'taxonomy-run-result.json'), 'utf-8')).toBe('preexisting result\n')
      expect(existsSync(resolve(dir, '.pluxx', 'agent', 'instructions-run-result.json'))).toBe(false)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('rejects malformed persisted resume state before contacting a source', async () => {
    const dir = mkdtempSync(resolve(tmpdir(), 'pluxx-autopilot-invalid-state-'))
    try {
      mkdirSync(resolve(dir, '.pluxx'), { recursive: true })
      writeFileSync(resolve(dir, '.pluxx/autopilot-state.json'), JSON.stringify({
        version: 1,
        behaviorFingerprint: 'fingerprint',
        source: 'unreachable-source',
        runner: 'claude',
        mode: 'invalid-mode',
        initialCheckpoint: 'initial',
        latestCheckpoint: 'latest',
        completedStages: ['baseline'],
        checkpoints: { baseline: 'latest' },
        updatedAt: new Date().toISOString(),
      }))

      const proc = spawnCli(['autopilot', '--resume', '--json'], dir)
      const stderr = await new Response(proc.stderr).text()
      const exitCode = await proc.exited

      expect(exitCode).toBe(1)
      expect(stderr).toContain('Invalid or unsupported Autopilot state')
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('re-introspects and reapplies the scaffold when resuming before baseline completed', async () => {
    const { dir, statePath, stubServerPath } = createStubServerFixture()
    const source = `bun ${stubServerPath} ${statePath}`
    const behavior = {
      source,
      runner: 'claude',
      mode: 'quick',
      pluginName: 'stub-server',
      displayName: 'Stub Server',
      authorName: 'Test Author',
      targets: ['codex'],
      installTargets: [],
      grouping: 'workflow',
      requestedHookMode: 'none',
      runtimeAuthMode: 'inline',
      oauthWrapper: false,
      approveMcpTools: false,
      contextPaths: [],
      reviewRequested: false,
      verify: false,
      installRequested: false,
      trustRequested: false,
      behavioralRequested: false,
    }

    try {
      writeFileSync(resolve(dir, '.gitignore'), 'existing-rule\n')
      const checkpoint = await createDurableCheckpoint(dir, 'initial', { includeAgentResults: true })
      mkdirSync(resolve(dir, '.pluxx'), { recursive: true })
      writeFileSync(resolve(dir, '.pluxx/autopilot-state.json'), JSON.stringify({
        version: 1,
        behaviorFingerprint: createHash('sha256').update(JSON.stringify(behavior)).digest('hex'),
        source,
        runner: 'claude',
        mode: 'quick',
        behavior,
        initialCheckpoint: checkpoint.directory,
        latestCheckpoint: checkpoint.directory,
        completedStages: [],
        checkpoints: {},
        updatedAt: new Date().toISOString(),
      }, null, 2))
      expect(existsSync(resolve(dir, '.pluxx/mcp.json'))).toBe(false)

      const proc = spawnCli(['autopilot', '--resume', '--json'], dir)
      const stdout = await new Response(proc.stdout).text()
      const stderr = await new Response(proc.stderr).text()
      const exitCode = await proc.exited

      expect(exitCode, `${stderr}\n${stdout}`).toBe(0)
      expect(stderr).toBe('')
      const summary = JSON.parse(stdout) as { ok: boolean; resumed?: boolean; baseline?: { doctor: { ok: boolean }; test: { ok: boolean } } }
      expect(summary.ok).toBe(true)
      expect(summary.resumed).toBe(true)
      expect(summary.baseline?.doctor.ok, stdout).toBe(true)
      expect(summary.baseline?.test.ok, stdout).toBe(true)
      expect(existsSync(resolve(dir, '.pluxx/mcp.json'))).toBe(true)
      const state = JSON.parse(readFileSync(resolve(dir, '.pluxx/autopilot-state.json'), 'utf-8')) as { completedStages: string[] }
      expect(state.completedStages).toContain('baseline')
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  }, 60_000)

  it('stops dependent passes after a runner failure', async () => {
    const { dir, statePath, stubServerPath } = createStubServerFixture()
    const binDir = resolve(dir, '.bin')
    const runnerPath = resolve(binDir, 'claude')
    const countPath = resolve(tmpdir(), `pluxx-runner-count-${Date.now()}`)
    mkdirSync(binDir, { recursive: true })
    writeFileSync(runnerPath, '#!/bin/sh\necho x >> "$COUNT_PATH"\nexit 17\n')
    chmodSync(runnerPath, 0o755)
    try {
      const proc = spawnCli([
        'autopilot', '--from-mcp', `bun ${stubServerPath} ${statePath}`,
        '--runner', 'claude', '--mode', 'thorough', '--name', 'stub-server',
        '--display-name', 'Stub Server', '--json', '--no-verify',
      ], dir, {
        PATH: `${binDir}:${Reflect.get(process, 'env').PATH ?? ''}`,
        COUNT_PATH: countPath,
      })
      const stdout = await new Response(proc.stdout).text()
      const stderr = await new Response(proc.stderr).text()
      const exitCode = await proc.exited
      expect(exitCode).toBe(1)
      expect(stderr).toBe('')
      const summary = JSON.parse(stdout) as {
        baseline?: { doctor: { ok: boolean }; test: { ok: boolean } }
        failureStage?: string
        agent: {
          taxonomy: { runnerExitCode?: number; runnerOutput?: { artifactPath: string; truncated: boolean } }
          instructions: { runnerExitCode?: number }
          review?: { runnerExitCode?: number }
        }
      }
      expect(summary.baseline?.doctor.ok).toBe(true)
      expect(summary.baseline?.test.ok).toBe(true)
      expect(summary.failureStage).toBe('runner')
      expect(summary.agent.taxonomy.runnerExitCode).toBe(17)
      expect(summary.agent.taxonomy.runnerOutput).toEqual(expect.objectContaining({
        artifactPath: '.pluxx/agent/taxonomy-run-result.json',
        truncated: false,
      }))
      expect(summary.agent.instructions.runnerExitCode).toBeUndefined()
      expect(summary.agent.review?.runnerExitCode).toBeUndefined()
      expect(readFileSync(countPath, 'utf-8').trim().split('\n')).toHaveLength(1)
      const state = JSON.parse(readFileSync(resolve(dir, '.pluxx/autopilot-state.json'), 'utf-8')) as {
        version: number
        completedStages: string[]
        behaviorFingerprint: string
      }
      expect(state.version).toBe(1)
      expect(state.completedStages).toContain('baseline')
      expect(state.completedStages).not.toContain('taxonomy')
      expect(state.behaviorFingerprint).toMatch(/^[a-f0-9]{64}$/)
      expect(readFileSync(resolve(dir, '.gitignore'), 'utf-8')).toContain('.pluxx/autopilot-state.json')
      expect(readFileSync(resolve(dir, '.gitignore'), 'utf-8')).toContain('.pluxx/agent/*-run-result.json')
      expect(existsSync(resolve(dir, '.pluxx/transactions'))).toBe(false)
      rmSync(stubServerPath, { force: true })
    } finally {
      rmSync(countPath, { force: true })
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('restores a boundary violation and suppresses dependent passes', async () => {
    const { dir, statePath, stubServerPath } = createStubServerFixture()
    const binDir = resolve(dir, '.bin')
    const runnerPath = resolve(binDir, 'claude')
    const countPath = resolve(tmpdir(), `pluxx-boundary-count-${Date.now()}`)
    mkdirSync(binDir, { recursive: true })
    writeFileSync(runnerPath, '#!/bin/sh\necho run >> "$COUNT_PATH"\nprintf "\\nunauthorized boundary edit\\n" >> INSTRUCTIONS.md\nexit 0\n')
    chmodSync(runnerPath, 0o755)
    try {
      const proc = spawnCli([
        'autopilot', '--from-mcp', `bun ${stubServerPath} ${statePath}`,
        '--runner', 'claude', '--mode', 'thorough', '--name', 'stub-server',
        '--display-name', 'Stub Server', '--json', '--no-verify',
      ], dir, {
        PATH: `${binDir}:${Reflect.get(process, 'env').PATH ?? ''}`,
        COUNT_PATH: countPath,
      })
      const stdout = await new Response(proc.stdout).text()
      expect(await proc.exited).toBe(1)
      const summary = JSON.parse(stdout)
      expect(summary.failureStage).toBe('boundary')
      expect(summary.agent.taxonomy.boundary).toEqual(expect.objectContaining({ ok: false, restored: true }))
      expect(summary.agent.instructions.runnerExitCode).toBeUndefined()
      expect(readFileSync(countPath, 'utf8').trim().split('\n')).toHaveLength(1)
      expect(readFileSync(resolve(dir, 'INSTRUCTIONS.md'), 'utf8')).not.toContain('unauthorized boundary edit')
    } finally {
      rmSync(countPath, { force: true })
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('blocks post-agent verification when review findings are actionable', async () => {
    const { dir, statePath, stubServerPath } = createStubServerFixture()
    const binDir = resolve(dir, '.bin')
    const runnerPath = resolve(binDir, 'claude')
    mkdirSync(binDir, { recursive: true })
    writeFileSync(runnerPath, `#!/bin/sh
echo PLUXX_REVIEW_RESULT_START
echo '{"findings":[{"severity":"error","title":"Fix boundary","message":"Required repair","actionable":true}]}'
echo PLUXX_REVIEW_RESULT_END
exit 0
`)
    chmodSync(runnerPath, 0o755)
    try {
      const proc = spawnCli([
        'autopilot', '--from-mcp', `bun ${stubServerPath} ${statePath}`,
        '--runner', 'claude', '--mode', 'thorough', '--name', 'stub-server',
        '--display-name', 'Stub Server', '--json',
      ], dir, { PATH: `${binDir}:${Reflect.get(process, 'env').PATH ?? ''}` })
      const stdout = await new Response(proc.stdout).text()
      const stderr = await new Response(proc.stderr).text()
      const exitCode = await proc.exited
      expect(exitCode).toBe(1)
      expect(stderr).toBe('')
      const summary = JSON.parse(stdout) as {
        failureStage?: string
        verification?: unknown
        agent: { review?: { result?: { status: string; actionableCount: number } } }
      }
      expect(summary.failureStage).toBe('review')
      expect(summary.verification).toBeUndefined()
      expect(summary.agent.review?.result).toEqual(expect.objectContaining({ status: 'actionable-findings', actionableCount: 1 }))
      const state = JSON.parse(readFileSync(resolve(dir, '.pluxx/autopilot-state.json'), 'utf-8')) as { completedStages: string[] }
      expect(state.completedStages).toContain('instructions')
      expect(state.completedStages).not.toContain('review')
      expect(state.completedStages).not.toContain('verification')
      expect(existsSync(resolve(dir, '.pluxx/agent/review-result.json'))).toBe(true)
      expect(existsSync(resolve(dir, '.pluxx/agent/review-run-result.json'))).toBe(true)
      const gitignore = readFileSync(resolve(dir, '.gitignore'), 'utf-8')
      expect(gitignore).toContain('.pluxx/agent/*-run-result.json')
      expect(gitignore).toContain('.pluxx/agent/review-result.json')
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('reports the stable verification discriminator and restores baseline after post-agent verification fails', async () => {
    const { dir, statePath, stubServerPath } = createStubServerFixture()
    const binDir = resolve(dir, '.bin')
    const runnerPath = resolve(binDir, 'claude')
    mkdirSync(binDir, { recursive: true })
    writeFileSync(runnerPath, `#!/bin/sh
case "$*" in
*instructions-prompt.md*)
  perl -0pi -e 's#<!-- pluxx:generated:start -->.*?<!-- pluxx:generated:end -->#<!-- pluxx:generated:start -->\\ninvalid instructions\\n<!-- pluxx:generated:end -->#s' INSTRUCTIONS.md
  ;;
esac
echo PLUXX_REVIEW_RESULT_START
echo '{"findings":[]}'
echo PLUXX_REVIEW_RESULT_END
exit 0
`)
    chmodSync(runnerPath, 0o755)
    try {
      const proc = spawnCli([
        'autopilot', '--from-mcp', `bun ${stubServerPath} ${statePath}`,
        '--runner', 'claude', '--mode', 'thorough', '--name', 'stub-server',
        '--display-name', 'Stub Server', '--json',
      ], dir, {
        PATH: `${binDir}:${Reflect.get(process, 'env').PATH ?? ''}`,
      })
      const stdout = await new Response(proc.stdout).text()
      expect(await proc.exited).toBe(1)
      const summary = JSON.parse(stdout) as {
        failureStage?: string
        failurePhase?: string
        verification?: { ok: boolean }
      }
      expect(summary.failureStage).toBe('verification')
      expect(summary.failurePhase).toBe('post-agent-verification')
      expect(summary.verification?.ok).toBe(false)
      const state = JSON.parse(readFileSync(resolve(dir, '.pluxx/autopilot-state.json'), 'utf-8')) as {
        completedStages: string[]
      }
      expect(state.completedStages).toEqual(['baseline'])
      expect(readFileSync(resolve(dir, 'INSTRUCTIONS.md'), 'utf-8')).not.toContain('invalid instructions')
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  }, 60_000)

  it('resumes from the last successful pass without reapplying completed stages', async () => {
    const { dir, statePath, stubServerPath } = createStubServerFixture()
    const binDir = resolve(dir, '.bin')
    const runnerPath = resolve(binDir, 'claude')
    const countPath = resolve(tmpdir(), `pluxx-resume-count-${Date.now()}`)
    mkdirSync(binDir, { recursive: true })
    writeFileSync(runnerPath, `#!/bin/sh
count=0
if [ -f "$COUNT_PATH" ]; then count=$(cat "$COUNT_PATH"); fi
count=$((count + 1))
echo "$count" > "$COUNT_PATH"
if [ "$count" = "2" ]; then exit 19; fi
echo PLUXX_REVIEW_RESULT_START
echo '{"findings":[]}'
echo PLUXX_REVIEW_RESULT_END
exit 0
`)
    chmodSync(runnerPath, 0o755)
    const baseArgs = [
      'autopilot', '--from-mcp', `bun ${stubServerPath} ${statePath}`,
      '--runner', 'claude', '--mode', 'thorough', '--name', 'stub-server',
      '--display-name', 'Stub Server', '--json', '--no-verify',
    ]
    const launch = async (extra: string[] = []) => {
      const proc = spawnCli([...baseArgs, ...extra], dir, {
        PATH: `${binDir}:${Reflect.get(process, 'env').PATH ?? ''}`,
        COUNT_PATH: countPath,
      })
      const stdout = await new Response(proc.stdout).text()
      const stderr = await new Response(proc.stderr).text()
      return { exitCode: await proc.exited, stdout, stderr }
    }
    try {
      const first = await launch()
      expect(first.exitCode).toBe(1)
      expect(JSON.parse(first.stdout).agent.taxonomy.runnerExitCode).toBe(0)
      expect(JSON.parse(first.stdout).agent.instructions.runnerExitCode).toBe(19)
      expect(existsSync(resolve(dir, '.pluxx/transactions'))).toBe(false)

      const mismatchProc = spawnCli(['autopilot', '--resume', '--mode', 'quick', '--json'], dir, {
        PATH: `${binDir}:${Reflect.get(process, 'env').PATH ?? ''}`,
        COUNT_PATH: countPath,
      })
      const mismatchStderr = await new Response(mismatchProc.stderr).text()
      expect(await mismatchProc.exited).toBe(1)
      expect(mismatchStderr).toContain('resume inputs do not match')
      expect(readFileSync(countPath, 'utf-8').trim()).toBe('2')

      const resumeProc = spawnCli(['autopilot', '--resume', '--json'], dir, {
        PATH: `${binDir}:${Reflect.get(process, 'env').PATH ?? ''}`,
        COUNT_PATH: countPath,
      })
      const resumed = {
        stdout: await new Response(resumeProc.stdout).text(),
        stderr: await new Response(resumeProc.stderr).text(),
        exitCode: await resumeProc.exited,
      }
      expect(resumed.exitCode).toBe(0)
      expect(resumed.stderr).toBe('')
      const summary = JSON.parse(resumed.stdout) as { ok: boolean; resumed?: boolean; agent: { taxonomy: { runnerExitCode?: number }; instructions: { runnerExitCode?: number } } }
      expect(summary.ok).toBe(true)
      expect(summary.resumed).toBe(true)
      expect(summary.agent.taxonomy.runnerExitCode).toBeUndefined()
      expect(summary.agent.instructions.runnerExitCode).toBe(0)
      expect(readFileSync(countPath, 'utf-8').trim()).toBe('4')
      expect(existsSync(resolve(dir, '.pluxx/transactions'))).toBe(false)
    } finally {
      rmSync(countPath, { force: true })
      rmSync(dir, { recursive: true, force: true })
    }
  }, 60_000)

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
      expect(summary.agent.taxonomy.command?.slice(0, 11)).toEqual([
        'codex',
        'exec',
        '--ephemeral',
        '--skip-git-repo-check',
        '--disable',
        'general_analytics',
        '--disable',
        'plugins',
        '--disable',
        'shell_snapshot',
        '--full-auto',
      ])
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
    const runnerArgsPath = resolve(tmpdir(), `pluxx-opencode-runner-args-${Date.now()}.txt`)
    const opencodePath = resolve(binDir, 'opencode')

    mkdirSync(binDir, { recursive: true })
    writeFileSync(
      opencodePath,
      '#!/bin/sh\nprintf "%s\\0" "$@" >> "$PLUXX_RUNNER_ARGS"\necho PLUXX_REVIEW_RESULT_START\necho \'{"findings":[]}\'\necho PLUXX_REVIEW_RESULT_END\nexit 0\n',
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
      rmSync(runnerArgsPath, { force: true })
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('runs the full autopilot flow with a headless runner and verifies the scaffold', async () => {
    const { dir, statePath, stubServerPath } = createStubServerFixture()
    const binDir = resolve(dir, '.bin')
    const runnerArgsPath = resolve(tmpdir(), `pluxx-runner-args-${Date.now()}.txt`)
    const claudePath = resolve(binDir, 'claude')

    mkdirSync(binDir, { recursive: true })
    writeFileSync(
      claudePath,
      '#!/bin/sh\nprintf "%s\\0" "$@" >> "$PLUXX_RUNNER_ARGS"\necho PLUXX_REVIEW_RESULT_START\necho \'{"findings":[]}\'\necho PLUXX_REVIEW_RESULT_END\nexit 0\n',
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
        '--approve-mcp-tools',
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
      expect(readFileSync(resolve(dir, 'pluxx.config.ts'), 'utf-8')).toContain('allow: ["MCP(stub-server.*)"]')

      const runnerArgs = readFileSync(runnerArgsPath, 'utf-8').split('\0').filter(Boolean)
      expect(runnerArgs.filter((arg) => arg === '-p').length).toBe(3)
      expect(runnerArgs.some((arg) => arg.includes('.pluxx/agent/context.md'))).toBe(true)
      expect(runnerArgs.some((arg) => arg.includes('.pluxx/agent/taxonomy-prompt.md'))).toBe(true)
      expect(runnerArgs.some((arg) => arg.includes('.pluxx/agent/instructions-prompt.md'))).toBe(true)
      expect(runnerArgs.some((arg) => arg.includes('.pluxx/agent/review-prompt.md'))).toBe(true)
    } finally {
      rmSync(runnerArgsPath, { force: true })
      rmSync(dir, { recursive: true, force: true })
    }
  }, 60_000)

  it('can complete the 10-minute path by installing and verifying one host', async () => {
    const { dir, statePath, stubServerPath } = createStubServerFixture()
    const homeDir = resolve(dir, 'home')

    mkdirSync(homeDir, { recursive: true })

    try {
      const proc = spawnCli([
        'autopilot',
        '--from-mcp',
        `bun ${stubServerPath} ${statePath}`,
        '--runner',
        'codex',
        '--mode',
        'standard',
        '--name',
        'stub-server',
        '--display-name',
        'Stub Server',
        '--author',
        'Test Author',
        '--targets',
        'claude-code,codex',
        '--install',
        '--install-target',
        'codex',
        '--json',
      ], dir, {
        HOME: homeDir,
      })

      const stdout = await new Response(proc.stdout).text()
      const stderr = await new Response(proc.stderr).text()
      const exitCode = await proc.exited

      expect(exitCode).toBe(0)
      expect(stderr).toBe('')

      const summary = JSON.parse(stdout) as {
        ok: boolean
        verification?: { ok: boolean }
        install?: {
          platforms: string[]
          installTargets: Array<{ platform: string; consumerPath: string }>
          verification?: { ok: boolean; checks: Array<{ platform: string; ok: boolean }> }
        }
      }

      expect(summary.ok).toBe(true)
      expect(summary.verification?.ok).toBe(true)
      expect(summary.install?.platforms).toEqual(['codex'])
      expect(summary.install?.verification?.ok).toBe(true)
      expect(summary.install?.verification?.checks).toEqual([
        expect.objectContaining({ platform: 'codex', ok: true }),
      ])
      expect(summary.install?.installTargets[0].consumerPath).toBe(resolve(homeDir, '.codex/plugins/stub-server'))
      expect(existsSync(resolve(homeDir, '.codex/plugins/stub-server/.codex-plugin/plugin.json'))).toBe(true)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('rejects autopilot install when verification is disabled', async () => {
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
        '--install',
        '--no-verify',
      ], dir)

      const stdout = await new Response(proc.stdout).text()
      const stderr = await new Response(proc.stderr).text()
      const exitCode = await proc.exited

      expect(exitCode).toBe(1)
      expect(stdout).toBe('')
      expect(stderr).toContain('--install requires verification')
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('rejects autopilot install for hook-bearing scaffolds unless trusted', async () => {
    const { dir, statePath, stubServerPath } = createStubServerFixture()
    const homeDir = resolve(dir, 'home')

    mkdirSync(homeDir, { recursive: true })

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
        '--hooks',
        'safe',
        '--auth-env',
        'STUB_API_KEY',
        '--install',
        '--install-target',
        'codex',
      ], dir, {
        HOME: homeDir,
        STUB_API_KEY: 'real_key',
      })

      const stdout = await new Response(proc.stdout).text()
      const stderr = await new Response(proc.stderr).text()
      const exitCode = await proc.exited

      expect(exitCode).toBe(1)
      expect(stdout).toBe('')
      expect(stderr).toContain('Refusing to install plugin with hooks in non-interactive mode')
      expect(stderr).toContain('--trust')
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('rejects behavioral autopilot smoke without install', async () => {
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
        '--behavioral',
        '--behavioral-prompt',
        'Use Stub Server to find organizations',
      ], dir)

      const stdout = await new Response(proc.stdout).text()
      const stderr = await new Response(proc.stderr).text()
      const exitCode = await proc.exited

      expect(exitCode).toBe(1)
      expect(stdout).toBe('')
      expect(stderr).toContain('--behavioral requires --install')
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
      echo PLUXX_REVIEW_RESULT_START
      echo '{"findings":[]}'
      echo PLUXX_REVIEW_RESULT_END
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
        `#!/bin/sh\necho "${marker}"\necho PLUXX_REVIEW_RESULT_START\necho '{"findings":[]}'\necho PLUXX_REVIEW_RESULT_END\nexit 0\n`,
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
  }, 60_000)

  it('prints explicit auth guidance for OAuth-first remote MCPs', async () => {
    const dir = mkdtempSync(resolve(tmpdir(), 'pluxx-autopilot-auth-'))

    try {
      process.chdir(dir)
      process.argv = [
        'bun',
        'pluxx',
        'autopilot',
        '--from-mcp',
        'https://mcp.exa.ai/mcp',
        '--runner',
        'codex',
        '--yes',
        '--name',
        'oauth-stub',
        '--display-name',
        'OAuth Stub',
        '--author',
        'Test Author',
      ]

      class MockMcpIntrospectionError extends Error {
        status?: number
        context?: {
          responseHeaders?: Record<string, string>
          responseBodySnippet?: string
          responseUrl?: string
        }

        constructor(
          message: string,
          status?: number,
          context?: {
            responseHeaders?: Record<string, string>
            responseBodySnippet?: string
            responseUrl?: string
          },
        ) {
          super(message)
          this.name = 'McpIntrospectionError'
          this.status = status
          this.context = context
        }
      }

      mock.module(INTROSPECT_PATH, () => ({
        McpIntrospectionError: MockMcpIntrospectionError,
        createMcpClient: async () => ({
          request: async () => ({}),
          notify: async () => {},
          close: async () => {},
        }),
        discoverMcpAuthFromError: () => ({
          kind: 'platform',
          mode: 'oauth',
          authorizationUrl: 'https://exa.ai/oauth/authorize',
        }),
        introspectMcpServer: async () => {
          throw new MockMcpIntrospectionError(
            'MCP HTTP request was redirected to an authentication page.',
            401,
            {
              responseHeaders: {
                location: 'https://exa.ai/oauth/authorize',
              },
              responseUrl: 'https://exa.ai/oauth/authorize',
            },
          )
        },
      }))

      const { main } = await import(`${CLI_INDEX_PATH}?autopilot-auth-guidance`)
      try {
        await main()
        throw new Error('Expected autopilot auth guidance to fail')
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        expect(message).toContain('This MCP server requires authentication')
        expect(message).toContain('--auth-env YOUR_ENV_VAR')
        expect(message).toContain('OAuth-first')
      }
    } finally {
      process.argv = [...originalArgv]
      process.chdir(originalCwd)
      mock.restore()
      rmSync(dir, { recursive: true, force: true })
    }
  })
})
