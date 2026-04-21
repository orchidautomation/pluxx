import { mkdirSync, readFileSync } from 'fs'
import { dirname, resolve } from 'path'
import * as readline from 'readline'
import type { Readable, Writable } from 'stream'
import { createMcpClient, McpIntrospectionError, type McpClient } from '../mcp/introspect'
import { parseMcpSourceInput } from './init-from-mcp'
import { writeTextFile } from '../text-files'

interface ProxyTapeInteraction {
  kind: 'request' | 'notify'
  method: string
  params?: Record<string, unknown>
  result?: unknown
  error?: {
    code: number
    message: string
  }
}

interface ProxyTape {
  version: 1
  source?: string
  interactions: ProxyTapeInteraction[]
}

interface McpProxyOptions {
  source?: string
  recordPath?: string
  replayPath?: string
}

interface ProxyIo {
  input: Readable
  output: Writable
  error: Writable
}

function usage(): string {
  return [
    'Usage: pluxx mcp proxy --from-mcp <source> [--record <tape.json>]',
    '       pluxx mcp proxy --replay <tape.json>',
    '',
    'Acts as a local stdio MCP proxy for development and CI.',
    '- --record stores normalized request/response interactions as a replay tape.',
    '- --replay serves a deterministic stdio MCP session from a recorded tape.',
  ].join('\n')
}

function readOption(rawArgs: string[], flag: string): string | undefined {
  const index = rawArgs.indexOf(flag)
  if (index === -1) return undefined

  const value = rawArgs[index + 1]
  if (!value || value.startsWith('-')) {
    return undefined
  }

  return value
}

