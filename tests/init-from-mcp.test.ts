import { describe, expect, it, beforeEach, afterEach } from 'bun:test'
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'fs'
import { resolve } from 'path'
import { loadConfig } from '../src/config/load'
import { analyzeMcpQuality, deriveDisplayName, derivePluginName, detectMutatingTools, parseMcpSourceInput, planSkillScaffolds, writeMcpScaffold } from '../src/cli/init-from-mcp'
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
  resources: [
    {
      uri: 'sumble://guides/getting-started',
      name: 'getting-started',
      description: 'Setup and onboarding guide for Sumble users.',
      mimeType: 'text/markdown',
    },
  ],
  resourceTemplates: [
    {
      uriTemplate: 'sumble://organizations/{organization_id}',
      name: 'organization-resource',
      description: 'Fetch organization reference data by identifier.',
      mimeType: 'application/json',
    },
  ],
  prompts: [
    {
      name: 'qualify-account',
      description: 'Qualify a target account before outreach.',
      arguments: [
        {
          name: 'company_name',
          required: true,
        },
      ],
    },
  ],
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

  it('parses URL with explicit SSE transport override', () => {
    expect(parseMcpSourceInput('https://mcp.example.com/v1', 'sse')).toEqual({
      transport: 'sse',
      url: 'https://mcp.example.com/v1',
    })
  })

  it('auto-detects SSE transport when URL path ends with /sse', () => {
    expect(parseMcpSourceInput('https://mcp.example.com/sse')).toEqual({
      transport: 'sse',
      url: 'https://mcp.example.com/sse',
    })
  })

  it('auto-detects SSE transport for trailing-slash SSE paths', () => {
    expect(parseMcpSourceInput('https://mcp.example.com/sse/')).toEqual({
      transport: 'sse',
      url: 'https://mcp.example.com/sse/',
    })

    expect(parseMcpSourceInput('https://mcp.example.com/v1/sse/')).toEqual({
      transport: 'sse',
      url: 'https://mcp.example.com/v1/sse/',
    })
  })

  it('defaults to http transport when URL path does not end with /sse', () => {
    expect(parseMcpSourceInput('https://mcp.example.com/mcp')).toEqual({
      transport: 'http',
      url: 'https://mcp.example.com/mcp',
    })
  })

  it('rejects invalid transport overrides', () => {
    expect(() => parseMcpSourceInput('https://mcp.example.com/v1', 'websocket')).toThrow(
      'Transport must be one of: http, sse',
    )
  })

  it('ignores transport override for stdio commands', () => {
    expect(parseMcpSourceInput('npx -y @acme/mcp', 'sse')).toEqual({
      transport: 'stdio',
      command: 'npx',
      args: ['-y', '@acme/mcp'],
    })
  })

  it('derives a stable plugin name from MCP metadata', () => {
    expect(derivePluginName(introspection, { transport: 'http', url: 'https://mcp.sumble.com/' })).toBe('sumble')
  })

  it('derives a polished display name from weak MCP identifiers', () => {
    expect(deriveDisplayName({
      ...introspection,
      serverInfo: {
        name: 'agent-mail',
      },
    }, 'agent-mail')).toBe('Agent Mail')
  })

  it('groups discovered MCP tools into workflow-oriented skills', () => {
    const skills = planSkillScaffolds(
      introspection.tools,
      'workflow',
      introspection.resources ?? [],
      introspection.resourceTemplates ?? [],
      introspection.prompts ?? [],
    )

    expect(skills.map((skill) => skill.dirName)).toEqual([
      'account-research',
      'contact-discovery',
    ])
    expect(skills[0].tools.map((tool) => tool.name)).toEqual([
      'FindOrganizations',
      'GetOrganization',
    ])
    expect(skills[0].resourceTemplates.map((resource) => resource.name)).toEqual([
      'organization-resource',
    ])
    expect(skills[0].prompts.map((prompt) => prompt.name)).toEqual([
      'qualify-account',
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

  it('avoids weak lexical workflow buckets for admin and activity-heavy MCP tools', () => {
    const skills = planSkillScaffolds([
      {
        name: 'create_client',
        description: 'Register a new client. Admin tool — use when onboarding a new client.',
        inputSchema: { type: 'object', properties: {} },
      },
      {
        name: 'update_client',
        description: 'Update an existing client configuration. Admin tool.',
        inputSchema: { type: 'object', properties: {} },
      },
      {
        name: 'create_api_key',
        description: 'Create a new API key for a team member. Admin tool — plaintext shown once.',
        inputSchema: { type: 'object', properties: {} },
      },
      {
        name: 'get_client_pulse',
        description: 'Lightweight index of a client. Returns meeting cadence, call listing, and message counts per channel.\n\nArgs:\n  client_id: Client slug.',
        inputSchema: { type: 'object', properties: {} },
      },
      {
        name: 'get_call_transcript',
        description: 'Get the full, clean transcript for a specific call. Use after search_calls to drill in. AI summary is omitted — use get_client_pulse or search_calls for quick overviews.',
        inputSchema: { type: 'object', properties: {} },
      },
      {
        name: 'get_weekly_heatmap',
        description: 'Weekly activity heatmap — external/internal messages, calls, and normalized 0-100 score.',
        inputSchema: { type: 'object', properties: {} },
      },
    ], 'workflow')

    expect(skills.map((skill) => skill.dirName)).toEqual([
      'admin-and-config',
      'activity-intelligence',
    ])
    expect(skills[0].tools.map((tool) => tool.name)).toEqual([
      'create_api_key',
      'create_client',
      'update_client',
    ])
    expect(skills[1].tools.map((tool) => tool.name)).toEqual([
      'get_call_transcript',
      'get_client_pulse',
      'get_weekly_heatmap',
    ])
  })

  it('reports weak MCP metadata that will likely need agent refinement', () => {
    const report = analyzeMcpQuality([
      { name: 'query', description: '', inputSchema: { type: 'object', properties: {} } },
      {
        name: 'get_usage',
        description: 'Get usage.\n\nReturns:\n- tier\n- credits',
        inputSchema: {
          type: 'object',
          properties: {
            account_id: { type: 'string' },
            workspace_id: { type: 'string' },
          },
        },
      },
    ])

    expect(report.ok).toBe(false)
    expect(report.warnings).toBeGreaterThanOrEqual(2)
    expect(report.issues.some((issue) => issue.code === 'generic-tool-names')).toBe(true)
    expect(report.issues.some((issue) => issue.code === 'missing-tool-descriptions')).toBe(true)
    expect(report.issues.some((issue) => issue.code === 'verbose-tool-descriptions')).toBe(true)
    expect(report.issues.some((issue) => issue.code === 'weak-input-schemas')).toBe(true)
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
    expect(result.commandFiles).toEqual([
      'commands/find-organizations.md',
      'commands/find-people.md',
      'commands/get-organization.md',
    ])
    expect(result.generatedFiles).toContain('scripts/check-env.sh')
    expect(result.generatedFiles).toContain('.pluxx/mcp.json')

    const config = readFileSync(resolve(TEST_DIR, 'pluxx.config.ts'), 'utf-8')
    const instructionsFile = readFileSync(resolve(TEST_DIR, 'INSTRUCTIONS.md'), 'utf-8')
    const organizationSkill = readFileSync(resolve(TEST_DIR, 'skills/find-organizations/SKILL.md'), 'utf-8')
    const organizationCommand = readFileSync(resolve(TEST_DIR, 'commands/find-organizations.md'), 'utf-8')
    const envScript = readFileSync(resolve(TEST_DIR, 'scripts/check-env.sh'), 'utf-8')
    const metadata = JSON.parse(readFileSync(resolve(TEST_DIR, '.pluxx/mcp.json'), 'utf-8')) as {
      version: number
      settings: {
        skillGrouping: string
        generatedHookMode: string
      }
      managedFiles: string[]
      userConfig: Array<{ envVar?: string }>
      resources?: Array<{ uri: string }>
      resourceTemplates?: Array<{ uriTemplate: string }>
      prompts?: Array<{ name: string }>
      skills: Array<{ dirName: string, resourceTemplateUris?: string[], promptNames?: string[] }>
    }

    expect(config).toContain(`name: "sumble"`)
    expect(config).toContain(`envVar: "SUMBLE_API_KEY"`)
    expect(config).toContain(`userConfig: [`)
    expect(config).toContain(`key: "sumble-api-key"`)
    expect(config).toContain(`title: "Sumble Api Key"`)
    expect(config).toContain(`instructions: './INSTRUCTIONS.md'`)
    expect(config).toContain(`commands: "./commands/"`)
    expect(config).toContain(`scripts: "./scripts/"`)
    expect(config).toContain(`sessionStart`)
    expect(config).toContain('check-env.sh')
    expect(config).toContain(`displayName: "Sumble MCP"`)
    expect(config).toContain(`websiteURL: "https://sumble.com/"`)

    expect(instructionsFile).toContain('# Sumble MCP')
    expect(instructionsFile).toContain('## Workflow Guidance')
    expect(instructionsFile).toContain('## Tool Routing')
    expect(instructionsFile).toContain('## Resource Surfaces')
    expect(instructionsFile).toContain('## Prompt Templates')
    expect(instructionsFile).toContain('## User Config')
    expect(instructionsFile).toContain('Prefer the most specific Sumble tool for the request.')
    expect(instructionsFile).toContain('`FindOrganizations`')
    expect(instructionsFile).toContain('`getting-started`')
    expect(instructionsFile).toContain('`organization-resource`')
    expect(instructionsFile).toContain('`qualify-account`')
    expect(instructionsFile).toContain('`find-organizations`')
    expect(instructionsFile).toContain('Sumble MCP connects to its MCP over HTTP.')
    expect(instructionsFile).not.toContain('connects to the `sumble` MCP server')

    expect(organizationSkill).toContain('# Find Organizations')
    expect(organizationSkill).toContain('### `FindOrganizations`')
    expect(organizationSkill).toContain('`query` (string, required)')
    expect(organizationSkill).toContain('## Related Resources')
    expect(organizationSkill).toContain('`organization-resource`')
    expect(organizationSkill).toContain('## Related Prompt Templates')
    expect(organizationSkill).toContain('`qualify-account`')
    expect(organizationSkill).toContain('## Example Requests')
    expect(organizationSkill).toContain('"Find organizations matching <query>."')
    expect(organizationSkill.startsWith('---\n')).toBe(true)
    expect(organizationSkill).toContain('\n<!-- pluxx:generated:start -->\n# Find Organizations')
    expect(organizationCommand).toContain('argument-hint: [query]')
    expect(organizationCommand).toContain('when_to_use: "Use this command when the user asks to search organizations by company attributes and signals.')
    expect(organizationCommand).toContain('arguments: ["query"]')
    expect(organizationCommand).toContain('skill: "find-organizations"')
    expect(organizationCommand).toContain('Use this command when the user asks to search organizations by company attributes and signals.')
    expect(organizationCommand).toContain('Primary tools:')
    expect(organizationCommand).toContain('Related resources:')
    expect(organizationCommand).toContain('`organization-resource`')
    expect(organizationCommand).toContain('Related prompt templates:')
    expect(organizationCommand).toContain('`qualify-account`')
    expect(organizationCommand).toContain('<!-- pluxx:generated:start -->')
    expect(envScript).toContain('SUMBLE_API_KEY')
    expect(envScript).toContain('pluxx: SUMBLE_API_KEY is not set')
    expect(metadata.version).toBe(1)
    expect(metadata.settings.skillGrouping).toBe('tool')
    expect(metadata.settings.generatedHookMode).toBe('safe')
    expect(metadata.managedFiles).toContain('.pluxx/mcp.json')
    expect(metadata.managedFiles).toContain('commands/find-organizations.md')
    expect(metadata.userConfig.map((entry) => entry.envVar)).toContain('SUMBLE_API_KEY')
    expect(metadata.resources?.map((resource) => resource.uri)).toContain('sumble://guides/getting-started')
    expect(metadata.resourceTemplates?.map((resource) => resource.uriTemplate)).toContain('sumble://organizations/{organization_id}')
    expect(metadata.prompts?.map((prompt) => prompt.name)).toContain('qualify-account')
    expect(metadata.skills.map((skill) => skill.dirName)).toEqual([
      'find-organizations',
      'find-people',
      'get-organization',
    ])
    expect(metadata.skills.find((skill) => skill.dirName === 'find-organizations')?.resourceTemplateUris).toEqual([
      'sumble://organizations/{organization_id}',
    ])
    expect(metadata.skills.find((skill) => skill.dirName === 'find-organizations')?.promptNames).toEqual([
      'qualify-account',
    ])
    expect(existsSync(resolve(TEST_DIR, 'skills/find-people/SKILL.md'))).toBe(true)

    const loadedConfig = await loadConfig(TEST_DIR)
    expect(loadedConfig.name).toBe('sumble')
    expect(loadedConfig.brand?.displayName).toBe('Sumble MCP')
  })

  it('keeps workflow command surfaces narrower than raw singleton tool wrappers', async () => {
    await writeMcpScaffold({
      rootDir: TEST_DIR,
      pluginName: 'utility-mcp',
      authorName: 'Test Author',
      displayName: 'Utility MCP',
      skillGrouping: 'workflow',
      hookMode: 'none',
      targets: ['codex'],
      source: {
        transport: 'http',
        url: 'https://utility.example.com/mcp',
      },
      introspection: {
        ...introspection,
        resources: [],
        resourceTemplates: [],
        prompts: [],
        tools: [
          {
            name: 'get_user',
            description: 'Fetch one user record by identifier.',
            inputSchema: {
              type: 'object',
              properties: { user_id: { type: 'string' } },
              required: ['user_id'],
            },
          },
          {
            name: 'get_team',
            description: 'Fetch one team record by identifier.',
            inputSchema: {
              type: 'object',
              properties: { team_id: { type: 'string' } },
              required: ['team_id'],
            },
          },
          {
            name: 'get_project',
            description: 'Fetch one project record by identifier.',
            inputSchema: {
              type: 'object',
              properties: { project_id: { type: 'string' } },
              required: ['project_id'],
            },
          },
        ],
      },
    })

    const commands = [
      'commands/get-user.md',
      'commands/get-team.md',
      'commands/get-project.md',
    ].filter((path) => existsSync(resolve(TEST_DIR, path)))
    const config = readFileSync(resolve(TEST_DIR, 'pluxx.config.ts'), 'utf-8')

    expect(commands).toHaveLength(1)
    expect(config).toContain('commands: "./commands/"')
  })

  it('preserves custom remote header auth in the generated config', async () => {
    await writeMcpScaffold({
      rootDir: TEST_DIR,
      pluginName: 'playkit',
      authorName: 'Orchid Automation',
      displayName: 'PlayKit',
      skillGrouping: 'workflow',
      hookMode: 'safe',
      targets: ['claude-code', 'cursor', 'codex', 'opencode'],
      source: {
        transport: 'http',
        url: 'https://mcp.playkit.sh/mcp',
        auth: {
          type: 'header',
          envVar: 'PLAYKIT_API_KEY',
          headerName: 'X-API-Key',
          headerTemplate: '${value}',
        },
      },
      introspection: {
        ...introspection,
        serverInfo: {
          ...introspection.serverInfo,
          name: 'playkit',
          title: 'PlayKit',
        },
      },
    })

    const config = readFileSync(resolve(TEST_DIR, 'pluxx.config.ts'), 'utf-8')
    expect(config).toContain(`type: "header"`)
    expect(config).toContain(`envVar: "PLAYKIT_API_KEY"`)
    expect(config).toContain(`headerName: "X-API-Key"`)
    expect(config).toContain(`headerTemplate: "\${value}"`)
    expect(config).toContain(`userConfig: [`)
    expect(config).toContain(`key: "playkit-api-key"`)
  })

  it('can emit platform-managed runtime auth hints for Claude Code and Cursor', async () => {
    await writeMcpScaffold({
      rootDir: TEST_DIR,
      pluginName: 'sumble',
      authorName: 'Anthony Goldbloom',
      displayName: 'Sumble MCP',
      skillGrouping: 'tool',
      hookMode: 'safe',
      runtimeAuthMode: 'platform',
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

    const config = readFileSync(resolve(TEST_DIR, 'pluxx.config.ts'), 'utf-8')
    const instructionsFile = readFileSync(resolve(TEST_DIR, 'INSTRUCTIONS.md'), 'utf-8')
    const metadata = JSON.parse(readFileSync(resolve(TEST_DIR, '.pluxx/mcp.json'), 'utf-8')) as {
      settings: { runtimeAuthMode: string }
    }

    expect(config).toContain("'claude-code': {\n      mcpAuth: 'platform'")
    expect(config).toContain("cursor: {\n      mcpAuth: 'platform'")
    expect(instructionsFile).toContain('platform-managed auth at runtime')
    expect(metadata.settings.runtimeAuthMode).toBe('platform')
  })

  it('can emit platform auth config for OAuth-ready MCPs without inline secrets', async () => {
    await writeMcpScaffold({
      rootDir: TEST_DIR,
      pluginName: 'oauth-stub',
      authorName: 'Test Author',
      displayName: 'OAuth Stub',
      skillGrouping: 'tool',
      hookMode: 'safe',
      targets: ['claude-code', 'cursor', 'codex', 'opencode'],
      source: {
        transport: 'http',
        url: 'https://example.com/mcp',
        auth: {
          type: 'platform',
          mode: 'oauth',
        },
      },
      introspection,
    })

    const config = readFileSync(resolve(TEST_DIR, 'pluxx.config.ts'), 'utf-8')
    const instructionsFile = readFileSync(resolve(TEST_DIR, 'INSTRUCTIONS.md'), 'utf-8')
    const metadata = JSON.parse(readFileSync(resolve(TEST_DIR, '.pluxx/mcp.json'), 'utf-8')) as {
      settings: { runtimeAuthMode: string }
    }

    expect(config).toContain(`type: 'platform'`)
    expect(config).toContain(`mode: "oauth"`)
    expect(config).toContain("'claude-code': {\n      mcpAuth: 'platform'")
    expect(config).toContain("cursor: {\n      mcpAuth: 'platform'")
    expect(instructionsFile).toContain('platform-managed OAuth')
    expect(metadata.settings.runtimeAuthMode).toBe('platform')
  })

  it('infers passthrough directories for local stdio runtime paths', async () => {
    rmSync(TEST_DIR, { recursive: true, force: true })
    mkdirSync(resolve(TEST_DIR, 'build'), { recursive: true })
    writeFileSync(resolve(TEST_DIR, 'build/index.js'), 'console.log("stdio runtime")\n')

    await writeMcpScaffold({
      rootDir: TEST_DIR,
      pluginName: 'local-runtime',
      authorName: 'Test Author',
      displayName: 'Local Runtime',
      skillGrouping: 'workflow',
      hookMode: 'safe',
      targets: ['codex'],
      source: {
        transport: 'stdio',
        command: 'node',
        args: ['./build/index.js'],
      },
      introspection,
    })

    const config = readFileSync(resolve(TEST_DIR, 'pluxx.config.ts'), 'utf-8')
    expect(config).toContain(`passthrough: ["./build/"]`)
  })

  it('curates single-tool frontmatter descriptions instead of copying raw multiline tool help', async () => {
    const multilineIntrospection: IntrospectedMcpServer = {
      ...introspection,
      tools: [
        {
          name: 'get_usage',
          description: 'Get your current usage, remaining credits, and tier info.\n\nReturns:\n- Current tier\n- Credits remaining\n- Upgrade URL',
          inputSchema: {
            type: 'object',
            properties: {},
          },
        },
      ],
    }

    await writeMcpScaffold({
      rootDir: TEST_DIR,
      pluginName: 'playkit',
      authorName: 'Orchid Automation',
      displayName: 'PlayKit',
      skillGrouping: 'workflow',
      hookMode: 'none',
      targets: ['codex'],
      source: {
        transport: 'http',
        url: 'https://mcp.playkit.sh/mcp',
      },
      introspection: multilineIntrospection,
    })

    const skill = readFileSync(resolve(TEST_DIR, 'skills/account-and-usage/SKILL.md'), 'utf-8')
    expect(skill).toContain('description: "Get your current usage, remaining credits, and tier info."')
    expect(skill).not.toContain('description: "Get your current usage, remaining credits, and tier info.\\n\\nReturns:')
  })

  it('writes compact routing guidance instead of dumping verbose tool docs into instructions', async () => {
    const verboseIntrospection: IntrospectedMcpServer = {
      ...introspection,
      tools: [
        {
          name: 'firecrawl_scrape',
          description: 'Scrape content from a single URL with advanced options.\n\n**Best for:** Single page content extraction when you know which page contains the information.\n**Usage Example:** {"url":"https://example.com"}\n**Returns:** JSON structured data, markdown, branding profile, or other formats as specified.',
          inputSchema: {
            type: 'object',
            properties: {
              url: {
                type: 'string',
              },
            },
            required: ['url'],
          },
        },
        {
          name: 'firecrawl_map',
          description: 'Map a website to discover all indexed URLs on the site.\n\n**Best for:** Discovering the correct page on a large documentation or product site before scraping.',
          inputSchema: {
            type: 'object',
            properties: {
              url: {
                type: 'string',
              },
            },
            required: ['url'],
          },
        },
      ],
    }

    await writeMcpScaffold({
      rootDir: TEST_DIR,
      pluginName: 'firecrawl',
      authorName: 'Firecrawl',
      displayName: 'Firecrawl',
      skillGrouping: 'workflow',
      hookMode: 'none',
      targets: ['codex'],
      source: {
        transport: 'stdio',
        command: 'npx',
        args: ['-y', 'firecrawl-mcp'],
      },
      introspection: verboseIntrospection,
    })

    const instructionsFile = readFileSync(resolve(TEST_DIR, 'INSTRUCTIONS.md'), 'utf-8')
    expect(instructionsFile).toContain('## Workflow Guidance')
    expect(instructionsFile).toContain('## Tool Routing')
    expect(instructionsFile).toContain('`firecrawl_scrape`: Scrape content from a single URL with advanced options. Best for: Single page content extraction when you know which page contains the information.')
    expect(instructionsFile).toContain('`firecrawl_map`: Map a website to discover all indexed URLs on the site. Best for: Discovering the correct page on a large documentation or product site before scraping.')
    expect(instructionsFile).not.toContain('**Usage Example:**')
    expect(instructionsFile).not.toContain('**Returns:**')
  })

  it('can fold sourced docs context into the initial scaffold deterministically', async () => {
    await writeMcpScaffold({
      rootDir: TEST_DIR,
      pluginName: 'firecrawl',
      authorName: 'Firecrawl',
      displayName: 'Firecrawl',
      description: 'Turn websites into clean markdown and structured data for downstream workflows.',
      websiteUrl: 'https://www.firecrawl.dev/',
      sourcedContext: {
        workflowHints: ['Scrape pages', 'Map large docs sites'],
        setupHints: ['Use onlyMainContent when you want cleaner page bodies.'],
        authHints: ['Set FIRECRAWL_API_KEY before calling hosted scraping flows.'],
        warnings: ['Deep MCP docs pages are often best paired with the broader docs root.'],
      },
      skillGrouping: 'workflow',
      hookMode: 'none',
      targets: ['codex'],
      source: {
        transport: 'http',
        url: 'https://api.firecrawl.dev/mcp',
      },
      introspection: {
        ...introspection,
        serverInfo: {
          ...introspection.serverInfo,
          name: 'firecrawl',
          title: 'Firecrawl',
          description: 'Generated from the firecrawl MCP server.',
        },
      },
    })

    const config = readFileSync(resolve(TEST_DIR, 'pluxx.config.ts'), 'utf-8')
    const instructionsFile = readFileSync(resolve(TEST_DIR, 'INSTRUCTIONS.md'), 'utf-8')

    expect(config).toContain('description: "Turn websites into clean markdown and structured data for downstream workflows."')
    expect(config).toContain('shortDescription: "Turn websites into clean markdown and structured data for downstream workflows."')
    expect(config).toContain('websiteURL: "https://www.firecrawl.dev/"')

    expect(instructionsFile).toContain('## Sourced Context')
    expect(instructionsFile).toContain('Workflow hints: Scrape pages | Map large docs sites')
    expect(instructionsFile).toContain('Setup hints: Use onlyMainContent when you want cleaner page bodies.')
    expect(instructionsFile).toContain('Auth hints: Set FIRECRAWL_API_KEY before calling hosted scraping flows.')
    expect(instructionsFile).toContain('Warnings: Deep MCP docs pages are often best paired with the broader docs root.')
  })

  it('derives product-facing fallback metadata when MCP metadata is generic', async () => {
    await writeMcpScaffold({
      rootDir: TEST_DIR,
      pluginName: 'agent-mail',
      authorName: 'Orchid Automation',
      targets: ['codex'],
      source: {
        transport: 'http',
        url: 'https://mcp.agentmail.dev/',
      },
      introspection: {
        ...introspection,
        serverInfo: {
          name: 'agent-mail',
          description: 'Generated from the agent-mail MCP server.',
        },
      },
    })

    const config = readFileSync(resolve(TEST_DIR, 'pluxx.config.ts'), 'utf-8')
    const instructionsFile = readFileSync(resolve(TEST_DIR, 'INSTRUCTIONS.md'), 'utf-8')

    expect(config).toContain('displayName: "Agent Mail"')
    expect(config).toContain('shortDescription: "Agent Mail plugin scaffold')
    expect(config).toContain('description: "Agent Mail plugin scaffold')
    expect(config).not.toContain('Generated from the agent-mail MCP server.')
    expect(instructionsFile).toContain('# Agent Mail')
    expect(instructionsFile).toContain('Agent Mail plugin scaffold')
    expect(instructionsFile).not.toContain('Generated from the agent-mail MCP server.')
  })

  it('generates natural example requests for MCP tools with chained action names', async () => {
    const agentMailIntrospection: IntrospectedMcpServer = {
      ...introspection,
      tools: [
        {
          name: 'CreateInbox',
          description: 'Create a new inbox for outgoing campaigns.',
          inputSchema: {
            type: 'object',
            properties: {
              name: { type: 'string' },
            },
            required: ['name'],
          },
        },
        {
          name: 'FindSendMessage',
          description: 'Find queued messages to send from an inbox.',
          inputSchema: {
            type: 'object',
            properties: {
              inboxId: { type: 'string' },
            },
            required: ['inboxId'],
          },
        },
      ],
    }

    await writeMcpScaffold({
      rootDir: TEST_DIR,
      pluginName: 'agentmail',
      authorName: 'AgentMail',
      displayName: 'AgentMail',
      skillGrouping: 'tool',
      hookMode: 'none',
      targets: ['codex'],
      source: {
        transport: 'http',
        url: 'https://mcp.agentmail.dev/mcp',
      },
      introspection: agentMailIntrospection,
    })

    const createInboxSkill = readFileSync(resolve(TEST_DIR, 'skills/create-inbox/SKILL.md'), 'utf-8')
    const findSendMessageSkill = readFileSync(resolve(TEST_DIR, 'skills/find-send-message/SKILL.md'), 'utf-8')

    expect(createInboxSkill).toContain('"Create a new inbox with <name>."')
    expect(findSendMessageSkill).toContain('"Find messages using <inboxId>."')
    expect(findSendMessageSkill).not.toContain('"Find send message using <inboxId>."')
  })

  it('generates mutation confirmation hooks when safe mode detects mutating tools', async () => {
    const mutatingIntrospection: IntrospectedMcpServer = {
      ...introspection,
      tools: [
        ...introspection.tools,
        { name: 'createIssue', description: 'Create a new issue.' },
        { name: 'delete_record', description: 'Delete a record by ID.' },
        { name: 'update-contact', description: 'Update an existing contact.' },
      ],
    }

    const result = await writeMcpScaffold({
      rootDir: TEST_DIR,
      pluginName: 'test-mcp',
      authorName: 'Test Author',
      targets: ['claude-code'],
      source: { transport: 'http', url: 'https://mcp.example.com/' },
      introspection: mutatingIntrospection,
      hookMode: 'safe',
    })

    expect(result.generatedFiles).toContain('scripts/confirm-mutation.sh')
    expect(result.generatedHookEvents).toContain('preToolUse')

    const confirmScript = readFileSync(resolve(TEST_DIR, 'scripts/confirm-mutation.sh'), 'utf-8')
    expect(confirmScript).toContain(JSON.stringify([
      'createIssue',
      'delete_record',
      'update-contact',
    ]))
    expect(confirmScript).toContain('pluxx: This tool modifies data')

    const config = readFileSync(resolve(TEST_DIR, 'pluxx.config.ts'), 'utf-8')
    expect(config).toContain('preToolUse')
    expect(config).toContain('confirm-mutation.sh')
    expect(config).toContain('matcher: "mcp__sumble__createIssue"')
    expect(config).toContain('matcher: "mcp__sumble__delete_record"')
    expect(config).toContain('matcher: "mcp__sumble__update-contact"')
    expect(config).not.toContain('matcher: "mcp__sumble"')
  })

  it('filters invalid shell env names from generated safe hook scripts', async () => {
    const result = await writeMcpScaffold({
      rootDir: TEST_DIR,
      pluginName: 'test-mcp',
      authorName: 'Test Author',
      targets: ['claude-code'],
      source: {
        transport: 'stdio',
        command: 'npx',
        args: ['-y', '@sumble/mcp'],
        env: {
          SAFE_KEY: '1',
          'BAD-NAME\nrm -rf /': '2',
        },
        auth: {
          type: 'bearer',
          envVar: 'ALSO BAD\nNAME',
        },
      },
      introspection,
      hookMode: 'safe',
    })

    expect(result.generatedFiles).toContain('scripts/check-env.sh')

    const envScript = readFileSync(resolve(TEST_DIR, 'scripts/check-env.sh'), 'utf-8')
    expect(envScript).toContain('SAFE_KEY')
    expect(envScript).not.toContain('BAD-NAME')
    expect(envScript).not.toContain('ALSO BAD')
  })

  it('sanitizes dangerous tool names in generated confirmation scripts', async () => {
    const dangerousTool = 'createIssue\nrm -rf /'
    const mutatingIntrospection: IntrospectedMcpServer = {
      ...introspection,
      tools: [
        ...introspection.tools,
        { name: dangerousTool, description: 'Create an issue.' },
      ],
    }

    await writeMcpScaffold({
      rootDir: TEST_DIR,
      pluginName: 'test-mcp',
      authorName: 'Test Author',
      targets: ['claude-code'],
      source: { transport: 'http', url: 'https://mcp.example.com/' },
      introspection: mutatingIntrospection,
      hookMode: 'safe',
    })

    const confirmScript = readFileSync(resolve(TEST_DIR, 'scripts/confirm-mutation.sh'), 'utf-8')
    expect(confirmScript).toContain(JSON.stringify(['createIssue rm -rf /']))
    expect(confirmScript).not.toContain(dangerousTool)
  })
})

describe('detectMutatingTools', () => {
  it('detects camelCase mutating tool names', () => {
    const tools = [
      { name: 'createIssue', description: 'Create an issue.' },
      { name: 'getIssue', description: 'Get an issue.' },
      { name: 'updateRecord', description: 'Update a record.' },
      { name: 'deleteUser', description: 'Delete a user.' },
    ]
    expect(detectMutatingTools(tools)).toEqual(['createIssue', 'updateRecord', 'deleteUser'])
  })

  it('detects snake_case mutating tool names', () => {
    const tools = [
      { name: 'add_contact', description: 'Add a contact.' },
      { name: 'list_contacts', description: 'List all contacts.' },
      { name: 'remove_contact', description: 'Remove a contact.' },
      { name: 'insert_row', description: 'Insert a row.' },
    ]
    expect(detectMutatingTools(tools)).toEqual(['add_contact', 'remove_contact', 'insert_row'])
  })

  it('detects kebab-case mutating tool names', () => {
    const tools = [
      { name: 'publish-post', description: 'Publish a post.' },
      { name: 'read-post', description: 'Read a post.' },
      { name: 'send-email', description: 'Send an email.' },
    ]
    expect(detectMutatingTools(tools)).toEqual(['publish-post', 'send-email'])
  })

  it('detects bulk and destroy prefixes', () => {
    const tools = [
      { name: 'bulk_import', description: 'Bulk import records.' },
      { name: 'destroy_session', description: 'Destroy a session.' },
      { name: 'drop_table', description: 'Drop a table.' },
      { name: 'purge_cache', description: 'Purge cache.' },
    ]
    expect(detectMutatingTools(tools)).toEqual(['bulk_import', 'destroy_session', 'drop_table', 'purge_cache'])
  })

  it('returns empty array when no tools match', () => {
    const tools = [
      { name: 'getUser', description: 'Get user.' },
      { name: 'list_items', description: 'List items.' },
      { name: 'search-docs', description: 'Search docs.' },
    ]
    expect(detectMutatingTools(tools)).toEqual([])
  })

  it('returns empty array for empty input', () => {
    expect(detectMutatingTools([])).toEqual([])
  })
})
