import { mkdir } from 'fs/promises'
import { basename, resolve } from 'path'
import type { McpServer, TargetPlatform } from '../schema'
import type { IntrospectedMcpServer, IntrospectedMcpTool } from '../mcp/introspect'

export interface McpScaffoldOptions {
  rootDir: string
  pluginName: string
  authorName: string
  targets: TargetPlatform[]
  source: McpServer
  introspection: IntrospectedMcpServer
  serverName?: string
  displayName?: string
  description?: string
}

export interface McpScaffoldResult {
  instructionsPath: string
  skillDirectories: string[]
}

interface PlannedSkill {
  dirName: string
  title: string
  description: string
  tools: IntrospectedMcpTool[]
}

interface SchemaField {
  name: string
  type: string
  required: boolean
  description?: string
}

const WORKFLOW_SKILL_DEFINITIONS = [
  {
    key: 'account-research',
    title: 'Account Research',
    description: 'Research companies, organizations, and account context before taking action.',
    match: ['organization', 'organisation', 'company', 'account', 'firmographic'],
  },
  {
    key: 'contact-discovery',
    title: 'Contact Discovery',
    description: 'Find people, contacts, and buyer-side context at the right accounts.',
    match: ['people', 'person', 'contact', 'buyer', 'prospect', 'lead'],
  },
  {
    key: 'hiring-signals',
    title: 'Hiring Signals',
    description: 'Use hiring activity and open roles as timing signals for outreach and research.',
    match: ['job', 'jobs', 'hiring', 'hire', 'role', 'roles', 'recruit', 'career'],
  },
  {
    key: 'technographics',
    title: 'Technographics',
    description: 'Research technologies, tools, and stack adoption across target accounts.',
    match: ['technology', 'technologies', 'tech', 'stack', 'tooling', 'software'],
  },
  {
    key: 'list-management',
    title: 'List Management',
    description: 'Manage lists, segments, and saved collections of accounts or contacts.',
    match: ['list', 'lists', 'segment', 'segments', 'audience', 'audiences', 'collection'],
  },
  {
    key: 'enrichment',
    title: 'Enrichment',
    description: 'Enrich known records with additional context before deciding on next steps.',
    match: ['enrich', 'enrichment', 'append', 'profile'],
  },
  {
    key: 'general-research',
    title: 'General Research',
    description: 'Handle broad search and query workflows when there is not a more specific skill match.',
    match: ['search', 'query', 'lookup', 'look up', 'discover', 'find'],
  },
] as const

export function parseMcpSourceInput(input: string): McpServer {
  const value = input.trim()
  if (!value) {
    throw new Error('Expected an MCP server URL or a local command.')
  }

  try {
    const url = new URL(value)
    if (url.protocol === 'http:' || url.protocol === 'https:') {
      return {
        transport: 'http',
        url: url.toString(),
      }
    }
  } catch {
    // Not a URL, treat it as a stdio command.
  }

  const parts = splitCommandString(value)
  if (parts.length === 0) {
    throw new Error('Expected an MCP server URL or a local command.')
  }

  return {
    transport: 'stdio',
    command: parts[0],
    args: parts.slice(1),
  }
}

