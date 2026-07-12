import { createHash } from 'crypto'
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  rmdirSync,
  writeFileSync,
} from 'fs'
import { homedir } from 'os'
import { dirname, relative, resolve, sep } from 'path'
import { parseTomlValue, stripTomlComment } from './toml-lite'

const OWNERSHIP_SCHEMA = 'pluxx.codex-agent-install.v1'

interface CodexBundledAgent {
  name: string
  relativePath: string
  sourcePath: string
  content: string
  sha256: string
}

interface CodexOwnedAgent {
  name: string
  relativePath: string
  sha256: string
}

interface CodexAgentOwnership {
  schema: typeof OWNERSHIP_SCHEMA
  pluginName: string
  pluginVersion?: string
  agents: CodexOwnedAgent[]
}

export interface CodexAgentRegistrationOptions {
  consumerRoot: string
  pluginName?: string
  codexHome?: string
  dryRun?: boolean
}

export interface CodexAgentRegistrationResult {
  changed: boolean
  pluginName: string
  agentRoot: string
  ownershipPath: string
  required: number
  installed: string[]
  alreadyPresent: string[]
  removed: string[]
  preserved: string[]
}

export interface CodexAgentRemovalOptions {
  pluginName: string
  codexHome?: string
  dryRun?: boolean
}

export interface CodexAgentRemovalResult {
  changed: boolean
  pluginName: string
  agentRoot: string
  ownershipPath: string
  removed: string[]
  preserved: string[]
}

export interface CodexAgentRegistrationIssue {
  code:
    | 'codex-agent-registration-collision'
    | 'codex-agent-registration-missing'
    | 'codex-agent-registration-stale'
    | 'codex-agent-registration-unowned'
  detail: string
  path: string
}

export interface CodexAgentRegistrationVerification {
  ok: boolean
  pluginName: string
  agentRoot: string
  ownershipPath: string
  required: number
  issues: CodexAgentRegistrationIssue[]
}

interface RegistrationPlan extends CodexAgentRegistrationResult {
  agents: CodexBundledAgent[]
  ownership: CodexAgentOwnership
  pathsToRemove: string[]
}

function hashContent(content: string): string {
  return createHash('sha256').update(content).digest('hex')
}

function resolveCodexHome(codexHome?: string): string {
  if (codexHome) return resolve(codexHome)
  if (process.env.CODEX_HOME?.trim()) return resolve(process.env.CODEX_HOME)
  return resolve(process.env.HOME?.trim() || homedir(), '.codex')
}

function validatePluginName(pluginName: string): string {
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(pluginName)) {
    throw new Error(`Cannot register Codex agents for invalid plugin name "${pluginName}".`)
  }
  return pluginName
}

function readPluginIdentity(consumerRoot: string, explicitPluginName?: string): {
  pluginName: string
  pluginVersion?: string
} {
  const manifestPath = resolve(consumerRoot, '.codex-plugin/plugin.json')
  let manifestName: string | undefined
  let pluginVersion: string | undefined

  if (existsSync(manifestPath)) {
    try {
      const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8')) as {
        name?: unknown
        version?: unknown
      }
      manifestName = typeof manifest.name === 'string' ? manifest.name : undefined
      pluginVersion = typeof manifest.version === 'string' ? manifest.version : undefined
    } catch (error) {
      throw new Error(`Cannot register Codex agents because ${manifestPath} is invalid JSON: ${String(error)}`)
    }
  }

  const pluginName = explicitPluginName ?? manifestName
  if (!pluginName) {
    throw new Error(`Cannot register Codex agents because ${manifestPath} does not declare a plugin name.`)
  }
  if (explicitPluginName && manifestName && explicitPluginName !== manifestName) {
    throw new Error(
      `Cannot register Codex agents: requested plugin name "${explicitPluginName}" does not match manifest name "${manifestName}".`,
    )
  }

  return { pluginName: validatePluginName(pluginName), pluginVersion }
}

function walkTomlFiles(rootDir: string): string[] {
  if (!existsSync(rootDir)) return []
  const files: string[] = []

  for (const entry of readdirSync(rootDir, { withFileTypes: true })) {
    const path = resolve(rootDir, entry.name)
    if (entry.isDirectory()) {
      files.push(...walkTomlFiles(path))
    } else if (entry.isFile() && entry.name.endsWith('.toml')) {
      files.push(path)
    }
  }

  return files.sort((a, b) => a.localeCompare(b))
}

