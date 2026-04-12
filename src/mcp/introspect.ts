import { spawn } from 'child_process'
import * as readline from 'readline'
import type { McpAuth, McpServer } from '../schema'

const MCP_PROTOCOL_VERSION = '2025-03-26'
const CLIENT_INFO = {
  name: 'pluxx',
  version: '0.1.0',
}
const DEFAULT_TIMEOUT_MS = 10_000

export interface IntrospectedMcpTool {
  name: string
  title?: string
  description?: string
  inputSchema?: Record<string, unknown>
}

export interface IntrospectedMcpServer {
  protocolVersion: string
  instructions?: string
  serverInfo: {
    name: string
    title?: string
    version?: string
    description?: string
    websiteUrl?: string
  }
  tools: IntrospectedMcpTool[]
}

export class McpIntrospectionError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message)
    this.name = 'McpIntrospectionError'
  }
}

interface JsonRpcSuccess<T> {
  jsonrpc: '2.0'
  id: number | string
  result: T
}

interface JsonRpcFailure {
  jsonrpc: '2.0'
  id: number | string | null
  error: {
    code: number
    message: string
    data?: unknown
  }
}

type JsonRpcEnvelope<T> = JsonRpcSuccess<T> | JsonRpcFailure

interface InitializeResult {
  protocolVersion?: string
  instructions?: string
  serverInfo?: {
    name?: string
    title?: string
    version?: string
    description?: string
    websiteUrl?: string
  }
}

interface ListToolsResult {
  tools?: Array<{
    name: string
    title?: string
    description?: string
    inputSchema?: Record<string, unknown>
  }>
  nextCursor?: string
}

interface McpClient {
  request<T>(method: string, params?: Record<string, unknown>): Promise<T>
  notify(method: string, params?: Record<string, unknown>): Promise<void>
  close(): Promise<void>
}

export async function introspectMcpServer(server: McpServer): Promise<IntrospectedMcpServer> {
  const client = server.transport === 'stdio'
    ? await createStdioClient(server)
    : createHttpClient(server)

  try {
    const initialize = await client.request<InitializeResult>('initialize', {
      protocolVersion: MCP_PROTOCOL_VERSION,
      capabilities: {},
      clientInfo: CLIENT_INFO,
    })

    await client.notify('notifications/initialized')

    const tools = await listAllTools(client)
    if (tools.length === 0) {
      throw new McpIntrospectionError(
        'The MCP server initialized successfully but exposed no tools. pluxx init --from-mcp currently scaffolds from tool metadata only.',
      )
    }

    return {
      protocolVersion: initialize.protocolVersion ?? MCP_PROTOCOL_VERSION,
      instructions: initialize.instructions,
      serverInfo: {
        name: initialize.serverInfo?.name ?? 'mcp-server',
        title: initialize.serverInfo?.title,
        version: initialize.serverInfo?.version,
        description: initialize.serverInfo?.description,
        websiteUrl: initialize.serverInfo?.websiteUrl,
      },
      tools,
    }
  } finally {
    await client.close()
  }
}

async function listAllTools(client: McpClient): Promise<IntrospectedMcpTool[]> {
  const tools: IntrospectedMcpTool[] = []
  let cursor: string | undefined

  while (true) {
    const result = await client.request<ListToolsResult>('tools/list', cursor ? { cursor } : undefined)
    tools.push(...(result.tools ?? []))
    cursor = result.nextCursor
    if (!cursor) {
      return tools
    }
  }
}

function createHttpClient(server: Exclude<McpServer, { transport: 'stdio' }>): McpClient {
  let sessionId: string | null = null

  return {
    async request<T>(method: string, params?: Record<string, unknown>): Promise<T> {
      const id = nextRequestId()
      const response = await fetch(server.url, {
        method: 'POST',
        headers: buildHttpHeaders(server.auth, sessionId),
        body: JSON.stringify({
          jsonrpc: '2.0',
          id,
          method,
          ...(params ? { params } : {}),
        }),
      })

      if (!response.ok) {
        throw new McpIntrospectionError(
          `MCP HTTP request failed with ${response.status} ${response.statusText}.`,
          response.status,
        )
      }

      sessionId = response.headers.get('Mcp-Session-Id') ?? sessionId
      const envelope = await parseHttpEnvelope<T>(response, id)
      return unwrapEnvelope(envelope)
    },

    async notify(method: string, params?: Record<string, unknown>): Promise<void> {
      const response = await fetch(server.url, {
        method: 'POST',
        headers: buildHttpHeaders(server.auth, sessionId),
        body: JSON.stringify({
          jsonrpc: '2.0',
          method,
          ...(params ? { params } : {}),
        }),
      })

      if (!response.ok && response.status !== 202) {
        throw new McpIntrospectionError(
          `MCP HTTP notification failed with ${response.status} ${response.statusText}.`,
          response.status,
        )
      }
    },

    async close(): Promise<void> {
      if (!sessionId) return
      try {
        await fetch(server.url, {
          method: 'DELETE',
          headers: {
            'Mcp-Session-Id': sessionId,
            'Mcp-Protocol-Version': MCP_PROTOCOL_VERSION,
          },
        })
      } catch {
        // Session cleanup is best effort only.
      }
    },
  }
}

