import { existsSync, readdirSync, readFileSync, statSync } from 'fs'
import { chmod, copyFile, mkdir, mkdtemp, readFile, rm } from 'fs/promises'
import { homedir, tmpdir } from 'os'
import { relative, resolve } from 'path'
import { spawn } from 'child_process'
import { loadConfig } from '../config/load'
import { readCanonicalCommandFiles } from '../commands'
import { lintProject, type LintResult } from './lint'
import { runTestSuite, type TestRunResult } from './test'
import {
  MCP_SCAFFOLD_METADATA_PATH,
  MCP_TAXONOMY_PATH,
  PLUXX_CUSTOM_END,
  PLUXX_CUSTOM_START,
  PLUXX_GENERATED_END,
  PLUXX_GENERATED_START,
  type McpScaffoldMetadata,
} from './init-from-mcp'
import { applyPersistedTaxonomy } from './sync-from-mcp'
import { type PluginConfig, getConfiguredCompilerBuckets } from '../schema'

export const AGENT_CONTEXT_PATH = '.pluxx/agent/context.md'
export const AGENT_PLAN_PATH = '.pluxx/agent/plan.json'
export const AGENT_OVERRIDES_PATH = 'pluxx.agent.md'
export const AGENT_PROMPT_KINDS = ['taxonomy', 'instructions', 'review'] as const
export const AGENT_RUNNERS = ['claude', 'opencode', 'codex', 'cursor'] as const
export type AgentPromptKind = typeof AGENT_PROMPT_KINDS[number]
export type AgentRunner = typeof AGENT_RUNNERS[number]

const AGENT_PROMPT_PATHS: Record<AgentPromptKind, string> = {
  taxonomy: '.pluxx/agent/taxonomy-prompt.md',
  instructions: '.pluxx/agent/instructions-prompt.md',
  review: '.pluxx/agent/review-prompt.md',
}

const AGENT_RUNNER_BINARIES: Record<AgentRunner, string> = {
  claude: 'claude',
  opencode: 'opencode',
  codex: 'codex',
  cursor: 'agent',
}

const CURSOR_RUNNER_BINARIES = ['agent', 'cursor-agent'] as const

export interface AgentPreparePlannedFile {
  relativePath: string
  content: string
  action: 'create' | 'update' | 'unchanged'
}

export interface AgentPrepareSummary {
  pluginName: string
  targetCount: number
  toolCount: number
  skillCount: number
  editableFiles: string[]
  protectedFiles: string[]
  generatedFiles: string[]
  createdFiles: string[]
  updatedFiles: string[]
  lint: {
    errors: number
    warnings: number
  }
  contextInputs: string[]
  dryRun?: boolean
}

export interface AgentPreparePlan extends AgentPrepareSummary {
  files: AgentPreparePlannedFile[]
}

export interface AgentPrepareOptions {
  docsUrl?: string
  websiteUrl?: string
  contextPaths?: string[]
}

interface AgentPromptOptions {
  allowMissingContext?: boolean
}

export interface AgentPromptSummary {
  pluginName: string
  kind: AgentPromptKind
  outputPath: string
  createdFiles: string[]
  updatedFiles: string[]
  dryRun?: boolean
}

export interface AgentPromptPlan extends AgentPromptSummary {
  files: AgentPreparePlannedFile[]
}

export interface AgentRunOptions {
  runner: AgentRunner
  model?: string
  attach?: string
  verify?: boolean
}

export interface AgentRunnerModelSummary {
  value?: string
  source: 'explicit' | 'default' | 'unknown'
  display: string
}

export interface AgentRunSummary {
  pluginName: string
  kind: AgentPromptKind
  runner: AgentRunner
  model: AgentRunnerModelSummary
  verify: boolean
  command: string[]
  commandDisplay: string
  promptPath: string
  contextPath: string
  createdFiles: string[]
  updatedFiles: string[]
  contextInputs: string[]
  dryRun?: boolean
}

export interface AgentRunPlan extends AgentRunSummary {
  files: AgentPreparePlannedFile[]
  prepareOptions?: AgentPrepareOptions
}

export interface AgentRunResult extends AgentRunSummary {
  ok: boolean
  runnerExitCode: number
  verification?: TestRunResult
}

interface AgentPlanFile {
  path: string
  managedSections?: Array<{
    start: string
    end: string
  }>
}

interface AgentModePlanFile {
  version: 1
  plugin: {
    name: string
    displayName: string
    targets: string[]
  }
  mcp: {
    metadataPath: string
    toolCount: number
    serverName: string
    transport: string
    auth: string
  }
  contextInputs: string[]
  files: {
    editable: AgentPlanFile[]
    protected: string[]
    generated: string[]
  }
  successCriteria: string[]
  caveats: string[]
}

interface AgentContextSource {
  label: string
  kind: 'website' | 'docs' | 'file'
  summary: string
}

interface AgentProjectSkill {
  dirName: string
  title: string
  description?: string
  toolNames: string[]
  path: string
  resourceUris?: string[]
  resourceTemplateUris?: string[]
  promptNames?: string[]
}

interface AgentProjectCommand {
  path: string
  title: string
  description?: string
}

interface AgentProjectModel {
  sourceKind: 'mcp-derived' | 'manual'
  displayName: string
  metadataPath: string
  serverName: string
  transport: string
  auth: string
  toolCount: number
  resourceCount: number
  promptCount: number
  skills: AgentProjectSkill[]
  commands: AgentProjectCommand[]
  taxonomyPath?: string
  resources?: McpScaffoldMetadata['resources']
  resourceTemplates?: McpScaffoldMetadata['resourceTemplates']
  prompts?: McpScaffoldMetadata['prompts']
}

interface AgentOverrides {
  path: string
  contextPaths: string[]
  productHints?: string
  setupAuthNotes?: string
  groupingHints?: string
  taxonomyGuidance?: string
  instructionsGuidance?: string
  reviewCriteria?: string
}

function hasManagedCommands(metadata: McpScaffoldMetadata): boolean {
  return metadata.managedFiles.some((file) => file.startsWith('commands/'))
}

export async function planAgentPrepare(
  rootDir: string = process.cwd(),
  options: AgentPrepareOptions = {},
): Promise<AgentPreparePlan> {
  const config = await loadConfig(rootDir)
  const project = await loadAgentProjectModel(rootDir, config)
  const lint = await lintProject(rootDir)
  const overrides = await loadAgentOverrides(rootDir)
  const contextSources = await collectAgentContextSources(rootDir, options, overrides)
  const editableFiles = buildEditableFiles(config, project)
  const protectedFiles = buildProtectedFiles()
  const generatedFiles = [AGENT_CONTEXT_PATH, AGENT_PLAN_PATH]
  const contextContent = buildAgentContext(config, project, lint, contextSources, overrides)
  const planContent = buildAgentModePlanJson(config, project, lint, editableFiles, protectedFiles, generatedFiles, contextSources)

  const files = await Promise.all([
    planFile(rootDir, AGENT_CONTEXT_PATH, contextContent),
    planFile(rootDir, AGENT_PLAN_PATH, `${planContent}\n`),
  ])

  return {
    pluginName: config.name,
    targetCount: config.targets.length,
    toolCount: project.toolCount,
    skillCount: project.skills.length,
    editableFiles: editableFiles.map((file) => file.path),
    protectedFiles,
    generatedFiles,
    createdFiles: files.filter((file) => file.action === 'create').map((file) => file.relativePath),
    updatedFiles: files.filter((file) => file.action === 'update').map((file) => file.relativePath),
    lint: {
      errors: lint.errors,
      warnings: lint.warnings,
    },
    contextInputs: contextSources.map((source) => source.label),
    files,
  }
}

