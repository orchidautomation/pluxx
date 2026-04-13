import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { mkdirSync, rmSync, writeFileSync } from 'fs'
import { resolve } from 'path'
import { introspectMcpServer } from '../src/mcp/introspect'

const TEST_DIR = resolve(import.meta.dir, '.mcp-introspect')
const STUB_SERVER_PATH = resolve(TEST_DIR, 'stub-server.js')

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
        capabilities: { tools: { listChanged: true } },
        serverInfo: {
          name: 'stub-server',
          title: 'Stub Server',
          version: '1.0.0',
          description: 'A fake MCP server for tests.'
        },
        instructions: 'Use the fake tools carefully.'
      }
    })
    return
  }

  if (message.method === 'tools/list') {
    if (!message.params || !message.params.cursor) {
      send({
        jsonrpc: '2.0',
        id: message.id,
        result: {
          tools: [{
            name: 'get_accounts',
            description: 'Fetch account records.',
            inputSchema: {
              type: 'object',
              properties: {
                accountId: { type: 'string', description: 'Account identifier.' }
              },
              required: ['accountId']
            }
          }],
          nextCursor: 'page-2'
        }
      })
      return
    }

    send({
      jsonrpc: '2.0',
      id: message.id,
      result: {
        tools: [{
          name: 'get_people',
          description: 'Fetch people records.'
        }]
      }
    })
  }
})`,
  )
})

afterEach(() => {
  rmSync(TEST_DIR, { recursive: true, force: true })
})

describe('MCP introspection', () => {
  it('introspects stdio MCP servers and paginates tools/list', async () => {
    const result = await introspectMcpServer({
      transport: 'stdio',
      command: 'bun',
      args: [STUB_SERVER_PATH],
    })

    expect(result.serverInfo.name).toBe('stub-server')
    expect(result.instructions).toBe('Use the fake tools carefully.')
    expect(result.tools.map((tool) => tool.name)).toEqual(['get_accounts', 'get_people'])
  })

  it('introspects HTTP MCP servers and preserves the negotiated session header', async () => {
    let sawInitialized = false
    let sawSessionHeader = false
    let sawAuthHeader = false
    const originalFetch = globalThis.fetch
    globalThis.fetch = (async (input, init) => {
      const request = new Request(input, init)

      if (request.method === 'DELETE') {
        sawSessionHeader = request.headers.get('Mcp-Session-Id') === 'test-session'
        return new Response(null, { status: 204 })
      }

      const message = await request.json() as Record<string, unknown>

      if (message.method === 'initialize') {
        sawAuthHeader = request.headers.get('Authorization') === 'Bearer test-token'
        return new Response(JSON.stringify({
          jsonrpc: '2.0',
          id: message.id,
          result: {
            protocolVersion: '2025-03-26',
            capabilities: { tools: { listChanged: false } },
            serverInfo: {
              name: 'http-server',
              title: 'HTTP Server',
            },
          },
        }), {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'Mcp-Session-Id': 'test-session',
          },
        })
      }

      if (message.method === 'notifications/initialized') {
        sawInitialized = true
        sawSessionHeader = request.headers.get('Mcp-Session-Id') === 'test-session'
        return new Response(null, { status: 202 })
      }

      if (message.method === 'tools/list') {
        sawSessionHeader = request.headers.get('Mcp-Session-Id') === 'test-session'
        return new Response(JSON.stringify({
          jsonrpc: '2.0',
          id: message.id,
          result: {
            tools: [{
              name: 'search_companies',
              description: 'Search companies.',
            }],
          },
        }), {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
          },
        })
      }

      return new Response('Unhandled', { status: 500 })
    }) as typeof fetch

    process.env.TEST_REMOTE_MCP_TOKEN = 'test-token'

    try {
      const result = await introspectMcpServer({
        transport: 'http',
        url: 'https://example.com/mcp',
        auth: {
          type: 'bearer',
          envVar: 'TEST_REMOTE_MCP_TOKEN',
        },
      })

      expect(result.serverInfo.name).toBe('http-server')
      expect(result.tools.map((tool) => tool.name)).toEqual(['search_companies'])
      expect(sawInitialized).toBe(true)
      expect(sawSessionHeader).toBe(true)
      expect(sawAuthHeader).toBe(true)
    } finally {
      delete process.env.TEST_REMOTE_MCP_TOKEN
      globalThis.fetch = originalFetch
    }
  })

  it('supports remote HTTP MCPs that use custom header auth instead of bearer auth', async () => {
    let sawAuthHeader = false
    const originalFetch = globalThis.fetch
    globalThis.fetch = (async (input, init) => {
      const request = new Request(input, init)
      const message = await request.json() as Record<string, unknown>

      if (message.method === 'initialize') {
        sawAuthHeader = request.headers.get('X-API-Key') === 'playkit-test-key'
        return new Response(JSON.stringify({
          jsonrpc: '2.0',
          id: message.id,
          result: {
            protocolVersion: '2025-03-26',
            capabilities: { tools: { listChanged: false } },
            serverInfo: {
              name: 'playkit',
              title: 'PlayKit',
            },
          },
        }), {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
          },
        })
      }

      if (message.method === 'notifications/initialized') {
        return new Response(null, { status: 202 })
      }

      if (message.method === 'tools/list') {
        return new Response(JSON.stringify({
          jsonrpc: '2.0',
          id: message.id,
          result: {
            tools: [{
              name: 'ask_clay',
              description: 'Ask a Clay question.',
            }],
          },
        }), {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
          },
        })
      }

      return new Response('Unhandled', { status: 500 })
    }) as typeof fetch

    process.env.PLAYKIT_API_KEY = 'playkit-test-key'

    try {
      const result = await introspectMcpServer({
        transport: 'http',
        url: 'https://mcp.playkit.sh/mcp',
        auth: {
          type: 'header',
          envVar: 'PLAYKIT_API_KEY',
          headerName: 'X-API-Key',
          headerTemplate: '${value}',
        },
      })

      expect(result.serverInfo.name).toBe('playkit')
      expect(result.tools.map((tool) => tool.name)).toEqual(['ask_clay'])
      expect(sawAuthHeader).toBe(true)
    } finally {
      delete process.env.PLAYKIT_API_KEY
      globalThis.fetch = originalFetch
    }
  })

  it('introspects legacy SSE MCP servers via the advertised endpoint event', async () => {
    let sawStreamAuthHeader = false
    let sawPostAuthHeader = false
    let sawSessionHeader = false
    const originalFetch = globalThis.fetch
    const encoder = new TextEncoder()
    let controller: ReadableStreamDefaultController<Uint8Array> | null = null

    const stream = new ReadableStream<Uint8Array>({
      start(streamController) {
        controller = streamController
        streamController.enqueue(encoder.encode('event: endpoint\ndata: /messages\n\n'))
      },
    })

    globalThis.fetch = (async (input, init) => {
      const request = new Request(input, init)

      if (request.method === 'GET') {
        sawStreamAuthHeader = request.headers.get('Authorization') === 'Bearer legacy-token'
        return new Response(stream, {
          status: 200,
          headers: {
            'Content-Type': 'text/event-stream',
          },
        })
      }

      const message = await request.json() as Record<string, unknown>

      if (request.url === 'https://example.com/messages' && message.method === 'initialize') {
        sawPostAuthHeader = request.headers.get('Authorization') === 'Bearer legacy-token'
        controller?.enqueue(encoder.encode(`event: message\ndata: ${JSON.stringify({
          jsonrpc: '2.0',
          id: message.id,
          result: {
            protocolVersion: '2025-03-26',
            capabilities: { tools: { listChanged: false } },
            serverInfo: {
              name: 'legacy-sse',
              title: 'Legacy SSE',
            },
          },
        })}\n\n`))

        return new Response(null, {
          status: 202,
          headers: {
            'Mcp-Session-Id': 'legacy-session',
          },
        })
      }

      if (request.url === 'https://example.com/messages' && message.method === 'notifications/initialized') {
        sawSessionHeader = request.headers.get('Mcp-Session-Id') === 'legacy-session'
        return new Response(null, { status: 202 })
      }

      if (request.url === 'https://example.com/messages' && message.method === 'tools/list') {
        sawSessionHeader = sawSessionHeader && request.headers.get('Mcp-Session-Id') === 'legacy-session'
        controller?.enqueue(encoder.encode(`event: message\ndata: ${JSON.stringify({
          jsonrpc: '2.0',
          id: message.id,
          result: {
            tools: [{
              name: 'search_legacy_companies',
              description: 'Search companies via legacy SSE.',
            }],
          },
        })}\n\n`))
        controller?.close()
        return new Response(null, { status: 202 })
      }

      return new Response('Unhandled', { status: 500 })
    }) as typeof fetch

    process.env.TEST_LEGACY_SSE_TOKEN = 'legacy-token'

    try {
      const result = await introspectMcpServer({
        transport: 'sse',
        url: 'https://example.com/sse',
        auth: {
          type: 'bearer',
          envVar: 'TEST_LEGACY_SSE_TOKEN',
        },
      })

      expect(result.serverInfo.name).toBe('legacy-sse')
      expect(result.tools.map((tool) => tool.name)).toEqual(['search_legacy_companies'])
      expect(sawStreamAuthHeader).toBe(true)
      expect(sawPostAuthHeader).toBe(true)
      expect(sawSessionHeader).toBe(true)
    } finally {
      delete process.env.TEST_LEGACY_SSE_TOKEN
      globalThis.fetch = originalFetch
    }
  })

  it('falls back from HTTP initialize failures to legacy SSE transport', async () => {
    let attemptedHttpInitialize = false
    const originalFetch = globalThis.fetch
    const encoder = new TextEncoder()
    let controller: ReadableStreamDefaultController<Uint8Array> | null = null

    const stream = new ReadableStream<Uint8Array>({
      start(streamController) {
        controller = streamController
        streamController.enqueue(encoder.encode('event: endpoint\ndata: /messages\n\n'))
      },
    })

    globalThis.fetch = (async (input, init) => {
      const request = new Request(input, init)

      if (request.url === 'https://example.com/legacy' && request.method === 'POST') {
        const message = await request.json() as Record<string, unknown>
        if (message.method === 'initialize') {
          attemptedHttpInitialize = true
          return new Response('Method Not Allowed', { status: 405, statusText: 'Method Not Allowed' })
        }
      }

      if (request.url === 'https://example.com/legacy' && request.method === 'GET') {
        return new Response(stream, {
          status: 200,
          headers: {
            'Content-Type': 'text/event-stream',
          },
        })
      }

      const message = await request.json() as Record<string, unknown>
      if (request.url === 'https://example.com/messages' && message.method === 'initialize') {
        controller?.enqueue(encoder.encode(`event: message\ndata: ${JSON.stringify({
          jsonrpc: '2.0',
          id: message.id,
          result: {
            protocolVersion: '2025-03-26',
            capabilities: { tools: { listChanged: false } },
            serverInfo: {
              name: 'fallback-legacy',
              title: 'Fallback Legacy',
            },
          },
        })}\n\n`))
        return new Response(null, { status: 202 })
      }

      if (request.url === 'https://example.com/messages' && message.method === 'notifications/initialized') {
        return new Response(null, { status: 202 })
      }

      if (request.url === 'https://example.com/messages' && message.method === 'tools/list') {
        controller?.enqueue(encoder.encode(`event: message\ndata: ${JSON.stringify({
          jsonrpc: '2.0',
          id: message.id,
          result: {
            tools: [{
              name: 'search_fallback_companies',
              description: 'Search companies after HTTP fallback.',
            }],
          },
        })}\n\n`))
        controller?.close()
        return new Response(null, { status: 202 })
      }

      return new Response('Unhandled', { status: 500 })
    }) as typeof fetch

    try {
      const result = await introspectMcpServer({
        transport: 'http',
        url: 'https://example.com/legacy',
      })

      expect(attemptedHttpInitialize).toBe(true)
      expect(result.serverInfo.name).toBe('fallback-legacy')
      expect(result.tools.map((tool) => tool.name)).toEqual(['search_fallback_companies'])
    } finally {
      globalThis.fetch = originalFetch
    }
  })
})
