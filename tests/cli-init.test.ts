import { describe, expect, it } from 'bun:test'
import { buildRemoteAuthConfig, parseInitFromMcpOptions, resolveRemoteAuthType } from '../src/cli/index'

describe('CLI init option parsing', () => {
  it('parses headless init --from-mcp flags for automation-friendly setup', () => {
    const options = parseInitFromMcpOptions(
      [
        'init',
        '--from-mcp',
        'https://mcp.sumble.com',
        '--yes',
        '--name',
        'sumble-plugin',
        '--display-name',
        'Sumble',
        '--author',
        'Anthony Goldbloom',
        '--targets',
        'claude-code,codex',
        '--grouping',
        'workflow',
        '--hooks',
        'safe',
        '--auth-env',
        'SUMBLE_API_KEY',
        '--json',
      ],
      undefined,
      'https://mcp.sumble.com',
    )

    expect(options).toEqual({
      source: 'https://mcp.sumble.com',
      assumeDefaults: true,
      name: 'sumble-plugin',
      displayName: 'Sumble',
      author: 'Anthony Goldbloom',
      targets: 'claude-code,codex',
      authEnv: 'SUMBLE_API_KEY',
      authType: undefined,
      authHeader: undefined,
      authTemplate: undefined,
      grouping: 'workflow',
      hooks: 'safe',
      transport: undefined,
      jsonOutput: true,
    })
  })

  it('parses --transport flag for SSE transport override', () => {
    const options = parseInitFromMcpOptions(
      [
        'init',
        '--from-mcp',
        'https://example.com/mcp',
        '--transport',
        'sse',
        '--yes',
      ],
      undefined,
      'https://example.com/mcp',
    )

    expect(options.transport).toBe('sse')
    expect(options.source).toBe('https://example.com/mcp')
    expect(options.assumeDefaults).toBe(true)
  })

  it('leaves transport undefined when --transport is not provided', () => {
    const options = parseInitFromMcpOptions(
      ['init', '--from-mcp', 'https://example.com/mcp'],
      undefined,
      'https://example.com/mcp',
    )

    expect(options.transport).toBeUndefined()
  })

  it('parses explicit header auth flags for remote MCP imports', () => {
    const options = parseInitFromMcpOptions(
      [
        'init',
        '--from-mcp',
        'https://mcp.playkit.sh/mcp',
        '--auth-env',
        'PLAYKIT_API_KEY',
        '--auth-type',
        'header',
        '--auth-header',
        'X-API-Key',
        '--auth-template',
        '${value}',
      ],
      undefined,
      'https://mcp.playkit.sh/mcp',
    )

    expect(options.authEnv).toBe('PLAYKIT_API_KEY')
    expect(options.authType).toBe('header')
    expect(options.authHeader).toBe('X-API-Key')
    expect(options.authTemplate).toBe('${value}')
  })

  it('lets the positional name seed the MCP scaffold flow', () => {
    const options = parseInitFromMcpOptions(
      ['init', 'sumble', '--from-mcp', 'npx -y @sumble/mcp'],
      'sumble',
      'npx -y @sumble/mcp',
    )

    expect(options.source).toBe('npx -y @sumble/mcp')
    expect(options.name).toBe('sumble')
    expect(options.assumeDefaults).toBe(false)
    expect(options.authType).toBeUndefined()
    expect(options.authHeader).toBeUndefined()
    expect(options.authTemplate).toBeUndefined()
    expect(options.hooks).toBeUndefined()
    expect(options.jsonOutput).toBe(false)
  })

  it('builds header auth config for custom-header MCPs', () => {
    expect(resolveRemoteAuthType({ authType: undefined, authHeader: 'X-API-Key' })).toBe('header')
    expect(buildRemoteAuthConfig({
      authEnv: 'PLAYKIT_API_KEY',
      authType: 'header',
      authHeader: 'X-API-Key',
      authTemplate: '${value}',
    })).toEqual({
      type: 'header',
      envVar: 'PLAYKIT_API_KEY',
      headerName: 'X-API-Key',
      headerTemplate: '${value}',
    })
  })

  it('defaults bearer auth config when only --auth-env is provided', () => {
    expect(buildRemoteAuthConfig({
      authEnv: 'SUMBLE_API_KEY',
      authType: undefined,
      authHeader: undefined,
      authTemplate: undefined,
    })).toEqual({
      type: 'bearer',
      envVar: 'SUMBLE_API_KEY',
      headerName: 'Authorization',
      headerTemplate: 'Bearer ${value}',
    })
  })
})
