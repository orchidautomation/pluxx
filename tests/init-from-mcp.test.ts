import { describe, expect, it, beforeEach, afterEach } from 'bun:test'
import { existsSync, readFileSync, rmSync } from 'fs'
import { resolve } from 'path'
import { derivePluginName, parseMcpSourceInput, planSkillScaffolds, writeMcpScaffold } from '../src/cli/init-from-mcp'
import type { IntrospectedMcpServer } from '../src/mcp/introspect'

const TEST_DIR = resolve(import.meta.dir, '.init-from-mcp')

const introspection: IntrospectedMcpServer = {
  protocolVersion: '2025-03-26',
  instructions: 'Prefer the most specific Sumble tool for the request.',
  serverInfo: {
    name: 'sumble',
    title: 'Sumble',
    version: '1.0.0',
    description: 'Sales intelligence and account research tools.',
    websiteUrl: 'https://sumble.com/',
  },
  tools: [
    {
      name: 'FindOrganizations',
      title: 'Find Organizations',
      description: 'Search organizations by company attributes and signals.',
      inputSchema: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Company search query.',
          },
          limit: {
            type: 'number',
            description: 'Maximum number of matches to return.',
          },
        },
        required: ['query'],
      },
    },
    {
      name: 'GetOrganization',
      description: 'Fetch a single organization by identifier.',
      inputSchema: {
        type: 'object',
        properties: {
          organizationId: {
            type: 'string',
            description: 'Organization identifier.',
          },
        },
        required: ['organizationId'],
      },
    },
    {
      name: 'FindPeople',
      description: 'Search people by role and company context.',
      inputSchema: {
        type: 'object',
        properties: {
          role: {
            type: 'string',
          },
        },
      },
    },
  ],
}

beforeEach(() => {
  rmSync(TEST_DIR, { recursive: true, force: true })
})

afterEach(() => {
  rmSync(TEST_DIR, { recursive: true, force: true })
})

describe('init-from-mcp scaffold', () => {
  it('parses remote and stdio MCP inputs', () => {
    expect(parseMcpSourceInput('https://mcp.sumble.com')).toEqual({
      transport: 'http',
      url: 'https://mcp.sumble.com/',
    })

    expect(parseMcpSourceInput('npx -y @sumble/mcp')).toEqual({
      transport: 'stdio',
      command: 'npx',
      args: ['-y', '@sumble/mcp'],
    })
  })

  it('derives a stable plugin name from MCP metadata', () => {
    expect(derivePluginName(introspection, { transport: 'http', url: 'https://mcp.sumble.com/' })).toBe('sumble')
  })

  it('groups discovered MCP tools into workflow-oriented skills', () => {
    const skills = planSkillScaffolds(introspection.tools)

    expect(skills.map((skill) => skill.dirName)).toEqual([
      'account-research',
      'contact-discovery',
    ])
    expect(skills[0].tools.map((tool) => tool.name)).toEqual([
      'FindOrganizations',
      'GetOrganization',
    ])
  })

  it('writes config, instructions, and grouped skills from discovered tools', async () => {
    const result = await writeMcpScaffold({
      rootDir: TEST_DIR,
      pluginName: 'sumble',
      authorName: 'Anthony Goldbloom',
      targets: ['claude-code', 'cursor', 'codex', 'opencode'],
      source: {
        transport: 'http',
        url: 'https://mcp.sumble.com/',
        auth: {
          type: 'bearer',
          envVar: 'SUMBLE_API_KEY',
        },
      },
      introspection,
    })

    expect(result.skillDirectories).toEqual([
      'skills/account-research',
      'skills/contact-discovery',
    ])

    const config = readFileSync(resolve(TEST_DIR, 'pluxx.config.ts'), 'utf-8')
    const instructionsFile = readFileSync(resolve(TEST_DIR, 'INSTRUCTIONS.md'), 'utf-8')
    const accountSkill = readFileSync(resolve(TEST_DIR, 'skills/account-research/SKILL.md'), 'utf-8')

    expect(config).toContain(`name: "sumble"`)
    expect(config).toContain(`envVar: "SUMBLE_API_KEY"`)
    expect(config).toContain(`instructions: './INSTRUCTIONS.md'`)
    expect(config).toContain(`websiteURL: "https://sumble.com/"`)

    expect(instructionsFile).toContain('# Sumble')
    expect(instructionsFile).toContain('Prefer the most specific Sumble tool for the request.')
    expect(instructionsFile).toContain('`FindOrganizations`')
    expect(instructionsFile).toContain('`account-research`')

    expect(accountSkill).toContain('# Account Research')
    expect(accountSkill).toContain('### `FindOrganizations`')
    expect(accountSkill).toContain('### `GetOrganization`')
    expect(accountSkill).toContain('`query` (string, required)')
    expect(existsSync(resolve(TEST_DIR, 'skills/contact-discovery/SKILL.md'))).toBe(true)
  })
})