export async function writeMcpScaffold(options: McpScaffoldOptions): Promise<McpScaffoldResult> {
  const pluginName = toKebabCase(options.pluginName) || 'mcp-plugin'
  const displayName = options.displayName
    ?? options.introspection.serverInfo.title
    ?? humanizeName(pluginName)
  const description = options.description
    ?? options.introspection.serverInfo.description
    ?? `Generated from the ${displayName} MCP server.`
  const serverName = options.serverName
    ?? toKebabCase(options.introspection.serverInfo.name)
    ?? pluginName

  const instructionsPath = resolve(options.rootDir, 'INSTRUCTIONS.md')
  const skillRoot = resolve(options.rootDir, 'skills')
  const plannedSkills = planSkillScaffolds(options.introspection.tools)
  const skillDirectories: string[] = []

  await Bun.write(
    resolve(options.rootDir, 'pluxx.config.ts'),
    buildConfigTemplate({
      pluginName,
      authorName: options.authorName,
      description,
      displayName,
      serverName,
      source: options.source,
      websiteUrl: options.introspection.serverInfo.websiteUrl,
      targets: options.targets,
    }),
  )

  await Bun.write(
    instructionsPath,
    buildInstructionsContent({
      displayName,
      description,
      serverName,
      instructions: options.introspection.instructions,
      skills: plannedSkills,
      tools: options.introspection.tools,
    }),
  )

  await mkdir(skillRoot, { recursive: true })

  for (const skill of plannedSkills) {
    const toolDir = resolve(skillRoot, skill.dirName)
    await mkdir(toolDir, { recursive: true })
    await Bun.write(resolve(toolDir, 'SKILL.md'), buildSkillContent(skill))
    skillDirectories.push(`skills/${skill.dirName}`)
  }

  return {
    instructionsPath: './INSTRUCTIONS.md',
    skillDirectories,
  }
}

export function buildSkillContent(skill: PlannedSkill): string {
  const description = truncate(skill.description, 220)

  const lines = [
    '---',
    `name: ${JSON.stringify(skill.dirName)}`,
    `description: ${JSON.stringify(description)}`,
    'version: 0.1.0',
    '---',
    '',
    `# ${skill.title}`,
    '',
    skill.description,
    '',
    '## Tools In This Skill',
    '',
  ]

  for (const tool of skill.tools) {
    lines.push(`### \`${tool.name}\``)
    lines.push('')
    lines.push(tool.description ?? `Calls \`${tool.name}\` on the configured MCP server.`)
    lines.push('')

    const fields = getTopLevelSchemaFields(tool.inputSchema)
    if (fields.length > 0) {
      lines.push('Inputs:')
      for (const field of fields) {
        const required = field.required ? ', required' : ''
        const detail = field.description ? `: ${field.description}` : ''
        lines.push(`- \`${field.name}\` (${field.type}${required})${detail}`)
      }
      lines.push('')
    }
  }

  lines.push(
    '## Usage',
    '',
    '- Pick the most specific tool in this skill for the user request.',
    '- Gather required inputs before calling a tool.',
    '- Summarize the returned data clearly instead of dumping raw JSON unless the user asks for it.',
    '',
    '## Example',
    '',
    '```',
    `Use the ${skill.title} skill to help with this request.`,
    '```',
    '',
  )

  return lines.join('\n')
}

export function buildInstructionsContent(input: {
  displayName: string
  description: string
  serverName: string
  instructions?: string
  skills: PlannedSkill[]
  tools: IntrospectedMcpTool[]
}): string {
  const lines = [
    `# ${input.displayName}`,
    '',
    input.description,
    '',
    `This plugin connects to the \`${input.serverName}\` MCP server.`,
    '',
    '## Available Tools',
    '',
  ]

  for (const tool of input.tools) {
    lines.push(`- \`${tool.name}\`: ${tool.description ?? 'No description provided.'}`)
  }

  lines.push(
    '',
    '## Generated Skills',
    '',
  )

  for (const skill of input.skills) {
    const toolNames = skill.tools.map((tool) => `\`${tool.name}\``).join(', ')
    lines.push(`- \`${skill.dirName}\`: ${skill.description} Tools: ${toolNames}.`)
  }

  lines.push(
    '',
    '## Operating Notes',
    '',
    '- Prefer the most specific tool that matches the user request.',
    '- Confirm required inputs before calling a tool.',
    '- Summarize returned data instead of dumping raw JSON unless the user asks for it.',
  )

  if (input.instructions) {
    lines.push('', '## Server Guidance', '', input.instructions.trim())
  }

  lines.push('')
  return lines.join('\n')
}

