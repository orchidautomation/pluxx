import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'fs'
import { resolve } from 'path'
import { PassThrough } from 'stream'
import { runMcpProxyWithIo } from '../src/cli/mcp-proxy'

const TEST_DIR = resolve(import.meta.dir, '.mcp-proxy')
const STUB_SERVER_PATH = resolve(TEST_DIR, 'stub-server.js')
const TAPE_PATH = resolve(TEST_DIR, 'dev-tape.json')
const QUOTED_STUB_SOURCE = `bun "${STUB_SERVER_PATH}"`

function buildRequest(id: number, method: string, params?: Record<string, unknown>) {
  return JSON.stringify({
    jsonrpc: '2.0',
    id,
    method,
    ...(params ? { params } : {}),
  })
}

function buildNotify(method: string, params?: Record<string, unknown>) {
  return JSON.stringify({
    jsonrpc: '2.0',
    method,
    ...(params ? { params } : {}),
  })
}

beforeEach(() => {
  rmSync(TEST_DIR, { recursive: true, force: true })
  mkdirSync(TEST_DIR, { recursive: true })
  writeFileSync(
    STUB_SERVER_PATH,
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
        capabilities: {
          tools: { listChanged: false },
        },
        serverInfo: {
          name: 'proxy-stub',
          version: '1.0.0',
        },
      },
    })
    return
  }

  if (message.method === 'tools/list') {
    send({
      jsonrpc: '2.0',
      id: message.id,
      result: {
        tools: [{
          name: 'search_accounts',
          description: 'Search accounts.',
        }],
      },
    })
  }
})`,
  )
})

afterEach(() => {
  rmSync(TEST_DIR, { recursive: true, force: true })
})

describe('mcp proxy', () => {
  it('records a live MCP session to a replay tape', async () => {
    const input = new PassThrough()
    const output = new PassThrough()
    const error = new PassThrough()
    let stdout = ''
    let stderr = ''
    output.on('data', (chunk) => {
      stdout += chunk.toString('utf-8')
    })
    error.on('data', (chunk) => {
      stderr += chunk.toString('utf-8')
    })

    const proxyRun = runMcpProxyWithIo([
      '--from-mcp',
      QUOTED_STUB_SOURCE,
      '--record',
      TAPE_PATH,
    ], {
      input,
      output,
      error,
    })

    input.write(`${buildRequest(1, 'initialize', {
      protocolVersion: '2025-03-26',
      capabilities: {},
      clientInfo: { name: 'test-client', version: '0.1.0' },
    })}\n`)
    input.write(`${buildNotify('notifications/initialized')}\n`)
    input.write(`${buildRequest(2, 'tools/list')}\n`)
    input.end()

    await proxyRun

    expect(stderr).toBe('')

    const lines = stdout.trim().split('\n').map((line) => JSON.parse(line) as Record<string, unknown>)
    expect(lines).toHaveLength(2)
    expect(lines[0].id).toBe(1)
    expect(lines[1].id).toBe(2)
    expect((lines[1].result as { tools: Array<{ name: string }> }).tools[0]?.name).toBe('search_accounts')

    const tape = JSON.parse(readFileSync(TAPE_PATH, 'utf-8')) as {
      version: number
      source: string
      interactions: Array<{ kind: string; method: string }>
    }
    expect(tape.version).toBe(1)
    expect(tape.source).toBe(QUOTED_STUB_SOURCE)
    expect(tape.interactions.map((entry) => `${entry.kind}:${entry.method}`)).toEqual([
      'request:initialize',
      'notify:notifications/initialized',
      'request:tools/list',
    ])
  })

  it('replays a recorded MCP tape deterministically with new request ids', async () => {
    writeFileSync(
      TAPE_PATH,
      JSON.stringify({
        version: 1,
        source: 'bun ./stub-server.js',
        interactions: [
          {
            kind: 'request',
            method: 'initialize',
            params: {
              protocolVersion: '2025-03-26',
              capabilities: {},
              clientInfo: { name: 'test-client', version: '0.1.0' },
            },
            result: {
              protocolVersion: '2025-03-26',
              capabilities: {
                tools: { listChanged: false },
              },
              serverInfo: {
                name: 'proxy-stub',
                version: '1.0.0',
              },
            },
          },
          {
            kind: 'notify',
            method: 'notifications/initialized',
          },
          {
            kind: 'request',
            method: 'tools/list',
            result: {
              tools: [{
                name: 'search_accounts',
                description: 'Search accounts.',
              }],
            },
          },
        ],
      }, null, 2),
    )

    const input = new PassThrough()
    const output = new PassThrough()
    const error = new PassThrough()
    let stdout = ''
    let stderr = ''
    output.on('data', (chunk) => {
      stdout += chunk.toString('utf-8')
    })
    error.on('data', (chunk) => {
      stderr += chunk.toString('utf-8')
    })

    const proxyRun = runMcpProxyWithIo([
      '--replay',
      TAPE_PATH,
    ], {
      input,
      output,
      error,
    })

    input.write(`${buildRequest(41, 'initialize', {
      protocolVersion: '2025-03-26',
      capabilities: {},
      clientInfo: { name: 'test-client', version: '0.1.0' },
    })}\n`)
    input.write(`${buildNotify('notifications/initialized')}\n`)
    input.write(`${buildRequest(99, 'tools/list')}\n`)
    input.end()

    await proxyRun

    expect(stderr).toBe('')

    const lines = stdout.trim().split('\n').map((line) => JSON.parse(line) as Record<string, unknown>)
    expect(lines).toHaveLength(2)
    expect(lines[0].id).toBe(41)
    expect(lines[1].id).toBe(99)
    expect((lines[1].result as { tools: Array<{ name: string }> }).tools[0]?.name).toBe('search_accounts')
  })
})