function parseOptions(rawArgs: string[]): McpProxyOptions {
  const source = readOption(rawArgs, '--from-mcp')
  const recordPath = readOption(rawArgs, '--record')
  const replayPath = readOption(rawArgs, '--replay')

  if (recordPath && replayPath) {
    throw new Error('Choose either --record or --replay, not both.')
  }

  if (!source && !replayPath) {
    throw new Error('Expected --from-mcp <source> for live proxying, or --replay <tape.json>.')
  }

  if ((recordPath || source) && replayPath && source) {
    throw new Error('Replay mode does not accept --from-mcp.')
  }

  return {
    source,
    recordPath,
    replayPath,
  }
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value)
  }

  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableStringify(entry)).join(',')}]`
  }

  const entries = Object.entries(value as Record<string, unknown>)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, nested]) => `${JSON.stringify(key)}:${stableStringify(nested)}`)
  return `{${entries.join(',')}}`
}

function sameParams(
  left: Record<string, unknown> | undefined,
  right: Record<string, unknown> | undefined,
): boolean {
  return stableStringify(left ?? null) === stableStringify(right ?? null)
}

function sendEnvelope(output: Writable, envelope: Record<string, unknown>): void {
  output.write(`${JSON.stringify(envelope)}\n`)
}

function sendError(output: Writable, id: number | string | null, code: number, message: string): void {
  sendEnvelope(output, {
    jsonrpc: '2.0',
    id,
    error: {
      code,
      message,
    },
  })
}

async function loadReplayTape(filepath: string): Promise<ProxyTape> {
  const absolutePath = resolve(process.cwd(), filepath)
  const tape = JSON.parse(readFileSync(absolutePath, 'utf-8')) as ProxyTape
  if (tape.version !== 1 || !Array.isArray(tape.interactions)) {
    throw new Error(`Replay tape is not a valid pluxx MCP tape: ${filepath}`)
  }
  return tape
}

async function writeTape(filepath: string, tape: ProxyTape): Promise<void> {
  const absolutePath = resolve(process.cwd(), filepath)
  mkdirSync(dirname(absolutePath), { recursive: true })
  await writeTextFile(absolutePath, `${JSON.stringify(tape, null, 2)}\n`)
}

function serializeError(error: unknown): { code: number; message: string } {
  if (error instanceof McpIntrospectionError) {
    return {
      code: error.rpcCode ?? -32000,
      message: error.message,
    }
  }

  return {
    code: -32000,
    message: error instanceof Error ? error.message : String(error),
  }
}

async function proxyLiveSession(client: McpClient, options: McpProxyOptions, io: ProxyIo): Promise<void> {
  const tape: ProxyTape | null = options.recordPath
    ? {
        version: 1,
        source: options.source,
        interactions: [],
      }
    : null

  const rl = readline.createInterface({
    input: io.input,
    crlfDelay: Infinity,
  })

  try {
    for await (const line of rl) {
      if (!line.trim()) continue

      let message: Record<string, unknown>
      try {
        message = JSON.parse(line) as Record<string, unknown>
      } catch {
        continue
      }

      const method = typeof message.method === 'string' ? message.method : undefined
      if (!method) continue

      const params = (typeof message.params === 'object' && message.params !== null)
        ? message.params as Record<string, unknown>
        : undefined
      const id = typeof message.id === 'number' || typeof message.id === 'string'
        ? message.id
        : null

      if (id === null) {
        await client.notify(method, params)
        tape?.interactions.push({
          kind: 'notify',
          method,
          ...(params ? { params } : {}),
        })
        continue
      }

      try {
        const result = await client.request<unknown>(method, params)
        sendEnvelope(io.output, {
          jsonrpc: '2.0',
          id,
          result,
        })
        tape?.interactions.push({
          kind: 'request',
          method,
          ...(params ? { params } : {}),
          result,
        })
      } catch (error) {
        const serialized = serializeError(error)
        sendError(io.output, id, serialized.code, serialized.message)
        tape?.interactions.push({
          kind: 'request',
          method,
          ...(params ? { params } : {}),
          error: serialized,
        })
      }
    }
  } finally {
    rl.close()
    await client.close()
    if (tape && options.recordPath) {
      await writeTape(options.recordPath, tape)
    }
  }
}

async function replaySession(filepath: string, io: ProxyIo): Promise<void> {
  const tape = await loadReplayTape(filepath)
  const interactions = [...tape.interactions]
  const rl = readline.createInterface({
    input: io.input,
    crlfDelay: Infinity,
  })

  try {
    for await (const line of rl) {
      if (!line.trim()) continue

      let message: Record<string, unknown>
      try {
        message = JSON.parse(line) as Record<string, unknown>
      } catch {
        continue
      }

      const method = typeof message.method === 'string' ? message.method : undefined
      if (!method) continue

      const params = (typeof message.params === 'object' && message.params !== null)
        ? message.params as Record<string, unknown>
        : undefined
      const id = typeof message.id === 'number' || typeof message.id === 'string'
        ? message.id
        : null
      const expected = interactions.shift()

      if (!expected) {
        if (id !== null) {
          sendError(io.output, id, -32001, `Replay tape exhausted before handling ${method}.`)
        }
        continue
      }

      if (expected.kind !== (id === null ? 'notify' : 'request') || expected.method !== method || !sameParams(expected.params, params)) {
        if (id !== null) {
          sendError(
            io.output,
            id,
            -32002,
            `Replay mismatch. Expected ${expected.kind} ${expected.method}, received ${id === null ? 'notify' : 'request'} ${method}.`,
          )
        }
        continue
      }

      if (id === null) {
        continue
      }

      if (expected.error) {
        sendError(io.output, id, expected.error.code, expected.error.message)
        continue
      }

      sendEnvelope(io.output, {
        jsonrpc: '2.0',
        id,
        result: expected.result ?? null,
      })
    }
  } finally {
    rl.close()
  }
}

export async function runMcpProxy(rawArgs: string[]): Promise<void> {
  return await runMcpProxyWithIo(rawArgs, {
    input: process.stdin,
    output: process.stdout,
    error: process.stderr,
  })
}

export async function runMcpProxyWithIo(rawArgs: string[], io: ProxyIo): Promise<void> {
  let options: McpProxyOptions
  try {
    options = parseOptions(rawArgs)
  } catch (error) {
    io.error.write(`${error instanceof Error ? error.message : String(error)}\n\n${usage()}\n`)
    throw new Error('Invalid MCP proxy arguments.')
  }

  if (options.replayPath) {
    await replaySession(options.replayPath, io)
    return
  }

  const source = parseMcpSourceInput(options.source!)
  const client = await createMcpClient(source)
  await proxyLiveSession(client, options, io)
}