export function buildConfigTemplate(input: {
  pluginName: string
  authorName: string
  description: string
  displayName: string
  serverName: string
  source: McpServer
  websiteUrl?: string
  targets: TargetPlatform[]
}): string {
  const targets = input.targets.map((target) => JSON.stringify(target)).join(', ')
  const mcpBlock = buildMcpBlock(input.serverName, input.source)
  const brandFields = [
    `displayName: ${JSON.stringify(input.displayName)}`,
    input.websiteUrl ? `websiteURL: ${JSON.stringify(input.websiteUrl)}` : null,
  ].filter(Boolean).join(',\n    ')

  return `import { definePlugin } from 'pluxx'

export default definePlugin({
  name: ${JSON.stringify(input.pluginName)},
  version: '0.1.0',
  description: ${JSON.stringify(input.description)},
  author: {
    name: ${JSON.stringify(input.authorName)},
  },
  license: 'MIT',

  skills: './skills/',
  instructions: './INSTRUCTIONS.md',

  mcp: {
${mcpBlock}
  },

  brand: {
    ${brandFields}
  },

  targets: [${targets}],
})
`
}

function buildMcpBlock(serverName: string, source: McpServer): string {
  if (source.transport === 'stdio') {
    const argsLine = source.args && source.args.length > 0
      ? `,\n      args: ${JSON.stringify(source.args)}`
      : ''
    const envLine = source.env && Object.keys(source.env).length > 0
      ? `,\n      env: ${JSON.stringify(source.env, null, 6).replace(/\n/g, '\n      ')}`
      : ''

    return `    ${JSON.stringify(serverName)}: {
      transport: 'stdio',
      command: ${JSON.stringify(source.command)}${argsLine}${envLine}
    },`
  }

  const authLine = source.auth && source.auth.type !== 'none'
    ? `,\n      auth: {\n        type: ${JSON.stringify(source.auth.type)},\n        envVar: ${JSON.stringify(source.auth.envVar)}${source.auth.type === 'header'
          ? `,\n        headerName: ${JSON.stringify(source.auth.headerName)},\n        headerTemplate: ${JSON.stringify(source.auth.headerTemplate)}`
          : ''}\n      }`
    : ''
  const transportLine = source.transport === 'sse'
    ? `\n      transport: 'sse',`
    : ''

  return `    ${JSON.stringify(serverName)}: {${transportLine}
      url: ${JSON.stringify(source.url)}${authLine}
    },`
}

export function planSkillScaffolds(tools: IntrospectedMcpTool[]): PlannedSkill[] {
  const categoryBuckets = new Map<string, IntrospectedMcpTool[]>()
  const standaloneTools: IntrospectedMcpTool[] = []

  for (const tool of tools) {
    const category = classifyToolWorkflow(tool)
    if (!category) {
      standaloneTools.push(tool)
      continue
    }

    const bucket = categoryBuckets.get(category) ?? []
    bucket.push(tool)
    categoryBuckets.set(category, bucket)
  }

  const plannedSkills: PlannedSkill[] = []

  for (const definition of WORKFLOW_SKILL_DEFINITIONS) {
    const bucket = categoryBuckets.get(definition.key)
    if (!bucket || bucket.length === 0) continue

    plannedSkills.push({
      dirName: definition.key,
      title: definition.title,
      description: definition.description,
      tools: bucket.sort((a, b) => a.name.localeCompare(b.name)),
    })
  }

  for (const tool of standaloneTools.sort((a, b) => a.name.localeCompare(b.name))) {
    plannedSkills.push({
      dirName: toKebabCase(tool.name) || 'tool',
      title: tool.title ?? humanizeName(tool.name),
      description: tool.description ?? `Use the \`${tool.name}\` MCP tool for this workflow.`,
      tools: [tool],
    })
  }

  return allocateSkillDirectoryNames(plannedSkills)
}

