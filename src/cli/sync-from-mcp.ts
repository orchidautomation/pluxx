import { existsSync, mkdtempSync, readFileSync, rmSync, readdirSync, rmdirSync, writeFileSync } from 'fs'
import { dirname, isAbsolute, relative, resolve } from 'path'
import { z } from 'zod'
import { tmpdir } from 'os'
import {
  applyFileMutations,
  copyProjectForStaging,
  createMutationManifest,
  readFileMutation,
  type MutationConflict,
  type MutationHooks,
  type MutationManifest,
} from '../fs-transaction'
import { loadConfig } from '../config/load'
import { introspectMcpServer, type IntrospectedMcpTool } from '../mcp/introspect'
import { McpServerSchema, UserConfigEntrySchema, type McpServer } from '../schema'
import {
  MCP_SCAFFOLD_METADATA_PATH,
  MCP_HOOK_MODES,
  MCP_RUNTIME_AUTH_MODES,
  MCP_SKILL_GROUPINGS,
  MCP_TAXONOMY_PATH,
  PLUXX_CUSTOM_START,
  PLUXX_CUSTOM_END,
  extractMixedMarkdownContent,
  hasMeaningfulCustomContent,
  type McpScaffoldMetadata,
  type PersistedSkill,
  writeMcpScaffold,
} from './init-from-mcp'

export interface SyncFromMcpOptions {
  rootDir: string
  source?: McpServer
  mutationHooks?: MutationHooks
}

export interface SyncFromMcpResult {
  source: McpServer
  toolCount: number
  addedFiles: string[]
  updatedFiles: string[]
  removedFiles: string[]
  preservedFiles: string[]
  renamedFiles: Array<{ from: string; to: string }>
  conflicts: MutationConflict[]
  mutation: MutationManifest
}

export async function readMcpScaffoldMetadata(rootDir: string): Promise<McpScaffoldMetadata> {
  const filepath = resolveWithinRoot(rootDir, MCP_SCAFFOLD_METADATA_PATH)
  if (!existsSync(filepath)) {
    throw new Error(
      `No MCP scaffold metadata found at ${MCP_SCAFFOLD_METADATA_PATH}. Run "pluxx init --from-mcp" first.`,
    )
  }

  const raw = JSON.parse(readFileSync(filepath, 'utf-8'))
  const result = McpScaffoldMetadataSchema.safeParse(raw)
  if (!result.success) {
    const details = result.error.issues
      .map((issue) => {
        const path = issue.path.length > 0 ? issue.path.join('.') : '<root>'
        return `${path}: ${issue.message}`
      })
      .slice(0, 5)
      .join('; ')
    throw new Error(
      `Invalid MCP scaffold metadata at ${MCP_SCAFFOLD_METADATA_PATH}: ${details}. `
      + `Fix: rerun "pluxx init --from-mcp" or restore a valid ${MCP_SCAFFOLD_METADATA_PATH} before syncing.`,
    )
  }

  return result.data as McpScaffoldMetadata
}

const IntrospectedServerInfoSchema = z.object({
  name: z.string(),
  title: z.string().optional(),
  version: z.string().optional(),
  description: z.string().optional(),
  websiteUrl: z.string().optional(),
}).passthrough()

const IntrospectedToolSchema = z.object({
  name: z.string(),
  title: z.string().optional(),
  description: z.string().optional(),
  inputSchema: z.record(z.string(), z.unknown()).optional(),
}).passthrough()

const IntrospectedResourceSchema = z.object({
  uri: z.string(),
  name: z.string().optional(),
  title: z.string().optional(),
  description: z.string().optional(),
  mimeType: z.string().optional(),
}).passthrough()

const IntrospectedResourceTemplateSchema = z.object({
  uriTemplate: z.string(),
  name: z.string(),
  title: z.string().optional(),
  description: z.string().optional(),
  mimeType: z.string().optional(),
}).passthrough()