export async function applyAgentPreparePlan(rootDir: string, plan: AgentPreparePlan): Promise<void> {
  for (const file of plan.files) {
    const filePath = resolve(rootDir, file.relativePath)
    const parentDir = file.relativePath.split('/').slice(0, -1).join('/')
    if (parentDir) {
      await mkdir(resolve(rootDir, parentDir), { recursive: true })
    }
    await Bun.write(filePath, file.content)
  }
}

export async function planAgentPrompt(
  rootDir: string,
  kind: AgentPromptKind,
  options: AgentPromptOptions = {},
): Promise<AgentPromptPlan> {
  const config = await loadConfig(rootDir)
  const project = await loadAgentProjectModel(rootDir, config)
  const overrides = await loadAgentOverrides(rootDir)
  const contextPath = resolve(rootDir, AGENT_CONTEXT_PATH)

  if (!options.allowMissingContext && !existsSync(contextPath)) {
    throw new Error(`No agent context found at ${AGENT_CONTEXT_PATH}. Run "pluxx agent prepare" first.`)
  }

  if (project.sourceKind !== 'mcp-derived' && kind !== 'review') {
    throw new Error('Agent taxonomy and instructions modes require an MCP-derived scaffold. Manual Pluxx projects currently support review mode only.')
  }

  const outputPath = AGENT_PROMPT_PATHS[kind]
  const content = buildAgentPrompt(kind, {
    pluginName: config.name,
    displayName: project.displayName,
    skillPaths: project.skills.map((skill) => skill.path),
    commandPaths: project.commands.map((command) => command.path),
    sourceKind: project.sourceKind,
    taxonomyPath: project.taxonomyPath,
    overrides,
  })
  const file = await planFile(rootDir, outputPath, content)

  return {
    pluginName: config.name,
    kind,
    outputPath,
    createdFiles: file.action === 'create' ? [outputPath] : [],
    updatedFiles: file.action === 'update' ? [outputPath] : [],
    files: [file],
  }
}

export async function applyAgentPromptPlan(rootDir: string, plan: AgentPromptPlan): Promise<void> {
  for (const file of plan.files) {
    const filePath = resolve(rootDir, file.relativePath)
    const parentDir = file.relativePath.split('/').slice(0, -1).join('/')
    if (parentDir) {
      await mkdir(resolve(rootDir, parentDir), { recursive: true })
    }
    await Bun.write(filePath, file.content)
  }
}

export async function planAgentRun(
  rootDir: string = process.cwd(),
  kind: AgentPromptKind,
  options: AgentRunOptions,
  prepareOptions: AgentPrepareOptions = {},
): Promise<AgentRunPlan> {
  if (options.runner !== 'opencode' && options.attach) {
    throw new Error('--attach is only supported for the opencode runner.')
  }

  const preparePlan = await planAgentPrepare(rootDir, prepareOptions)
  const promptPlan = await planAgentPrompt(rootDir, kind, { allowMissingContext: true })
  const promptPath = AGENT_PROMPT_PATHS[kind]
  const verify = kind === 'review' ? false : options.verify !== false
  const command = buildAgentRunnerCommand(options.runner, kind, buildAgentRunnerPrompt(kind, promptPath), {
    model: options.model,
    attach: options.attach,
    workspace: rootDir,
  })
  const model = await resolveAgentRunnerModel(options.runner, options.model)

  return {
    pluginName: preparePlan.pluginName,
    kind,
    runner: options.runner,
    model,
    verify,
    command,
    commandDisplay: command.map(shellQuote).join(' '),
    promptPath,
    contextPath: AGENT_CONTEXT_PATH,
    createdFiles: [...preparePlan.createdFiles, ...promptPlan.createdFiles],
    updatedFiles: [...preparePlan.updatedFiles, ...promptPlan.updatedFiles],
    contextInputs: preparePlan.contextInputs,
    files: [...preparePlan.files, ...promptPlan.files],
    prepareOptions,
  }
}

export async function runAgentPlan(
  rootDir: string,
  plan: AgentRunPlan,
  options: {
    streamOutput?: boolean
  } = {},
): Promise<AgentRunResult> {
  const preparePlan = await planAgentPrepare(rootDir, plan.prepareOptions ?? {})
  const promptPlan = await planAgentPrompt(rootDir, plan.kind, { allowMissingContext: true })
  await writePlannedFiles(rootDir, [...preparePlan.files, ...promptPlan.files])
  let createdFiles = [...preparePlan.createdFiles, ...promptPlan.createdFiles]
  let updatedFiles = [...preparePlan.updatedFiles, ...promptPlan.updatedFiles]
  let contextInputs = preparePlan.contextInputs

  await ensureRunnerAvailable(plan.runner)
  await ensureRunnerAuthenticated(plan.runner)
  const executionContext = await prepareRunnerExecution(plan.runner)
  let runnerExitCode: number
  try {
    runnerExitCode = await executeCommand(plan.command, rootDir, {
      streamOutput: options.streamOutput === true,
      env: executionContext.env,
    })
  } finally {
    await executionContext.cleanup?.()
  }
  if (runnerExitCode === 0 && plan.kind === 'taxonomy') {
    await applyPersistedTaxonomy(rootDir)
    const refreshedPack = await refreshAgentPack(rootDir, plan.prepareOptions ?? {})
    createdFiles = mergeUnique(createdFiles, refreshedPack.createdFiles)
    updatedFiles = mergeUnique(updatedFiles, refreshedPack.updatedFiles)
    contextInputs = refreshedPack.contextInputs
  }
  const verification = runnerExitCode === 0 && plan.verify
    ? await runTestSuite({ rootDir })
    : undefined

  return {
    ...plan,
    createdFiles,
    updatedFiles,
    contextInputs,
    ok: runnerExitCode === 0 && (verification?.ok ?? true),
    runnerExitCode,
    verification,
  }
}

async function refreshAgentPack(
  rootDir: string,
  prepareOptions: AgentPrepareOptions,
): Promise<{
  createdFiles: string[]
  updatedFiles: string[]
  contextInputs: string[]
}> {
  const preparePlan = await planAgentPrepare(rootDir, prepareOptions)
  const promptPlans = await Promise.all(
    AGENT_PROMPT_KINDS.map((kind) => planAgentPrompt(rootDir, kind, { allowMissingContext: true })),
  )
  const files = [
    ...preparePlan.files,
    ...promptPlans.flatMap((promptPlan) => promptPlan.files),
  ]
  await writePlannedFiles(rootDir, files)

  return {
    createdFiles: mergeUnique(
      preparePlan.createdFiles,
      promptPlans.flatMap((promptPlan) => promptPlan.createdFiles),
    ),
    updatedFiles: mergeUnique(
      preparePlan.updatedFiles,
      promptPlans.flatMap((promptPlan) => promptPlan.updatedFiles),
    ),
    contextInputs: preparePlan.contextInputs,
  }
}

async function writePlannedFiles(rootDir: string, files: AgentPreparePlannedFile[]): Promise<void> {
  for (const file of files) {
    const filePath = resolve(rootDir, file.relativePath)
    const parentDir = file.relativePath.split('/').slice(0, -1).join('/')
    if (parentDir) {
      await mkdir(resolve(rootDir, parentDir), { recursive: true })
    }
    await Bun.write(filePath, file.content)
  }
}

function mergeUnique(existing: string[], next: string[]): string[] {
  return [...new Set([...existing, ...next])]
}