function readTomlStringField(content: string, key: string): string | undefined {
  for (const rawLine of content.split(/\r?\n/)) {
    const line = stripTomlComment(rawLine).trim()
    const match = line.match(new RegExp(`^${key}\\s*=\\s*(.+)$`))
    if (!match) continue
    const value = parseTomlValue(match[1].trim())
    return typeof value === 'string' && value.trim() ? value.trim() : undefined
  }
  return undefined
}

function hasTomlAssignment(content: string, key: string): boolean {
  return content.split(/\r?\n/).some((rawLine) => {
    const line = stripTomlComment(rawLine).trim()
    return new RegExp(`^${key}\\s*=`).test(line)
  })
}

function readAgentName(path: string): string | undefined {
  try {
    return readTomlStringField(readFileSync(path, 'utf-8'), 'name')
  } catch {
    return undefined
  }
}

function collectBundledAgents(consumerRoot: string): CodexBundledAgent[] {
  const sourceRoot = resolve(consumerRoot, '.codex/agents')
  const names = new Map<string, string>()

  return walkTomlFiles(sourceRoot).map((sourcePath) => {
    const content = readFileSync(sourcePath, 'utf-8')
    const name = readTomlStringField(content, 'name')
    const description = readTomlStringField(content, 'description')
    if (!name || !description || !hasTomlAssignment(content, 'developer_instructions')) {
      throw new Error(
        `Invalid Codex custom agent at ${sourcePath}: name, description, and developer_instructions are required.`,
      )
    }
    const previousPath = names.get(name)
    if (previousPath) {
      throw new Error(`Duplicate bundled Codex agent name "${name}" in ${previousPath} and ${sourcePath}.`)
    }
    names.set(name, sourcePath)

    return {
      name,
      relativePath: relative(sourceRoot, sourcePath).replace(/\\/g, '/'),
      sourcePath,
      content,
      sha256: hashContent(content),
    }
  })
}

function getAgentRoot(codexHome: string, pluginName: string): string {
  return resolve(codexHome, 'agents', pluginName)
}

function getOwnershipPath(codexHome: string, pluginName: string): string {
  return resolve(codexHome, 'pluxx/agent-installs', `${pluginName}.json`)
}

function readOwnership(path: string, pluginName: string): CodexAgentOwnership | undefined {
  if (!existsSync(path)) return undefined
  try {
    const parsed = JSON.parse(readFileSync(path, 'utf-8')) as Partial<CodexAgentOwnership>
    if (parsed.schema !== OWNERSHIP_SCHEMA || parsed.pluginName !== pluginName || !Array.isArray(parsed.agents)) {
      throw new Error('unexpected ownership schema')
    }
    for (const agent of parsed.agents) {
      if (
        !agent
        || typeof agent !== 'object'
        || typeof agent.name !== 'string'
        || typeof agent.relativePath !== 'string'
        || !isSafeRelativePath(agent.relativePath)
        || typeof agent.sha256 !== 'string'
        || !/^[a-f0-9]{64}$/.test(agent.sha256)
      ) {
        throw new Error('invalid owned agent entry')
      }
    }
    return parsed as CodexAgentOwnership
  } catch (error) {
    throw new Error(`Cannot use Codex agent ownership record ${path}: ${String(error)}`)
  }
}

function isInside(path: string, parent: string): boolean {
  return path === parent || path.startsWith(`${parent}${sep}`)
}

function isSafeRelativePath(path: string): boolean {
  if (!path || path.startsWith('/') || path.startsWith('\\')) return false
  const normalized = path.replace(/\\/g, '/')
  return normalized !== '..' && !normalized.startsWith('../') && !normalized.includes('/../')
}

function resolveAgentPath(agentRoot: string, relativePath: string): string {
  if (!isSafeRelativePath(relativePath)) {
    throw new Error(`Unsafe Codex agent ownership path "${relativePath}".`)
  }
  const path = resolve(agentRoot, relativePath)
  if (!isInside(path, agentRoot) || path === agentRoot) {
    throw new Error(`Unsafe Codex agent ownership path "${relativePath}".`)
  }
  return path
}

function findNameCollisions(
  codexHome: string,
  agentRoot: string,
  agents: CodexBundledAgent[],
  replaceableOwnedPaths: ReadonlySet<string> = new Set(),
): Map<string, string> {
  const expectedPaths = new Map(agents.map((agent) => [agent.name, resolveAgentPath(agentRoot, agent.relativePath)]))
  const collisions = new Map<string, string>()
  const globalAgentRoot = resolve(codexHome, 'agents')

  for (const path of walkTomlFiles(globalAgentRoot)) {
    if (replaceableOwnedPaths.has(path)) continue
    const name = readAgentName(path)
    const expectedPath = name ? expectedPaths.get(name) : undefined
    if (name && expectedPath && path !== expectedPath && !collisions.has(name)) {
      collisions.set(name, path)
    }
  }

  return collisions
}