const IntrospectedPromptSchema = z.object({
  name: z.string(),
  title: z.string().optional(),
  description: z.string().optional(),
  arguments: z.array(z.object({
    name: z.string(),
    description: z.string().optional(),
    required: z.boolean().optional(),
  }).passthrough()).optional(),
}).passthrough()

const McpScaffoldMetadataSchema = z.object({
  version: z.literal(1),
  source: McpServerSchema,
  serverInfo: IntrospectedServerInfoSchema,
  settings: z.object({
    pluginName: z.string(),
    displayName: z.string(),
    description: z.string().optional(),
    skillGrouping: z.enum(MCP_SKILL_GROUPINGS),
    requestedHookMode: z.enum(MCP_HOOK_MODES),
    generatedHookMode: z.enum(MCP_HOOK_MODES),
    generatedHookEvents: z.array(z.string()),
    runtimeAuthMode: z.enum(MCP_RUNTIME_AUTH_MODES),
  }).strict(),
  userConfig: z.array(UserConfigEntrySchema),
  tools: z.array(IntrospectedToolSchema),
  resources: z.array(IntrospectedResourceSchema).optional(),
  resourceTemplates: z.array(IntrospectedResourceTemplateSchema).optional(),
  prompts: z.array(IntrospectedPromptSchema).optional(),
  skills: z.array(z.object({
    dirName: z.string(),
    title: z.string(),
    description: z.string().optional(),
    toolNames: z.array(z.string()),
    resourceUris: z.array(z.string()).optional(),
    resourceTemplateUris: z.array(z.string()).optional(),
    promptNames: z.array(z.string()).optional(),
  }).strict()),
  managedFiles: z.array(z.string()),
}).strict()

export async function syncFromMcp(options: SyncFromMcpOptions): Promise<SyncFromMcpResult> {
  const metadata = await readMcpScaffoldMetadata(options.rootDir)
  const tempRoot = mkdtempSync(resolve(tmpdir(), 'pluxx-sync-stage-'))
  const stagedRoot = resolve(tempRoot, 'project')

  try {
    copyProjectForStaging(options.rootDir, stagedRoot)
    const result = await syncFromMcpInPlace({
      rootDir: stagedRoot,
      source: options.source,
    })
    if (result.conflicts.length > 0) return result

    const stagedMetadata = await readMcpScaffoldMetadata(stagedRoot)
    const candidatePaths = new Set([
      ...metadata.managedFiles,
      ...stagedMetadata.managedFiles,
      ...AGENT_PACK_FILES,
    ])
    const mutations = [...candidatePaths].flatMap((path) => {
      const currentPath = resolveWithinRoot(options.rootDir, path)
      const stagedPath = resolveWithinRoot(stagedRoot, path)
      const currentExists = existsSync(currentPath)
      const stagedExists = existsSync(stagedPath)
      if (!currentExists && !stagedExists) return []
      if (currentExists && stagedExists) {
        if (readFileSync(currentPath, 'utf-8') === readFileSync(stagedPath, 'utf-8')) return []
      }
      return [readFileMutation(options.rootDir, stagedRoot, path)]
    })

    applyFileMutations(options.rootDir, mutations, options.mutationHooks)
    return {
      ...result,
      mutation: createMutationManifest({
        files: mutations,
        renames: result.renamedFiles,
        conflicts: result.conflicts,
      }),
    }
  } finally {
    rmSync(tempRoot, { recursive: true, force: true })
  }
}

