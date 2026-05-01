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

  it('supports runtime readiness with refresh commands and gate scoping', () => {
    const config = PluginConfigSchema.parse({
      name: 'readiness-plugin',
      description: 'Readiness fixture',
      author: {
        name: 'Orchid Labs',
      },
      skills: './skills/',
      readiness: {
        dependencies: [
          {
            id: 'runtime-cache',
            path: './runtime/status.json',
            statusField: 'status',
            readyValues: ['ready'],
            pendingValues: ['pending'],
            failedValues: ['failed'],
            refresh: {
              command: '${PLUGIN_ROOT}/scripts/refresh-runtime.sh',
            },
          },
        ],
        gates: [
          {
            dependency: 'runtime-cache',
            applyTo: ['mcp-tools', 'commands'],
            tools: ['fixture.search'],
            commands: ['research'],
            timeoutMs: 2000,
            pollMs: 100,
            onTimeout: 'warn',
          },
        ],
      },
    })

    expect(config.readiness?.dependencies[0]?.refresh.command).toBe('${PLUGIN_ROOT}/scripts/refresh-runtime.sh')
    expect(config.readiness?.gates[0]?.commands).toEqual(['research'])
  })

  it('rejects invalid runtime readiness selector wiring and duplicate dependencies', () => {
    const parsed = PluginConfigSchema.safeParse({
      name: 'readiness-plugin',
      description: 'Readiness fixture',
      author: {
        name: 'Orchid Labs',
      },
      skills: './skills/',
      readiness: {
        dependencies: [
          {
            id: 'runtime-cache',
            path: './runtime/status.json',
            refresh: {
              command: 'echo refresh',
            },
          },
          {
            id: 'runtime-cache',
            path: './runtime/other-status.json',
            refresh: {
              command: 'echo refresh',
            },
          },
        ],
        gates: [
          {
            dependency: 'runtime-cache',
            applyTo: ['skills'],
            tools: ['fixture.search'],
          },
        ],
      },
    })

    expect(parsed.success).toBe(false)
    expect(parsed.error?.issues.some((issue) => issue.message.includes('duplicated'))).toBe(true)
    expect(parsed.error?.issues.some((issue) => issue.message.includes('requires applyTo to include "mcp-tools"'))).toBe(true)
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
    expect(Object.keys(buckets.runtime.mcpSurface.servers ?? {})).toEqual(['leadkit'])
    expect(buckets.runtime.mcpSurface.hasRuntimeAuth).toBe(false)
    expect(buckets.runtime.readinessSurface.config).toBeUndefined()
    expect(buckets.runtime.payloadSurface.passthroughPaths).toEqual(['./mcp-server/'])
    expect(buckets.permissions.rules?.allow).toEqual(['Read(src/**)'])
    expect(buckets.distribution.targets).toEqual(['claude-code', 'cursor', 'codex', 'opencode'])
    expect(buckets.distribution.identity.name).toBe('leadkit')
    expect(buckets.distribution.userConfig).toEqual([])
    expect(buckets.distribution.brandingSurface.identity.name).toBe('leadkit')
    expect(buckets.distribution.installSurface.userConfig).toEqual([])
    expect(buckets.distribution.outputSurface.targets).toEqual(['claude-code', 'cursor', 'codex', 'opencode'])
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

  it('accepts keyed record maps for mcp, env, matcher, and platform override objects', () => {
    const config = PluginConfigSchema.parse({
      name: 'synabun',
      description: 'Synabun plugin',
      author: {
        name: 'Orchid Labs',
      },
      skills: './skills/',
      mcp: {
        synabun: {
          transport: 'stdio',
          command: 'node',
          args: ['server.js'],
          env: {
            SYNABUN_API_KEY: '${SYNABUN_API_KEY}',
          },
        },
      },
      hooks: {
        preToolUse: [
          {
            command: 'echo gate',
            matcher: {
              tool: 'write_file',
              path: 'src/**',
            },
          },
        ],
      },
      platforms: {
        'claude-code': {
          skillDefaults: {
            temperature: 0.2,
          },
        },
        codex: {
          interface: {
            websiteURL: 'https://synabun.dev',
          },
        },
      },
      targets: ['codex', 'cursor'],
    })

    expect(config.mcp?.synabun.transport).toBe('stdio')
    expect(config.mcp?.synabun.env?.SYNABUN_API_KEY).toBe('${SYNABUN_API_KEY}')
    expect(config.hooks?.preToolUse?.[0]?.matcher).toEqual({
      tool: 'write_file',
      path: 'src/**',
    })
    expect(config.platforms?.['claude-code']?.skillDefaults).toEqual({
      temperature: 0.2,
    })
    expect(config.platforms?.codex?.interface).toEqual({
      websiteURL: 'https://synabun.dev',
    })
  })
})
