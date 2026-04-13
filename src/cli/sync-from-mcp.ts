import { existsSync, readFileSync, rmSync, readdirSync, rmdirSync, writeFileSync } from 'fs'
import { dirname, isAbsolute, relative, resolve } from 'path'
import { loadConfig } from '../config/load'
import { introspectMcpServer, type IntrospectedMcpTool } from '../mcp/introspect'
import type { McpServer } from '../schema'
import {
  MCP_SCAFFOLD_METADATA_PATH,
  PLUXX_CUSTOM_START,
  PLUXX_CUSTOM_END,
  extractMixedMarkdownContent,
  hasMeaningfulCustomContent,
  type McpScaffoldMetadata,
  writeMcpScaffold,
} from './init-from-mcp'

export interface SyncFromMcpOptions {
  rootDir: string
  source?: McpServer
}

export interface SyncFromMcpResult {
  source: McpServer
  toolCount: number
  addedFiles: string[]
  updatedFiles: string[]
  removedFiles: string[]
  preservedFiles: string[]
  renamedFiles: Array<{ from: string; to: string }>
}

export async function readMcpScaffoldMetadata(rootDir: string): Promise<McpScaffoldMetadata> {
  const filepath = resolveWithinRoot(rootDir, MCP_SCAFFOLD_METADATA_PATH)
  if (!existsSync(filepath)) {
    throw new Error(
      `No MCP scaffold metadata found at ${MCP_SCAFFOLD_METADATA_PATH}. Run "pluxx init --from-mcp" first.`,
    )
  }

  return JSON.parse(readFileSync(filepath, 'utf-8')) as McpScaffoldMetadata
}

export async function syncFromMcp(options: SyncFromMcpOptions): Promise<SyncFromMcpResult> {
  const metadata = await readMcpScaffoldMetadata(options.rootDir)
  const config = await loadConfig(options.rootDir)
  const source = options.source ?? metadata.source
  const introspection = await introspectMcpServer(source)
  const beforeContents = snapshotManagedFiles(options.rootDir, metadata.managedFiles)

  // Step 1: Detect renames between old and new tool lists
  const toolRenames = detectToolRenames(metadata.tools, introspection.tools)

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

  return {
    source,
    toolCount: introspection.tools.length,
    addedFiles: addedFiles.sort(),
    updatedFiles: updatedFiles.sort(),
    removedFiles: removedFiles.sort(),
    preservedFiles: preservedFiles.sort(),
    renamedFiles: renamedFiles.sort((a, b) => a.from.localeCompare(b.from)),
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