async function syncFromMcpInPlace(options: SyncFromMcpOptions): Promise<SyncFromMcpResult> {
  const metadata = await readMcpScaffoldMetadata(options.rootDir)
  const config = await loadConfig(options.rootDir)
  const source = options.source ?? metadata.source
  const introspection = await introspectMcpServer(source)
  const beforeContents = snapshotManagedFiles(options.rootDir, metadata.managedFiles)

  // Step 1: Detect renames between old and new tool lists
  const toolRenames = detectToolRenames(metadata.tools, introspection.tools)
  const conflicts = detectToolRenameConflicts(metadata.tools, introspection.tools)
  const conflictedToolNames = new Set(conflicts.flatMap((conflict) => [
    conflict.path.replace(/^tools\//, ''),
    ...(conflict.candidates ?? []),
  ]))
  for (const [oldName, newName] of toolRenames) {
    if (conflictedToolNames.has(oldName) || conflictedToolNames.has(newName)) {
      toolRenames.delete(oldName)
    }
  }
  const persistedSkills = readPersistedSkills(options.rootDir, metadata)

  // Step 3: Generate new scaffold
  const result = await writeMcpScaffold({
    rootDir: options.rootDir,
    pluginName: config.name,
    authorName: config.author.name,
    targets: config.targets,
    source,
    introspection,
    displayName: config.brand?.displayName ?? metadata.settings.displayName,
    skillGrouping: metadata.settings.skillGrouping,
    hookMode: metadata.settings.requestedHookMode,
    runtimeAuthMode: metadata.settings.runtimeAuthMode ?? 'inline',
    permissions: config.permissions,
    persistedSkills,
    toolRenames,
  })

  const newMetadataPath = resolveWithinRoot(options.rootDir, MCP_SCAFFOLD_METADATA_PATH)
  const newMetadata: McpScaffoldMetadata = JSON.parse(readFileSync(newMetadataPath, 'utf-8'))
  const skillRenames = detectSkillRenames(metadata.skills, newMetadata.skills, toolRenames)

  // Step 4: Inject preserved custom content into renamed skill files
  for (const [oldSkillDir, newSkillDir] of skillRenames) {
    const oldSkillPath = resolveWithinRoot(options.rootDir, `skills/${oldSkillDir}/SKILL.md`)
    if (!existsSync(oldSkillPath)) continue
    const oldContent = readFileSync(oldSkillPath, 'utf-8')
    const extracted = extractMixedMarkdownContent(oldContent, '')
    if (!hasMeaningfulCustomContent(oldContent)) continue

    const newSkill = newMetadata.skills.find((s) => s.dirName === newSkillDir)
    if (!newSkill) continue

    const newSkillPath = resolveWithinRoot(options.rootDir, `skills/${newSkill.dirName}/SKILL.md`)
    if (!existsSync(newSkillPath)) continue
    const currentContent = readFileSync(newSkillPath, 'utf-8')
    const updatedContent = injectCustomContent(currentContent, extracted.customContent)
    writeFileSync(newSkillPath, updatedContent, 'utf-8')
  }

  // Step 5: Build rename mapping (old skill dir -> new skill dir)
  const renamedFiles: Array<{ from: string; to: string }> = []
  const renamedOldDirs = new Set<string>()
  const renamedNewDirs = new Set<string>()
  for (const [oldSkillDir, newSkillDir] of skillRenames) {
    const fromDir = `skills/${oldSkillDir}/`
    const toDir = `skills/${newSkillDir}/`
    if (renamedOldDirs.has(fromDir) || renamedNewDirs.has(toDir)) continue
    renamedFiles.push({ from: fromDir, to: toDir })
    renamedOldDirs.add(fromDir)
    renamedNewDirs.add(toDir)
  }

  const afterManaged = new Set(result.generatedFiles)
  const beforeManaged = new Set(metadata.managedFiles)

  // Step 6: Handle removed files, excluding those that are part of renames
  const removedCandidates = [...beforeManaged].filter((file) => !afterManaged.has(file))
  const removedFiles: string[] = []
  const preservedFiles: string[] = []

  for (const file of removedCandidates) {
    const isPartOfRename = [...renamedOldDirs].some((dir) => file.startsWith(dir))
    if (isPartOfRename) {
      removeManagedFile(options.rootDir, file)
      continue
    }

    if (shouldPreserveManagedFile(options.rootDir, file)) {
      preservedFiles.push(file)
      continue
    }

    removeManagedFile(options.rootDir, file)
    removedFiles.push(file)
  }

  // Step 7: Compute added/updated, excluding files that are part of renames from "added"
  const addedFiles = [...afterManaged].filter((file) => {
    if (beforeManaged.has(file)) return false
    const isPartOfRename = [...renamedNewDirs].some((dir) => file.startsWith(dir))
    return !isPartOfRename
  })
  const updatedFiles = [...afterManaged].filter((file) => {
    if (!beforeManaged.has(file)) return false
    const before = beforeContents.get(file)
    const currentPath = resolveWithinRoot(options.rootDir, file)
    if (!existsSync(currentPath)) return false
    const after = readFileSync(currentPath, 'utf-8')
    return before !== after
  })
  const scaffoldChanged = addedFiles.length > 0
    || updatedFiles.length > 0
    || removedFiles.length > 0
    || renamedFiles.length > 0
  if (scaffoldChanged) {
    invalidateSavedAgentPack(options.rootDir)
  }

  return {
    source,
    toolCount: introspection.tools.length,
    addedFiles: addedFiles.sort(),
    updatedFiles: updatedFiles.sort(),
    removedFiles: removedFiles.sort(),
    preservedFiles: preservedFiles.sort(),
    renamedFiles: renamedFiles.sort((a, b) => a.from.localeCompare(b.from)),
    conflicts,
    mutation: createMutationManifest({
      files: [
        ...addedFiles.map((path) => ({ path, action: 'create' as const })),
        ...updatedFiles.map((path) => ({ path, action: 'update' as const })),
        ...removedFiles.map((path) => ({ path, action: 'delete' as const })),
      ],
      renames: renamedFiles,
      conflicts,
    }),
  }
}

export async function applyPersistedTaxonomy(rootDir: string): Promise<void> {
  const metadata = await readMcpScaffoldMetadata(rootDir)
  const config = await loadConfig(rootDir)
  const beforeContents = snapshotManagedFiles(rootDir, metadata.managedFiles)
  const persistedSkills = readPersistedSkills(rootDir, metadata)

  const result = await writeMcpScaffold({
    rootDir,
    pluginName: config.name,
    authorName: config.author.name,
    targets: config.targets,
    source: metadata.source,
    introspection: {
      protocolVersion: '2025-03-26',
      serverInfo: metadata.serverInfo,
      tools: metadata.tools,
    },
    displayName: config.brand?.displayName ?? metadata.settings.displayName,
    skillGrouping: metadata.settings.skillGrouping,
    hookMode: metadata.settings.requestedHookMode,
    runtimeAuthMode: metadata.settings.runtimeAuthMode ?? 'inline',
    permissions: config.permissions,
    persistedSkills,
  })

  const instructionsPath = './INSTRUCTIONS.md'
  const previousInstructions = beforeContents.get(instructionsPath)
  if (previousInstructions !== undefined) {
    writeFileSync(resolveWithinRoot(rootDir, instructionsPath), previousInstructions, 'utf-8')
  }

  const newMetadataPath = resolveWithinRoot(rootDir, MCP_SCAFFOLD_METADATA_PATH)
  const newMetadata: McpScaffoldMetadata = JSON.parse(readFileSync(newMetadataPath, 'utf-8'))
  const skillRenames = detectSkillRenames(metadata.skills, newMetadata.skills, new Map())

  preserveCustomContentForRenames(rootDir, skillRenames, (dirName) => `skills/${dirName}/SKILL.md`)
  preserveCustomContentForRenames(rootDir, skillRenames, (dirName) => `commands/${dirName}.md`)

  const afterManaged = new Set(result.generatedFiles)
  const beforeManaged = new Set(metadata.managedFiles)
  const renamedOldDirs = new Set([...skillRenames.keys()].map((dirName) => `skills/${dirName}/`))
  const renamedNewDirs = new Set([...skillRenames.values()].map((dirName) => `skills/${dirName}/`))
  const renamedOldCommands = new Set([...skillRenames.keys()].map((dirName) => `commands/${dirName}.md`))

  for (const file of beforeManaged) {
    if (afterManaged.has(file) || file === instructionsPath) continue

    const isRenamedSkill = [...renamedOldDirs].some((dir) => file.startsWith(dir))
    const isRenamedCommand = renamedOldCommands.has(file)
    if (isRenamedSkill || isRenamedCommand) {
      removeManagedFile(rootDir, file)
      continue
    }

    if (shouldPreserveManagedFile(rootDir, file)) continue
    removeManagedFile(rootDir, file)
  }

  for (const file of afterManaged) {
    if (file === instructionsPath && previousInstructions !== undefined) {
      writeFileSync(resolveWithinRoot(rootDir, file), previousInstructions, 'utf-8')
    }
  }

  invalidateSavedAgentPack(rootDir)
}

export async function planSyncFromMcp(options: SyncFromMcpOptions): Promise<SyncFromMcpResult> {
  const tempRoot = mkdtempSync(resolve(tmpdir(), 'pluxx-sync-dry-run-'))
  const projectDir = resolve(tempRoot, 'project')

  try {
    copyProjectForStaging(options.rootDir, projectDir)
    return await syncFromMcpInPlace({
      rootDir: projectDir,
      source: options.source,
    })
  } finally {
    rmSync(tempRoot, { recursive: true, force: true })
  }
}

export function detectToolRenameConflicts(
  oldTools: IntrospectedMcpTool[],
  newTools: IntrospectedMcpTool[],
): MutationConflict[] {
  const oldNames = new Set(oldTools.map((tool) => tool.name))
  const newNames = new Set(newTools.map((tool) => tool.name))
  const removedTools = oldTools.filter((tool) => !newNames.has(tool.name))
  const addedTools = newTools.filter((tool) => !oldNames.has(tool.name))
  const conflicts: MutationConflict[] = []

  for (const oldTool of removedTools) {
    const candidates = addedTools
      .map((newTool) => ({ name: newTool.name, score: computeRenameScore(oldTool, newTool) }))
      .filter((candidate) => candidate.score >= RENAME_SCORE_THRESHOLD)
      .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))
    if (candidates.length > 1 && candidates[0].score === candidates[1].score) {
      conflicts.push({
        path: `tools/${oldTool.name}`,
        reason: 'ambiguous-rename',
        candidates: candidates.filter((candidate) => candidate.score === candidates[0].score).map((candidate) => candidate.name),
      })
    }
  }

  for (const newTool of addedTools) {
    const candidates = removedTools
      .map((oldTool) => ({ name: oldTool.name, score: computeRenameScore(oldTool, newTool) }))
      .filter((candidate) => candidate.score >= RENAME_SCORE_THRESHOLD)
      .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))
    if (candidates.length > 1 && candidates[0].score === candidates[1].score) {
      conflicts.push({
        path: `tools/${newTool.name}`,
        reason: 'rename-destination-collision',
        candidates: candidates.filter((candidate) => candidate.score === candidates[0].score).map((candidate) => candidate.name),
      })
    }
  }

  return conflicts.sort((a, b) => a.path.localeCompare(b.path))
}

