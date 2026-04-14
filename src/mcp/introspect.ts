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
    readonly context?: {
      responseHeaders?: Record<string, string>
      responseBodySnippet?: string
    },
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
  if (server.transport === 'stdio') {
    const client = await createStdioClient(server)
    return await introspectWithClient(client)
  }

  if (server.transport === 'sse') {
    const client = await createSseClient(server)
    return await introspectWithClient(client)
  }

  try {
    return await introspectWithClient(createHttpClient(server))
  } catch (error) {
    if (
      error instanceof McpIntrospectionError
      && (error.status === 400 || error.status === 404 || error.status === 405)
    ) {
      const sseClient = await createSseClient({
        ...server,
        transport: 'sse',
      })
      return await introspectWithClient(sseClient)
    }

    throw error
  }
}

async function introspectWithClient(client: McpClient): Promise<IntrospectedMcpServer> {
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
        const context = await extractHttpErrorContext(response)
        throw new McpIntrospectionError(
          `MCP HTTP request failed with ${response.status} ${response.statusText}.`,
          response.status,
          context,
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
        const context = await extractHttpErrorContext(response)
        throw new McpIntrospectionError(
          `MCP HTTP notification failed with ${response.status} ${response.statusText}.`,
          response.status,
          context,
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

async function createSseClient(server: Extract<McpServer, { transport: 'sse' }>): Promise<McpClient> {
  let sessionId: string | null = null
  let endpointUrl: string | null = null
  let isClosed = false
  const pending = new Map<number, {
    resolve: (value: unknown) => void
    reject: (error: Error) => void
    timeout: ReturnType<typeof setTimeout>
  }>()
  const abortController = new AbortController()
  let resolveEndpoint!: (value: string) => void
  let rejectEndpoint!: (error: Error) => void
  let endpointSettled = false

  const endpointReady = new Promise<string>((resolve, reject) => {
    resolveEndpoint = (value) => {
      endpointSettled = true
      resolve(value)
    }
    rejectEndpoint = (error) => {
      endpointSettled = true
      reject(error)
    }
  })

  const streamPromise = (async () => {
    const response = await fetch(server.url, {
      method: 'GET',
      headers: buildSseStreamHeaders(server.auth, sessionId),
      signal: abortController.signal,
    })

    if (!response.ok) {
      const context = await extractHttpErrorContext(response)
      throw new McpIntrospectionError(
        `MCP SSE stream failed with ${response.status} ${response.statusText}.`,
        response.status,
        context,
      )
    }

    const contentType = response.headers.get('content-type') ?? ''
    if (!contentType.includes('text/event-stream')) {
      throw new McpIntrospectionError(`Unsupported MCP SSE response content type: ${contentType || 'unknown'}.`)
    }

    sessionId = response.headers.get('Mcp-Session-Id') ?? sessionId

    if (!response.body) {
      throw new McpIntrospectionError('MCP SSE stream opened without a readable response body.')
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    let eventName = 'message'
    let dataLines: string[] = []

    const flushEvent = () => {
      if (dataLines.length === 0) {
        eventName = 'message'
        return
      }

      const data = dataLines.join('\n').trim()
      dataLines = []
      const currentEvent = eventName || 'message'
      eventName = 'message'

      if (!data) {
        return
      }

      if (currentEvent === 'endpoint') {
        endpointUrl = new URL(data, server.url).toString()
        if (!endpointSettled) {
          resolveEndpoint(endpointUrl)
        }
        return
      }

      if (currentEvent !== 'message') {
        return
      }

      const envelope = JSON.parse(data) as JsonRpcEnvelope<unknown>
      if (typeof envelope !== 'object' || envelope === null || !('id' in envelope)) {
        return
      }

      const requestId = typeof envelope.id === 'number' ? envelope.id : Number.NaN
      if (!Number.isFinite(requestId)) return

      const entry = pending.get(requestId)
      if (!entry) return

      pending.delete(requestId)
      clearTimeout(entry.timeout)

      try {
        entry.resolve(unwrapEnvelope(envelope))
      } catch (error) {
        entry.reject(error instanceof Error ? error : new Error(String(error)))
      }
    }

    while (true) {
      const { value, done } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split(/\r?\n/)
      buffer = lines.pop() ?? ''

      for (const line of lines) {
        if (line === '') {
          flushEvent()
          continue
        }

        if (line.startsWith(':')) {
          continue
        }

        const separatorIndex = line.indexOf(':')
        const field = separatorIndex === -1 ? line : line.slice(0, separatorIndex)
        const rawValue = separatorIndex === -1 ? '' : line.slice(separatorIndex + 1).trimStart()

        if (field === 'event') {
          eventName = rawValue || 'message'
        } else if (field === 'data') {
          dataLines.push(rawValue)
        }
      }
    }

    if (buffer) {
      const tailLines = buffer.split(/\r?\n/)
      for (const line of tailLines) {
        if (line.startsWith('data:')) {
          dataLines.push(line.slice(5).trimStart())
        }
      }
    }
    flushEvent()

    if (!endpointSettled) {
      rejectEndpoint(new McpIntrospectionError('MCP SSE stream did not provide the required endpoint event.'))
      return
    }

    if (!isClosed && pending.size > 0) {
      const error = new McpIntrospectionError('MCP SSE stream ended before pluxx finished introspecting it.')
      for (const entry of pending.values()) {
        clearTimeout(entry.timeout)
        entry.reject(error)
      }
      pending.clear()
    }
  })().catch((error) => {
    if (isClosed && error instanceof DOMException && error.name === 'AbortError') {
      return
    }

    const wrapped = error instanceof Error
      ? error
      : new McpIntrospectionError(String(error))

    if (!endpointSettled) {
      rejectEndpoint(wrapped)
    }

    for (const entry of pending.values()) {
      clearTimeout(entry.timeout)
      entry.reject(wrapped)
    }
    pending.clear()
  })

  await endpointReady

  return {
    async request<T>(method: string, params?: Record<string, unknown>): Promise<T> {
      const requestId = nextRequestId()
      const endpoint = endpointUrl ?? await endpointReady

      const resultPromise = new Promise<T>((resolve, reject) => {
        const timeout = setTimeout(() => {
          pending.delete(requestId)
          reject(new McpIntrospectionError(`Timed out waiting for MCP SSE response to ${method}.`))
        }, DEFAULT_TIMEOUT_MS)

        pending.set(requestId, {
          resolve: (value) => {
            clearTimeout(timeout)
            resolve(value as T)
          },
          reject: (error) => {
            clearTimeout(timeout)
            reject(error)
          },
          timeout,
        })
      })

      let response: Response
      try {
        response = await fetch(endpoint, {
          method: 'POST',
          headers: buildHttpHeaders(server.auth, sessionId),
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: requestId,
            method,
            ...(params ? { params } : {}),
          }),
        })
      } catch (error) {
        const entry = pending.get(requestId)
        if (entry) {
          pending.delete(requestId)
          clearTimeout(entry.timeout)
        }
        throw new McpIntrospectionError(`MCP SSE request failed: ${error instanceof Error ? error.message : String(error)}`)
      }

      if (!response.ok && response.status !== 202) {
        const entry = pending.get(requestId)
        if (entry) {
          pending.delete(requestId)
          clearTimeout(entry.timeout)
        }
        const context = await extractHttpErrorContext(response)
        throw new McpIntrospectionError(
          `MCP SSE request failed with ${response.status} ${response.statusText}.`,
          response.status,
          context,
        )
      }

      sessionId = response.headers.get('Mcp-Session-Id') ?? sessionId
      const contentType = response.headers.get('content-type') ?? ''
      if (contentType.includes('application/json') || contentType.includes('text/event-stream')) {
        const entry = pending.get(requestId)
        if (entry) {
          pending.delete(requestId)
          clearTimeout(entry.timeout)
        }
        const envelope = await parseHttpEnvelope<T>(response, requestId)
        return unwrapEnvelope(envelope)
      }

      return await resultPromise
    },

    async notify(method: string, params?: Record<string, unknown>): Promise<void> {
      const endpoint = endpointUrl ?? await endpointReady
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: buildHttpHeaders(server.auth, sessionId),
        body: JSON.stringify({
          jsonrpc: '2.0',
          method,
          ...(params ? { params } : {}),
        }),
      })

      if (!response.ok && response.status !== 202) {
        const context = await extractHttpErrorContext(response)
        throw new McpIntrospectionError(
          `MCP SSE notification failed with ${response.status} ${response.statusText}.`,
          response.status,
          context,
        )
      }

      sessionId = response.headers.get('Mcp-Session-Id') ?? sessionId
    },

    async close(): Promise<void> {
      isClosed = true
      abortController.abort()
      await streamPromise
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

function buildSseStreamHeaders(auth: McpAuth | undefined, sessionId: string | null): HeadersInit {
  const headers: Record<string, string> = {
    Accept: 'text/event-stream',
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

async function extractHttpErrorContext(response: Response): Promise<{
  responseHeaders?: Record<string, string>
  responseBodySnippet?: string
}> {
  const responseHeaders: Record<string, string> = {}
  for (const headerName of ['www-authenticate', 'location', 'content-type']) {
    const value = response.headers.get(headerName)
    if (value) {
      responseHeaders[headerName] = value
    }
  }

  let responseBodySnippet: string | undefined
  try {
    const contentType = response.headers.get('content-type') ?? ''
    if (contentType.includes('application/json') || contentType.includes('text/plain') || contentType.includes('text/html')) {
      const body = (await response.text()).trim()
      if (body) {
        responseBodySnippet = body.slice(0, 500)
      }
    }
  } catch {
    // Body extraction is best effort only.
  }

  if (Object.keys(responseHeaders).length === 0 && !responseBodySnippet) {
    return {}
  }

  return {
    ...(Object.keys(responseHeaders).length > 0 ? { responseHeaders } : {}),
    ...(responseBodySnippet ? { responseBodySnippet } : {}),
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
