import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { mkdirSync, rmSync, writeFileSync } from 'fs'
import { resolve } from 'path'
import { tmpdir } from 'os'
import {
  discoverInstalledMcpServers,
  resolveInstalledMcpSelector,
} from '../src/cli/discover-installed-mcp'

let rootDir = ''
let homeDir = ''

beforeEach(() => {
  rootDir = resolve(tmpdir(), `pluxx-installed-mcp-root-${Date.now()}-${Math.random().toString(16).slice(2)}`)
  homeDir = resolve(tmpdir(), `pluxx-installed-mcp-home-${Date.now()}-${Math.random().toString(16).slice(2)}`)
  mkdirSync(rootDir, { recursive: true })
  mkdirSync(homeDir, { recursive: true })
})

afterEach(() => {
  rmSync(rootDir, { recursive: true, force: true })
  rmSync(homeDir, { recursive: true, force: true })
})

describe('installed MCP discovery', () => {
  it('discovers remote MCPs from Cursor config with env-based bearer auth', () => {
    mkdirSync(resolve(homeDir, '.cursor'), { recursive: true })
    writeFileSync(resolve(homeDir, '.cursor/mcp.json'), JSON.stringify({
      mcpServers: {
        exa: {
          url: 'https://mcp.exa.ai/mcp',
          bearer_token_env_var: 'EXA_API_KEY',
        },
      },
    }, null, 2))

    const discovered = discoverInstalledMcpServers({ rootDir, homeDir, hosts: ['cursor'] })

    expect(discovered).toHaveLength(1)
    expect(discovered[0].id).toBe('cursor:exa')
    expect(discovered[0].server).toEqual({
      transport: 'http',
      url: 'https://mcp.exa.ai/mcp',
      auth: {
        type: 'bearer',
        envVar: 'EXA_API_KEY',
        headerName: 'Authorization',
        headerTemplate: 'Bearer ${value}',
      },
    })
  })

  it('discovers stdio MCPs from Codex config.toml without copying literal secrets', () => {
    mkdirSync(resolve(rootDir, '.codex'), { recursive: true })
    writeFileSync(resolve(rootDir, '.codex/config.toml'), `
[mcp_servers.prospeo]
command = "node"
args = ["./server.js"]
env = { PROSPEO_API_KEY = "literal-secret-value-that-should-not-copy" }
`)

    const discovered = discoverInstalledMcpServers({ rootDir, homeDir, hosts: ['codex'] })

    expect(discovered).toHaveLength(1)
    expect(discovered[0].id).toBe('codex:prospeo')
    expect(discovered[0].server).toEqual({
      transport: 'stdio',
      command: 'node',
      args: ['./server.js'],
      env: {
        PROSPEO_API_KEY: '${PROSPEO_API_KEY}',
      },
    })
    expect(discovered[0].warnings).toContain('Literal secret-like env value for PROSPEO_API_KEY was replaced with ${PROSPEO_API_KEY}.')
  })

  it('preserves richer native MCP auth overrides during installed discovery', () => {
    writeFileSync(resolve(rootDir, '.mcp.json'), JSON.stringify({
      mcpServers: {
        metrics: {
          url: 'https://metrics.example.com/mcp',
          env_http_headers: {
            'X-API-Key': 'METRICS_API_KEY',
            'X-Workspace': 'METRICS_WORKSPACE_ID',
          },
        },
      },
    }, null, 2))

    const discovered = discoverInstalledMcpServers({ rootDir, homeDir, hosts: ['codex'] })

    expect(discovered).toHaveLength(1)
    expect(discovered[0].platformOverrides).toEqual({
      codex: {
        mcpServers: {
          metrics: {
            env_http_headers: {
              'X-API-Key': 'METRICS_API_KEY',
              'X-Workspace': 'METRICS_WORKSPACE_ID',
            },
          },
        },
      },
    })
  })

  it('discovers OpenCode local and remote MCP config', () => {
    writeFileSync(resolve(rootDir, 'opencode.json'), JSON.stringify({
      mcp: {
        context7: {
          type: 'local',
          command: ['npx', '-y', '@upstash/context7-mcp'],
        },
        docs: {
          type: 'remote',
          url: 'https://docs.example.com/mcp',
          headers: {
            'X-API-Key': '${DOCS_API_KEY}',
          },
        },
      },
    }, null, 2))

    const discovered = discoverInstalledMcpServers({ rootDir, homeDir, hosts: ['opencode'] })

    expect(discovered.map((server) => server.id)).toEqual(['opencode:context7', 'opencode:docs'])
    expect(discovered[0].server).toEqual({
      transport: 'stdio',
      command: 'npx',
      args: ['-y', '@upstash/context7-mcp'],
    })
    expect(discovered[1].server).toEqual({
      transport: 'http',
      url: 'https://docs.example.com/mcp',
      auth: {
        type: 'header',
        envVar: 'DOCS_API_KEY',
        headerName: 'X-API-Key',
        headerTemplate: '${value}',
      },
    })
  })

  it('resolves ambiguous selectors by requiring a host prefix', () => {
    writeFileSync(resolve(rootDir, '.mcp.json'), JSON.stringify({
      mcpServers: {
        shared: {
          url: 'https://claude.example.com/mcp',
        },
      },
    }, null, 2))
    mkdirSync(resolve(homeDir, '.cursor'), { recursive: true })
    writeFileSync(resolve(homeDir, '.cursor/mcp.json'), JSON.stringify({
      mcpServers: {
        shared: {
          url: 'https://cursor.example.com/mcp',
        },
      },
    }, null, 2))

    const discovered = discoverInstalledMcpServers({ rootDir, homeDir, hosts: ['claude-code', 'cursor'] })

    expect(() => resolveInstalledMcpSelector('shared', discovered)).toThrow('ambiguous')
    expect(resolveInstalledMcpSelector('cursor:shared', discovered).server).toEqual({
      transport: 'http',
      url: 'https://cursor.example.com/mcp',
    })
  })
})