function buildEditableFiles(
  config: Awaited<ReturnType<typeof loadConfig>>,
  project: AgentProjectModel,
): AgentPlanFile[] {
  const files: AgentPlanFile[] = []
  const managedSections = project.sourceKind === 'mcp-derived'
    ? [{ start: PLUXX_GENERATED_START, end: PLUXX_GENERATED_END }]
    : undefined

  if (project.taxonomyPath) {
    files.push({
      path: project.taxonomyPath,
    })
  }

  if (config.instructions) {
    files.push({
      path: normalizeRelativePath(config.instructions),
      managedSections,
    })
  }

  for (const skill of project.skills) {
    files.push({
      path: skill.path,
      managedSections,
    })
  }

  for (const command of project.commands) {
    files.push({
      path: command.path,
      managedSections,
    })
  }

  return files
}

function buildProtectedFiles(): string[] {
  return [
    'pluxx.config.ts',
    'pluxx.config.js',
    'pluxx.config.json',
    AGENT_OVERRIDES_PATH,
    MCP_SCAFFOLD_METADATA_PATH,
    'dist/',
  ]
}

async function loadMcpScaffoldMetadata(rootDir: string): Promise<McpScaffoldMetadata> {
  const metadataPath = resolve(rootDir, MCP_SCAFFOLD_METADATA_PATH)
  if (!existsSync(metadataPath)) {
    throw new Error(`No MCP scaffold metadata found at ${MCP_SCAFFOLD_METADATA_PATH}. Run "pluxx init --from-mcp" first.`)
  }

  try {
    const text = await Bun.file(metadataPath).text()
    return JSON.parse(text) as McpScaffoldMetadata
  } catch (error) {
    throw new Error(
      `Failed to parse ${MCP_SCAFFOLD_METADATA_PATH}: ${error instanceof Error ? error.message : String(error)}`,
    )
  }
}

async function loadAgentProjectModel(
  rootDir: string,
  config: PluginConfig,
): Promise<AgentProjectModel> {
  const metadataPath = resolve(rootDir, MCP_SCAFFOLD_METADATA_PATH)

  if (existsSync(metadataPath)) {
    const metadata = await loadMcpScaffoldMetadata(rootDir)
    const serverEntry = Object.entries(config.mcp ?? {})[0]
    const [serverName, server] = serverEntry ?? ['unknown', metadata.source]

    return {
      sourceKind: 'mcp-derived',
      displayName: config.brand?.displayName ?? metadata.settings.displayName ?? config.name,
      metadataPath: MCP_SCAFFOLD_METADATA_PATH,
      serverName,
      transport: server.transport,
      auth: describeAuth(server),
      toolCount: metadata.tools.length,
      resourceCount: metadata.resources?.length ?? 0,
      promptCount: metadata.prompts?.length ?? 0,
      skills: metadata.skills.map((skill) => ({
        ...skill,
        toolNames: [...skill.toolNames],
        path: `skills/${skill.dirName}/SKILL.md`,
      })),
      commands: hasManagedCommands(metadata)
        ? metadata.skills.map((skill) => ({
            path: `commands/${skill.dirName}.md`,
            title: skill.title,
            description: skill.description,
          }))
        : [],
      taxonomyPath: MCP_TAXONOMY_PATH,
      resources: metadata.resources,
      resourceTemplates: metadata.resourceTemplates,
      prompts: metadata.prompts,
    }
  }

  return loadManualAgentProjectModel(rootDir, config)
}

function loadManualAgentProjectModel(rootDir: string, config: PluginConfig): AgentProjectModel {
  const displayName = config.brand?.displayName ?? config.name
  const skillsDir = config.skills ? resolve(rootDir, config.skills) : undefined
  const commandsDir = config.commands ? resolve(rootDir, config.commands) : undefined
  const skills = readCanonicalSkillFiles(rootDir, skillsDir)
  const commands = readCanonicalCommandFiles(commandsDir).map((command) => ({
    path: normalizeRelativePath(relative(rootDir, command.filePath)),
    title: command.title,
    description: command.description,
  }))

  return {
    sourceKind: 'manual',
    displayName,
    metadataPath: 'manual Pluxx project (no .pluxx/mcp.json)',
    serverName: 'manual-project',
    transport: 'n/a',
    auth: 'not applicable',
    toolCount: 0,
    resourceCount: 0,
    promptCount: 0,
    skills,
    commands,
    resources: [],
    resourceTemplates: [],
    prompts: [],
  }
}

async function planFile(rootDir: string, relativePath: string, content: string): Promise<AgentPreparePlannedFile> {
  const filePath = resolve(rootDir, relativePath)
  const action = existsSync(filePath)
    ? ((await Bun.file(filePath).text()) === content ? 'unchanged' : 'update')
    : 'create'
  return { relativePath, content, action }
}

