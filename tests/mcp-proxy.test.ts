import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'fs'
import { resolve } from 'path'
import { PassThrough } from 'stream'
import { runMcpProxyWithIo } from '../src/cli/mcp-proxy'

const TEST_DIR = resolve(import.meta.dir, '.mcp-proxy')
const STUB_SERVER_PATH = resolve(TEST_DIR, 'stub-server.js')
const TAPE_PATH = resolve(TEST_DIR, 'dev-tape.json')
const FIXTURE_SECRET = 'pluxx-fixture-secret-not-a-real-credential'
const SOURCE_ONLY_SECRET = 'pluxx-source-only-fixture-secret'
const COMPOUND_KEY_SECRET = 'pluxx-compound-key-fixture-secret'
const PRIVATE_KEY_SECRET = 'pluxx-private-key-fixture-secret'
const HEADER_SECRET = 'pluxx-header-only-fixture-secret with-spaces'
const ENV_SECRET = 'pluxx-env-assignment-fixture-secret'
const FLAG_SECRET = 'pluxx-refresh-flag-fixture-secret'
const PRETTY_JSON_TEXT = '{\n  "safe": "value"\n}'
const SECRET_STUB_SOURCE = `bun "${STUB_SERVER_PATH}" PLUXX_CLIENT_SECRET=${ENV_SECRET} --api-key ${FIXTURE_SECRET} --refresh-token=${FLAG_SECRET} --endpoint "https://fixture-user:${SOURCE_ONLY_SECRET}@example.com/mcp?token=${SOURCE_ONLY_SECRET}&mode=test" --header "X-API-Key: ${HEADER_SECRET}"`

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

function startReplay(lines: string[]): {
  completion: Promise<void>
  stdout: () => string
  stderr: () => string
} {
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

  const proxyRun = runMcpProxyWithIo(['--replay', TAPE_PATH], { input, output, error })
  for (const line of lines) input.write(`${line}\n`)
  input.end()
  return {
    completion: proxyRun,
    stdout: () => stdout,
    stderr: () => stderr,
  }
}

