import { describe, expect, it, beforeEach, afterEach } from 'bun:test'
import { existsSync, readFileSync, rmSync } from 'fs'
import { resolve } from 'path'
import { loadConfig } from '../src/config/load'
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

  it('supports one-skill-per-tool grouping for agent-friendly headless scaffolds', () => {
    const skills = planSkillScaffolds(introspection.tools, 'tool')

    expect(skills.map((skill) => skill.dirName)).toEqual([
      'find-organizations',
      'find-people',
      'get-organization',
    ])
    expect(skills.every((skill) => skill.tools.length === 1)).toBe(true)
  })

  it('writes config, instructions, and grouped skills from discovered tools', async () => {
    const result = await writeMcpScaffold({
      rootDir: TEST_DIR,
      pluginName: 'sumble',
      authorName: 'Anthony Goldbloom',
      displayName: 'Sumble MCP',
      skillGrouping: 'tool',
      hookMode: 'safe',
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
      'skills/find-organizations',
      'skills/find-people',
      'skills/get-organization',
    ])
    expect(result.generatedFiles).toContain('scripts/check-env.sh')

    const config = readFileSync(resolve(TEST_DIR, 'pluxx.config.ts'), 'utf-8')
    const instructionsFile = readFileSync(resolve(TEST_DIR, 'INSTRUCTIONS.md'), 'utf-8')
    const organizationSkill = readFileSync(resolve(TEST_DIR, 'skills/find-organizations/SKILL.md'), 'utf-8')
    const envScript = readFileSync(resolve(TEST_DIR, 'scripts/check-env.sh'), 'utf-8')

    expect(config).toContain(`name: "sumble"`)
    expect(config).toContain(`envVar: "SUMBLE_API_KEY"`)
    expect(config).toContain(`instructions: './INSTRUCTIONS.md'`)
    expect(config).toContain(`scripts: "./scripts/"`)
    expect(config).toContain(`sessionStart`)
    expect(config).toContain('check-env.sh')
    expect(config).toContain(`displayName: "Sumble MCP"`)
    expect(config).toContain(`websiteURL: "https://sumble.com/"`)

    expect(instructionsFile).toContain('# Sumble MCP')
    expect(instructionsFile).toContain('Prefer the most specific Sumble tool for the request.')
    expect(instructionsFile).toContain('`FindOrganizations`')
    expect(instructionsFile).toContain('`find-organizations`')

    expect(organizationSkill).toContain('# Find Organizations')
    expect(organizationSkill).toContain('### `FindOrganizations`')
    expect(organizationSkill).toContain('`query` (string, required)')
    expect(envScript).toContain('SUMBLE_API_KEY')
    expect(envScript).toContain('pluxx: SUMBLE_API_KEY is not set')
    expect(existsSync(resolve(TEST_DIR, 'skills/find-people/SKILL.md'))).toBe(true)

    const loadedConfig = await loadConfig(TEST_DIR)
    expect(loadedConfig.name).toBe('sumble')
    expect(loadedConfig.brand?.displayName).toBe('Sumble MCP')
  })
})
