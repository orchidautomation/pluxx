import { existsSync } from 'fs'
import { mkdir } from 'fs/promises'
import { basename, resolve } from 'path'
import type { HookEntry, McpServer, PluginConfig, TargetPlatform, UserConfigEntry } from '../schema'
import type {
  IntrospectedMcpPrompt,
  IntrospectedMcpResource,
  IntrospectedMcpResourceTemplate,
  IntrospectedMcpServer,
  IntrospectedMcpTool,
} from '../mcp/introspect'
import { collectUserConfigEntries } from '../user-config'

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
  runtimeAuthMode?: McpRuntimeAuthMode
  persistedSkills?: PersistedSkill[]
  toolRenames?: Map<string, string>
}

export interface McpScaffoldResult {
  instructionsPath: string
  skillDirectories: string[]
  commandFiles: string[]
  generatedFiles: string[]
  generatedHookMode: McpHookMode
  generatedHookEvents: string[]
  metadataPath: string
}

export interface McpScaffoldPlannedFile {
  relativePath: string
  content: string
  action: 'create' | 'update' | 'unchanged'
}

export interface McpScaffoldPlan extends McpScaffoldResult {
  files: McpScaffoldPlannedFile[]
}

interface PlannedSkill {
  dirName: string
  title: string
  description: string
  tools: IntrospectedMcpTool[]
}

export interface PersistedSkill {
  dirName: string
  title: string
  description?: string
  toolNames: string[]
}

interface SchemaField {
  name: string
  type: string
  required: boolean
  description?: string
}

export type McpQualityLevel = 'warning' | 'info'

export interface McpQualityIssue {
  level: McpQualityLevel
  code: string
  title: string
  detail: string
  fix: string
}

export interface McpQualityReport {
  ok: boolean
  warnings: number
  infos: number
  issues: McpQualityIssue[]
}

export const MCP_SKILL_GROUPINGS = ['workflow', 'tool'] as const
export type McpSkillGrouping = typeof MCP_SKILL_GROUPINGS[number]

export const MCP_HOOK_MODES = ['none', 'safe'] as const
export type McpHookMode = typeof MCP_HOOK_MODES[number]
export const MCP_RUNTIME_AUTH_MODES = ['inline', 'platform'] as const
export type McpRuntimeAuthMode = typeof MCP_RUNTIME_AUTH_MODES[number]

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
    description?: string
    skillGrouping: McpSkillGrouping
    requestedHookMode: McpHookMode
    generatedHookMode: McpHookMode
    generatedHookEvents: string[]
    runtimeAuthMode: McpRuntimeAuthMode
  }
  userConfig: UserConfigEntry[]
  tools: IntrospectedMcpTool[]
  resources?: IntrospectedMcpResource[]
  resourceTemplates?: IntrospectedMcpResourceTemplate[]
  prompts?: IntrospectedMcpPrompt[]
  skills: Array<{
    dirName: string
    title: string
    description?: string
    toolNames: string[]
  }>
  managedFiles: string[]
}

export const MCP_SCAFFOLD_METADATA_PATH = '.pluxx/mcp.json'
export const MCP_TAXONOMY_PATH = '.pluxx/taxonomy.json'
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
    key: 'setup-and-auth',
    title: 'Setup and Auth',
    description: 'Confirm access, auth state, and session readiness before running operational workflows.',
    match: ['connect', 'connected', 'connection', 'status', 'auth', 'session', 'cookie', 'workspace'],
  },
  {
    key: 'workflow-design',
    title: 'Workflow Design',
    description: 'Define strategy, prompts, targeting, and workflow shape before building tables or running enrichments.',
    match: ['workflow', 'design', 'play', 'prompt', 'icp', 'persona', 'audience', 'segment', 'brainstorm', 'outreach'],
  },
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
    match: ['people', 'person', 'contact', 'prospect', 'decision maker', 'org chart'],
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
    key: 'table-operations',
    title: 'Table Operations',
    description: 'Build, inspect, run, document, and export tables, rows, and enrichment workflows.',
    match: ['table', 'tables', 'schema', 'webhook', 'row', 'rows', 'export', 'audit', 'document', 'enrich', 'view'],
  },
  {
    key: 'provider-research',
    title: 'Provider Research',
    description: 'Compare providers, integrations, and capability tradeoffs before choosing a workflow.',
    match: ['provider', 'providers', 'integration', 'integrations', 'byoa', 'waterfall', 'compare', 'comparison'],
  },
  {
    key: 'account-and-usage',
    title: 'Account and Usage',
    description: 'Check pricing, usage, limits, credits, and upgrade context for the current account.',
    match: ['usage', 'tier', 'plan', 'pricing', 'price', 'cost', 'credits', 'checkout', 'upgrade', 'billing'],
  },
  {
    key: 'general-research',
    title: 'General Research',
    description: 'Handle broad search and query workflows when there is not a more specific product surface match.',
    match: ['search', 'query', 'lookup', 'look up', 'discover', 'find'],
  },
] as const

const GENERIC_TOOL_NAMES = new Set([
  'run',
  'execute',
  'query',
  'invoke',
  'action',
  'tool',
  'command',
  'workflow',
  'task',
])

