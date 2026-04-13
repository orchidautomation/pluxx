import { existsSync, readFileSync, rmSync, readdirSync, rmdirSync } from 'fs'
import { dirname, relative, resolve } from 'path'
import { loadConfig } from '../config/load'
import { introspectMcpServer, type IntrospectedMcpServer } from '../mcp/introspect'
import type { McpServer } from '../schema'
import {
  MCP_SCAFFOLD_METADATA_PATH,
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
}

export async function readMcpScaffoldMetadata(rootDir: string): Promise<McpScaffoldMetadata> {
  const filepath = resolve(rootDir, MCP_SCAFFOLD_METADATA_PATH)
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

  const afterManaged = new Set(result.generatedFiles)
  const beforeManaged = new Set(metadata.managedFiles)

  const removedFiles = [...beforeManaged].filter((file) => !afterManaged.has(file))
  for (const file of removedFiles) {
    removeManagedFile(options.rootDir, file)
  }

  const addedFiles = [...afterManaged].filter((file) => !beforeManaged.has(file))
  const updatedFiles = [...afterManaged].filter((file) => {
    if (!beforeManaged.has(file)) return false
    const before = beforeContents.get(file)
    const currentPath = resolve(options.rootDir, file)
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
  }
}

function snapshotManagedFiles(rootDir: string, files: string[]): Map<string, string> {
  const contents = new Map<string, string>()
  for (const file of files) {
    const filepath = resolve(rootDir, file)
    if (!existsSync(filepath)) continue
    contents.set(file, readFileSync(filepath, 'utf-8'))
  }
  return contents
}

function removeManagedFile(rootDir: string, relativePath: string): void {
  const filepath = resolve(rootDir, relativePath)
  if (!existsSync(filepath)) return

  rmSync(filepath, { force: true })
  pruneEmptyDirectories(rootDir, dirname(filepath))
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

export function formatSyncSummary(result: SyncFromMcpResult, rootDir: string): string[] {
  const lines = [
    `Synced ${result.toolCount} MCP tool(s).`,
    '',
  ]

  lines.push(`Added: ${result.addedFiles.length}`)
  result.addedFiles.forEach((file) => lines.push(`  + ${relative(rootDir, resolve(rootDir, file))}`))
  lines.push(`Updated: ${result.updatedFiles.length}`)
  result.updatedFiles.forEach((file) => lines.push(`  ~ ${relative(rootDir, resolve(rootDir, file))}`))
  lines.push(`Removed: ${result.removedFiles.length}`)
  result.removedFiles.forEach((file) => lines.push(`  - ${relative(rootDir, resolve(rootDir, file))}`))

  return lines
}
