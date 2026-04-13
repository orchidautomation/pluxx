import { describe, expect, it } from 'bun:test'
import { parseInitFromMcpOptions } from '../src/cli/index'

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
      grouping: 'workflow',
      hooks: 'safe',
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

  it('lets the positional name seed the MCP scaffold flow', () => {
    const options = parseInitFromMcpOptions(
      ['init', 'sumble', '--from-mcp', 'npx -y @sumble/mcp'],
      'sumble',
      'npx -y @sumble/mcp',
    )

    expect(options.source).toBe('npx -y @sumble/mcp')
    expect(options.name).toBe('sumble')
    expect(options.assumeDefaults).toBe(false)
    expect(options.hooks).toBeUndefined()
    expect(options.jsonOutput).toBe(false)
  })
})