function readPersistedSkills(rootDir: string, metadata: McpScaffoldMetadata): PersistedSkill[] {
  const taxonomyPath = resolveWithinRoot(rootDir, MCP_TAXONOMY_PATH)
  if (existsSync(taxonomyPath)) {
    return JSON.parse(readFileSync(taxonomyPath, 'utf-8')) as PersistedSkill[]
  }

  return metadata.skills.map((skill) => ({
    dirName: skill.dirName,
    title: skill.title,
    description: skill.description,
    toolNames: skill.toolNames,
  }))
}

function preserveCustomContentForRenames(
  rootDir: string,
  renames: Map<string, string>,
  pathForName: (dirName: string) => string,
): void {
  for (const [oldName, newName] of renames) {
    const oldPath = resolveWithinRoot(rootDir, pathForName(oldName))
    if (!existsSync(oldPath)) continue

    const oldContent = readFileSync(oldPath, 'utf-8')
    const extracted = extractMixedMarkdownContent(oldContent, '')
    if (!hasMeaningfulCustomContent(oldContent)) continue

    const newPath = resolveWithinRoot(rootDir, pathForName(newName))
    if (!existsSync(newPath)) continue

    const currentContent = readFileSync(newPath, 'utf-8')
    const updatedContent = injectCustomContent(currentContent, extracted.customContent)
    writeFileSync(newPath, updatedContent, 'utf-8')
  }
}