function buildAgentContext(
  config: Awaited<ReturnType<typeof loadConfig>>,
  project: AgentProjectModel,
  lint: LintResult,
  contextSources: AgentContextSource[],
  overrides: AgentOverrides | null,
): string {
  const resourceByUri = new Map((project.resources ?? []).map((resource) => [resource.uri, resource]))
  const resourceTemplateByUri = new Map((project.resourceTemplates ?? []).map((template) => [template.uriTemplate, template]))
  const promptByName = new Map((project.prompts ?? []).map((prompt) => [prompt.name, prompt]))
  const lines = [
    '# Pluxx Agent Context',
    '',
    '## Plugin',
    '',
    `- Name: \`${config.name}\``,
    `- Display name: ${project.displayName}`,
    `- Targets: ${config.targets.join(', ')}`,
    '',
    project.sourceKind === 'mcp-derived' ? '## MCP' : '## Source Project',
    '',
    `- Metadata source: \`${project.metadataPath}\``,
    ...(project.taxonomyPath ? [`- Semantic taxonomy: \`${project.taxonomyPath}\``] : []),
    `- Server name: \`${project.serverName}\``,
    `- Transport: ${project.transport}`,
    `- Auth: ${project.auth}`,
    `- Tool count: ${project.toolCount}`,
    `- Resource count: ${project.resourceCount}`,
    `- Prompt template count: ${project.promptCount}`,
    '',
    '## Generated Skills',
    '',
  ]

  for (const skill of project.skills) {
    const relatedResourceLabels = [
      ...(skill.resourceUris ?? []).map((uri) => {
        const resource = resourceByUri.get(uri)
        return resource ? `\`${resource.name ?? resource.title ?? resource.uri}\`` : null
      }),
      ...(skill.resourceTemplateUris ?? []).map((uriTemplate) => {
        const template = resourceTemplateByUri.get(uriTemplate)
        return template ? `\`${template.name}\`` : null
      }),
    ].filter((label): label is string => Boolean(label))
    const relatedPromptLabels = (skill.promptNames ?? [])
      .map((name) => promptByName.get(name)?.name ?? name)
      .map((name) => `\`${name}\``)

    lines.push(`### \`${skill.dirName}\``)
    lines.push('')
    lines.push(`- Title: ${skill.title}`)
    lines.push(`- Tools: ${skill.toolNames.join(', ') || 'none'}`)
    if (skill.description) {
      lines.push(`- Description: ${skill.description}`)
    }
    if (relatedResourceLabels.length > 0) {
      lines.push(`- Related resources: ${relatedResourceLabels.join(', ')}`)
    }
    if (relatedPromptLabels.length > 0) {
      lines.push(`- Related prompt templates: ${relatedPromptLabels.join(', ')}`)
    }
    lines.push('')
  }

  if (project.commands.length > 0) {
    lines.push('## Commands')
    lines.push('')
    for (const command of project.commands) {
      lines.push(`- \`${command.path}\`: ${command.description ?? command.title}`)
    }
    lines.push('')
  }

  if ((project.resources?.length ?? 0) > 0 || (project.resourceTemplates?.length ?? 0) > 0 || (project.prompts?.length ?? 0) > 0) {
    lines.push('## MCP Discovery Surfaces')
    lines.push('')

    for (const resource of project.resources ?? []) {
      const label = resource.name ?? resource.title ?? resource.uri
      lines.push(`- Resource \`${label}\`: ${summarizeDiscoveryDescription(resource.description, `URI: ${resource.uri}`)}`)
    }

    for (const template of project.resourceTemplates ?? []) {
      lines.push(`- Resource template \`${template.name}\`: ${summarizeDiscoveryDescription(template.description, `URI template: ${template.uriTemplate}`)}`)
    }

    for (const prompt of project.prompts ?? []) {
      const args = prompt.arguments?.map((argument) => `\`${argument.name}\`${argument.required ? ' (required)' : ''}`).join(', ')
      const trailing = args ? `Arguments: ${args}` : undefined
      lines.push(`- Prompt \`${prompt.name}\`: ${summarizeDiscoveryDescription(prompt.description, trailing)}`)
    }

    lines.push('')
  }

  lines.push('## Lint Snapshot')
  lines.push('')
  lines.push(`- Errors: ${lint.errors}`)
  lines.push(`- Warnings: ${lint.warnings}`)
  lines.push('')

  if (lint.issues.length > 0) {
    lines.push('### Current Issues')
    lines.push('')
    for (const issue of lint.issues.slice(0, 20)) {
      lines.push(`- [${issue.level}] ${issue.code}: ${issue.message}`)
    }
    lines.push('')
  }

  if (contextSources.length > 0) {
    lines.push('## Additional Context')
    lines.push('')
    for (const source of contextSources) {
      lines.push(`### ${source.kind === 'file' ? '`' + source.label + '`' : source.label}`)
      lines.push('')
      lines.push(source.summary)
      lines.push('')
    }
  }

  if (overrides) {
    lines.push('## Project Overrides')
    lines.push('')
    lines.push(`- Source: \`${overrides.path}\``)
    lines.push('')

    appendOverrideSection(lines, 'Product Hints', overrides.productHints)
    appendOverrideSection(lines, 'Setup/Auth Notes', overrides.setupAuthNotes)
    appendOverrideSection(lines, 'Grouping Hints', overrides.groupingHints)
    appendOverrideSection(lines, 'Taxonomy Guidance', overrides.taxonomyGuidance)
    appendOverrideSection(lines, 'Instructions Guidance', overrides.instructionsGuidance)
    appendOverrideSection(lines, 'Review Criteria', overrides.reviewCriteria)
  }

  lines.push('## Write Contract')
  lines.push('')
  if (project.sourceKind === 'mcp-derived') {
    lines.push('- Edit only Pluxx-managed generated sections.')
    lines.push(`- Preserve custom sections marked by \`${PLUXX_CUSTOM_START}\` and \`${PLUXX_CUSTOM_END}\`.`)
  } else {
    lines.push('- This manual Pluxx project currently supports review mode only in Agent Mode.')
    lines.push('- Do not assume marker-delimited generated sections exist in source files unless the project adds them explicitly later.')
  }
  lines.push('- Do not change auth wiring or target-platform config unless explicitly requested.')
  lines.push('- Do not edit generated platform bundles in `dist/`.')
  lines.push('')
  lines.push('## Quality Bar')
  lines.push('')
  lines.push('- Each skill should represent a real user workflow or product surface.')
  lines.push('- Setup, admin, account, and runtime workflows should be grouped intentionally.')
  lines.push('- Prefer branded product language in user-facing content; avoid exposing raw MCP server identifiers unless they are operationally required.')
  lines.push('- Avoid tiny singleton skills unless the surface is genuinely standalone.')
  lines.push('- Examples should be concrete and specific, not generic placeholders.')
  if (project.sourceKind === 'mcp-derived') {
    lines.push('- Weak MCP metadata (missing/generic tool descriptions) should be called out explicitly before publishing.')
    lines.push('- The wording should match the MCP product narrative, not just raw tool names.')
    lines.push('- Use discovered MCP resources and prompt templates when they clarify the real product surface.')
    lines.push('- Respect the per-skill resource and prompt-template associations in the metadata/context unless stronger discovery evidence shows they are wrong.')
  } else {
    lines.push('- The wording should match the plugin product narrative and install surface, not internal shorthand.')
    lines.push(`- Keep the configured compiler buckets coherent: ${getConfiguredCompilerBuckets(config).join(', ')}.`)
  }
  lines.push('- Keep INSTRUCTIONS.md as concise routing guidance; do not dump raw vendor documentation into generated sections.')
  lines.push('')

  return `${lines.join('\n')}\n`
}

function buildAgentModePlanJson(
  config: Awaited<ReturnType<typeof loadConfig>>,
  project: AgentProjectModel,
  lint: LintResult,
  editableFiles: AgentPlanFile[],
  protectedFiles: string[],
  generatedFiles: string[],
  contextSources: AgentContextSource[],
): string {
  const plan: AgentModePlanFile = {
    version: 1,
    plugin: {
      name: config.name,
      displayName: project.displayName,
      targets: [...config.targets],
    },
    mcp: {
      metadataPath: project.metadataPath,
      toolCount: project.toolCount,
      serverName: project.serverName,
      transport: project.transport,
      auth: project.auth,
    },
    contextInputs: contextSources.map((source) => source.label),
    files: {
      editable: editableFiles,
      protected: protectedFiles,
      generated: generatedFiles,
    },
    successCriteria: [
      'Each skill represents a real user workflow or product surface.',
      'Setup/admin/account tools are grouped intentionally.',
      'Examples are concrete and realistic.',
      project.sourceKind === 'mcp-derived'
        ? 'Weak MCP metadata is surfaced before publishing.'
        : 'Marketplace and install-facing copy stays concrete and operational.',
      project.sourceKind === 'mcp-derived'
        ? 'Only Pluxx-managed sections are modified.'
        : 'Review output stays read-only and does not assume marker-delimited edit regions.',
    ],
    caveats: lint.issues.map((issue) => `[${issue.level}] ${issue.code}: ${issue.message}`),
  }

  return JSON.stringify(plan, null, 2)
}

async function collectAgentContextSources(
  rootDir: string,
  options: AgentPrepareOptions,
  overrides: AgentOverrides | null,
): Promise<AgentContextSource[]> {
  const sources: AgentContextSource[] = []
  const seenFilePaths = new Set<string>()

  if (options.websiteUrl) {
    sources.push(await fetchContextSource(options.websiteUrl, 'website'))
  }

  if (options.docsUrl) {
    sources.push(await fetchContextSource(options.docsUrl, 'docs'))
  }

  const contextPaths = [
    ...(overrides?.contextPaths ?? []),
    ...(options.contextPaths ?? []),
  ]

  for (const relativePath of contextPaths) {
    if (seenFilePaths.has(relativePath)) continue
    seenFilePaths.add(relativePath)
    const filePath = resolve(rootDir, relativePath)
    if (!existsSync(filePath)) {
      sources.push({
        label: relativePath,
        kind: 'file',
        summary: `Unavailable: local file not found.`,
      })
      continue
    }

    const content = await Bun.file(filePath).text()
    sources.push({
      label: relativePath,
      kind: 'file',
      summary: summarizePlainText(content),
    })
  }

  return sources
}