function buildRegistrationPlan(options: CodexAgentRegistrationOptions): RegistrationPlan {
  const consumerRoot = resolve(options.consumerRoot)
  const { pluginName, pluginVersion } = readPluginIdentity(consumerRoot, options.pluginName)
  const codexHome = resolveCodexHome(options.codexHome)
  const agentRoot = getAgentRoot(codexHome, pluginName)
  const ownershipPath = getOwnershipPath(codexHome, pluginName)
  const previousOwnership = readOwnership(ownershipPath, pluginName)
  const agents = collectBundledAgents(consumerRoot)
  const replaceableOwnedPaths = new Set(
    (previousOwnership?.agents ?? []).flatMap((agent) => {
      const path = resolveAgentPath(agentRoot, agent.relativePath)
      if (!existsSync(path)) return []
      return hashContent(readFileSync(path, 'utf-8')) === agent.sha256 ? [path] : []
    }),
  )
  const collisions = findNameCollisions(codexHome, agentRoot, agents, replaceableOwnedPaths)

  if (collisions.size > 0) {
    const [name, path] = collisions.entries().next().value as [string, string]
    throw new Error(
      `Codex agent name collision for "${name}": ${path} already registers that runtime name outside ${agentRoot}.`,
    )
  }

  const previousByPath = new Map(
    (previousOwnership?.agents ?? []).map((agent) => [agent.relativePath, agent]),
  )
  const nextPaths = new Set(agents.map((agent) => agent.relativePath))
  const installed: string[] = []
  const alreadyPresent: string[] = []
  const removed: string[] = []
  const preserved: string[] = []
  const pathsToRemove: string[] = []

  for (const agent of agents) {
    const installedPath = resolveAgentPath(agentRoot, agent.relativePath)
    if (!existsSync(installedPath)) {
      installed.push(agent.name)
      continue
    }

    const installedHash = hashContent(readFileSync(installedPath, 'utf-8'))
    if (installedHash === agent.sha256) {
      alreadyPresent.push(agent.name)
      continue
    }

    const previous = previousByPath.get(agent.relativePath)
    if (previous && previous.sha256 === installedHash) {
      installed.push(agent.name)
      continue
    }

    throw new Error(
      `Refusing to replace modified or unowned Codex agent "${agent.name}" at ${installedPath}. Move or reconcile that file, then retry.`,
    )
  }

  for (const previous of previousOwnership?.agents ?? []) {
    if (nextPaths.has(previous.relativePath)) continue
    const installedPath = resolveAgentPath(agentRoot, previous.relativePath)
    if (!existsSync(installedPath)) continue
    const installedHash = hashContent(readFileSync(installedPath, 'utf-8'))
    if (installedHash === previous.sha256) {
      removed.push(previous.name)
      pathsToRemove.push(installedPath)
    } else {
      preserved.push(previous.name)
    }
  }

  const ownership: CodexAgentOwnership = {
    schema: OWNERSHIP_SCHEMA,
    pluginName,
    ...(pluginVersion ? { pluginVersion } : {}),
    agents: agents.map(({ name, relativePath, sha256 }) => ({ name, relativePath, sha256 })),
  }
  const nextOwnershipText = `${JSON.stringify(ownership, null, 2)}\n`
  const ownershipChanged = agents.length === 0
    ? existsSync(ownershipPath)
    : !existsSync(ownershipPath) || readFileSync(ownershipPath, 'utf-8') !== nextOwnershipText

  return {
    changed: installed.length > 0 || removed.length > 0 || ownershipChanged,
    pluginName,
    agentRoot,
    ownershipPath,
    required: agents.length,
    installed,
    alreadyPresent,
    removed,
    preserved,
    agents,
    ownership,
    pathsToRemove,
  }
}

function removeEmptyDirectories(rootDir: string): void {
  if (!existsSync(rootDir)) return
  for (const entry of readdirSync(rootDir, { withFileTypes: true })) {
    if (entry.isDirectory()) removeEmptyDirectories(resolve(rootDir, entry.name))
  }
  if (readdirSync(rootDir).length === 0) rmdirSync(rootDir)
}

