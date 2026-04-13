import { existsSync } from 'fs'
import { mkdir } from 'fs/promises'
import { basename, resolve } from 'path'
import type { HookEntry, McpServer, TargetPlatform } from '../schema'
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
  skillGrouping?: McpSkillGrouping
  hookMode?: McpHookMode
}

export interface McpScaffoldResult {
  instructionsPath: string
  skillDirectories: string[]
  generatedFiles: string[]
  generatedHookMode: McpHookMode
  generatedHookEvents: string[]
  metadataPath: string
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

export const MCP_SKILL_GROUPINGS = ['workflow', 'tool'] as const
export type McpSkillGrouping = typeof MCP_SKILL_GROUPINGS[number]

export const MCP_HOOK_MODES = ['none', 'safe'] as const
export type McpHookMode = typeof MCP_HOOK_MODES[number]

interface GeneratedHookScaffold {
  mode: McpHookMode
  scriptsPath?: string
  hookEntries?: Record<string, HookEntry[]>
  files: Array<{ relativePath: string; content: string }>
}

export interface McpScaffoldMetadata {
  version: 1
  source: McpServer
  serverInfo: IntrospectedMcpServer['serverInfo']
  settings: {
    pluginName: string
    displayName: string
    skillGrouping: McpSkillGrouping
    requestedHookMode: McpHookMode
    generatedHookMode: McpHookMode
    generatedHookEvents: string[]
  }
  tools: IntrospectedMcpTool[]
  skills: Array<{
    dirName: string
    title: string
    toolNames: string[]
  }>
  managedFiles: string[]
}

export const MCP_SCAFFOLD_METADATA_PATH = '.pluxx/mcp.json'
export const PLUXX_GENERATED_START = '<!-- pluxx:generated:start -->'
export const PLUXX_GENERATED_END = '<!-- pluxx:generated:end -->'
export const PLUXX_CUSTOM_START = '<!-- pluxx:custom:start -->'
export const PLUXX_CUSTOM_END = '<!-- pluxx:custom:end -->'

const DEFAULT_INSTRUCTIONS_CUSTOM_CONTENT = 'Add custom plugin instructions here. This section is preserved across `pluxx sync --from-mcp`.'
const DEFAULT_SKILL_CUSTOM_CONTENT = 'Add custom guidance, examples, or caveats here. This section is preserved across `pluxx sync --from-mcp`.'
const LEGACY_MIXED_CONTENT_NOTE = 'Migrated from a previous unstructured scaffold. Review and trim this section as needed.'

interface MixedMarkdownContent {
  hasMarkers: boolean
  customContent: string
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
  const plannedSkills = planSkillScaffolds(options.introspection.tools, options.skillGrouping)
  const skillDirectories: string[] = []
  const generatedFiles = ['pluxx.config.ts', './INSTRUCTIONS.md']
  const generatedHooks = planGeneratedHooks(options.source, options.hookMode)
  const metadataPath = MCP_SCAFFOLD_METADATA_PATH

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
      hooks: generatedHooks.hookEntries,
      scriptsPath: generatedHooks.scriptsPath,
    }),
  )

  await Bun.write(
    instructionsPath,
    wrapManagedMarkdown(
      buildInstructionsContent({
        displayName,
        description,
        serverName,
        instructions: options.introspection.instructions,
        skills: plannedSkills,
        tools: options.introspection.tools,
      }),
      existsSync(instructionsPath) ? await Bun.file(instructionsPath).text() : undefined,
      {
        customHeading: '## Custom Instructions',
        defaultCustomContent: DEFAULT_INSTRUCTIONS_CUSTOM_CONTENT,
      },
    ),
  )

  await mkdir(skillRoot, { recursive: true })

  for (const skill of plannedSkills) {
    const toolDir = resolve(skillRoot, skill.dirName)
    await mkdir(toolDir, { recursive: true })
    const skillPath = resolve(toolDir, 'SKILL.md')
    await Bun.write(
      skillPath,
      wrapManagedMarkdown(
        buildSkillContent(skill),
        existsSync(skillPath) ? await Bun.file(skillPath).text() : undefined,
        {
          customHeading: '## Custom Notes',
          defaultCustomContent: DEFAULT_SKILL_CUSTOM_CONTENT,
        },
      ),
    )
    const relativeSkillPath = `skills/${skill.dirName}`
    skillDirectories.push(relativeSkillPath)
    generatedFiles.push(`${relativeSkillPath}/SKILL.md`)
  }

  for (const file of generatedHooks.files) {
    const filePath = resolve(options.rootDir, file.relativePath)
    const parentDir = file.relativePath.split('/').slice(0, -1).join('/')
    if (parentDir) {
      await mkdir(resolve(options.rootDir, parentDir), { recursive: true })
    }
    await Bun.write(filePath, file.content)
    generatedFiles.push(file.relativePath)
  }

  await mkdir(resolve(options.rootDir, '.pluxx'), { recursive: true })
  const metadata = buildMcpScaffoldMetadata({
    source: options.source,
    introspection: options.introspection,
    pluginName,
    displayName,
    skillGrouping: options.skillGrouping ?? 'workflow',
    requestedHookMode: options.hookMode ?? 'none',
    generatedHookMode: generatedHooks.mode,
    generatedHookEvents: Object.keys(generatedHooks.hookEntries ?? {}),
    plannedSkills,
    managedFiles: [...generatedFiles, metadataPath],
  })
  await Bun.write(resolve(options.rootDir, metadataPath), `${JSON.stringify(metadata, null, 2)}\n`)
  generatedFiles.push(metadataPath)

  return {
    instructionsPath: './INSTRUCTIONS.md',
    skillDirectories,
    generatedFiles,
    generatedHookMode: generatedHooks.mode,
    generatedHookEvents: Object.keys(generatedHooks.hookEntries ?? {}),
    metadataPath,
  }
}

