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

    const server = Bun.serve({
      port: 0,
      fetch(request) {
        const body = request.method === 'POST'
          ? request.json() as Promise<Record<string, unknown>>
          : Promise.resolve({})

        return body.then((message) => {
          if (request.method === 'DELETE') {
            sawSessionHeader = request.headers.get('Mcp-Session-Id') === 'test-session'
            return new Response(null, { status: 204 })
          }

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
        })
      },
    })

    process.env.TEST_REMOTE_MCP_TOKEN = 'test-token'

    try {
      const result = await introspectMcpServer({
        transport: 'http',
        url: `http://127.0.0.1:${server.port}/mcp`,
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
      await server.stop(true)
    }
  })
})
