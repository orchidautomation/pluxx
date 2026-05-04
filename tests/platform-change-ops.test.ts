import { describe, expect, it } from 'bun:test'
import { spawn, spawnSync } from 'child_process'
import { resolve } from 'path'

const ROOT = resolve(import.meta.dir, '..')
const CLI_PATH = resolve(ROOT, 'bin/pluxx.js')
const EXAMPLE_ROOT = resolve(ROOT, 'example/platform-change-ops')
const CORE_FOUR = ['claude-code', 'cursor', 'codex', 'opencode']

interface DoctorResult {
  ok: boolean
  errors: number
  warnings: number
  checks: Array<{ code: string }>
}

interface SmokeResult {
  ok: boolean
  build?: {
    ok: boolean
    targets: string[]
  }
}

interface JsonRpcSuccess<T = unknown> {
  jsonrpc: '2.0'
  id: number
  result: T
}

async function runStdioRoundTrip(): Promise<JsonRpcSuccess[]> {
  const bootstrap = spawnSync('bash', ['./scripts/bootstrap-runtime.sh'], {
    cwd: EXAMPLE_ROOT,
    env: {
      ...process.env,
      CHANGEOPS_ENVIRONMENT: 'production',
      CHANGEOPS_APPROVAL_MODE: 'strict',
    },
    stdio: ['ignore', 'ignore', 'pipe'],
  })
  expect(bootstrap.status).toBe(0)

  const proc = spawn('bash', ['./scripts/start-mcp.sh'], {
    cwd: EXAMPLE_ROOT,
    stdio: ['pipe', 'pipe', 'pipe'],
    env: {
      ...process.env,
      CHANGEOPS_ENVIRONMENT: 'production',
      CHANGEOPS_APPROVAL_MODE: 'strict',
    },
  })

  const decoder = new TextDecoder()
  const responses: JsonRpcSuccess[] = []
  let buffer = ''

  const waitForResponses = new Promise<void>((resolve, reject) => {
    proc.stdout.on('data', (chunk: Buffer) => {
      buffer += decoder.decode(chunk, { stream: true })
      while (true) {
        const newlineIndex = buffer.indexOf('\n')
        if (newlineIndex === -1) break
        const line = buffer.slice(0, newlineIndex).trim()
        buffer = buffer.slice(newlineIndex + 1)
        if (!line) continue
        responses.push(JSON.parse(line) as JsonRpcSuccess)
        if (responses.length >= 3) {
          resolve()
        }
      }
    })
    proc.once('error', reject)
    proc.once('exit', (code, signal) => {
      if (responses.length < 3) {
        reject(new Error(`stdio runtime exited early (code=${code ?? 'null'}, signal=${signal ?? 'null'})`))
      }
    })
  })

  proc.stdin.write(`${JSON.stringify({
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: {
      protocolVersion: '2025-03-26',
      capabilities: {},
      clientInfo: {
        name: 'pluxx-test',
        version: '0.1.0',
      },
    },
  })}\n`)
  proc.stdin.write(`${JSON.stringify({
    jsonrpc: '2.0',
    method: 'notifications/initialized',
  })}\n`)
  proc.stdin.write(`${JSON.stringify({
    jsonrpc: '2.0',
    id: 2,
    method: 'tools/list',
  })}\n`)
  proc.stdin.write(`${JSON.stringify({
    jsonrpc: '2.0',
    id: 3,
    method: 'tools/call',
    params: {
      name: 'readiness_status',
      arguments: {},
    },
  })}\n`)

  await waitForResponses
  proc.stdin.end()
  proc.kill('SIGTERM')
  await new Promise<void>((resolve) => {
    proc.once('exit', () => resolve())
  })

  return responses
}

async function runCliJson<T>(cwd: string, ...argv: string[]): Promise<{ data: T, stderr: string, exitCode: number }> {
  const proc = Bun.spawn(['bun', CLI_PATH, ...argv], {
    cwd,
    stdout: 'pipe',
    stderr: 'pipe',
  })

  const stdout = await new Response(proc.stdout).text()
  const stderr = await new Response(proc.stderr).text()
  const exitCode = await proc.exited

  return {
    data: JSON.parse(stdout) as T,
    stderr,
    exitCode,
  }
}

describe('platform change ops example', () => {
  it('builds as an intentionally warning-heavy all-primitive fixture', async () => {
    const doctor = await runCliJson<DoctorResult>(EXAMPLE_ROOT, 'doctor', '--json')
    expect(doctor.exitCode).toBe(0)
    expect(doctor.data.ok).toBe(true)
    expect(doctor.data.errors).toBe(0)
    expect(doctor.data.warnings).toBeGreaterThan(0)
    expect(doctor.data.checks.some((check) => check.code === 'hooks-trust-required')).toBe(true)

    const result = await runCliJson<SmokeResult>(
      EXAMPLE_ROOT,
      'test',
      '--json',
      '--target',
      ...CORE_FOUR,
    )

    expect(result.exitCode).toBe(0)
    expect(result.data.ok).toBe(true)
    expect(result.data.build?.ok).toBe(true)
    expect(result.data.build?.targets).toEqual(CORE_FOUR)
    expect(result.stderr).toContain('templated header Codex cannot express exactly')
    expect(result.stderr).toContain('dropped unsupported hook field "failClosed"')
    expect(result.stderr).toContain('dropped unsupported hook field "loop_limit"')
  })

  it('runs a long-lived local stdio MCP runtime with the advertised tools', async () => {
    const responses = await runStdioRoundTrip()

    expect(responses).toHaveLength(3)
    expect(responses[0]?.result).toMatchObject({
      protocolVersion: '2025-03-26',
      serverInfo: {
        name: 'changeops-local',
      },
    })
    expect(responses[1]?.result).toMatchObject({
      tools: expect.arrayContaining([
        expect.objectContaining({ name: 'readiness_status' }),
        expect.objectContaining({ name: 'open_change_window' }),
        expect.objectContaining({ name: 'record_audit_event' }),
      ]),
    })
    expect(responses[2]?.result).toMatchObject({
      structuredContent: {
        environment: 'production',
        approvalMode: 'strict',
        readiness: {
          policyCache: {
            status: 'ready',
          },
          serviceHealth: {
            status: 'ready',
          },
        },
      },
    })
  })
})
