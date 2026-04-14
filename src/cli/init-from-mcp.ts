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
  const generatedHooks = planGeneratedHooks(options.source, options.introspection.tools, serverName, options.hookMode)
  const metadataPath = MCP_SCAFFOLD_METADATA_PATH
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
      hooks: generatedHooks.hookEntries,
      scriptsPath: generatedHooks.scriptsPath,
    }),
  )

  await addPlannedFile(
    './INSTRUCTIONS.md',
    wrapManagedMarkdown(
      buildInstructionsContent({
        displayName,
        description,
        source: options.source,
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

  for (const skill of plannedSkills) {
    const relativeSkillPath = `skills/${skill.dirName}`
    const skillPath = resolve(skillRoot, skill.dirName, 'SKILL.md')
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
    plannedSkills,
    managedFiles: [...generatedFiles, metadataPath],
  })
  await addPlannedFile(metadataPath, `${JSON.stringify(metadata, null, 2)}\n`)
  generatedFiles.push(metadataPath)

  return {
    instructionsPath: './INSTRUCTIONS.md',
    skillDirectories,
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

export function buildInstructionsContent(input: {
  displayName: string
  description: string
  source: McpServer
  instructions?: string
  skills: PlannedSkill[]
  tools: IntrospectedMcpTool[]
}): string {
  const accessLine = describePluginAccess(input.displayName, input.source)
  const lines = [
    `# ${input.displayName}`,
    '',
    input.description,
    '',
    accessLine,
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

  if (source.auth?.type && source.auth.type !== 'none') {
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

function describePluginAccess(displayName: string, source: McpServer): string {
  if (source.transport === 'stdio') {
    const command = [source.command, ...(source.args ?? [])].join(' ')
    const authLine = describeAuthRequirement(source)
    return `${displayName} connects through a local stdio MCP command (\`${command}\`).${authLine ? ` ${authLine}` : ''}`
  }

  const transportLabel = source.transport === 'sse' ? 'legacy SSE' : 'HTTP'
  const authLine = describeAuthRequirement(source)
  return `${displayName} connects to its MCP over ${transportLabel}.${authLine ? ` ${authLine}` : ''}`
}

function describeAuthRequirement(source: McpServer): string {
  if (!source.auth || source.auth.type === 'none') {
    return ''
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