async function fetchContextSource(url: string, kind: 'website' | 'docs'): Promise<AgentContextSource> {
  try {
    const response = await fetch(url)
    if (!response.ok) {
      return {
        label: url,
        kind,
        summary: `Unavailable: fetch failed with ${response.status} ${response.statusText}.`,
      }
    }

    const contentType = response.headers.get('content-type') ?? ''
    const body = await response.text()

    return {
      label: url,
      kind,
      summary: contentType.includes('html')
        ? summarizeHtml(body)
        : summarizePlainText(body),
    }
  } catch (error) {
    return {
      label: url,
      kind,
      summary: `Unavailable: ${error instanceof Error ? error.message : String(error)}.`,
    }
  }
}

function summarizeHtml(html: string): string {
  const title = matchHtmlTag(html, 'title')
  const description = matchMetaDescription(html)
  const headings = matchHtmlTags(html, ['h1', 'h2', 'h3']).slice(0, 5)
  const paragraphs = matchHtmlTags(html, ['p']).slice(0, 3)
  const lines: string[] = []

  if (title) {
    lines.push(`Title: ${title}`)
  }
  if (description) {
    lines.push(`Description: ${description}`)
  }
  if (headings.length > 0) {
    lines.push(`Headings: ${headings.join(' | ')}`)
  }
  if (paragraphs.length > 0) {
    lines.push(`Excerpt: ${paragraphs.join(' ').slice(0, 900)}`)
  }

  return lines.join('\n')
}

function summarizePlainText(content: string): string {
  return content
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 1200)
}

function matchHtmlTag(html: string, tag: string): string | null {
  const match = html.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'i'))
  return match ? cleanHtmlText(match[1]) : null
}