export function syncCodexAgentRegistration(
  options: CodexAgentRegistrationOptions,
): CodexAgentRegistrationResult {
  const plan = buildRegistrationPlan(options)
  if (!options.dryRun) {
    for (const path of plan.pathsToRemove) rmSync(path, { force: true })
    for (const agent of plan.agents) {
      const installedPath = resolveAgentPath(plan.agentRoot, agent.relativePath)
      mkdirSync(dirname(installedPath), { recursive: true })
      writeFileSync(installedPath, agent.content)
    }

    if (plan.agents.length > 0) {
      mkdirSync(dirname(plan.ownershipPath), { recursive: true })
      writeFileSync(plan.ownershipPath, `${JSON.stringify(plan.ownership, null, 2)}\n`)
    } else {
      rmSync(plan.ownershipPath, { force: true })
    }
    removeEmptyDirectories(plan.agentRoot)
  }

  const { agents: _agents, ownership: _ownership, pathsToRemove: _pathsToRemove, ...result } = plan
  return result
}

export function verifyCodexAgentRegistration(
  options: Omit<CodexAgentRegistrationOptions, 'dryRun'>,
): CodexAgentRegistrationVerification {
  const consumerRoot = resolve(options.consumerRoot)
  const { pluginName } = readPluginIdentity(consumerRoot, options.pluginName)
  const codexHome = resolveCodexHome(options.codexHome)
  const agentRoot = getAgentRoot(codexHome, pluginName)
  const ownershipPath = getOwnershipPath(codexHome, pluginName)
  const agents = collectBundledAgents(consumerRoot)
  const ownership = readOwnership(ownershipPath, pluginName)
  const ownedByPath = new Map((ownership?.agents ?? []).map((agent) => [agent.relativePath, agent]))
  const issues: CodexAgentRegistrationIssue[] = []

  for (const [name, path] of findNameCollisions(codexHome, agentRoot, agents)) {
    issues.push({
      code: 'codex-agent-registration-collision',
      detail: `Runtime name "${name}" is also registered outside this plugin at ${path}.`,
      path,
    })
  }

  for (const agent of agents) {
    const installedPath = resolveAgentPath(agentRoot, agent.relativePath)
    if (!existsSync(installedPath)) {
      issues.push({
        code: 'codex-agent-registration-missing',
        detail: `Bundled custom agent "${agent.name}" is not registered in the active Codex agent directory.`,
        path: installedPath,
      })
      continue
    }

    const installedHash = hashContent(readFileSync(installedPath, 'utf-8'))
    if (installedHash !== agent.sha256) {
      issues.push({
        code: 'codex-agent-registration-stale',
        detail: `Registered custom agent "${agent.name}" does not match the installed plugin bundle.`,
        path: installedPath,
      })
      continue
    }

    const owned = ownedByPath.get(agent.relativePath)
    if (!owned || owned.name !== agent.name || owned.sha256 !== agent.sha256) {
      issues.push({
        code: 'codex-agent-registration-unowned',
        detail: `Registered custom agent "${agent.name}" matches the bundle but is not tracked as Pluxx-owned install state.`,
        path: installedPath,
      })
    }
  }

  return {
    ok: issues.length === 0,
    pluginName,
    agentRoot,
    ownershipPath,
    required: agents.length,
    issues,
  }
}

export function removeCodexAgentRegistration(
  options: CodexAgentRemovalOptions,
): CodexAgentRemovalResult {
  const pluginName = validatePluginName(options.pluginName)
  const codexHome = resolveCodexHome(options.codexHome)
  const agentRoot = getAgentRoot(codexHome, pluginName)
  const ownershipPath = getOwnershipPath(codexHome, pluginName)
  const ownership = readOwnership(ownershipPath, pluginName)
  const removed: string[] = []
  const preserved: string[] = []

  for (const agent of ownership?.agents ?? []) {
    const installedPath = resolveAgentPath(agentRoot, agent.relativePath)
    if (!existsSync(installedPath)) continue
    const installedHash = hashContent(readFileSync(installedPath, 'utf-8'))
    if (installedHash === agent.sha256) {
      removed.push(agent.name)
      if (!options.dryRun) rmSync(installedPath, { force: true })
    } else {
      preserved.push(agent.name)
    }
  }

  if (ownership && !options.dryRun) {
    rmSync(ownershipPath, { force: true })
    removeEmptyDirectories(agentRoot)
    removeEmptyDirectories(dirname(ownershipPath))
  }

  return {
    changed: ownership !== undefined,
    pluginName,
    agentRoot,
    ownershipPath,
    removed,
    preserved,
  }
}