export function wrapManagedMarkdown(
  generatedContent: string,
  existingContent: string | undefined,
  options: {
    customHeading: string
    defaultCustomContent: string
  },
): string {
  const mixedContent = extractMixedMarkdownContent(existingContent, options.defaultCustomContent)
  const customContent = mixedContent.customContent.trim() || options.defaultCustomContent

  return [
    PLUXX_GENERATED_START,
    generatedContent.trim(),
    PLUXX_GENERATED_END,
    '',
    options.customHeading,
    '',
    PLUXX_CUSTOM_START,
    customContent,
    PLUXX_CUSTOM_END,
    '',
  ].join('\n')
}

export function extractMixedMarkdownContent(
  content: string | undefined,
  defaultCustomContent: string,
): MixedMarkdownContent {
  if (!content) {
    return {
      hasMarkers: false,
      customContent: defaultCustomContent,
    }
  }

  const customStart = content.indexOf(PLUXX_CUSTOM_START)
  const customEnd = content.indexOf(PLUXX_CUSTOM_END)

  if (customStart !== -1 && customEnd !== -1 && customEnd > customStart) {
    const customContent = content
      .slice(customStart + PLUXX_CUSTOM_START.length, customEnd)
      .trim()

    return {
      hasMarkers: true,
      customContent: customContent || defaultCustomContent,
    }
  }

  const trimmed = content.trim()
  return {
    hasMarkers: false,
    customContent: trimmed
      ? `${LEGACY_MIXED_CONTENT_NOTE}\n\n${trimmed}`
      : defaultCustomContent,
  }
}

export function hasMeaningfulCustomContent(content: string | undefined): boolean {
  if (!content) return false

  const extracted = extractMixedMarkdownContent(content, DEFAULT_INSTRUCTIONS_CUSTOM_CONTENT)
  const normalized = extracted.customContent.trim()

  return normalized !== '' && normalized !== DEFAULT_INSTRUCTIONS_CUSTOM_CONTENT && normalized !== DEFAULT_SKILL_CUSTOM_CONTENT
}