async function createStdioClient(server: Extract<McpServer, { transport: 'stdio' }>): Promise<McpClient> {
  const child = spawn(server.command, server.args ?? [], {
    env: {
      ...process.env,
      ...(server.env ?? {}),
    },
    stdio: ['pipe', 'pipe', 'pipe'],
  })

  const pending = new Map<number, { resolve: (value: unknown) => void; reject: (error: Error) => void }>()
  const stdout = readline.createInterface({
    input: child.stdout,
    crlfDelay: Infinity,
  })

  stdout.on('line', (line) => {
    if (!line.trim()) return

    let envelope: JsonRpcEnvelope<unknown>
    try {
      envelope = JSON.parse(line) as JsonRpcEnvelope<unknown>
    } catch {
      return
    }

    if (typeof envelope !== 'object' || envelope === null || !('id' in envelope)) {
      return
    }

    const requestId = typeof envelope.id === 'number' ? envelope.id : Number.NaN
    if (!Number.isFinite(requestId)) return

    const entry = pending.get(requestId)
    if (!entry) return

    pending.delete(requestId)

    try {
      entry.resolve(unwrapEnvelope(envelope))
    } catch (error) {
      entry.reject(error instanceof Error ? error : new Error(String(error)))
    }
  })

  child.once('exit', (code, signal) => {
    const error = new McpIntrospectionError(
      `MCP stdio process exited before pluxx finished introspecting it (code=${code ?? 'null'}, signal=${signal ?? 'null'}).`,
    )
    for (const entry of pending.values()) {
      entry.reject(error)
    }
    pending.clear()
  })

  child.once('error', (error) => {
    const wrapped = new McpIntrospectionError(`Failed to start MCP stdio process: ${error.message}`)
    for (const entry of pending.values()) {
      entry.reject(wrapped)
    }
    pending.clear()
  })

  function send(message: Record<string, unknown>) {
    child.stdin.write(JSON.stringify(message) + '\n')
  }

  return {
    request<T>(method: string, params?: Record<string, unknown>): Promise<T> {
      const id = nextRequestId()
      send({
        jsonrpc: '2.0',
        id,
        method,
        ...(params ? { params } : {}),
      })

      return new Promise<T>((resolve, reject) => {
        const timeout = setTimeout(() => {
          pending.delete(id)
          reject(new McpIntrospectionError(`Timed out waiting for MCP stdio response to ${method}.`))
        }, DEFAULT_TIMEOUT_MS)

        pending.set(id, {
          resolve: (value) => {
            clearTimeout(timeout)
            resolve(value as T)
          },
          reject: (error) => {
            clearTimeout(timeout)
            reject(error)
          },
        })
      })
    },

    async notify(method: string, params?: Record<string, unknown>): Promise<void> {
      send({
        jsonrpc: '2.0',
        method,
        ...(params ? { params } : {}),
      })
    },

    async close(): Promise<void> {
      stdout.close()
      child.kill()
    },
  }
}

function buildHttpHeaders(auth: McpAuth | undefined, sessionId: string | null): HeadersInit {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json, text/event-stream',
    'Mcp-Protocol-Version': MCP_PROTOCOL_VERSION,
  }

  if (sessionId) {
    headers['Mcp-Session-Id'] = sessionId
  }

  const authHeader = resolveAuthHeader(auth)
  if (authHeader) {
    headers[authHeader.name] = authHeader.value
  }

  return headers
}

function resolveAuthHeader(auth: McpAuth | undefined): { name: string; value: string } | null {
  if (!auth || auth.type === 'none') return null

  const envValue = process.env[auth.envVar]
  if (!envValue) {
    throw new McpIntrospectionError(
      `Missing environment variable ${auth.envVar} required to introspect the MCP server.`,
    )
  }

  const headerName = auth.type === 'bearer'
    ? auth.headerName ?? 'Authorization'
    : auth.headerName
  const headerTemplate = auth.headerTemplate ?? 'Bearer ${value}'

  return {
    name: headerName,
    value: headerTemplate.replace('${value}', envValue),
  }
}

async function parseHttpEnvelope<T>(
  response: Response,
  requestId: number,
): Promise<JsonRpcEnvelope<T>> {
  const contentType = response.headers.get('content-type') ?? ''

  if (contentType.includes('application/json')) {
    return await response.json() as JsonRpcEnvelope<T>
  }

  if (contentType.includes('text/event-stream')) {
    const payload = await response.text()
    const envelopes = parseSsePayload(payload)
    const match = envelopes.find((message) => message.id === requestId) as JsonRpcEnvelope<T> | undefined
    if (!match) {
      throw new McpIntrospectionError(
        `MCP server returned an SSE stream for request ${requestId} without a matching JSON-RPC response.`,
      )
    }
    return match
  }

  throw new McpIntrospectionError(`Unsupported MCP HTTP response content type: ${contentType || 'unknown'}.`)
}

function parseSsePayload(payload: string): Array<JsonRpcEnvelope<unknown>> {
  const messages: Array<JsonRpcEnvelope<unknown>> = []
  let dataLines: string[] = []

  const flush = () => {
    if (dataLines.length === 0) return
    const data = dataLines.join('\n').trim()
    dataLines = []
    if (!data) return
    messages.push(JSON.parse(data) as JsonRpcEnvelope<unknown>)
  }

  for (const line of payload.split(/\r?\n/)) {
    if (line === '') {
      flush()
      continue
    }

    if (line.startsWith('data:')) {
      dataLines.push(line.slice(5).trimStart())
    }
  }

  flush()
  return messages
}

function unwrapEnvelope<T>(envelope: JsonRpcEnvelope<T>): T {
  if ('error' in envelope) {
    throw new McpIntrospectionError(`MCP request failed: ${envelope.error.message}`)
  }

  return envelope.result
}

let requestCounter = 0
function nextRequestId(): number {
  requestCounter += 1
  return requestCounter
}
