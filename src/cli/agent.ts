import { existsSync } from 'fs'
import { mkdir } from 'fs/promises'
import { resolve } from 'path'
import { spawn } from 'child_process'
import { loadConfig } from '../config/load'
import { lintProject, type LintResult } from './lint'
import { runTestSuite, type TestRunResult } from './test'
import {
  MCP_SCAFFOLD_METADATA_PATH,
  PLUXX_CUSTOM_END,
  PLUXX_CUSTOM_START,
  PLUXX_GENERATED_END,
  PLUXX_GENERATED_START,
  type McpScaffoldMetadata,
} from './init-from-mcp'

export const AGENT_CONTEXT_PATH = '.pluxx/agent/context.md'
export const AGENT_PLAN_PATH = '.pluxx/agent/plan.json'
export const AGENT_OVERRIDES_PATH = 'pluxx.agent.md'
export const AGENT_PROMPT_KINDS = ['taxonomy', 'instructions', 'review'] as const
export const AGENT_RUNNERS = ['claude', 'opencode', 'codex'] as const
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
}

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

export interface AgentRunSummary {
  pluginName: string
  kind: AgentPromptKind
  runner: AgentRunner
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

export async function planAgentPrepare(
  rootDir: string = process.cwd(),
  options: AgentPrepareOptions = {},
): Promise<AgentPreparePlan> {
  const config = await loadConfig(rootDir)
  const metadata = await loadMcpScaffoldMetadata(rootDir)
  const lint = await lintProject(rootDir)
  const overrides = await loadAgentOverrides(rootDir)
  const contextSources = await collectAgentContextSources(rootDir, options, overrides)
  const editableFiles = buildEditableFiles(metadata)
  const protectedFiles = buildProtectedFiles()
  const generatedFiles = [AGENT_CONTEXT_PATH, AGENT_PLAN_PATH]
  const contextContent = buildAgentContext(config, metadata, lint, contextSources, overrides)
  const planContent = buildAgentModePlanJson(config, metadata, lint, editableFiles, protectedFiles, generatedFiles, contextSources)

  const files = await Promise.all([
    planFile(rootDir, AGENT_CONTEXT_PATH, contextContent),
    planFile(rootDir, AGENT_PLAN_PATH, `${planContent}\n`),
  ])

  return {
    pluginName: config.name,
    targetCount: config.targets.length,
    toolCount: metadata.tools.length,
    skillCount: metadata.skills.length,
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
  const metadata = await loadMcpScaffoldMetadata(rootDir)
  const overrides = await loadAgentOverrides(rootDir)
  const contextPath = resolve(rootDir, AGENT_CONTEXT_PATH)

  if (!options.allowMissingContext && !existsSync(contextPath)) {
    throw new Error(`No agent context found at ${AGENT_CONTEXT_PATH}. Run "pluxx agent prepare" first.`)
  }

  const outputPath = AGENT_PROMPT_PATHS[kind]
  const content = buildAgentPrompt(kind, {
    pluginName: config.name,
    displayName: config.brand?.displayName ?? metadata.settings.displayName ?? config.name,
    skillPaths: metadata.skills.map((skill) => `skills/${skill.dirName}/SKILL.md`),
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

  if (options.runner === 'codex' && options.model) {
    throw new Error('--model is not yet supported for the codex runner in Pluxx. Use the default Codex CLI model selection for now.')
  }

  const preparePlan = await planAgentPrepare(rootDir, prepareOptions)
  const promptPlan = await planAgentPrompt(rootDir, kind, { allowMissingContext: true })
  const promptPath = AGENT_PROMPT_PATHS[kind]
  const verify = kind === 'review' ? false : options.verify !== false
  const command = buildAgentRunnerCommand(options.runner, kind, buildAgentRunnerPrompt(kind, promptPath), {
    model: options.model,
    attach: options.attach,
  })

  return {
    pluginName: preparePlan.pluginName,
    kind,
    runner: options.runner,
    verify,
    command,
    commandDisplay: command.map(shellQuote).join(' '),
    promptPath,
    contextPath: AGENT_CONTEXT_PATH,
    createdFiles: [...preparePlan.createdFiles, ...promptPlan.createdFiles],
    updatedFiles: [...preparePlan.updatedFiles, ...promptPlan.updatedFiles],
    contextInputs: preparePlan.contextInputs,
    files: [...preparePlan.files, ...promptPlan.files],
  }
}

export async function runAgentPlan(
  rootDir: string,
  plan: AgentRunPlan,
  options: {
    streamOutput?: boolean
  } = {},
): Promise<AgentRunResult> {
  for (const file of plan.files) {
    const filePath = resolve(rootDir, file.relativePath)
    const parentDir = file.relativePath.split('/').slice(0, -1).join('/')
    if (parentDir) {
      await mkdir(resolve(rootDir, parentDir), { recursive: true })
    }
    await Bun.write(filePath, file.content)
  }

  await ensureRunnerAvailable(plan.runner)
  const runnerExitCode = await executeCommand(plan.command, rootDir, {
    streamOutput: options.streamOutput === true,
  })
  const verification = runnerExitCode === 0 && plan.verify
    ? await runTestSuite({ rootDir })
    : undefined

  return {
    ...plan,
    ok: runnerExitCode === 0 && (verification?.ok ?? true),
    runnerExitCode,
    verification,
  }
}

function buildEditableFiles(metadata: McpScaffoldMetadata): AgentPlanFile[] {
  const files: AgentPlanFile[] = [{
    path: 'INSTRUCTIONS.md',
    managedSections: [{ start: PLUXX_GENERATED_START, end: PLUXX_GENERATED_END }],
  }]

  for (const skill of metadata.skills) {
    files.push({
      path: `skills/${skill.dirName}/SKILL.md`,
      managedSections: [{ start: PLUXX_GENERATED_START, end: PLUXX_GENERATED_END }],
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

async function planFile(rootDir: string, relativePath: string, content: string): Promise<AgentPreparePlannedFile> {
  const filePath = resolve(rootDir, relativePath)
  const action = existsSync(filePath)
    ? ((await Bun.file(filePath).text()) === content ? 'unchanged' : 'update')
    : 'create'
  return { relativePath, content, action }
}

function buildAgentContext(
  config: Awaited<ReturnType<typeof loadConfig>>,
  metadata: McpScaffoldMetadata,
  lint: LintResult,
  contextSources: AgentContextSource[],
  overrides: AgentOverrides | null,
): string {
  const serverEntry = Object.entries(config.mcp ?? {})[0]
  const [serverName, server] = serverEntry ?? ['unknown', undefined]
  const displayName = config.brand?.displayName ?? metadata.settings.displayName ?? config.name
  const lines = [
    '# Pluxx Agent Context',
    '',
    '## Plugin',
    '',
    `- Name: \`${config.name}\``,
    `- Display name: ${displayName}`,
    `- Targets: ${config.targets.join(', ')}`,
    '',
    '## MCP',
    '',
    `- Metadata source: \`${MCP_SCAFFOLD_METADATA_PATH}\``,
    `- Server name: \`${serverName}\``,
    `- Transport: ${server?.transport ?? metadata.source.transport}`,
    `- Auth: ${describeAuth(server ?? metadata.source)}`,
    `- Tool count: ${metadata.tools.length}`,
    '',
    '## Generated Skills',
    '',
  ]

  for (const skill of metadata.skills) {
    lines.push(`### \`${skill.dirName}\``)
    lines.push('')
    lines.push(`- Title: ${skill.title}`)
    lines.push(`- Tools: ${skill.toolNames.join(', ') || 'none'}`)
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
  lines.push('- Edit only Pluxx-managed generated sections.')
  lines.push(`- Preserve custom sections marked by \`${PLUXX_CUSTOM_START}\` and \`${PLUXX_CUSTOM_END}\`.`)
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
  lines.push('- Weak MCP metadata (missing/generic tool descriptions) should be called out explicitly before publishing.')
  lines.push('- The wording should match the MCP product narrative, not just raw tool names.')
  lines.push('')

  return `${lines.join('\n')}\n`
}

function buildAgentModePlanJson(
  config: Awaited<ReturnType<typeof loadConfig>>,
  metadata: McpScaffoldMetadata,
  lint: LintResult,
  editableFiles: AgentPlanFile[],
  protectedFiles: string[],
  generatedFiles: string[],
  contextSources: AgentContextSource[],
): string {
  const serverEntry = Object.entries(config.mcp ?? {})[0]
  const [serverName, server] = serverEntry ?? ['unknown', metadata.source]
  const plan: AgentModePlanFile = {
    version: 1,
    plugin: {
      name: config.name,
      displayName: config.brand?.displayName ?? metadata.settings.displayName ?? config.name,
      targets: [...config.targets],
    },
    mcp: {
      metadataPath: MCP_SCAFFOLD_METADATA_PATH,
      toolCount: metadata.tools.length,
      serverName,
      transport: server.transport,
      auth: describeAuth(server),
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
      'Weak MCP metadata is surfaced before publishing.',
      'Only Pluxx-managed sections are modified.',
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
    '- `INSTRUCTIONS.md`',
    ...input.skillPaths.map((path) => `- \`${path}\``),
    '',
    'Rules:',
    '- Only edit Pluxx-managed generated sections.',
    `- Preserve all custom-note blocks between \`${PLUXX_CUSTOM_START}\` and \`${PLUXX_CUSTOM_END}\`.`,
    '- Do not change auth wiring or target-platform config.',
    '- Do not edit files under `dist/`.',
    '',
  ]

  if (kind === 'taxonomy') {
    return `${sharedIntro.join('\n')}Your job:\n1. Infer the MCP's real product surfaces and workflows.\n2. Merge, split, or rename generated skills so labels are product-facing, not lexical buckets.\n3. Remove misleading skill labels and avoid tiny singleton/admin-only skills unless clearly justified.\n4. Rewrite the generated blocks in the skill files so each skill maps to a real user workflow or product surface.\n5. Keep setup/onboarding, account-admin, and runtime workflows intentionally separated when appropriate.\n6. Eliminate misleading labels such as contact or people discovery when the tools do not actually perform direct lookup.\n${buildPromptOverrideBlock(kind, input.overrides)}\nSuccess criteria:\n- each skill represents a real user workflow or product surface\n- skill names are product-shaped and avoid raw MCP tool/server identifiers when possible\n- setup/onboarding, account-admin, and runtime workflows are grouped intentionally\n- singleton skills are avoided unless they represent a real standalone user workflow\n- examples are concrete and realistic\n`
  }

  if (kind === 'instructions') {
    return `${sharedIntro.join('\n')}Your job:\n1. Rewrite only the generated block in \`INSTRUCTIONS.md\`.\n2. Explain what the plugin is for, how the skills should be used, and which setup/admin/account/runtime boundaries matter.\n3. Keep wording aligned to the MCP's product narrative and branded language; avoid raw MCP server/tool identifiers except when technically required.\n4. Prefer the branded product name in user-facing copy; do not lead with internal MCP server identifiers.\n${buildPromptOverrideBlock(kind, input.overrides)}\nSuccess criteria:\n- instructions are concise, actionable, and product-shaped\n- wording is branded and product-facing, not raw MCP-internal naming\n- auth/setup/admin caveats are explicit when relevant\n- raw MCP server identifiers are omitted unless operationally necessary\n- the file remains safe for future \`pluxx sync --from-mcp\`\n`
  }

  return `${sharedIntro.join('\n')}Your job:\n1. Review the current scaffold critically.\n2. Call out weak skill groupings, missing setup guidance, vague examples, product/category mismatches, or weak MCP metadata signals.\n3. Separate scaffold quality findings from runtime-correctness findings.\n4. Propose only the highest-value changes needed to make the scaffold useful.\n${buildPromptOverrideBlock(kind, input.overrides)}\nSuccess criteria:\n- findings are concrete and tied to files\n- scaffold quality gaps are distinguished from runtime correctness\n- suggested changes improve user-facing plugin quality\n- recommendations stay inside Pluxx-managed boundaries\n`
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
  } = {},
): string[] {
  const binary = AGENT_RUNNER_BINARIES[runner]

  if (runner === 'claude') {
    const args = [binary]
    if (options.model) {
      args.push('--model', options.model)
    }
    args.push('--permission-mode', kind === 'review' ? 'plan' : 'acceptEdits', '-p', prompt)
    return args
  }

  if (runner === 'codex') {
    const args = [binary, 'exec']
    if (kind !== 'review') {
      args.push('--full-auto')
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

async function ensureRunnerAvailable(runner: AgentRunner): Promise<void> {
  const binary = AGENT_RUNNER_BINARIES[runner]
  const available = await commandExists(binary)
  if (!available) {
    throw new Error(`The ${runner} runner is not available on PATH. Install \`${binary}\` or choose a different runner.`)
  }
}

async function commandExists(binary: string): Promise<boolean> {
  return await new Promise<boolean>((resolvePromise) => {
    const child = spawn('sh', ['-lc', `command -v ${shellQuote(binary)} >/dev/null 2>&1`], {
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
  } = {},
): Promise<number> {
  return await new Promise<number>((resolvePromise, reject) => {
    const child = spawn(command[0], command.slice(1), {
      cwd,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: process.env,
    })

    if (options.streamOutput) {
      child.stdout?.on('data', (chunk) => process.stdout.write(chunk))
      child.stderr?.on('data', (chunk) => process.stderr.write(chunk))
    }

    child.on('error', (error) => reject(error))
    child.on('close', (code) => resolvePromise(code ?? 1))
  })
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