function snapshotManagedFiles(rootDir: string, files: string[]): Map<string, string> {
  const contents = new Map<string, string>()
  for (const file of files) {
    const filepath = resolveWithinRoot(rootDir, file)
    if (!existsSync(filepath)) continue
    contents.set(file, readFileSync(filepath, 'utf-8'))
  }
  return contents
}

function removeManagedFile(rootDir: string, relativePath: string): void {
  const filepath = resolveWithinRoot(rootDir, relativePath)
  if (!existsSync(filepath)) return

  rmSync(filepath, { force: true })
  pruneEmptyDirectories(rootDir, dirname(filepath))
}

function shouldPreserveManagedFile(rootDir: string, relativePath: string): boolean {
  if (!relativePath.endsWith('.md')) return false

  const filepath = resolveWithinRoot(rootDir, relativePath)
  if (!existsSync(filepath)) return false

  return hasMeaningfulCustomContent(readFileSync(filepath, 'utf-8'))
}

function pruneEmptyDirectories(rootDir: string, startDir: string): void {
  let current = startDir
  const stopDir = resolve(rootDir)

  while (current.startsWith(stopDir) && current !== stopDir) {
    const entries = readdirSync(current)
    if (entries.length > 0) return

    rmdirSync(current)
    current = dirname(current)
  }
}