function matchMetaDescription(html: string): string | null {
  const match = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["'][^>]*>/i)
  return match ? cleanHtmlText(match[1]) : null
}

function matchHtmlTags(html: string, tags: string[]): string[] {
  const pattern = new RegExp(`<(?:${tags.join('|')})[^>]*>([\\s\\S]*?)</(?:${tags.join('|')})>`, 'ig')
  const values: string[] = []
  for (const match of html.matchAll(pattern)) {
    const value = cleanHtmlText(match[1])
    if (value) values.push(value)
  }
  return values
}

function cleanHtmlText(value: string): string {
  return value
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
}

function buildAgentPrompt(
  kind: AgentPromptKind,
  input: {
    pluginName: string
    displayName: string
    skillPaths: string[]
    commandPaths: string[]
    sourceKind: AgentProjectModel['sourceKind']
    taxonomyPath?: string
    overrides: AgentOverrides | null
  },
): string {
  const sharedIntro = [
    `# ${titleCase(kind)} Prompt`,
    '',
    `You are refining the Pluxx-generated plugin scaffold for \`${input.pluginName}\` (${input.displayName}).`,
    '',
    'Inputs:',
    '- `.pluxx/agent/context.md`',
    '- `.pluxx/agent/plan.json`',
    ...(input.taxonomyPath ? [`- \`${input.taxonomyPath}\``] : []),
    '- `INSTRUCTIONS.md`',
    ...input.skillPaths.map((path) => `- \`${path}\``),
    ...input.commandPaths.map((path) => `- \`${path}\``),
    '',
    'Rules:',
    '- Only edit Pluxx-managed generated sections.',
    `- Preserve all custom-note blocks between \`${PLUXX_CUSTOM_START}\` and \`${PLUXX_CUSTOM_END}\`.`,
    '- Do not change auth wiring or target-platform config.',
    '- Do not edit files under `dist/`.',
    ...(input.sourceKind === 'mcp-derived'
      ? [
          '- Treat discovered MCP resources, resource templates, and prompt templates as part of the product surface when they are present in the context and metadata.',
          '- Treat per-skill related resources and prompt templates in the context as default evidence for workflow boundaries and examples unless stronger discovery evidence contradicts them.',
        ]
      : []),
    '',
  ]

  if (kind === 'taxonomy') {
    return `${sharedIntro.join('\n')}Your job:\n1. Treat \`${MCP_TAXONOMY_PATH}\` as the semantic source of truth for skill grouping and naming.\n2. Infer the MCP's real product surfaces and workflows from tools, resources, resource templates, and prompt templates.\n3. Merge, split, or rename generated skills so labels are product-facing, not lexical buckets.\n4. Update the taxonomy file first; Pluxx will re-render generated skills and commands from that taxonomy after the pass.\n5. Keep setup/onboarding, account-admin, and runtime workflows intentionally separated when appropriate.\n6. Eliminate misleading labels such as contact or people discovery when the tools do not actually perform direct lookup.\n7. Use per-skill related resources and prompt templates as strong evidence for workflow shape, but correct them when broader discovery evidence shows a mismatch.\n8. Reject stale scaffold assumptions; if current files conflict with discovery context, prefer the discovery evidence and flag the mismatch.\n${buildPromptOverrideBlock(kind, input.overrides)}\nSuccess criteria:\n- each skill represents a real user workflow or product surface\n- skill names are product-shaped and avoid raw MCP tool/server identifiers when possible\n- setup/onboarding, account-admin, and runtime workflows are grouped intentionally\n- singleton skills are avoided unless they represent a real standalone user workflow\n- commands stay aligned with the chosen taxonomy and avoid weak command UX\n- per-skill resource and prompt-template associations remain coherent with the chosen taxonomy\n- taxonomy decisions are grounded in current discovery context, not stale scaffold assumptions\n`
  }

  if (kind === 'instructions') {
    return `${sharedIntro.join('\n')}Your job:\n1. Rewrite only the generated block in \`INSTRUCTIONS.md\`.\n2. Explain what the plugin is for, how the skills should be used, and which setup/admin/account/runtime boundaries matter.\n3. Use discovered tools, resources, resource templates, and prompt templates to produce short routing guidance, not a raw documentation dump.\n4. Keep wording aligned to the MCP's product narrative and branded language; avoid raw MCP server/tool identifiers except when technically required.\n5. Prefer the branded product name in user-facing copy; do not lead with internal MCP server identifiers.\n6. Replace stale scaffold claims with current discovery-backed language and keep command examples operational, concrete, and copy-paste runnable.\n7. When a workflow already has related resources or prompt templates in the context, keep the wording and examples aligned to that surfaced workflow evidence.\n${buildPromptOverrideBlock(kind, input.overrides)}\nSuccess criteria:\n- instructions are concise, actionable, and product-shaped\n- wording is branded and product-facing, not raw MCP-internal naming\n- auth/setup/admin caveats are explicit when relevant\n- raw MCP server identifiers are omitted unless operationally necessary\n- the generated section reads like routing guidance, not pasted vendor docs\n- command examples use strong command UX (clear intent, realistic args, and runnable shapes)\n- workflow guidance stays coherent with related resource and prompt-template evidence in the context\n- the file remains safe for future \`pluxx sync --from-mcp\`\n`
  }

  return `${sharedIntro.join('\n')}Your job:\n1. Review the current scaffold critically.\n2. Call out weak skill groupings, missing setup guidance, vague examples, product/category mismatches, raw documentation dumps, lexical skill names, stale scaffold assumptions, weak command UX${input.sourceKind === 'mcp-derived' ? ', incoherent per-skill resource/prompt associations, or weak MCP metadata signals' : ', weak marketplace/listing copy, awkward installation guidance, or unclear operator boundaries'}.\n3. Separate scaffold quality findings from runtime-correctness findings.\n4. Propose only the highest-value changes needed to make the scaffold useful.\n${buildPromptOverrideBlock(kind, input.overrides)}\nSuccess criteria:\n- findings are concrete and tied to files\n- scaffold quality gaps are distinguished from runtime correctness\n- stale assumptions${input.sourceKind === 'mcp-derived' ? ', incoherent per-skill discovery associations,' : ','} and command-UX weaknesses are identified explicitly when present\n- suggested changes improve user-facing plugin quality\n- recommendations stay inside Pluxx-managed boundaries\n`
}

function normalizeRelativePath(path: string): string {
  return path.replace(/\\/g, '/').replace(/^\.\//, '')
}

function readCanonicalSkillFiles(rootDir: string, skillsDir: string | undefined): AgentProjectSkill[] {
  if (!skillsDir || !existsSync(skillsDir)) return []

  return walkSkillMarkdownFiles(skillsDir)
    .sort((a, b) => a.localeCompare(b))
    .map((filePath) => {
      const content = readFileSync(filePath, 'utf-8')
      const { frontmatterLines, body } = splitSkillMarkdownFrontmatter(content)
      const dirName = normalizeRelativePath(relative(skillsDir, filePath).replace(/\/SKILL\.md$/i, ''))
      const title = firstMarkdownHeading(body) ?? dirName

      return {
        dirName,
        title,
        description: parseYamlDescription(frontmatterLines),
        toolNames: [],
        path: normalizeRelativePath(relative(rootDir, filePath)),
      }
    })
}

function walkSkillMarkdownFiles(dir: string): string[] {
  const entries = readdirSync(dir)
  const files: string[] = []

  for (const entry of entries) {
    const fullPath = resolve(dir, entry)
    const stat = statSync(fullPath)
    if (stat.isDirectory()) {
      files.push(...walkSkillMarkdownFiles(fullPath))
      continue
    }
    if (stat.isFile() && entry === 'SKILL.md') {
      files.push(fullPath)
    }
  }

  return files
}

function splitSkillMarkdownFrontmatter(content: string): {
  frontmatterLines: string[]
  body: string
} {
  const lines = content.split(/\r?\n/)
  if (lines[0]?.trim() !== '---') {
    return {
      frontmatterLines: [],
      body: content,
    }
  }

  let endIndex = -1
  for (let i = 1; i < lines.length; i += 1) {
    if (lines[i].trim() === '---') {
      endIndex = i
      break
    }
  }

  if (endIndex === -1) {
    return {
      frontmatterLines: [],
      body: content,
    }
  }

  return {
    frontmatterLines: lines.slice(1, endIndex),
    body: lines.slice(endIndex + 1).join('\n'),
  }
}

function parseYamlDescription(frontmatterLines: string[]): string | undefined {
  for (const line of frontmatterLines) {
    const match = /^description:\s*(.+)\s*$/i.exec(line.trim())
    if (match?.[1]) {
      return stripYamlScalar(match[1])
    }
  }

  return undefined
}

function firstMarkdownHeading(content: string): string | undefined {
  const lines = content.split(/\r?\n/)
  for (const line of lines) {
    const match = line.match(/^#\s+(.*)$/)
    if (match?.[1]?.trim()) return match[1].trim()
  }
  return undefined
}

function stripYamlScalar(value: string): string {
  const trimmed = value.trim()
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"'))
    || (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1).trim()
  }
  return trimmed
}

function summarizeDiscoveryDescription(description: string | undefined, trailing?: string): string {
  const base = description
    ?.replace(/\s+/g, ' ')
    .trim()
    .slice(0, 180)
  return [base || 'Discovered during MCP introspection.', trailing].filter(Boolean).join(' ')
}

function buildAgentRunnerPrompt(kind: AgentPromptKind, promptPath: string): string {
  const lines = [
    'You are running inside a Pluxx-generated plugin scaffold.',
    `Read and follow \`${AGENT_CONTEXT_PATH}\`, \`${AGENT_PLAN_PATH}\`, and \`${promptPath}\` before doing anything else.`,
    'Use the prompt file as the task definition.',
    'Respect the write contract in the plan file.',
    `Preserve all custom-note blocks between \`${PLUXX_CUSTOM_START}\` and \`${PLUXX_CUSTOM_END}\`.`,
    'Do not change auth wiring, target-platform config, or generated files under `dist/`.',
  ]

  if (kind === 'review') {
    lines.push('Do not edit files. Return findings only.')
  } else {
    lines.push('Edit only the Pluxx-managed generated sections allowed by the plan file.')
    lines.push('Do not run lint, build, or tests; Pluxx will verify the result afterward.')
    lines.push('When finished, provide a short summary of what you changed.')
  }

  return `${lines.join('\n')}\n`
}

function buildAgentRunnerCommand(
  runner: AgentRunner,
  kind: AgentPromptKind,
  prompt: string,
  options: {
    model?: string
    attach?: string
    workspace?: string
  } = {},
): string[] {
  const binary = AGENT_RUNNER_BINARIES[runner]

  if (runner === 'claude') {
    const args = [binary]
    if (options.model) {
      args.push('--model', options.model)
    }
    args.push(
      '--no-session-persistence',
      '--verbose',
      '--output-format',
      'stream-json',
      '--permission-mode',
      kind === 'review' ? 'plan' : 'acceptEdits',
      '-p',
      prompt,
    )
    return args
  }

  if (runner === 'codex') {
    // Codex headless edits can finish successfully and then stall during
    // session persistence/finalization. Ephemeral mode keeps the non-interactive
    // worker path stable for Pluxx agent/autopilot runs.
    const args = [binary, 'exec', '--ephemeral', '--skip-git-repo-check']
    if (options.model) {
      args.push('--model', options.model)
    }
    if (kind !== 'review') {
      args.push('--full-auto')
    }
    args.push(prompt)
    return args
  }

  if (runner === 'cursor') {
    if (!options.workspace) {
      throw new Error('Cursor runner requires a workspace path.')
    }

    const args = [binary, '-p', '--trust', '--workspace', options.workspace]
    if (kind !== 'review') {
      args.push('--force')
    }
    if (options.model) {
      args.push('--model', options.model)
    }
    args.push(prompt)
    return args
  }

  const args = [binary, 'run']
  if (options.model) {
    args.push('--model', options.model)
  }
  if (options.attach) {
    args.push('--attach', options.attach)
  }
  args.push(prompt)
  return args
}

async function resolveAgentRunnerModel(
  runner: AgentRunner,
  explicitModel?: string,
): Promise<AgentRunnerModelSummary> {
  if (explicitModel) {
    return {
      value: explicitModel,
      source: 'explicit',
      display: `${explicitModel} (explicit)`,
    }
  }

  const detectedModel = runner === 'codex'
    ? await readCodexDefaultModel()
    : runner === 'opencode'
      ? await readOpenCodeDefaultModel()
      : runner === 'claude'
        ? await readClaudeDefaultModel()
        : undefined

  if (detectedModel) {
    return {
      value: detectedModel,
      source: 'default',
      display: `${detectedModel} (local default)`,
    }
  }

  return {
    source: 'unknown',
    display: 'local default (CLI-managed)',
  }
}

async function readCodexDefaultModel(): Promise<string | undefined> {
  const codexHome = process.env.CODEX_HOME?.trim() || resolve(homedir(), '.codex')
  return await readTomlStringValue(resolve(codexHome, 'config.toml'), 'model')
}

async function readOpenCodeDefaultModel(): Promise<string | undefined> {
  const configHome = process.env.XDG_CONFIG_HOME?.trim() || resolve(homedir(), '.config')
  const configPath = resolve(configHome, 'opencode', 'opencode.json')
  const parsed = await readJsonFile(configPath)
  if (!parsed || typeof parsed !== 'object') {
    return undefined
  }

  if (typeof parsed.model === 'string' && parsed.model.trim()) {
    return parsed.model.trim()
  }

  if (
    typeof parsed.default_agent === 'string'
    && parsed.agent
    && typeof parsed.agent === 'object'
    && parsed.default_agent in parsed.agent
  ) {
    const defaultAgent = parsed.agent[parsed.default_agent]
    if (
      defaultAgent
      && typeof defaultAgent === 'object'
      && 'model' in defaultAgent
      && typeof defaultAgent.model === 'string'
      && defaultAgent.model.trim()
    ) {
      return defaultAgent.model.trim()
    }
  }

  return undefined
}

async function readClaudeDefaultModel(): Promise<string | undefined> {
  for (const candidate of [
    resolve(homedir(), '.claude', 'settings.json'),
    resolve(homedir(), '.claude', 'settings.local.json'),
    resolve(homedir(), '.claude.json'),
  ]) {
    const parsed = await readJsonFile(candidate)
    if (!parsed || typeof parsed !== 'object') continue
    for (const key of ['model', 'defaultModel', 'default_model']) {
      if (key in parsed && typeof parsed[key] === 'string' && parsed[key].trim()) {
        return parsed[key].trim()
      }
    }
  }

  return undefined
}

async function readTomlStringValue(filePath: string, key: string): Promise<string | undefined> {
  try {
    const raw = await readFile(filePath, 'utf8')
    const match = raw.match(new RegExp(`^\\s*${key}\\s*=\\s*"([^"]+)"\\s*$`, 'm'))
    return match?.[1]?.trim() || undefined
  } catch {
    return undefined
  }
}

async function readJsonFile(filePath: string): Promise<Record<string, any> | undefined> {
  try {
    const raw = await readFile(filePath, 'utf8')
    return JSON.parse(raw) as Record<string, any>
  } catch {
    return undefined
  }
}

async function ensureRunnerAvailable(runner: AgentRunner): Promise<void> {
  const binary = runner === 'cursor'
    ? await resolveCursorBinary()
    : AGENT_RUNNER_BINARIES[runner]
  const available = binary ? await commandExists(binary) : false
  if (!available) {
    if (runner === 'cursor') {
      throw new Error('The cursor runner requires the Cursor CLI `agent` or `cursor-agent` binary on PATH. Install it with `curl https://cursor.com/install -fsS | bash` or choose a different runner.')
    }
    throw new Error(`The ${runner} runner is not available on PATH. Install \`${binary}\` or choose a different runner.`)
  }
}

async function ensureRunnerAuthenticated(runner: AgentRunner): Promise<void> {
  if (runner !== 'cursor') return

  if (process.env.CURSOR_API_KEY && process.env.CURSOR_API_KEY.trim().length > 0) {
    return
  }

  const binary = await resolveCursorBinary()
  const isAuthenticated = binary ? await commandSucceeds([binary, 'status']) : false
  if (!isAuthenticated) {
    throw new Error('Cursor CLI authentication is required. Run `agent login` (or `cursor-agent login`) or export `CURSOR_API_KEY` before running Pluxx with `--runner cursor`.')
  }
}

async function resolveCursorBinary(): Promise<string | undefined> {
  for (const candidate of CURSOR_RUNNER_BINARIES) {
    if (await commandExists(candidate)) {
      return candidate
    }
  }

  return undefined
}

async function commandExists(binary: string): Promise<boolean> {
  return await new Promise<boolean>((resolvePromise) => {
    const child = spawn('sh', ['-c', `command -v ${shellQuote(binary)} >/dev/null 2>&1`], {
      stdio: 'ignore',
      env: process.env,
    })
    child.on('close', (code) => resolvePromise(code === 0))
    child.on('error', () => resolvePromise(false))
  })
}

async function commandSucceeds(command: string[]): Promise<boolean> {
  return await new Promise<boolean>((resolvePromise) => {
    const child = spawn(command[0], command.slice(1), {
      stdio: 'ignore',
      env: process.env,
    })
    child.on('close', (code) => resolvePromise(code === 0))
    child.on('error', () => resolvePromise(false))
  })
}

async function executeCommand(
  command: string[],
  cwd: string,
  options: {
    streamOutput?: boolean
    env?: NodeJS.ProcessEnv
  } = {},
): Promise<number> {
  const runtimeCommand = [...command]
  let codexOutputDir: string | null = null
  let codexLastMessagePath: string | null = null
  const isClaudeStreamJson = runtimeCommand[0] === 'claude'
    && runtimeCommand.includes('--output-format')
    && runtimeCommand.includes('stream-json')

  if (runtimeCommand[0] === 'codex' && runtimeCommand[1] === 'exec') {
    codexOutputDir = await mkdtemp(resolve(tmpdir(), 'pluxx-codex-output-'))
    codexLastMessagePath = resolve(codexOutputDir, 'last-message.txt')
    runtimeCommand.splice(2, 0, '--json', '--output-last-message', codexLastMessagePath)
  }

  return await new Promise<number>((resolvePromise, reject) => {
    const child = spawn(runtimeCommand[0], runtimeCommand.slice(1), {
      cwd,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: options.env ?? process.env,
    })
    let killedAfterFinalMessage = false
    let sawFinalMessageAt: number | null = null
    let codexStdoutBuffer = ''
    let codexTurnCompleted = false
    let codexTurnFailed = false
    let claudeStdoutBuffer = ''
    let claudeTurnCompleted = false
    let claudeTurnFailed = false
    const sentinelInterval = (codexLastMessagePath || isClaudeStreamJson)
      ? setInterval(() => {
        const sawCompletionSignal = codexTurnCompleted
          || codexTurnFailed
          || claudeTurnCompleted
          || claudeTurnFailed
          || (codexLastMessagePath ? existsSync(codexLastMessagePath) : false)
        if (!sawCompletionSignal) return
        if (sawFinalMessageAt == null) {
          sawFinalMessageAt = Date.now()
          return
        }
        if (!killedAfterFinalMessage && Date.now() - sawFinalMessageAt >= 1500) {
          killedAfterFinalMessage = true
          child.kill('SIGTERM')
        }
      }, 250)
      : null

    const finalize = async (result: number, error?: Error): Promise<void> => {
      if (sentinelInterval) clearInterval(sentinelInterval)
      if (codexOutputDir) {
        await rm(codexOutputDir, { recursive: true, force: true })
      }
      if (error) {
        reject(error)
        return
      }
      resolvePromise(result)
    }

    child.stdout?.on('data', (chunk) => {
      const text = chunk.toString()
      if (codexLastMessagePath || isClaudeStreamJson) {
        const buffer = codexLastMessagePath ? codexStdoutBuffer + text : claudeStdoutBuffer + text
        const lines = buffer.split('\n')
        const remainder = lines.pop() ?? ''
        if (codexLastMessagePath) {
          codexStdoutBuffer = remainder
        } else {
          claudeStdoutBuffer = remainder
        }
        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed) continue
          try {
            const event = JSON.parse(trimmed) as { type?: string; subtype?: string; is_error?: boolean }
            if (codexLastMessagePath) {
              if (event.type === 'turn.completed') {
                codexTurnCompleted = true
              } else if (event.type === 'turn.failed' || event.type === 'error') {
                codexTurnFailed = true
              }
            } else if (isClaudeStreamJson) {
              if (event.type === 'result') {
                if (event.is_error || event.subtype === 'error') {
                  claudeTurnFailed = true
                } else {
                  claudeTurnCompleted = true
                }
              }
            }
          } catch {
            // Ignore non-JSON lines. Codex still writes some human-readable output to stderr.
          }
        }
      }
      if (options.streamOutput) process.stdout.write(chunk)
    })
    child.stderr?.on('data', (chunk) => {
      if (options.streamOutput) process.stderr.write(chunk)
    })

    child.on('error', (error) => {
      void finalize(1, error)
    })
    child.on('close', (code) => {
      const result = codexTurnFailed || claudeTurnFailed
        ? 1
        : (killedAfterFinalMessage || codexTurnCompleted || claudeTurnCompleted ? 0 : (code ?? 1))
      void finalize(result)
    })
  })
}