export function parseMcpSourceInput(input: string, transportOverride?: string): McpServer {
  const value = input.trim()
  if (!value) {
    throw new Error('Expected an MCP server URL or a local command.')
  }

  if (transportOverride && transportOverride !== 'http' && transportOverride !== 'sse') {
    throw new Error('Transport must be one of: http, sse')
  }

  try {
    const url = new URL(value)
    if (url.protocol === 'http:' || url.protocol === 'https:') {
      const normalizedPath = url.pathname.replace(/\/+$/, '')
      const transport = transportOverride === 'sse' || (!transportOverride && normalizedPath.endsWith('/sse'))
        ? 'sse' as const
        : 'http' as const
      return {
        transport,
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
  const plan = await planMcpScaffold(options)
  await applyMcpScaffoldPlan(options.rootDir, plan)

  return {
    instructionsPath: plan.instructionsPath,
    skillDirectories: plan.skillDirectories,
    commandFiles: plan.commandFiles,
    generatedFiles: plan.generatedFiles,
    generatedHookMode: plan.generatedHookMode,
    generatedHookEvents: plan.generatedHookEvents,
    metadataPath: plan.metadataPath,
  }
}

export async function applyMcpScaffoldPlan(rootDir: string, plan: McpScaffoldPlan): Promise<void> {
  for (const file of plan.files) {
    const filePath = resolve(rootDir, file.relativePath)
    const parentDir = file.relativePath.split('/').slice(0, -1).join('/')
    if (parentDir) {
      await mkdir(resolve(rootDir, parentDir), { recursive: true })
    }
    await Bun.write(filePath, file.content)
  }
}

export async function planMcpScaffold(options: McpScaffoldOptions): Promise<McpScaffoldPlan> {
  const pluginName = toKebabCase(options.pluginName) || 'mcp-plugin'
  const displayName = options.displayName
    ?? deriveDisplayName(options.introspection, pluginName)
  const plannedSkills = planSkillScaffoldsFromPersisted(
    options.introspection.tools,
    options.skillGrouping,
    options.persistedSkills,
    options.toolRenames,
  )
  const description = options.description
    ?? deriveScaffoldDescription({
      displayName,
      introspection: options.introspection,
      plannedSkills,
    })
  const serverName = options.serverName
    ?? toKebabCase(options.introspection.serverInfo.name)
    ?? pluginName
  const runtimeAuthMode = options.runtimeAuthMode
    ?? (
      options.source.transport !== 'stdio' && options.source.auth?.type === 'platform'
        ? 'platform'
        : 'inline'
    )

  const instructionsPath = resolve(options.rootDir, 'INSTRUCTIONS.md')
  const skillRoot = resolve(options.rootDir, 'skills')
  const commandsRoot = resolve(options.rootDir, 'commands')
  const userConfigSource = {
    targets: options.targets,
    mcp: {
      [serverName]: options.source,
    },
    platforms: runtimeAuthMode === 'platform'
      ? {
          'claude-code': { mcpAuth: 'platform' as const },
          cursor: { mcpAuth: 'platform' as const },
        }
      : undefined,
  } as PluginConfig
  const userConfig = collectUserConfigEntries(userConfigSource)
    .map(({ source: _source, ...entry }) => entry)
  const skillDirectories: string[] = []
  const commandFiles: string[] = []
  const generatedFiles = ['pluxx.config.ts', './INSTRUCTIONS.md']
  const generatedHooks = planGeneratedHooks(options.source, options.introspection.tools, serverName, options.hookMode)
  const metadataPath = MCP_SCAFFOLD_METADATA_PATH
  const taxonomyPath = MCP_TAXONOMY_PATH
  const files: McpScaffoldPlannedFile[] = []

  const addPlannedFile = async (relativePath: string, content: string) => {
    const filePath = resolve(options.rootDir, relativePath)
    const action = existsSync(filePath)
      ? ((await Bun.file(filePath).text()) === content ? 'unchanged' : 'update')
      : 'create'
    files.push({ relativePath, content, action })
  }

  await addPlannedFile(
    'pluxx.config.ts',
    buildConfigTemplate({
      pluginName,
      authorName: options.authorName,
      description,
      displayName,
      serverName,
      source: options.source,
      websiteUrl: options.introspection.serverInfo.websiteUrl,
      targets: options.targets,
      userConfig,
      hooks: generatedHooks.hookEntries,
      scriptsPath: generatedHooks.scriptsPath,
      runtimeAuthMode,
      commandsPath: './commands/',
    }),
  )

  await addPlannedFile(
    './INSTRUCTIONS.md',
    wrapManagedMarkdown(
        buildInstructionsContent({
          displayName,
          description,
          source: options.source,
          runtimeAuthMode,
          instructions: options.introspection.instructions,
          skills: plannedSkills,
          tools: options.introspection.tools,
          resources: options.introspection.resources ?? [],
          resourceTemplates: options.introspection.resourceTemplates ?? [],
          prompts: options.introspection.prompts ?? [],
          userConfig,
        }),
      existsSync(instructionsPath) ? await Bun.file(instructionsPath).text() : undefined,
      {
        customHeading: '## Custom Instructions',
        defaultCustomContent: DEFAULT_INSTRUCTIONS_CUSTOM_CONTENT,
      },
    ),
  )

  for (const skill of plannedSkills) {
    const relativeSkillPath = `skills/${skill.dirName}`
    const skillPath = resolve(skillRoot, skill.dirName, 'SKILL.md')
    const relativeCommandPath = `commands/${skill.dirName}.md`
    const commandPath = resolve(commandsRoot, `${skill.dirName}.md`)
    await addPlannedFile(
      `${relativeSkillPath}/SKILL.md`,
      wrapManagedMarkdown(
        buildSkillContent(skill),
        existsSync(skillPath) ? await Bun.file(skillPath).text() : undefined,
        {
          customHeading: '## Custom Notes',
          defaultCustomContent: DEFAULT_SKILL_CUSTOM_CONTENT,
        },
      ),
    )
    skillDirectories.push(relativeSkillPath)
    generatedFiles.push(`${relativeSkillPath}/SKILL.md`)

    await addPlannedFile(
      relativeCommandPath,
      buildCommandContent(
        skill,
        existsSync(commandPath) ? await Bun.file(commandPath).text() : undefined,
      ),
    )
    commandFiles.push(relativeCommandPath)
    generatedFiles.push(relativeCommandPath)
  }

  for (const file of generatedHooks.files) {
    await addPlannedFile(file.relativePath, file.content)
    generatedFiles.push(file.relativePath)
  }

  const metadata = buildMcpScaffoldMetadata({
    source: options.source,
    introspection: options.introspection,
    pluginName,
    displayName,
    skillGrouping: options.skillGrouping ?? 'workflow',
    requestedHookMode: options.hookMode ?? 'none',
    generatedHookMode: generatedHooks.mode,
    generatedHookEvents: Object.keys(generatedHooks.hookEntries ?? {}),
    runtimeAuthMode,
    userConfig,
    plannedSkills,
    managedFiles: [...generatedFiles, taxonomyPath, metadataPath],
  })
  await addPlannedFile(taxonomyPath, `${JSON.stringify(buildPersistedTaxonomy(plannedSkills), null, 2)}\n`)
  generatedFiles.push(taxonomyPath)
  await addPlannedFile(metadataPath, `${JSON.stringify(metadata, null, 2)}\n`)
  generatedFiles.push(metadataPath)

  return {
    instructionsPath: './INSTRUCTIONS.md',
    skillDirectories,
    commandFiles,
    generatedFiles,
    generatedHookMode: generatedHooks.mode,
    generatedHookEvents: Object.keys(generatedHooks.hookEntries ?? {}),
    metadataPath,
    files,
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
  const { frontmatter, body } = splitMarkdownFrontmatter(generatedContent.trim())

  const lines = [
    ...(frontmatter ? [frontmatter, ''] : []),
    PLUXX_GENERATED_START,
    body.trim(),
    PLUXX_GENERATED_END,
    '',
    options.customHeading,
    '',
    PLUXX_CUSTOM_START,
    customContent,
    PLUXX_CUSTOM_END,
    '',
  ]

  return lines.join('\n')
}

function splitMarkdownFrontmatter(content: string): { frontmatter: string; body: string } {
  const lines = content.split(/\r?\n/)
  if (lines[0]?.trim() !== '---') {
    return {
      frontmatter: '',
      body: content,
    }
  }

  let endIndex = -1
  for (let index = 1; index < lines.length; index += 1) {
    if (lines[index].trim() === '---') {
      endIndex = index
      break
    }
  }

  if (endIndex === -1) {
    return {
      frontmatter: '',
      body: content,
    }
  }

  return {
    frontmatter: lines.slice(0, endIndex + 1).join('\n'),
    body: lines.slice(endIndex + 1).join('\n').replace(/^\n+/, ''),
  }
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
  const description = buildSkillFrontmatterDescription(skill)
  const exampleRequests = skill.tools
    .map((tool) => buildToolExampleRequest(tool))
    .filter((example, index, values) => values.indexOf(example) === index)

  const lines = [
    '---',
    `name: ${JSON.stringify(skill.dirName)}`,
    `description: ${JSON.stringify(description)}`,
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

export function buildCommandContent(skill: PlannedSkill, existingContent?: string): string {
  const description = truncate(cleanSingleLineText(skill.description), 140)
  const argumentHint = inferCommandArgumentHint(skill)
  const entryBlurb = buildCommandEntryBlurb(skill)
  const generatedContent = [
    '---',
    `description: ${JSON.stringify(description)}`,
    `argument-hint: ${JSON.stringify(argumentHint)}`,
    '---',
    '',
    entryBlurb,
    '',
    'Arguments: $ARGUMENTS',
    '',
    'Primary tools:',
    ...skill.tools.map((tool) => `- \`${tool.name}\``),
    '',
    'Workflow:',
    '',
    '1. Interpret `$ARGUMENTS` as the user request for this workflow.',
    '2. Choose the most specific tool in this surface.',
    '3. Ask for missing required inputs only if the request does not already provide them.',
    '4. Return a concise task-focused answer instead of raw JSON unless the user asks for it.',
  ].join('\n')

  return wrapManagedMarkdown(
    generatedContent,
    existingContent,
    {
      customHeading: '## Custom Notes',
      defaultCustomContent: DEFAULT_SKILL_CUSTOM_CONTENT,
    },
  )
}

export function buildInstructionsContent(input: {
  displayName: string
  description: string
  source: McpServer
  runtimeAuthMode?: McpRuntimeAuthMode
  instructions?: string
  skills: PlannedSkill[]
  tools: IntrospectedMcpTool[]
  resources: IntrospectedMcpResource[]
  resourceTemplates: IntrospectedMcpResourceTemplate[]
  prompts: IntrospectedMcpPrompt[]
  userConfig?: UserConfigEntry[]
}): string {
  const accessLine = describePluginAccess(input.displayName, input.source, input.runtimeAuthMode ?? 'inline')
  const lines = [
    `# ${input.displayName}`,
    '',
    input.description,
    '',
    accessLine,
    '',
    '## Workflow Guidance',
    '',
  ]

  for (const skill of input.skills) {
    lines.push(`- ${buildInstructionSkillSummary(skill)}`)
  }

  lines.push(
    '',
    '## Tool Routing',
    '',
  )

  for (const tool of input.tools) {
    lines.push(`- \`${tool.name}\`: ${summarizeToolForInstructions(tool)}`)
  }

  if (input.resources.length > 0 || input.resourceTemplates.length > 0) {
    lines.push('', '## Resource Surfaces', '')

    for (const resource of input.resources.slice(0, 8)) {
      const label = resource.name ?? resource.title ?? resource.uri
      lines.push(`- \`${label}\`: ${summarizeResourceForInstructions(resource)}`)
    }

    for (const template of input.resourceTemplates.slice(0, 8)) {
      lines.push(`- \`${template.name}\`: ${summarizeResourceTemplateForInstructions(template)}`)
    }
  }

  if (input.prompts.length > 0) {
    lines.push('', '## Prompt Templates', '')

    for (const prompt of input.prompts.slice(0, 8)) {
      lines.push(`- \`${prompt.name}\`: ${summarizePromptForInstructions(prompt)}`)
    }
  }

  lines.push(
    '',
    '## Operating Notes',
    '',
    '- Prefer the most specific tool that matches the user request.',
    '- If the MCP exposes resources or prompt templates, use them as canonical context before improvising your own workflow.',
    '- Confirm required inputs before calling a tool.',
    '- Summarize returned data instead of dumping raw JSON unless the user asks for it.',
  )

  if (input.userConfig && input.userConfig.length > 0) {
    lines.push('', '## User Config', '')
    for (const item of input.userConfig) {
      const descriptor = [item.type ?? 'string', item.required === false ? 'optional' : 'required']
        .filter(Boolean)
        .join(', ')
      const envVar = item.envVar ? ` — env: \`${item.envVar}\`` : ''
      lines.push(`- \`${item.key}\` (${item.title}; ${descriptor})${envVar}: ${item.description}`)
    }
  }

  if (input.instructions) {
    const serverGuidance = summarizeServerGuidance(input.instructions)
    if (serverGuidance.length > 0) {
      lines.push('', '## Server Guidance', '')
      for (const item of serverGuidance) {
        lines.push(`- ${item}`)
      }
    }
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
  userConfig?: UserConfigEntry[]
  hooks?: Record<string, HookEntry[]>
  scriptsPath?: string
  runtimeAuthMode?: McpRuntimeAuthMode
  commandsPath?: string
}): string {
  const targets = input.targets.map((target) => JSON.stringify(target)).join(', ')
  const mcpBlock = buildMcpBlock(input.serverName, input.source)
  const shortDescription = truncate(firstSentenceOf(cleanSingleLineText(input.description)), 140)
  const brandFields = [
    `displayName: ${JSON.stringify(input.displayName)}`,
    shortDescription ? `shortDescription: ${JSON.stringify(shortDescription)}` : null,
    input.websiteUrl ? `websiteURL: ${JSON.stringify(input.websiteUrl)}` : null,
  ].filter(Boolean).join(',\n    ')
  const userConfigBlock = input.userConfig && input.userConfig.length > 0
    ? `\n  userConfig: ${serializeUserConfig(input.userConfig)},\n`
    : ''
  const scriptsBlock = input.scriptsPath ? `  scripts: ${JSON.stringify(input.scriptsPath)},\n` : ''
  const commandsBlock = input.commandsPath ? `  commands: ${JSON.stringify(input.commandsPath)},\n` : ''
  const hooksBlock = input.hooks ? `\n  hooks: ${serializeHooks(input.hooks)},\n` : ''
  const platformsBlock = input.runtimeAuthMode === 'platform'
    ? `\n  platforms: {\n    'claude-code': {\n      mcpAuth: 'platform',\n    },\n    cursor: {\n      mcpAuth: 'platform',\n    },\n  },\n`
    : ''

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
${commandsBlock}
  instructions: './INSTRUCTIONS.md',
${userConfigBlock}
${scriptsBlock}

  mcp: {
${mcpBlock}
  },
${hooksBlock}
${platformsBlock}

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
    ? source.auth.type === 'platform'
      ? `,\n      auth: {\n        type: 'platform',\n        mode: ${JSON.stringify(source.auth.mode ?? 'oauth')}\n      }`
      : `,\n      auth: {\n        type: ${JSON.stringify(source.auth.type)},\n        envVar: ${JSON.stringify(source.auth.envVar)}${source.auth.type === 'header'
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

function serializeUserConfig(userConfig: UserConfigEntry[]): string {
  const entries = userConfig
    .map((item) => {
      const fields = [
        `key: ${JSON.stringify(item.key)}`,
        `title: ${JSON.stringify(item.title)}`,
        `description: ${JSON.stringify(item.description)}`,
        `type: ${JSON.stringify(item.type ?? 'string')}`,
        `required: ${item.required ?? true}`,
        item.envVar ? `envVar: ${JSON.stringify(item.envVar)}` : null,
        item.defaultValue !== undefined ? `defaultValue: ${JSON.stringify(item.defaultValue)}` : null,
        item.placeholder ? `placeholder: ${JSON.stringify(item.placeholder)}` : null,
        item.targets ? `targets: ${JSON.stringify(item.targets)}` : null,
      ].filter(Boolean)

      return `    {\n      ${fields.join(',\n      ')}\n    }`
    })
    .join(',\n')

  return `[\n${entries}\n  ]`
}

const MUTATING_PREFIXES = [
  'create', 'add', 'insert',
  'update', 'edit', 'modify', 'patch',
  'delete', 'remove', 'destroy', 'drop', 'purge',
  'bulk', 'send', 'post', 'publish',
] as const

const MUTATING_PREFIX_PATTERN = new RegExp(`^(${MUTATING_PREFIXES.join('|')})\\b`, 'i')

export function detectMutatingTools(tools: IntrospectedMcpTool[]): string[] {
  return tools
    .filter((tool) => {
      const normalized = normalizeIdentifier(tool.name).trim().toLowerCase()
      return MUTATING_PREFIX_PATTERN.test(normalized)
    })
    .map((tool) => tool.name)
}

function planGeneratedHooks(source: McpServer, tools: IntrospectedMcpTool[], serverName: string, hookMode: McpHookMode = 'none'): GeneratedHookScaffold {
  if (hookMode !== 'safe') {
    return { mode: 'none', files: [] }
  }

  const envVars = collectRequiredEnvVars(source)
  const mutatingTools = detectMutatingTools(tools)

  if (envVars.length === 0 && mutatingTools.length === 0) {
    return { mode: 'none', files: [] }
  }

  const hookEntries: Record<string, HookEntry[]> = {}
  const files: Array<{ relativePath: string; content: string }> = []

  if (envVars.length > 0) {
    hookEntries.sessionStart = [{
      type: 'command',
      command: 'bash "${PLUGIN_ROOT}/scripts/check-env.sh"',
    }]
    files.push({
      relativePath: 'scripts/check-env.sh',
      content: buildEnvValidationScript(envVars),
    })
  }

  if (mutatingTools.length > 0) {
    hookEntries.preToolUse = mutatingTools.map((toolName) => ({
      type: 'command',
      command: 'bash "${PLUGIN_ROOT}/scripts/confirm-mutation.sh"',
      matcher: buildMcpToolMatcher(serverName, toolName),
    }))
    files.push({
      relativePath: 'scripts/confirm-mutation.sh',
      content: buildMutationConfirmationScript(mutatingTools),
    })
  }

  return {
    mode: 'safe',
    scriptsPath: './scripts/',
    hookEntries,
    files,
  }
}

export function buildMutationConfirmationScript(mutatingTools: string[]): string {
  const toolList = JSON.stringify(mutatingTools.map(sanitizeShellCommentText))
  return `#!/usr/bin/env bash
set -euo pipefail
# This hook runs before mutating MCP tools.
# The platform will prompt the user for confirmation.
# Mutating tools: ${toolList}
echo "pluxx: This tool modifies data. The agent should confirm before proceeding." >&2
`
}

function collectRequiredEnvVars(source: McpServer): string[] {
  const envVars = new Set<string>()

  if (source.auth?.type && source.auth.type !== 'none' && source.auth.type !== 'platform') {
    if (isValidShellEnvVarName(source.auth.envVar)) {
      envVars.add(source.auth.envVar)
    }
  }

  if (source.transport === 'stdio') {
    for (const key of Object.keys(source.env ?? {})) {
      if (isValidShellEnvVarName(key)) {
        envVars.add(key)
      }
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

function buildMcpToolMatcher(serverName: string, toolName: string): string {
  return `mcp__${serverName}__${toolName}`
}

function sanitizeShellCommentText(value: string): string {
  return value.replace(/[\u0000-\u001f\u007f\u2028\u2029]/g, ' ').trim()
}

function isValidShellEnvVarName(value: string): boolean {
  return /^[A-Za-z_][A-Za-z0-9_]*$/.test(value)
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
  runtimeAuthMode: McpRuntimeAuthMode
  userConfig: UserConfigEntry[]
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
      description: deriveScaffoldDescription({
        displayName: input.displayName,
        introspection: input.introspection,
        plannedSkills: input.plannedSkills,
      }),
      skillGrouping: input.skillGrouping,
      requestedHookMode: input.requestedHookMode,
      generatedHookMode: input.generatedHookMode,
      generatedHookEvents: input.generatedHookEvents,
      runtimeAuthMode: input.runtimeAuthMode,
    },
    userConfig: input.userConfig,
    tools: input.introspection.tools,
    resources: input.introspection.resources ?? [],
    resourceTemplates: input.introspection.resourceTemplates ?? [],
    prompts: input.introspection.prompts ?? [],
    skills: input.plannedSkills.map((skill) => ({
      dirName: skill.dirName,
      title: skill.title,
      description: skill.description,
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

function planSkillScaffoldsFromPersisted(
  tools: IntrospectedMcpTool[],
  grouping: McpSkillGrouping = 'workflow',
  persistedSkills: PersistedSkill[] = [],
  toolRenames: Map<string, string> = new Map(),
): PlannedSkill[] {
  if (persistedSkills.length === 0) {
    return planSkillScaffolds(tools, grouping)
  }

  const toolByName = new Map(tools.map((tool) => [tool.name, tool]))
  const assigned = new Set<string>()
  const planned: PlannedSkill[] = []

  for (const skill of persistedSkills) {
    const matchedTools: IntrospectedMcpTool[] = []

    for (const originalToolName of skill.toolNames) {
      const resolvedToolName = toolRenames.get(originalToolName) ?? originalToolName
      const tool = toolByName.get(resolvedToolName)
      if (!tool || assigned.has(tool.name)) continue
      matchedTools.push(tool)
      assigned.add(tool.name)
    }

    if (matchedTools.length === 0) continue

    planned.push({
      dirName: skill.dirName,
      title: skill.title,
      description: skill.description ?? `Handle ${skill.title.toLowerCase()} workflows.`,
      tools: matchedTools,
    })
  }

  const remainingTools = tools.filter((tool) => !assigned.has(tool.name))
  if (remainingTools.length > 0) {
    planned.push(...planSkillScaffolds(remainingTools, grouping))
  }

  return allocateSkillDirectoryNames(planned)
}

function buildPersistedTaxonomy(skills: PlannedSkill[]): PersistedSkill[] {
  return skills.map((skill) => ({
    dirName: skill.dirName,
    title: skill.title,
    description: skill.description,
    toolNames: skill.tools.map((tool) => tool.name),
  }))
}

export function analyzeMcpQuality(
  tools: IntrospectedMcpTool[],
  plannedSkills: PlannedSkill[] = planSkillScaffolds(tools, 'workflow'),
): McpQualityReport {
  const issues: McpQualityIssue[] = []

  const genericNameTools = tools.filter((tool) => {
    const normalized = toKebabCase(tool.name)
    return GENERIC_TOOL_NAMES.has(normalized)
  })

  if (genericNameTools.length > 0) {
    issues.push({
      level: 'warning',
      code: 'generic-tool-names',
      title: 'Generic MCP tool names',
      detail: `${genericNameTools.length} tool(s) use generic names: ${genericNameTools.slice(0, 5).map((tool) => tool.name).join(', ')}`,
      fix: 'Add sharper tool names or use Agent Mode with docs/website context to recover better taxonomy.',
    })
  }

  const missingDescriptionTools = tools.filter((tool) => cleanSingleLineText(tool.description).length < 12)
  if (missingDescriptionTools.length > 0) {
    issues.push({
      level: 'warning',
      code: 'missing-tool-descriptions',
      title: 'Weak MCP tool descriptions',
      detail: `${missingDescriptionTools.length} tool(s) have missing or too-short descriptions.`,
      fix: 'Add clearer tool descriptions, or expect the scaffold to need more agent refinement.',
    })
  }

  const verboseDescriptionTools = tools.filter((tool) => {
    const description = tool.description ?? ''
    return description.includes('\n') || /returns:|args:|usage:|example:/i.test(description) || description.length > 260
  })
  if (verboseDescriptionTools.length > 0) {
    issues.push({
      level: 'info',
      code: 'verbose-tool-descriptions',
      title: 'Tool descriptions look documentation-shaped',
      detail: `${verboseDescriptionTools.length} tool(s) include long or multiline help text that may need agent cleanup in skills and instructions.`,
      fix: 'Use autopilot or rerun agent refinement with docs/website context so the output becomes more product-shaped.',
    })
  }

  const weakSchemaTools = tools.filter((tool) => {
    const fields = getTopLevelSchemaFields(tool.inputSchema)
    return fields.length >= 2 && fields.every((field) => !field.description)
  })
  if (weakSchemaTools.length > 0) {
    issues.push({
      level: 'info',
      code: 'weak-input-schemas',
      title: 'Input schemas lack field descriptions',
      detail: `${weakSchemaTools.length} tool(s) define multi-field input schemas without per-field descriptions.`,
      fix: 'Add input field descriptions or provide docs/context so agents can infer better examples and guidance.',
    })
  }

  const workflowFallbackSkills = plannedSkills.filter((skill) => skill.tools.length === 1 && toKebabCase(skill.tools[0]?.name ?? '') === skill.dirName)
  if (workflowFallbackSkills.length >= 2) {
    issues.push({
      level: 'warning',
      code: 'workflow-fallback-skills',
      title: 'Workflow grouping fell back to tool-level buckets',
      detail: `${workflowFallbackSkills.length} generated skill(s) are still direct tool wrappers, which usually means the MCP metadata is too weak for clean workflow grouping.`,
      fix: 'Use docs/website context, add pluxx.agent.md hints, or improve the MCP tool metadata before publishing.',
    })
  }

  const warnings = issues.filter((issue) => issue.level === 'warning').length
  const infos = issues.filter((issue) => issue.level === 'info').length

  return {
    ok: warnings === 0,
    warnings,
    infos,
    issues,
  }
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

function buildSkillFrontmatterDescription(skill: PlannedSkill): string {
  if (skill.tools.length === 1) {
    const tool = skill.tools[0]
    const cleanedDescription = cleanSingleLineText(tool.description)
    const sentence = firstSentenceOf(cleanedDescription)

    if (sentence) {
      return truncate(sentence, 220)
    }
  }

  return truncate(cleanSingleLineText(skill.description), 220)
}

function buildInstructionSkillSummary(skill: PlannedSkill): string {
  const toolNames = skill.tools.map((tool) => `\`${tool.name}\``).join(', ')
  const description = truncate(cleanSingleLineText(skill.description), 180)
  return `\`${skill.dirName}\`: ${description} Primary tools: ${toolNames}.`
}

function inferCommandArgumentHint(skill: PlannedSkill): string {
  const fieldHints = new Set<string>()

  for (const tool of skill.tools) {
    const fields = getTopLevelSchemaFields(tool.inputSchema)
    const prioritizedFields = fields.filter((field) => field.required)
    const candidates = (prioritizedFields.length > 0 ? prioritizedFields : fields).slice(0, 2)

    for (const field of candidates) {
      fieldHints.add(mapSchemaFieldToArgumentHint(field.name))
      if (fieldHints.size >= 2) break
    }

    if (fieldHints.size >= 2) break
  }

  if (fieldHints.size === 0) {
    return '[request]'
  }

  return [...fieldHints].slice(0, 2).map((hint) => `[${hint}]`).join(' ')
}

function buildCommandEntryBlurb(skill: PlannedSkill): string {
  const intent = inferSkillIntentPhrase(skill)
  return `Use this command when the user asks to ${intent}.`
}

function inferSkillIntentPhrase(skill: PlannedSkill): string {
  const toolDescription = skill.tools.length === 1
    ? firstSentenceOf(cleanSingleLineText(skill.tools[0].description))
    : ''
  const fallback = firstSentenceOf(cleanSingleLineText(skill.description))
  const cleaned = normalizeSkillIntentPhrase(toolDescription || fallback)

  if (!cleaned) {
    return `work with ${skill.title.toLowerCase()} in this plugin`
  }

  return startsWithActionVerb(cleaned) ? cleaned : `work on ${cleaned}`
}

function normalizeSkillIntentPhrase(value: string): string {
  if (!value) return ''

  const withoutGenericPrefixes = value
    .replace(/^use (?:the |this )?(?:workflow|command|tool)\s+(?:for|to)\s+/i, '')
    .replace(/^use the `[^`]+` mcp tool for this workflow\.?/i, '')
    .replace(/^handle\s+/i, '')
    .replace(/^this (?:workflow|command|tool)\s+/i, '')
    .replace(/\s+for this plugin\.?$/i, '')
    .replace(/\s+for this workflow\.?$/i, '')
    .trim()

  if (!withoutGenericPrefixes) return ''

  const normalized = withoutGenericPrefixes.charAt(0).toLowerCase() + withoutGenericPrefixes.slice(1)
  return normalized.replace(/[.?!]+$/, '').trim()
}

function startsWithActionVerb(value: string): boolean {
  return /^(search|find|look up|get|fetch|create|update|delete|list|query|send|check|compare|build|run|research)\b/i.test(value)
}

function mapSchemaFieldToArgumentHint(fieldName: string): string {
  const value = fieldName.toLowerCase()

  if (value.includes('query') || value.includes('search') || value.includes('keyword')) return 'query'
  if (value.includes('company') || value.includes('organization') || value.includes('organisation') || value.includes('account')) return 'company'
  if (value.includes('role') || value.includes('title')) return 'role'
  if (value.includes('domain')) return 'domain'
  if (value.includes('url')) return 'url'
  if (value.includes('email')) return 'email'
  if (value === 'id' || value.endsWith('id')) return 'id'
  if (value.includes('name')) return 'name'

  return value.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'request'
}

function summarizeToolForInstructions(tool: IntrospectedMcpTool): string {
  const fallback = 'Use this tool when its inputs match the user request.'
  const description = tool.description ?? ''
  const base = firstSentenceOf(cleanSingleLineText(description))
  const bestFor = extractLabeledGuidance(description, 'Best for')
  const useWhen = extractLabeledGuidance(description, 'Use when')

  const parts = [base].filter(Boolean)
  const guidance = bestFor || useWhen

  if (guidance) {
    parts.push(`Best for: ${guidance}.`)
  }

  if (parts.length === 0) {
    return fallback
  }

  return truncate(parts.join(' '), 240)
}

function summarizeResourceForInstructions(resource: IntrospectedMcpResource): string {
  const descriptor = firstSentenceOf(cleanSingleLineText(resource.description ?? ''))
  const location = resource.uri ? `URI: \`${resource.uri}\`.` : ''
  const mimeType = resource.mimeType ? ` Format: ${resource.mimeType}.` : ''
  const parts = [
    descriptor || 'Reference resource exposed by the MCP.',
    location,
    mimeType,
  ].filter(Boolean)

  return truncate(parts.join(' '), 240)
}

function summarizeResourceTemplateForInstructions(template: IntrospectedMcpResourceTemplate): string {
  const descriptor = firstSentenceOf(cleanSingleLineText(template.description ?? ''))
  const uriTemplate = template.uriTemplate ? `URI template: \`${template.uriTemplate}\`.` : ''
  const mimeType = template.mimeType ? ` Format: ${template.mimeType}.` : ''
  const parts = [
    descriptor || 'Parameterized MCP resource template.',
    uriTemplate,
    mimeType,
  ].filter(Boolean)

  return truncate(parts.join(' '), 240)
}

function summarizePromptForInstructions(prompt: IntrospectedMcpPrompt): string {
  const descriptor = firstSentenceOf(cleanSingleLineText(prompt.description ?? ''))
  const args = prompt.arguments?.slice(0, 4).map((argument) => {
    const required = argument.required ? 'required' : 'optional'
    return `\`${argument.name}\` (${required})`
  }) ?? []
  const parts = [
    descriptor || 'Prompt template exposed by the MCP.',
    args.length > 0 ? `Arguments: ${args.join(', ')}.` : '',
  ].filter(Boolean)

  return truncate(parts.join(' '), 240)
}

function summarizeServerGuidance(value: string): string[] {
  const lines = value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !line.startsWith('```'))
    .map((line) => line.replace(/^#+\s*/, ''))
    .map((line) => line.replace(/^[-*]\s+/, ''))
    .filter((line) => !/^example:?$/i.test(line))
    .map((line) => truncate(cleanSingleLineText(line), 220))
    .filter(Boolean)

  return [...new Set(lines)].slice(0, 4)
}

function extractLabeledGuidance(value: string | undefined, label: string): string {
  if (!value) return ''

  const normalizedLabel = `${label.toLowerCase()}:`
  for (const rawLine of value.split('\n')) {
    const line = rawLine
      .trim()
      .replace(/^\*+|\*+$/g, '')
      .replace(/^[-*]\s*/, '')
      .replace(/^\*+\s*/, '')
      .replace(/\s+\*+$/, '')
    if (!line) continue

    const plain = line.replace(/[*`_]/g, '')
    if (plain.toLowerCase().startsWith(normalizedLabel)) {
      return truncate(cleanSingleLineText(plain.slice(normalizedLabel.length).trim()), 160)
    }
  }

  return ''
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
  const sentence = buildExampleSentence(action, objectLabel, context)

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
  if (/^(send|post|publish)\b/.test(identifier)) return 'send'
  return 'find'
}

function inferToolObject(tool: IntrospectedMcpTool): string {
  const raw = normalizeIdentifier(tool.title ?? tool.name).trim()
  const stripped = raw.replace(/^(find|get|fetch|lookup|look up|search|list|create|add|update|edit|delete|remove|query)\s+/i, '')
  const tokens = (stripped || raw).toLowerCase().split(/\s+/).filter(Boolean)

  while (tokens.length > 1 && SECONDARY_ACTION_TOKENS.has(tokens[0])) {
    tokens.shift()
  }

  while (tokens.length > 1 && NOISE_OBJECT_TOKENS.has(tokens[tokens.length - 1])) {
    tokens.pop()
  }

  const candidate = tokens.join(' ').trim()
  return candidate || 'results'
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

const SECONDARY_ACTION_TOKENS = new Set([
  'find',
  'get',
  'fetch',
  'lookup',
  'search',
  'list',
  'create',
  'add',
  'update',
  'edit',
  'delete',
  'remove',
  'query',
  'send',
  'post',
  'publish',
])

const NOISE_OBJECT_TOKENS = new Set(['tool', 'workflow', 'mcp'])

function buildExampleSentence(action: string, objectLabel: string, context: string): string {
  const objectPhrase = buildObjectPhrase(action, objectLabel)
  const withContext = context ? `${objectPhrase} ${context}` : objectPhrase
  return `${withContext}.`
}

function buildObjectPhrase(action: string, objectLabel: string): string {
  const trimmed = objectLabel.trim() || 'results'
  const pluralized = maybePluralizePhrase(trimmed)

  if (action === 'create') return `create a new ${trimmed}`
  if (action === 'update') return `update ${withArticle(trimmed)}`
  if (action === 'delete') return `delete the ${trimmed}`
  if (action === 'look up') return `look up ${withArticle(trimmed)}`
  if (action === 'list') return `list ${pluralized}`
  if (action === 'find' || action === 'search' || action === 'query') return `${action} ${pluralized}`
  if (action === 'send') return `send ${withArticle(trimmed)}`
  return `${action} ${trimmed}`
}

function withArticle(value: string): string {
  if (!value) return 'results'
  if (/^(a|an|the)\b/i.test(value)) return value
  if (/\b(and|or)\b/i.test(value) || value.endsWith('s')) return value
  const firstWord = value.split(/\s+/)[0].toLowerCase()
  const article = /^[aeiou]/.test(firstWord) ? 'an' : 'a'
  return `${article} ${value}`
}

function maybePluralizePhrase(value: string): string {
  const words = value.trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return 'results'

  const last = words[words.length - 1]
  if (/s$/i.test(last) || /people$/i.test(last)) return value
  if (/y$/i.test(last) && !/[aeiou]y$/i.test(last)) {
    words[words.length - 1] = `${last.slice(0, -1)}ies`
    return words.join(' ')
  }
  if (/(ch|sh|x|z)$/i.test(last)) {
    words[words.length - 1] = `${last}es`
    return words.join(' ')
  }

  words[words.length - 1] = `${last}s`
  return words.join(' ')
}

function formatSchemaType(value: unknown): string {
  if (typeof value === 'string') return value
  if (Array.isArray(value)) {
    const parts = value.filter((entry): entry is string => typeof entry === 'string')
    if (parts.length > 0) return parts.join(' | ')
  }
  return 'unknown'
}

function describePluginAccess(displayName: string, source: McpServer, runtimeAuthMode: McpRuntimeAuthMode): string {
  if (source.transport === 'stdio') {
    const command = [source.command, ...(source.args ?? [])].join(' ')
    const authLine = describeAuthRequirement(source)
    return `${displayName} connects through a local stdio MCP command (\`${command}\`).${authLine ? ` ${authLine}` : ''}`
  }

  const transportLabel = source.transport === 'sse' ? 'legacy SSE' : 'HTTP'
  const authLine = describeAuthRequirement(source, runtimeAuthMode)
  return `${displayName} connects to its MCP over ${transportLabel}.${authLine ? ` ${authLine}` : ''}`
}

function describeAuthRequirement(source: McpServer, runtimeAuthMode: McpRuntimeAuthMode = 'inline'): string {
  if (runtimeAuthMode === 'platform' && source.transport !== 'stdio') {
    if (source.auth?.type === 'platform') {
      return 'This server relies on platform-managed OAuth at runtime. Pluxx does not complete interactive OAuth in the CLI; use the host-native auth flow before calling authenticated tools.'
    }
    return 'Claude Code and Cursor use platform-managed auth at runtime (for example native OAuth/custom connector flows). Exported env vars remain useful for scaffold refreshes and other non-platform-managed targets like Codex and OpenCode.'
  }

  if (!source.auth || source.auth.type === 'none') {
    return ''
  }

  if (source.auth.type === 'platform') {
    return 'This server relies on platform-managed OAuth at runtime. Pluxx does not complete interactive OAuth in the CLI; use the host-native auth flow before calling authenticated tools.'
  }

  if (source.auth.type === 'header') {
    return `Export \`${source.auth.envVar}\` so Pluxx can send ${source.auth.headerName ?? 'the required auth header'}.`
  }

  return `Export \`${source.auth.envVar}\` before using authenticated tools.`
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

function cleanSingleLineText(value: string | undefined): string {
  if (!value) return ''

  return value
    .replace(/\s+/g, ' ')
    .replace(/\s*[-*]\s+/g, ' ')
    .trim()
}

function firstSentenceOf(value: string): string {
  if (!value) return ''

  const match = value.match(/^(.+?[.?!])(?:\s|$)/)
  return (match?.[1] ?? value).trim()
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

export function deriveDisplayName(introspection: IntrospectedMcpServer, pluginName: string): string {
  const candidates = [
    introspection.serverInfo.title,
    introspection.serverInfo.name,
    pluginName,
  ].filter((value): value is string => typeof value === 'string' && value.trim().length > 0)

  for (const candidate of candidates) {
    const polished = polishDisplayName(candidate)
    if (polished) return polished
  }

  return 'MCP Plugin'
}

function polishDisplayName(value: string): string {
  const raw = value.trim()
  if (!raw) return ''

  const looksMachineIdentifier = /^[a-z0-9._/-]+$/.test(raw) || /[-_/]/.test(raw) || raw === raw.toLowerCase()
  let candidate = looksMachineIdentifier ? humanizeName(raw) : raw

  candidate = candidate
    .replace(/\bmcp\b/gi, 'MCP')
    .replace(/\bMCP\s+Server\b/gi, 'MCP')
    .replace(/\s+/g, ' ')
    .trim()

  return candidate
}

function deriveScaffoldDescription(input: {
  displayName: string
  introspection: IntrospectedMcpServer
  plannedSkills: PlannedSkill[]
}): string {
  const serverDescription = truncate(cleanSingleLineText(input.introspection.serverInfo.description), 200)
  if (serverDescription && !isGenericServerDescription(serverDescription)) {
    return serverDescription
  }

  const skillTitles = [...new Set(
    input.plannedSkills
      .map((skill) => cleanSingleLineText(skill.title).toLowerCase())
      .filter(Boolean),
  )].slice(0, 2)

  if (skillTitles.length === 1) {
    return `${input.displayName} plugin scaffold for ${skillTitles[0]} workflows.`
  }

  if (skillTitles.length === 2) {
    return `${input.displayName} plugin scaffold for ${skillTitles[0]} and ${skillTitles[1]} workflows.`
  }

  const toolCount = input.introspection.tools.length
  if (toolCount > 0) {
    return `${input.displayName} plugin scaffold for ${toolCount} MCP tool${toolCount === 1 ? '' : 's'}.`
  }

  return `${input.displayName} plugin scaffold for MCP-driven workflows.`
}

function isGenericServerDescription(value: string): boolean {
  const normalized = value.toLowerCase().trim()
  if (!normalized) return true

  if (normalized.startsWith('generated from ')) return true
  if (normalized === 'mcp server') return true
  if (normalized === 'an mcp server') return true
  if (normalized === 'a mcp server') return true

  return false
}