const AGENT_PACK_FILES = [
  '.pluxx/agent/context.md',
  '.pluxx/agent/plan.json',
  '.pluxx/agent/taxonomy-prompt.md',
  '.pluxx/agent/instructions-prompt.md',
  '.pluxx/agent/review-prompt.md',
] as const

function invalidateSavedAgentPack(rootDir: string): void {
  for (const relativePath of AGENT_PACK_FILES) {
    removeManagedFile(rootDir, relativePath)
  }
}

/**
 * Detect tool renames by comparing old and new tool lists.
 * Returns a map of oldName -> newName for likely renames.
 * Only matches 1:1 (each old tool maps to at most one new tool and vice versa).
 */
export function detectToolRenames(
  oldTools: IntrospectedMcpTool[],
  newTools: IntrospectedMcpTool[],
): Map<string, string> {
  const oldNames = new Set(oldTools.map((t) => t.name))
  const newNames = new Set(newTools.map((t) => t.name))

  // Only consider tools that were removed or added (not tools that stayed the same)
  const removedTools = oldTools.filter((t) => !newNames.has(t.name))
  const addedTools = newTools.filter((t) => !oldNames.has(t.name))

  if (removedTools.length === 0 || addedTools.length === 0) {
    return new Map()
  }

  // Score all candidate pairs
  const candidates: Array<{ oldName: string; newName: string; score: number }> = []

  for (const oldTool of removedTools) {
    for (const newTool of addedTools) {
      const score = computeRenameScore(oldTool, newTool)
      if (score >= RENAME_SCORE_THRESHOLD) {
        candidates.push({ oldName: oldTool.name, newName: newTool.name, score })
      }
    }
  }

  // Greedy 1:1 matching: take best scores first
  candidates.sort((a, b) => b.score - a.score)
  const renames = new Map<string, string>()
  const usedOld = new Set<string>()
  const usedNew = new Set<string>()

  for (const candidate of candidates) {
    if (usedOld.has(candidate.oldName) || usedNew.has(candidate.newName)) continue
    renames.set(candidate.oldName, candidate.newName)
    usedOld.add(candidate.oldName)
    usedNew.add(candidate.newName)
  }

  return renames
}