export function buildSkillContent(skill: PlannedSkill): string {
  const description = truncate(skill.description, 220)
  const exampleRequests = skill.tools
    .map((tool) => buildToolExampleRequest(tool))
    .filter((example, index, values) => values.indexOf(example) === index)

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
    '## Example Requests',
    '',
  )

  for (const example of exampleRequests) {
    lines.push(`- "${example}"`)
  }

  lines.push(
    '',
    '## Usage',
    '',
    '- Pick the most specific tool in this skill for the user request.',
    '- Gather required inputs before calling a tool.',
    '- Summarize the returned data clearly instead of dumping raw JSON unless the user asks for it.',
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
  hooks?: Record<string, HookEntry[]>
  scriptsPath?: string
}): string {
  const targets = input.targets.map((target) => JSON.stringify(target)).join(', ')
  const mcpBlock = buildMcpBlock(input.serverName, input.source)
  const brandFields = [
    `displayName: ${JSON.stringify(input.displayName)}`,
    input.websiteUrl ? `websiteURL: ${JSON.stringify(input.websiteUrl)}` : null,
  ].filter(Boolean).join(',\n    ')
  const scriptsBlock = input.scriptsPath ? `  scripts: ${JSON.stringify(input.scriptsPath)},\n` : ''
  const hooksBlock = input.hooks ? `\n  hooks: ${serializeHooks(input.hooks)},\n` : ''

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
${scriptsBlock}

  mcp: {
${mcpBlock}
  },
${hooksBlock}

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

function serializeHooks(hooks: Record<string, HookEntry[]>): string {
  const entries = Object.entries(hooks)
    .map(([event, hookEntries]) => {
      const serializedEntries = hookEntries
        .map((entry) => {
          const fields = [
            entry.type && entry.type !== 'command' ? `type: ${JSON.stringify(entry.type)}` : null,
            entry.command ? `command: ${JSON.stringify(entry.command)}` : null,
            entry.prompt ? `prompt: ${JSON.stringify(entry.prompt)}` : null,
            entry.model ? `model: ${JSON.stringify(entry.model)}` : null,
            entry.timeout !== undefined ? `timeout: ${entry.timeout}` : null,
            entry.matcher ? `matcher: ${JSON.stringify(entry.matcher)}` : null,
            entry.failClosed !== undefined ? `failClosed: ${entry.failClosed}` : null,
            entry.loop_limit !== undefined ? `loop_limit: ${entry.loop_limit}` : null,
          ].filter(Boolean)

          return `      {\n        ${fields.join(',\n        ')}\n      }`
        })
        .join(',\n')

      return `    ${event}: [\n${serializedEntries}\n    ]`
    })
    .join(',\n')

  return `{\n${entries}\n  }`
}

function planGeneratedHooks(source: McpServer, hookMode: McpHookMode = 'none'): GeneratedHookScaffold {
  if (hookMode !== 'safe') {
    return { mode: 'none', files: [] }
  }

  const envVars = collectRequiredEnvVars(source)
  if (envVars.length === 0) {
    return { mode: 'none', files: [] }
  }

  return {
    mode: 'safe',
    scriptsPath: './scripts/',
    hookEntries: {
      sessionStart: [{
        type: 'command',
        command: 'bash "${PLUGIN_ROOT}/scripts/check-env.sh"',
      }],
    },
    files: [{
      relativePath: 'scripts/check-env.sh',
      content: buildEnvValidationScript(envVars),
    }],
  }
}

function collectRequiredEnvVars(source: McpServer): string[] {
  const envVars = new Set<string>()

  if (source.auth?.type && source.auth.type !== 'none') {
    envVars.add(source.auth.envVar)
  }

  if (source.transport === 'stdio') {
    for (const key of Object.keys(source.env ?? {})) {
      envVars.add(key)
    }
  }

  return [...envVars]
}

function buildEnvValidationScript(envVars: string[]): string {
  const checks = envVars
    .map((envVar) => `if [ -z "\${${envVar}:-}" ]; then
  echo "pluxx: ${envVar} is not set. Export it before using this plugin." >&2
  exit 1
fi`)
    .join('\n\n')

  return `#!/usr/bin/env bash
set -euo pipefail

${checks}
`
}

function buildMcpScaffoldMetadata(input: {
  source: McpServer
  introspection: IntrospectedMcpServer
  pluginName: string
  displayName: string
  skillGrouping: McpSkillGrouping
  requestedHookMode: McpHookMode
  generatedHookMode: McpHookMode
  generatedHookEvents: string[]
  plannedSkills: PlannedSkill[]
  managedFiles: string[]
}): McpScaffoldMetadata {
  return {
    version: 1,
    source: input.source,
    serverInfo: input.introspection.serverInfo,
    settings: {
      pluginName: input.pluginName,
      displayName: input.displayName,
      skillGrouping: input.skillGrouping,
      requestedHookMode: input.requestedHookMode,
      generatedHookMode: input.generatedHookMode,
      generatedHookEvents: input.generatedHookEvents,
    },
    tools: input.introspection.tools,
    skills: input.plannedSkills.map((skill) => ({
      dirName: skill.dirName,
      title: skill.title,
      toolNames: skill.tools.map((tool) => tool.name),
    })),
    managedFiles: input.managedFiles,
  }
}

export function planSkillScaffolds(
  tools: IntrospectedMcpTool[],
  grouping: McpSkillGrouping = 'workflow',
): PlannedSkill[] {
  if (grouping === 'tool') {
    return allocateSkillDirectoryNames(
      tools
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((tool) => ({
          dirName: toKebabCase(tool.name) || 'tool',
          title: tool.title ?? humanizeName(tool.name),
          description: tool.description ?? `Use the \`${tool.name}\` MCP tool for this workflow.`,
          tools: [tool],
        })),
    )
  }

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

export function buildToolExampleRequest(tool: IntrospectedMcpTool): string {
  const action = inferToolAction(tool)
  const objectLabel = inferToolObject(tool)
  const context = buildToolRequestContext(tool)

  const sentence = context
    ? `${action} ${objectLabel} ${context}.`
    : `${action} ${objectLabel}.`

  return sentence.charAt(0).toUpperCase() + sentence.slice(1)
}

function inferToolAction(tool: IntrospectedMcpTool): string {
  const identifier = normalizeIdentifier(tool.title ?? tool.name).toLowerCase()

  if (/^(get|fetch|lookup|look up)\b/.test(identifier)) return 'look up'
  if (/^(create|add)\b/.test(identifier)) return 'create'
  if (/^(update|edit)\b/.test(identifier)) return 'update'
  if (/^(delete|remove)\b/.test(identifier)) return 'delete'
  if (/^(list)\b/.test(identifier)) return 'list'
  if (/^(query)\b/.test(identifier)) return 'query'
  if (/^(search)\b/.test(identifier)) return 'search'
  return 'find'
}

function inferToolObject(tool: IntrospectedMcpTool): string {
  const raw = normalizeIdentifier(tool.title ?? tool.name).trim()
  const stripped = raw.replace(/^(find|get|fetch|lookup|look up|search|list|create|add|update|edit|delete|remove|query)\s+/i, '')
  const candidate = stripped || raw
  return candidate ? candidate.toLowerCase() : 'results'
}

function buildToolRequestContext(tool: IntrospectedMcpTool): string {
  const requiredFields = getTopLevelSchemaFields(tool.inputSchema).filter((field) => field.required)
  const preferredField = requiredFields[0]

  if (!preferredField) return ''

  const placeholder = `<${preferredField.name}>`
  const fieldName = preferredField.name.toLowerCase()

  if (fieldName.endsWith('id') || fieldName === 'id') {
    return `using ${placeholder}`
  }

  if (fieldName.includes('query') || fieldName.includes('keyword') || fieldName.includes('search')) {
    return `matching ${placeholder}`
  }

  if (fieldName.includes('role') || fieldName.includes('title')) {
    return `for ${placeholder}`
  }

  if (fieldName.includes('company') || fieldName.includes('organization') || fieldName.includes('organisation') || fieldName.includes('account')) {
    return `for ${placeholder}`
  }

  if (fieldName.includes('domain') || fieldName.includes('email') || fieldName.includes('url')) {
    return `using ${placeholder}`
  }

  return `with ${placeholder}`
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
