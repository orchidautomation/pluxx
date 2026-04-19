import { describe, expect, it } from 'bun:test'
import {
  HookEntrySchema,
  McpAuthSchema,
  McpServerSchema,
  PermissionsSchema,
  PluginConfigSchema,
  PLUXX_COMPILER_BUCKETS,
  UserConfigSchema,
  getConfiguredCompilerBuckets,
  getPluginCompilerBuckets,
} from '../src/schema'

describe('McpServerSchema transport validation', () => {
  it('requires command and forbids url for stdio transport', () => {
    expect(
      McpServerSchema.safeParse({
        transport: 'stdio',
      }).success
    ).toBe(false)

    expect(
      McpServerSchema.safeParse({
        transport: 'stdio',
        command: 'npx',
        url: 'https://example.com/mcp',
      }).success
    ).toBe(false)

    expect(
      McpServerSchema.safeParse({
        transport: 'stdio',
        command: 'npx',
      }).success
    ).toBe(true)
  })

  it('requires url and forbids command for http/sse transport', () => {
    expect(
      McpServerSchema.safeParse({
        transport: 'http',
      }).success
    ).toBe(false)

    expect(
      McpServerSchema.safeParse({
        transport: 'http',
        url: 'https://example.com/mcp',
        command: 'npx',
      }).success
    ).toBe(false)

    expect(
      McpServerSchema.safeParse({
        transport: 'sse',
      }).success
    ).toBe(false)

    expect(
      McpServerSchema.safeParse({
        transport: 'sse',
        url: 'https://example.com/mcp',
        command: 'npx',
      }).success
    ).toBe(false)

    expect(
      McpServerSchema.safeParse({
        transport: 'http',
        url: 'https://example.com/mcp',
      }).success
    ).toBe(true)

    expect(
      McpServerSchema.safeParse({
        transport: 'sse',
        url: 'https://example.com/mcp',
      }).success
    ).toBe(true)
  })

  it('defaults missing transport to http', () => {
    const parsed = McpServerSchema.parse({
      url: 'https://example.com/mcp',
    })

    expect(parsed.transport).toBe('http')
  })
})

describe('McpAuthSchema auth validation', () => {
  it('requires envVar for bearer auth', () => {
    expect(
      McpAuthSchema.safeParse({
        type: 'bearer',
      }).success
    ).toBe(false)

    expect(
      McpAuthSchema.safeParse({
        type: 'bearer',
        envVar: 'API_KEY',
      }).success
    ).toBe(true)
  })

  it('requires envVar and headerName for header auth', () => {
    expect(
      McpAuthSchema.safeParse({
        type: 'header',
      }).success
    ).toBe(false)

    expect(
      McpAuthSchema.safeParse({
        type: 'header',
        envVar: 'API_KEY',
      }).success
    ).toBe(false)

    expect(
      McpAuthSchema.safeParse({
        type: 'header',
        envVar: 'API_KEY',
        headerName: 'X-API-Key',
      }).success
    ).toBe(true)
  })

  it('supports platform-managed auth', () => {
    expect(
      McpAuthSchema.safeParse({
        type: 'platform',
      }).success
    ).toBe(true)
  })
})

describe('UserConfigSchema user config validation', () => {
  it('requires a key, title, and description', () => {
    expect(
      UserConfigSchema.safeParse([
        {
          key: 'api-key',
          title: 'API Key',
          description: 'Bearer token for the MCP.',
          type: 'secret',
          required: true,
          envVar: 'API_KEY',
        },
      ]).success
    ).toBe(true)

    expect(
      UserConfigSchema.safeParse([
        {
          description: 'Bearer token for the MCP.',
        },
      ]).success
    ).toBe(false)
  })
})

describe('PermissionsSchema permissions validation', () => {
  it('accepts canonical allow/ask/deny rules', () => {
    expect(
      PermissionsSchema.safeParse({
        allow: ['Bash(git status)', 'Read(src/**)'],
        ask: ['MCP(linear.*)'],
        deny: ['Edit(.env)'],
      }).success,
    ).toBe(true)
  })

  it('rejects non-canonical permission syntax', () => {
    expect(
      PermissionsSchema.safeParse({
        allow: ['git status'],
      }).success,
    ).toBe(false)
  })
})

describe('HookEntrySchema hook type validation', () => {
  it('supports command hooks', () => {
    expect(
      HookEntrySchema.safeParse({
        command: 'echo hello',
      }).success
    ).toBe(true)
  })

  it('supports prompt hooks', () => {
    expect(
      HookEntrySchema.safeParse({
        type: 'prompt',
        prompt: 'Only allow safe commands',
      }).success
    ).toBe(true)
  })

  it('requires prompt for prompt hooks', () => {
    expect(
      HookEntrySchema.safeParse({
        type: 'prompt',
      }).success
    ).toBe(false)
  })
})

describe('Plugin compiler bucket mapping', () => {
  it('exposes the canonical compiler bucket list', () => {
    expect(PLUXX_COMPILER_BUCKETS).toEqual([
      'instructions',
      'skills',
      'commands',
      'agents',
      'hooks',
      'permissions',
      'runtime',
      'distribution',
    ])
  })

  it('derives compiler buckets from a parsed plugin config', () => {
    const config = PluginConfigSchema.parse({
      name: 'leadkit',
      description: 'Leadkit plugin',
      author: {
        name: 'Orchid Labs',
      },
      skills: './skills/',
      commands: './commands/',
      agents: './agents/',
      instructions: './README.md',
      scripts: './scripts/',
      assets: './assets/',
      passthrough: ['./mcp-server/'],
      mcp: {
        leadkit: {
          transport: 'stdio',
          command: 'node',
          args: ['server.js'],
        },
      },
      permissions: {
        allow: ['Read(src/**)'],
      },
      targets: ['claude-code', 'cursor', 'codex', 'opencode'],
    })

    const buckets = getPluginCompilerBuckets(config)

    expect(buckets.instructions.path).toBe('./README.md')
    expect(buckets.skills.path).toBe('./skills/')
    expect(buckets.commands.path).toBe('./commands/')
    expect(buckets.agents.path).toBe('./agents/')
    expect(buckets.runtime.scriptsPath).toBe('./scripts/')
    expect(buckets.runtime.assetsPath).toBe('./assets/')
    expect(buckets.runtime.passthroughPaths).toEqual(['./mcp-server/'])
    expect(Object.keys(buckets.runtime.mcp ?? {})).toEqual(['leadkit'])
    expect(buckets.permissions.rules?.allow).toEqual(['Read(src/**)'])
    expect(buckets.distribution.targets).toEqual(['claude-code', 'cursor', 'codex', 'opencode'])
    expect(buckets.distribution.identity.name).toBe('leadkit')
    expect(buckets.distribution.userConfig).toEqual([])
  })

  it('derives the active compiler buckets from config', () => {
    const config = PluginConfigSchema.parse({
      name: 'leadkit',
      description: 'Leadkit plugin',
      author: {
        name: 'Orchid Labs',
      },
      skills: './skills/',
      commands: './commands/',
      hooks: {
        sessionStart: [{ command: 'echo setup' }],
      },
      mcp: {
        leadkit: {
          transport: 'stdio',
          command: 'node',
        },
      },
      targets: ['claude-code', 'cursor'],
    })

    expect(getConfiguredCompilerBuckets(config)).toEqual([
      'skills',
      'commands',
      'hooks',
      'runtime',
      'distribution',
    ])
  })
})