async function prepareRunnerExecution(runner: AgentRunner): Promise<{
  env: NodeJS.ProcessEnv
  cleanup?: () => Promise<void>
}> {
  if (runner === 'cursor') {
    const cursorBinary = await resolveCursorBinary()
    if (!cursorBinary || cursorBinary === AGENT_RUNNER_BINARIES.cursor) {
      return { env: process.env }
    }

    const shimDir = await mkdtemp(resolve(tmpdir(), 'pluxx-cursor-bin-'))
    const shimPath = resolve(shimDir, AGENT_RUNNER_BINARIES.cursor)
    await Bun.write(
      shimPath,
      `#!/bin/sh\nexec ${shellQuote(cursorBinary)} "$@"\n`,
    )
    await chmod(shimPath, 0o755)

    return {
      env: {
        ...process.env,
        PATH: `${shimDir}:${process.env.PATH ?? ''}`,
      },
      cleanup: async () => {
        await rm(shimDir, { recursive: true, force: true })
      },
    }
  }

  if (runner !== 'codex') {
    return { env: process.env }
  }

  const currentCodexHome = process.env.CODEX_HOME?.trim() || resolve(homedir(), '.codex')
  const isolatedCodexHome = await mkdtemp(resolve(tmpdir(), 'pluxx-codex-home-'))
  await mkdir(resolve(isolatedCodexHome, 'memories'), { recursive: true })

  for (const relativePath of ['auth.json', 'config.toml', 'hooks.json', 'installation_id']) {
    const sourcePath = resolve(currentCodexHome, relativePath)
    if (!existsSync(sourcePath)) continue
    await copyFile(sourcePath, resolve(isolatedCodexHome, relativePath))
  }

  const rulesSourceDir = resolve(currentCodexHome, 'rules')
  if (existsSync(rulesSourceDir)) {
    const rulesTargetDir = resolve(isolatedCodexHome, 'rules')
    await mkdir(rulesTargetDir, { recursive: true })
    const defaultRulesPath = resolve(rulesSourceDir, 'default.rules')
    if (existsSync(defaultRulesPath)) {
      await copyFile(defaultRulesPath, resolve(rulesTargetDir, 'default.rules'))
    }
  }

  return {
    env: {
      ...process.env,
      CODEX_HOME: isolatedCodexHome,
    },
    cleanup: async () => {
      await rm(isolatedCodexHome, { recursive: true, force: true })
    },
  }
}