const RENAME_SCORE_THRESHOLD = 0.5
const SKILL_RENAME_SCORE_THRESHOLD = 0.6

function computeRenameScore(oldTool: IntrospectedMcpTool, newTool: IntrospectedMcpTool): number {
  let score = 0
  let hasCorroboratingSignal = false

  if (oldTool.description && newTool.description) {
    if (oldTool.description === newTool.description) {
      score += 0.45
    } else {
      // Partial description similarity (Jaccard on words)
      const oldWords = new Set(oldTool.description.toLowerCase().split(/\s+/))
      const newWords = new Set(newTool.description.toLowerCase().split(/\s+/))
      const intersection = [...oldWords].filter((w) => newWords.has(w)).length
      const union = new Set([...oldWords, ...newWords]).size
      const jaccard = union > 0 ? intersection / union : 0
      if (jaccard >= 0.7) {
        score += 0.35
      }
    }
  }

  const distance = levenshteinDistance(oldTool.name, newTool.name)
  if (distance <= 3) {
    score += 0.35
    hasCorroboratingSignal = true
  } else if (distance <= 6 && Math.max(oldTool.name.length, newTool.name.length) > 10) {
    score += 0.2
    hasCorroboratingSignal = true
  }

  const oldRequired = getRequiredFieldNames(oldTool.inputSchema)
  const newRequired = getRequiredFieldNames(newTool.inputSchema)
  if (oldRequired.length > 0 || newRequired.length > 0) {
    if (oldRequired.length === newRequired.length && oldRequired.every((f) => newRequired.includes(f))) {
      score += 0.35
      hasCorroboratingSignal = true
    } else {
      // Partial overlap
      const overlap = oldRequired.filter((f) => newRequired.includes(f)).length
      const total = new Set([...oldRequired, ...newRequired]).size
      if (total > 0 && overlap / total >= 0.7) {
        score += 0.2
        hasCorroboratingSignal = true
      }
    }
  }

  if (oldTool.description && newTool.description && oldTool.description === newTool.description) {
    return hasCorroboratingSignal ? score : 0
  }

  return score
}

function getRequiredFieldNames(inputSchema?: Record<string, unknown>): string[] {
  if (!inputSchema) return []
  const required = inputSchema.required
  if (!Array.isArray(required)) return []
  return required
    .filter((v): v is string => typeof v === 'string')
    .sort()
}

function levenshteinDistance(a: string, b: string): number {
  const m = a.length
  const n = b.length
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0))

  for (let i = 0; i <= m; i++) dp[i][0] = i
  for (let j = 0; j <= n; j++) dp[0][j] = j

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost,
      )
    }
  }

  return dp[m][n]
}

/**
 * Replace the custom content section in a managed markdown file.
 */
function injectCustomContent(fileContent: string, customContent: string): string {
  const customStart = fileContent.indexOf(PLUXX_CUSTOM_START)
  const customEnd = fileContent.indexOf(PLUXX_CUSTOM_END)

  if (customStart === -1 || customEnd === -1 || customEnd <= customStart) {
    return fileContent
  }

  return (
    fileContent.slice(0, customStart + PLUXX_CUSTOM_START.length) +
    '\n' +
    customContent.trim() +
    '\n' +
    fileContent.slice(customEnd)
  )
}

interface SkillRenameCandidate {
  oldSkill: McpScaffoldMetadata['skills'][number]
  newSkill: McpScaffoldMetadata['skills'][number]
  score: number
}