async function runReplay(lines: string[]): Promise<{ stdout: string; stderr: string }> {
  const replay = startReplay(lines)
  await replay.completion
  return { stdout: replay.stdout(), stderr: replay.stderr() }
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
    return
  }

  if (message.method === 'tools/call') {
    const apiKey = message.params?.arguments?.apiKey
    const secretAccessKey = message.params?.arguments?.secretAccessKey
    const privateKeyPem = message.params?.arguments?.privateKeyPem
    if (message.params?.arguments?.fail === true) {
      send({
        jsonrpc: '2.0',
        id: message.id,
        error: {
          code: -32042,
          message: 'Tool failed with Authorization: Bearer ' + apiKey + ' access=' + secretAccessKey + ' private=' + privateKeyPem,
        },
      })
      return
    }

    send({
      jsonrpc: '2.0',
      id: message.id,
      result: {
        content: [{ type: 'text', text: ${JSON.stringify(PRETTY_JSON_TEXT)} }],
        structuredContent: {
          apiKey,
          secretAccessKey,
          privateKeyPem,
          nested: {
            authorization: 'Bearer ' + apiKey,
          },
        },
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
      SECRET_STUB_SOURCE,
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
    input.write(`${buildNotify('notifications/initialized', {
      sessionToken: FIXTURE_SECRET,
      note: `notification ${FIXTURE_SECRET}`,
    })}\n`)
    input.write(`${buildRequest(2, 'tools/list')}\n`)
    input.write(`${buildRequest(3, 'tools/call', {
      name: 'search_accounts',
      arguments: {
        apiKey: FIXTURE_SECRET,
        secretAccessKey: COMPOUND_KEY_SECRET,
        privateKeyPem: PRIVATE_KEY_SECRET,
        note: `credential ${FIXTURE_SECRET}`,
        nested: {
          authorization: `Bearer ${FIXTURE_SECRET}`,
          endpoint: `https://fixture-user:${FIXTURE_SECRET}@example.com/search?token=${FIXTURE_SECRET}&page=1`,
        },
      },
    })}\n`)
    input.write(`${buildRequest(4, 'tools/call', {
      name: 'search_accounts',
      arguments: {
        apiKey: FIXTURE_SECRET,
        secretAccessKey: COMPOUND_KEY_SECRET,
        privateKeyPem: PRIVATE_KEY_SECRET,
        fail: true,
      },
    })}\n`)
    input.end()

    await proxyRun

    expect(stderr).toBe('')

    const lines = stdout.trim().split('\n').map((line) => JSON.parse(line) as Record<string, unknown>)
    expect(lines).toHaveLength(4)
    expect(lines[0].id).toBe(1)
    expect(lines[1].id).toBe(2)
    expect((lines[1].result as { tools: Array<{ name: string }> }).tools[0]?.name).toBe('search_accounts')
    expect((lines[3].error as { code: number }).code).toBe(-32042)

    const tapeText = readFileSync(TAPE_PATH, 'utf-8')
    const tape = JSON.parse(tapeText) as {
      version: number
      source: string
      redaction: { policy: string; version: number; marker: string }
      interactions: Array<{ kind: string; method: string }>
    }
    expect(tape.version).toBe(2)
    expect(tape.redaction).toEqual({
      policy: 'pluxx-default',
      version: 1,
      marker: '[REDACTED]',
    })
    expect(tape.source).toContain('[REDACTED]')
    expect(tapeText).not.toContain(FIXTURE_SECRET)
    expect(tapeText).not.toContain(SOURCE_ONLY_SECRET)
    expect(tapeText).not.toContain(COMPOUND_KEY_SECRET)
    expect(tapeText).not.toContain(PRIVATE_KEY_SECRET)
    expect(tapeText).not.toContain(HEADER_SECRET)
    expect(tapeText).not.toContain('with-spaces')
    expect(tapeText).not.toContain(ENV_SECRET)
    expect(tapeText).not.toContain(FLAG_SECRET)
    expect(((tape.interactions[3] as { result: { content: Array<{ text: string }> } }).result.content[0]?.text)).toBe(PRETTY_JSON_TEXT)
    expect(tape.interactions.map((entry) => `${entry.kind}:${entry.method}`)).toEqual([
      'request:initialize',
      'notify:notifications/initialized',
      'request:tools/list',
      'request:tools/call',
      'request:tools/call',
    ])

    const replay = await runReplay([
      buildRequest(101, 'initialize', {
        protocolVersion: '2025-03-26',
        capabilities: {},
        clientInfo: { name: 'test-client', version: '0.1.0' },
      }),
      buildNotify('notifications/initialized', {
        sessionToken: FIXTURE_SECRET,
        note: `notification ${FIXTURE_SECRET}`,
      }),
      buildRequest(102, 'tools/list'),
      buildRequest(103, 'tools/call', {
        name: 'search_accounts',
        arguments: {
          apiKey: FIXTURE_SECRET,
          secretAccessKey: COMPOUND_KEY_SECRET,
          privateKeyPem: PRIVATE_KEY_SECRET,
          note: `credential ${FIXTURE_SECRET}`,
          nested: {
            authorization: `Bearer ${FIXTURE_SECRET}`,
            endpoint: `https://fixture-user:${FIXTURE_SECRET}@example.com/search?token=${FIXTURE_SECRET}&page=1`,
          },
        },
      }),
      buildRequest(104, 'tools/call', {
        name: 'search_accounts',
        arguments: {
          apiKey: FIXTURE_SECRET,
          secretAccessKey: COMPOUND_KEY_SECRET,
          privateKeyPem: PRIVATE_KEY_SECRET,
          fail: true,
        },
      }),
    ])
    expect(replay.stderr).toBe('')
    expect(replay.stdout).not.toContain(FIXTURE_SECRET)
    expect(replay.stdout).not.toContain(COMPOUND_KEY_SECRET)
    const replayResponses = replay.stdout.trim().split('\n').map((line) => JSON.parse(line) as Record<string, unknown>)
    expect(replayResponses).toHaveLength(4)
    expect(((replayResponses[2]?.result as { content: Array<{ text: string }> }).content[0]?.text)).toBe(PRETTY_JSON_TEXT)
    expect((replayResponses[3]?.error as { code: number }).code).toBe(-32042)
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

    const { stdout, stderr } = await runReplay([
      buildRequest(41, 'initialize', {
        protocolVersion: '2025-03-26',
        capabilities: {},
        clientInfo: { name: 'test-client', version: '0.1.0' },
      }),
      buildNotify('notifications/initialized'),
      buildRequest(99, 'tools/list'),
    ])

    expect(stderr).toBe('')

    const lines = stdout.trim().split('\n').map((line) => JSON.parse(line) as Record<string, unknown>)
    expect(lines).toHaveLength(2)
    expect(lines[0].id).toBe(41)
    expect(lines[1].id).toBe(99)
    expect((lines[1].result as { tools: Array<{ name: string }> }).tools[0]?.name).toBe('search_accounts')
  })

  it('matches redacted v2 parameters without requiring recorded secrets', async () => {
    writeFileSync(TAPE_PATH, JSON.stringify({
      version: 2,
      redaction: {
        policy: 'pluxx-default',
        version: 1,
        marker: '[REDACTED]',
      },
      interactions: [{
        kind: 'request',
        method: 'tools/call',
        params: {
          name: 'search_accounts',
          arguments: {
            apiKey: '[REDACTED]',
            endpoint: 'https://example.com/search?token=%5BREDACTED%5D&page=1',
          },
        },
        result: {
          content: [{ type: 'text', text: 'fixture response' }],
        },
      }],
    }, null, 2))

    const { stdout, stderr } = await runReplay([buildRequest(91, 'tools/call', {
      name: 'search_accounts',
      arguments: {
        apiKey: FIXTURE_SECRET,
        endpoint: `https://example.com/search?token=${FIXTURE_SECRET}&page=1`,
      },
    })])

    expect(stderr).toBe('')
    const response = JSON.parse(stdout.trim()) as { id: number; result: unknown }
    expect(response.id).toBe(91)
    expect(response.result).toEqual({
      content: [{ type: 'text', text: 'fixture response' }],
    })
  })

  it('does not consume request or notification interactions on mismatch', async () => {
    writeFileSync(TAPE_PATH, JSON.stringify({
      version: 1,
      interactions: [
        {
          kind: 'notify',
          method: 'notifications/initialized',
        },
        {
          kind: 'request',
          method: 'tools/list',
          result: { tools: [{ name: 'search_accounts' }] },
        },
      ],
    }, null, 2))

    const { stdout, stderr } = await runReplay([
      buildNotify('notifications/cancelled'),
      buildNotify('notifications/initialized'),
      buildRequest(70, 'tools/list', { unexpected: true }),
      buildRequest(71, 'tools/call', { name: 'wrong_tool' }),
      buildRequest(72, 'tools/list'),
    ])

    const responses = stdout.trim().split('\n').map((line) => JSON.parse(line) as {
      id: number
      error?: { code: number; message: string }
      result?: unknown
    })
    expect(responses).toHaveLength(3)
    expect(responses[0]).toMatchObject({ id: 70, error: { code: -32002 } })
    expect(responses[0]?.error?.message).toBe('Replay parameter mismatch for request tools/list.')
    expect(responses[1]).toMatchObject({ id: 71, error: { code: -32002 } })
    expect(responses[2]).toMatchObject({ id: 72, result: { tools: [{ name: 'search_accounts' }] } })
    expect(stderr).toContain('Replay mismatch. Expected notify notifications/initialized')
  })

  it('replays recorded RPC errors', async () => {
    writeFileSync(TAPE_PATH, JSON.stringify({
      version: 1,
      interactions: [{
        kind: 'request',
        method: 'tools/call',
        params: { name: 'search_accounts', arguments: { fail: true } },
        error: { code: -32042, message: 'Fixture tool failure' },
      }],
    }, null, 2))

    const { stdout, stderr } = await runReplay([
      buildRequest(72, 'tools/call', { name: 'search_accounts', arguments: { fail: true } }),
    ])

    expect(stderr).toBe('')
    expect(JSON.parse(stdout.trim())).toMatchObject({
      id: 72,
      error: { code: -32042, message: 'Fixture tool failure' },
    })
  })

  it('rejects malformed, unsupported, and incomplete tapes clearly', async () => {
    const cases: Array<{ value: string; message: string }> = [
      { value: '{not-json', message: 'could not be parsed as JSON' },
      { value: 'null', message: 'must contain a JSON object' },
      {
        value: JSON.stringify({ interactions: [] }),
        message: 'schema version missing',
      },
      {
        value: JSON.stringify({ version: 99, interactions: [] }),
        message: 'Unsupported MCP replay tape schema version 99',
      },
      {
        value: JSON.stringify({ version: 1, interactions: [], extra: true }),
        message: 'unsupported field "extra"',
      },
      {
        value: JSON.stringify({ version: 1, source: 42, interactions: [] }),
        message: 'source must be a string',
      },
      {
        value: JSON.stringify({ version: 1, interactions: {} }),
        message: 'interactions must be an array',
      },
      {
        value: JSON.stringify({ version: 2, interactions: [] }),
        message: 'redaction',
      },
      {
        value: JSON.stringify({
          version: 2,
          redaction: { policy: 'unknown', version: 1, marker: '[REDACTED]' },
          interactions: [],
        }),
        message: 'redaction metadata is unsupported',
      },
      {
        value: JSON.stringify({
          version: 2,
          redaction: { policy: 'pluxx-default', version: 1, marker: '[REDACTED]', extra: true },
          interactions: [],
        }),
        message: 'Replay tape redaction contains unsupported field "extra"',
      },
      {
        value: JSON.stringify({
          version: 2,
          redaction: { policy: 'pluxx-default', version: 2, marker: '[REDACTED]' },
          interactions: [],
        }),
        message: 'redaction metadata is unsupported',
      },
      {
        value: JSON.stringify({
          version: 2,
          redaction: { policy: 'pluxx-default', version: 1, marker: '[MASKED]' },
          interactions: [],
        }),
        message: 'redaction metadata is unsupported',
      },
      {
        value: JSON.stringify({ version: 1, interactions: [null] }),
        message: 'interactions[0] must be an object',
      },
      {
        value: JSON.stringify({ version: 1, interactions: [{ kind: 'event', method: 'tools/list' }] }),
        message: 'kind must be "request" or "notify"',
      },
      {
        value: JSON.stringify({
          version: 1,
          interactions: [{ kind: 'notify', method: 'notifications/initialized', extra: true }],
        }),
        message: 'interactions[0] contains unsupported field "extra"',
      },
      {
        value: JSON.stringify({ version: 1, interactions: [{ kind: 'notify', method: '' }] }),
        message: 'method must be a non-empty string',
      },
      {
        value: JSON.stringify({
          version: 1,
          interactions: [{ kind: 'notify', method: 'notifications/initialized', params: [] }],
        }),
        message: 'params must be an object',
      },
      {
        value: JSON.stringify({
          version: 1,
          interactions: [{ kind: 'request', method: 'tools/list' }],
        }),
        message: 'exactly one of result or error',
      },
      {
        value: JSON.stringify({
          version: 1,
          interactions: [{ kind: 'notify', method: 'notifications/initialized', result: null }],
        }),
        message: 'notification cannot contain result or error',
      },
      {
        value: JSON.stringify({
          version: 1,
          interactions: [{
            kind: 'request',
            method: 'tools/list',
            result: null,
            error: { code: -32000, message: 'failure' },
          }],
        }),
        message: 'exactly one of result or error',
      },
      {
        value: JSON.stringify({
          version: 1,
          interactions: [{ kind: 'request', method: 'tools/list', error: [] }],
        }),
        message: 'error must be an object',
      },
      {
        value: JSON.stringify({
          version: 1,
          interactions: [{ kind: 'request', method: 'tools/list', error: { code: 1.5, message: 'failure' } }],
        }),
        message: 'error.code must be an integer',
      },
      {
        value: JSON.stringify({
          version: 1,
          interactions: [{
            kind: 'request',
            method: 'tools/list',
            error: { code: -32000, message: 'failure', extra: true },
          }],
        }),
        message: 'interactions[0].error contains unsupported field "extra"',
      },
      {
        value: JSON.stringify({
          version: 1,
          interactions: [{ kind: 'request', method: 'tools/list', error: { code: -32000, message: 42 } }],
        }),
        message: 'error.message must be a string',
      },
    ]

    for (const testCase of cases) {
      writeFileSync(TAPE_PATH, testCase.value)
      await expect(runReplay([])).rejects.toThrow(testCase.message)
    }
  })

  it('fails replay when interactions remain unused', async () => {
    writeFileSync(TAPE_PATH, JSON.stringify({
      version: 1,
      interactions: [{
        kind: 'request',
        method: 'tools/list',
        result: { tools: [] },
      }],
    }, null, 2))

    await expect(runReplay([])).rejects.toThrow(
      'Replay tape has 1 unused interaction: request tools/list.',
    )
  })

  it('fails when requests and notifications arrive after the tape is exhausted', async () => {
    writeFileSync(TAPE_PATH, JSON.stringify({
      version: 1,
      interactions: [{
        kind: 'request',
        method: 'tools/list',
        result: { tools: [] },
      }],
    }, null, 2))

    const replay = startReplay([
      buildRequest(80, 'tools/list'),
      buildRequest(81, 'tools/list'),
      buildNotify('notifications/initialized'),
    ])
    await expect(replay.completion).rejects.toThrow(
      'Replay input contained interactions after the tape was exhausted.',
    )
    const responses = replay.stdout().trim().split('\n').map((line) => JSON.parse(line))
    expect(responses[1]).toMatchObject({ id: 81, error: { code: -32001 } })
    expect(replay.stderr()).toContain('Replay tape exhausted before handling notifications/initialized.')
  })
})