function shellQuote(value: string): string {
  if (/^[A-Za-z0-9_/:=.,-]+$/.test(value)) {
    return value
  }

  return `'${value.replace(/'/g, `'\"'\"'`)}'`
}

function describeAuth(server: { auth?: { type: string; envVar?: string; headerName?: string } }): string {
  const auth = server.auth
  if (!auth || auth.type === 'none') {
    return 'none'
  }

  if (auth.type === 'header') {
    return `header via ${auth.headerName ?? 'custom header'} from ${auth.envVar ?? 'env'}`
  }

  if (auth.type === 'platform') {
    return 'platform-managed auth'
  }

  return `bearer via ${auth.envVar ?? 'env'}`
}

function titleCase(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1)
}

async function loadAgentOverrides(rootDir: string): Promise<AgentOverrides | null> {
  const overridesPath = resolve(rootDir, AGENT_OVERRIDES_PATH)
  if (!existsSync(overridesPath)) {
    return null
  }

  const content = await Bun.file(overridesPath).text()
  return parseAgentOverrides(content, AGENT_OVERRIDES_PATH)
}

function parseAgentOverrides(content: string, path: string): AgentOverrides {
  const sections = new Map<string, string[]>()
  let currentSection: string | null = null

  for (const rawLine of content.split(/\r?\n/)) {
    const heading = rawLine.match(/^##\s+(.+?)\s*$/)
    if (heading) {
      currentSection = normalizeOverrideHeading(heading[1])
      if (currentSection && !sections.has(currentSection)) {
        sections.set(currentSection, [])
      }
      continue
    }

    if (!currentSection) continue
    sections.get(currentSection)?.push(rawLine)
  }

  const contextPaths = extractListItems(sections.get('context-paths') ?? [])

  return {
    path,
    contextPaths,
    productHints: normalizeOverrideBody(sections.get('product-hints')),
    setupAuthNotes: normalizeOverrideBody(sections.get('setup-auth-notes')),
    groupingHints: normalizeOverrideBody(sections.get('grouping-hints')),
    taxonomyGuidance: normalizeOverrideBody(sections.get('taxonomy-guidance')),
    instructionsGuidance: normalizeOverrideBody(sections.get('instructions-guidance')),
    reviewCriteria: normalizeOverrideBody(sections.get('review-criteria')),
  }
}

function normalizeOverrideHeading(value: string): string | null {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

  const aliases: Record<string, string> = {
    'context-paths': 'context-paths',
    'context-files': 'context-paths',
    'product-hints': 'product-hints',
    'setup-auth-notes': 'setup-auth-notes',
    'setup-and-auth-notes': 'setup-auth-notes',
    'setup-auth-guidance': 'setup-auth-notes',
    'grouping-hints': 'grouping-hints',
    'tool-grouping-hints': 'grouping-hints',
    'taxonomy-guidance': 'taxonomy-guidance',
    'instructions-guidance': 'instructions-guidance',
    'review-criteria': 'review-criteria',
  }

  return aliases[normalized] ?? null
}

function extractListItems(lines: string[]): string[] {
  return lines
    .map((line) => line.trim())
    .filter((line) => line.startsWith('- ') || line.startsWith('* '))
    .map((line) => line.slice(2).trim())
    .filter(Boolean)
}

function normalizeOverrideBody(lines: string[] | undefined): string | undefined {
  if (!lines) return undefined
  const value = lines.join('\n').trim()
  return value || undefined
}

function appendOverrideSection(lines: string[], heading: string, content: string | undefined): void {
  if (!content) return
  lines.push(`### ${heading}`)
  lines.push('')
  lines.push(content)
  lines.push('')
}

function buildPromptOverrideBlock(kind: AgentPromptKind, overrides: AgentOverrides | null): string {
  if (!overrides) return ''

  const additions: string[] = []

  if (overrides.productHints) {
    additions.push(`Product hints:\n${overrides.productHints}`)
  }
  if (overrides.setupAuthNotes) {
    additions.push(`Setup/auth notes:\n${overrides.setupAuthNotes}`)
  }

  if (kind === 'taxonomy') {
    if (overrides.groupingHints) {
      additions.push(`Grouping hints:\n${overrides.groupingHints}`)
    }
    if (overrides.taxonomyGuidance) {
      additions.push(`Taxonomy guidance:\n${overrides.taxonomyGuidance}`)
    }
  }

  if (kind === 'instructions' && overrides.instructionsGuidance) {
    additions.push(`Instructions guidance:\n${overrides.instructionsGuidance}`)
  }

  if (kind === 'review' && overrides.reviewCriteria) {
    additions.push(`Additional review criteria:\n${overrides.reviewCriteria}`)
  }

  if (additions.length === 0) return ''
  return `\nProject overrides:\n${additions.map((block) => `- ${block.replace(/\n/g, '\n  ')}`).join('\n')}\n`
}