function allocateSkillDirectoryNames(skills: PlannedSkill[]): PlannedSkill[] {
  const used = new Set<string>()

  return skills.map((skill) => {
    const base = toKebabCase(skill.dirName) || 'skill'
    let candidate = base
    let suffix = 2

    while (used.has(candidate)) {
      candidate = `${base}-${suffix}`
      suffix += 1
    }

    used.add(candidate)
    return {
      ...skill,
      dirName: candidate,
    }
  })
}

function classifyToolWorkflow(tool: IntrospectedMcpTool): string | null {
  const primaryText = [
    normalizeIdentifier(tool.name).toLowerCase(),
    normalizeIdentifier(tool.title ?? '').toLowerCase(),
  ].join(' ')
  const secondaryText = (tool.description ?? '').toLowerCase()

  let bestMatch: string | null = null
  let bestScore = 0

  for (const definition of WORKFLOW_SKILL_DEFINITIONS) {
    let score = 0

    for (const needle of definition.match) {
      if (primaryText.includes(needle)) {
        score += 3
      }
      if (secondaryText.includes(needle)) {
        score += 1
      }
    }

    if (score > bestScore) {
      bestScore = score
      bestMatch = definition.key
    }
  }

  return bestMatch
}

function getTopLevelSchemaFields(inputSchema?: Record<string, unknown>): SchemaField[] {
  if (!inputSchema) return []

  const rawProperties = inputSchema.properties
  if (!rawProperties || typeof rawProperties !== 'object') {
    return []
  }

  const required = new Set(
    Array.isArray(inputSchema.required)
      ? inputSchema.required.filter((value): value is string => typeof value === 'string')
      : [],
  )

  return Object.entries(rawProperties).map(([name, value]) => {
    const schema = typeof value === 'object' && value !== null ? value as Record<string, unknown> : {}
    return {
      name,
      type: formatSchemaType(schema.type),
      required: required.has(name),
      description: typeof schema.description === 'string' ? schema.description : undefined,
    }
  })
}

function formatSchemaType(value: unknown): string {
  if (typeof value === 'string') return value
  if (Array.isArray(value)) {
    const parts = value.filter((entry): entry is string => typeof entry === 'string')
    if (parts.length > 0) return parts.join(' | ')
  }
  return 'unknown'
}

function humanizeName(value: string): string {
  return normalizeIdentifier(value)
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function toKebabCase(value: string): string {
  return normalizeIdentifier(value)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function normalizeIdentifier(value: string): string {
  return value
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .replace(/[._/]+/g, ' ')
    .replace(/-/g, ' ')
}

function truncate(value: string, maxLength: number): string {
  if (value.length <= maxLength) return value
  return `${value.slice(0, maxLength - 1).trimEnd()}…`
}

function splitCommandString(command: string): string[] {
  const parts: string[] = []
  let current = ''
  let quote: '"' | "'" | null = null
  let escaping = false

  for (const char of command) {
    if (escaping) {
      current += char
      escaping = false
      continue
    }

    if (char === '\\') {
      escaping = true
      continue
    }

    if (quote) {
      if (char === quote) {
        quote = null
      } else {
        current += char
      }
      continue
    }

    if (char === '"' || char === "'") {
      quote = char
      continue
    }

    if (/\s/.test(char)) {
      if (current) {
        parts.push(current)
        current = ''
      }
      continue
    }

    current += char
  }

  if (quote) {
    throw new Error('Unterminated quote in MCP command.')
  }

  if (escaping) {
    current += '\\'
  }

  if (current) {
    parts.push(current)
  }

  return parts
}

export function derivePluginName(introspection: IntrospectedMcpServer, source: McpServer): string {
  const candidates = [
    introspection.serverInfo.name,
    introspection.serverInfo.title,
    source.transport === 'stdio' ? basename(source.command) : new URL(source.url).hostname.split('.')[0],
  ].filter((value): value is string => Boolean(value))

  for (const candidate of candidates) {
    const normalized = toKebabCase(candidate)
    if (normalized) return normalized
  }

  return 'mcp-plugin'
}