export function detectSkillRenames(
  oldSkills: McpScaffoldMetadata['skills'],
  newSkills: McpScaffoldMetadata['skills'],
  toolRenames: Map<string, string>,
): Map<string, string> {
  const candidates: SkillRenameCandidate[] = []

  for (const oldSkill of oldSkills) {
    for (const newSkill of newSkills) {
      if (oldSkill.dirName === newSkill.dirName) continue

      const score = computeSkillRenameScore(oldSkill, newSkill, toolRenames)
      if (score >= SKILL_RENAME_SCORE_THRESHOLD) {
        candidates.push({ oldSkill, newSkill, score })
      }
    }
  }

  candidates.sort((a, b) => b.score - a.score)

  const renames = new Map<string, string>()
  const usedOld = new Set<string>()
  const usedNew = new Set<string>()

  for (const candidate of candidates) {
    if (usedOld.has(candidate.oldSkill.dirName) || usedNew.has(candidate.newSkill.dirName)) continue
    renames.set(candidate.oldSkill.dirName, candidate.newSkill.dirName)
    usedOld.add(candidate.oldSkill.dirName)
    usedNew.add(candidate.newSkill.dirName)
  }

  return renames
}

function computeSkillRenameScore(
  oldSkill: McpScaffoldMetadata['skills'][number],
  newSkill: McpScaffoldMetadata['skills'][number],
  toolRenames: Map<string, string>,
): number {
  const mappedOldTools = new Set(oldSkill.toolNames.map((toolName) => toolRenames.get(toolName) ?? toolName))
  const newTools = new Set(newSkill.toolNames)
  const overlap = [...mappedOldTools].filter((toolName) => newTools.has(toolName)).length

  if (overlap === 0) return 0

  const precision = overlap / newTools.size
  const recall = overlap / mappedOldTools.size
  let score = (precision + recall) / 2

  const normalizedOldTitle = oldSkill.title.toLowerCase().replace(/[^a-z0-9]+/g, '')
  const normalizedNewTitle = newSkill.title.toLowerCase().replace(/[^a-z0-9]+/g, '')
  if (normalizedOldTitle === normalizedNewTitle) {
    score += 0.1
  }

  return score
}

function resolveWithinRoot(rootDir: string, relativePath: string): string {
  const rootPath = resolve(rootDir)
  const filepath = resolve(rootPath, relativePath)
  const relativePathFromRoot = relative(rootPath, filepath)

  if (relativePathFromRoot === '' || (!relativePathFromRoot.startsWith('..') && !isAbsolute(relativePathFromRoot))) {
    return filepath
  }

  throw new Error(`Refusing to access path outside root: ${relativePath}`)
}

export function formatSyncSummary(result: SyncFromMcpResult, rootDir: string): string[] {
  const lines = [
    `Synced ${result.toolCount} MCP tool(s).`,
    '',
  ]

  if (result.renamedFiles.length > 0) {
    lines.push(`Renamed: ${result.renamedFiles.length}`)
    result.renamedFiles.forEach((rename) => lines.push(`  → ${rename.from} → ${rename.to}`))
  }
  if (result.conflicts.length > 0) {
    lines.push(`Conflicts: ${result.conflicts.length}`)
    result.conflicts.forEach((conflict) => {
      const candidates = conflict.candidates?.length ? ` (${conflict.candidates.join(', ')})` : ''
      lines.push(`  ! ${conflict.path}: ${conflict.reason}${candidates}`)
    })
  }
  lines.push(`Added: ${result.addedFiles.length}`)
  result.addedFiles.forEach((file) => lines.push(`  + ${relative(rootDir, resolve(rootDir, file))}`))
  lines.push(`Updated: ${result.updatedFiles.length}`)
  result.updatedFiles.forEach((file) => lines.push(`  ~ ${relative(rootDir, resolve(rootDir, file))}`))
  lines.push(`Removed: ${result.removedFiles.length}`)
  result.removedFiles.forEach((file) => lines.push(`  - ${relative(rootDir, resolve(rootDir, file))}`))
  lines.push(`Preserved: ${result.preservedFiles.length}`)
  result.preservedFiles.forEach((file) => lines.push(`  ! ${relative(rootDir, resolve(rootDir, file))}`))

  return lines
}
