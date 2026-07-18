import { resolve, dirname, basename, relative } from 'path'
import { existsSync, symlinkSync, mkdirSync, rmSync, readFileSync, writeFileSync, cpSync, readdirSync, statSync } from 'fs'
import { spawnSync } from 'child_process'
import * as readline from 'readline'
import type { PluginConfig, TargetPlatform, UserConfigEntry } from '../schema'
import {
  buildInstalledUserConfigPayload,
  buildUserConfigEnvMap,
  collectRuntimeInheritedStdioEnvVars,
  collectUserConfigEntries,
  defaultUserConfigEnvVar,
  isCoreHostRuntimeEnvPlatform,
  isPlaceholderSecretValue,
  resolveUserConfigEntriesForTarget,
  type ResolvedUserConfigEntry,
} from '../user-config'
import {
  materializeInstalledPluginOwnedStdioPathForPlatform,
  normalizePluginOwnedStdioPathForPlatform,
} from '../mcp-stdio-paths'
import {
  buildMcpRuntimeEnvScript,
  buildRuntimeWrappedStdioMcpCommand,
  collectStdioServerRuntimeEnvVars,
  filterRuntimeInheritedStdioEnvRecord,
  MCP_RUNTIME_ENV_SCRIPT_RELATIVE_PATH,
} from '../mcp-runtime-env'
import { getInstallFollowupNotes as getDistributionInstallFollowupNotes } from '../distribution-lifecycle'
import {
  collectNativeMcpAuthUserConfigEntries,
  getNativeCodexMcpEntryOverride,
  getNativeJsonHeadersOverride,
} from '../mcp-native-overrides'
import {
  removeCodexAgentRegistration,
  syncCodexAgentRegistration,
} from '../codex-agent-install'
import {
  listInstallOwnership,
  removeOwnedInstall,
  transactionalInstall,
  transactionalInstallGroup,
} from '../install-ownership'
import { buildOpenCodeEntryFile, isCurrentOpenCodeEntryFile } from '../opencode-entry'

interface InstallTarget {
  platform: TargetPlatform
  pluginDir: string
  description: string
}

export interface PlannedInstallTarget extends InstallTarget {
  sourceDir: string
  built: boolean
  existing: boolean
}

interface BundleIntegrityIssues {
  manifestIssue?: string
  hookConfigIssue?: string
  missingManifestPaths: string[]
  missingHookTargets: string[]
  cwdUnsafeHookCommands: string[]
  invalidRuntimeScripts: string[]
}

interface CommandResult {
  status: number | null
  stdout: string
  stderr: string
}

interface CodexMarketplaceFile {
  name?: string
  interface?: {
    displayName?: string
  }
  plugins?: Array<{
    name: string
    source?: {
      source?: string
      path?: string
    }
    policy?: {
      installation?: string
      authentication?: string
    }
    category?: string
  }>
}

type CommandRunner = (command: string, args: string[]) => CommandResult

export interface HookCommand {
  event: string
  command: string
}

type PluginHooks = PluginConfig['hooks']
type UserConfigPrimitive = string | number | boolean

interface PlannedUserConfigEntry {
  field: UserConfigEntry
  envVar?: string
  source: 'env' | 'default' | 'missing'
  value?: UserConfigPrimitive
}

export function listHookCommands(hooks?: PluginHooks): HookCommand[] {
  if (!hooks) return []

  const commands: HookCommand[] = []
  for (const [event, entries] of Object.entries(hooks)) {
    for (const entry of entries) {
      if (entry.type === 'command' && entry.command) {
        commands.push({ event, command: entry.command })
      }
    }
  }

  return commands
}

export function planInstallUserConfig(
  config: PluginConfig,
  platforms: TargetPlatform[] = config.targets,
): PlannedUserConfigEntry[] {
  const baseEntries = collectUserConfigEntries(config, platforms)
  const runtimeEnvVars = collectRuntimeInheritedStdioEnvVars(config, platforms)
  const entries = [
    ...baseEntries,
    ...collectNativeMcpAuthUserConfigEntries(config, platforms, baseEntries),
  ].filter((field) => {
    const envVar = field.envVar ?? defaultUserConfigEnvVar(field.key)
    if (!runtimeEnvVars.has(envVar)) return true
    const applicableTargets = (field.targets ?? platforms).filter((target) => platforms.includes(target))
    return applicableTargets.length === 0 || !applicableTargets.every(isCoreHostRuntimeEnvPlatform)
  })

  return entries.map((field) => {
    const envVar = field.envVar ?? defaultUserConfigEnvVar(field.key)
    const envValue = process.env[envVar]
    if (envValue !== undefined && envValue !== '') {
      return {
        field,
        envVar,
        source: 'env',
        value: parseUserConfigValue(field, envValue),
      }
    }

    if (field.defaultValue !== undefined) {
      return {
        field,
        envVar,
        source: 'default',
        value: field.defaultValue,
      }
    }

    return {
      field,
      envVar,
      source: 'missing',
    }
  })
}

export async function resolveInstallUserConfig(
  config: PluginConfig,
  platforms: TargetPlatform[] = config.targets,
  options: { isTTY?: boolean } = {},
): Promise<ResolvedUserConfigEntry[]> {
  const planned = planInstallUserConfig(config, platforms)
  const resolved: ResolvedUserConfigEntry[] = []
  const isTTY = options.isTTY ?? process.stdin.isTTY === true

  for (const entry of planned) {
    if (entry.value !== undefined) {
      if (entry.field.type === 'secret' && isPlaceholderSecretValue(entry.value)) {
        const hint = entry.envVar
          ? ` Export a real value first: export ${entry.envVar}='your_real_key'. Then rerun pluxx install.`
          : ' Provide a real secret value before installing.'
        throw new Error(`Refusing to install placeholder secret for userConfig "${entry.field.key}". Placeholder values like "dummy" are not usable by installed MCP servers.${hint}`)
      }
      resolved.push({
        field: entry.field,
        value: entry.value,
        envVar: entry.envVar,
      })
      continue
    }

    if (entry.field.required === false) {
      continue
    }

    if (!isTTY) {
      const hint = entry.envVar
        ? ` Export it before installing: export ${entry.envVar}='your_real_key'. Then rerun pluxx install.`
        : ' Re-run interactively to provide it.'
      throw new Error(`Missing required userConfig "${entry.field.key}". Installed plugins cannot prompt for this value later in every host UI.${hint}`)
    }

    const promptLabel = entry.field.title || entry.field.key
    const envHint = entry.envVar ? ` [env: ${entry.envVar}]` : ''
    const answer = await promptTextValue(`${promptLabel}${envHint}: `)
    const value = parseUserConfigValue(entry.field, answer)

    resolved.push({
      field: entry.field,
      value,
      envVar: entry.envVar,
    })
  }

  return resolved
}

async function promptTextValue(question: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  })

  try {
    const answer = await new Promise<string>((resolveAnswer) => {
      rl.question(question, (value) => resolveAnswer(value))
    })
    return answer
  } finally {
    rl.close()
  }
}

function parseUserConfigValue(field: UserConfigEntry, rawValue: string): UserConfigPrimitive {
  if (field.type === 'number') {
    const parsed = Number(rawValue)
    if (!Number.isFinite(parsed)) {
      throw new Error(`Expected a numeric value for userConfig "${field.key}".`)
    }
    return parsed
  }

  if (field.type === 'boolean') {
    const normalized = rawValue.trim().toLowerCase()
    if (['true', '1', 'yes', 'y'].includes(normalized)) return true
    if (['false', '0', 'no', 'n'].includes(normalized)) return false
    throw new Error(`Expected a boolean value for userConfig "${field.key}".`)
  }

  return rawValue
}

async function promptTrustConfirmation(question: string): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  })

  try {
    const answer = await new Promise<string>((resolveAnswer) => {
      rl.question(question, (value) => resolveAnswer(value))
    })
    const normalized = answer.trim().toLowerCase()
    return normalized === 'y' || normalized === 'yes'
  } finally {
    rl.close()
  }
}

interface EnsureHookTrustOptions {
  pluginName: string
  hooks?: PluginHooks
  trust?: boolean
  isTTY?: boolean
  confirmPrompt?: (question: string) => Promise<boolean>
}

export async function ensureHookTrust(options: EnsureHookTrustOptions): Promise<void> {
  const commands = listHookCommands(options.hooks)
  if (commands.length === 0) return
  if (options.trust) return

  console.warn('\n⚠️  This plugin defines hook commands that run shell code on your machine:')
  console.warn('')
  for (const { event, command } of commands) {
    console.warn(`  - ${event}: ${command}`)
  }
  console.warn('')
  console.warn(
    `Installing "${options.pluginName}" means trusting this plugin author with local command execution.`
  )

  const isTTY = options.isTTY ?? process.stdin.isTTY === true
  if (!isTTY) {
    throw new Error(
      `Refusing to install plugin with hooks in non-interactive mode. Review the hook commands above. Re-run with --trust if you trust this plugin author.`
    )
  }

  const confirm = options.confirmPrompt ?? promptTrustConfirmation
  const approved = await confirm('Continue install? (y/N): ')
  if (!approved) {
    throw new Error('Install cancelled. Re-run with --trust to bypass confirmation.')
  }
}

function getInstallTargets(pluginName: string): InstallTarget[] {
  const home = process.env.HOME ?? '~'
  return [
    {
      platform: 'claude-code',
      pluginDir: resolve(home, '.claude/plugins', pluginName),
      description: `claude plugin install ${pluginName}@${getClaudeMarketplaceName(pluginName)}`,
    },
    {
      platform: 'cursor',
      pluginDir: resolve(home, '.cursor/plugins/local', pluginName),
      description: `~/.cursor/plugins/local/${pluginName}`,
    },
    {
      platform: 'codex',
      pluginDir: resolve(home, '.codex/plugins', pluginName),
      description: `~/.codex/plugins/${pluginName} (via ~/.agents/plugins/marketplace.json)`,
    },
    {
      platform: 'opencode',
      pluginDir: resolve(home, '.config/opencode/plugins', pluginName),
      description: `~/.config/opencode/plugins/${pluginName}.ts + ~/.config/opencode/plugins/${pluginName}/`,
    },
    {
      platform: 'github-copilot',
      pluginDir: resolve(home, '.github-copilot/plugins', pluginName),
      description: `~/.github-copilot/plugins/${pluginName}`,
    },
    {
      platform: 'openhands',
      pluginDir: resolve(home, '.openhands/plugins', pluginName),
      description: `~/.openhands/plugins/${pluginName}`,
    },
    {
      platform: 'warp',
      pluginDir: resolve(home, '.warp/plugins', pluginName),
      description: `~/.warp/plugins/${pluginName}`,
    },
    {
      platform: 'gemini-cli',
      pluginDir: resolve(home, '.gemini/extensions', pluginName),
      description: `~/.gemini/extensions/${pluginName}`,
    },
    {
      platform: 'roo-code',
      pluginDir: resolve(home, '.roo/plugins', pluginName),
      description: `~/.roo/plugins/${pluginName}`,
    },
    {
      platform: 'cline',
      pluginDir: resolve(home, '.cline/plugins', pluginName),
      description: `~/.cline/plugins/${pluginName}`,
    },
    {
      platform: 'amp',
      pluginDir: resolve(home, '.amp/plugins', pluginName),
      description: `~/.amp/plugins/${pluginName}`,
    },
  ]
}

function getOpenCodeEntryPath(pluginDir: string): string {
  return `${pluginDir}.ts`
}

function getOpenCodeSkillRoot(): string {
  const home = process.env.HOME ?? '~'
  return resolve(home, '.config/opencode/skills')
}

function getOpenCodeInstalledSkillDir(pluginName: string, skillName: string): string {
  return resolve(getOpenCodeSkillRoot(), `${pluginName}-${skillName}`)
}

function namespaceOpenCodeSkill(content: string, pluginName: string, fallbackName: string): string {
  const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---\n?/)
  const namespacedName = `${pluginName}/${fallbackName}`

  if (!frontmatterMatch) {
    return `---\nname: ${namespacedName}\n---\n\n${content}`
  }

  const frontmatter = frontmatterMatch[1]
  const existingNameMatch = frontmatter.match(/^name:\s*(.+)$/m)
  const existingName = existingNameMatch?.[1]?.trim().replace(/^['"]|['"]$/g, '') ?? fallbackName
  const nextName = existingName.startsWith(`${pluginName}/`) ? existingName : `${pluginName}/${existingName}`

  const nextFrontmatter = existingNameMatch
    ? frontmatter.replace(/^name:\s*.+$/m, `name: ${nextName}`)
    : `name: ${nextName}\n${frontmatter}`

  return `${content.slice(0, frontmatterMatch.index)}---\n${nextFrontmatter}\n---\n${content.slice(frontmatterMatch[0].length)}`
}

function getOpenCodeSkillInstallTargets(sourcePluginDir: string, pluginName: string) {
  const sourceSkillsDir = resolve(sourcePluginDir, 'skills')
  if (!existsSync(sourceSkillsDir)) return []
  return readdirSync(sourceSkillsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && existsSync(resolve(sourceSkillsDir, entry.name, 'SKILL.md')))
    .map((entry) => ({
      sourcePath: resolve(sourceSkillsDir, entry.name),
      installPath: getOpenCodeInstalledSkillDir(pluginName, entry.name),
      kind: 'copy' as const,
      surface: `skill-${entry.name}`,
      prepare: (stagePath: string): void => {
        const skillPath = resolve(stagePath, 'SKILL.md')
        writeFileSync(skillPath, namespaceOpenCodeSkill(readFileSync(skillPath, 'utf-8'), pluginName, entry.name))
      },
    }))
}

function verifyOpenCodeInstall(pluginDir: string, pluginName: string): void {
  const entryPath = getOpenCodeEntryPath(pluginDir)
  if (!existsSync(entryPath)) {
    throw new Error(`OpenCode install is incomplete: missing host entry file at ${entryPath}`)
  }

  const entryContent = readFileSync(entryPath, 'utf-8')
  const expectedImport = `import * as PluginModule from "./${pluginName}/index.ts"`
  if (!entryContent.includes(expectedImport)) {
    throw new Error(`OpenCode install is incomplete: ${entryPath} does not import ./${pluginName}/index.ts`)
  }

  if (!isCurrentOpenCodeEntryFile(entryContent, pluginName)) {
    throw new Error(`OpenCode install is incomplete: ${entryPath} does not pass the host workspace context through unchanged`)
  }

  const sourceSkillsDir = resolve(pluginDir, 'skills')
  if (!existsSync(sourceSkillsDir)) return

  for (const entry of readdirSync(sourceSkillsDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue

    const sourceSkillPath = resolve(sourceSkillsDir, entry.name, 'SKILL.md')
    if (!existsSync(sourceSkillPath)) continue

    const installedSkillPath = resolve(getOpenCodeInstalledSkillDir(pluginName, entry.name), 'SKILL.md')
    if (!existsSync(installedSkillPath)) {
      throw new Error(`OpenCode install is incomplete: missing synced skill at ${installedSkillPath}`)
    }

    const installedSkillContent = readFileSync(installedSkillPath, 'utf-8')
    if (!installedSkillContent.includes(`${pluginName}/`)) {
      throw new Error(`OpenCode install is incomplete: ${installedSkillPath} is missing the expected ${pluginName}/ skill namespace`)
    }
  }
}

export function getInstallFollowupNotes(platforms: TargetPlatform[]): string[] {
  return getDistributionInstallFollowupNotes(platforms)
}

function runCommandDefault(command: string, args: string[]): CommandResult {
  const result = spawnSync(command, args, { encoding: 'utf-8' })
  return {
    status: result.status,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
  }
}

function createSymlinkInstall(target: PlannedInstallTarget, pluginName: string): void {
  const manifestPath = manifestPathForPlatform(target.platform)
  transactionalInstall({
    pluginName,
    platform: target.platform,
    sourcePath: target.sourceDir,
    installPath: target.pluginDir,
    kind: 'symlink',
    validate: manifestPath && existsSync(resolve(target.sourceDir, manifestPath))
      ? path => assertInstalledBundleIntegrity(path, target.platform, `Staged ${target.platform} plugin bundle`)
      : undefined,
  })
}

function createOpenCodeInstall(
  target: PlannedInstallTarget,
  pluginName: string,
  kind: 'copy' | 'symlink',
  prepare?: (stagePath: string) => void,
): void {
  const manifestPath = manifestPathForPlatform(target.platform)
  transactionalInstallGroup({
    pluginName,
    platform: 'opencode',
    targets: [
      {
        sourcePath: target.sourceDir,
        installPath: target.pluginDir,
        kind,
        prepare,
        validate: manifestPath && existsSync(resolve(target.sourceDir, manifestPath))
          ? path => assertInstalledBundleIntegrity(path, target.platform, 'Staged opencode plugin bundle')
          : undefined,
      },
      {
        installPath: getOpenCodeEntryPath(target.pluginDir),
        kind: 'file',
        surface: 'entry',
        content: buildOpenCodeEntryFile(pluginName),
      },
      ...getOpenCodeSkillInstallTargets(target.sourceDir, pluginName),
    ],
  })
}

function getCodexMarketplacePath(): string {
  const home = process.env.HOME ?? '~'
  return resolve(home, '.agents/plugins/marketplace.json')
}

function getCodexMarketplacePluginPath(pluginName: string): string {
  return `./.codex/plugins/${pluginName}`
}

function getCodexLocalCachePluginRoot(pluginName: string): string {
  const home = process.env.HOME ?? '~'
  return resolve(home, '.codex/plugins/cache/local-plugins', pluginName)
}

function readCodexMarketplace(filepath: string): CodexMarketplaceFile {
  if (!existsSync(filepath)) {
    return {
      name: 'pluxx-local',
      interface: {
        displayName: 'Pluxx Local',
      },
      plugins: [],
    }
  }

  const raw = readFileSync(filepath, 'utf-8')
  const parsed = JSON.parse(raw) as CodexMarketplaceFile
  return {
    name: parsed.name ?? 'pluxx-local',
    interface: parsed.interface ?? { displayName: 'Pluxx Local' },
    plugins: Array.isArray(parsed.plugins) ? parsed.plugins : [],
  }
}

function ensureCodexMarketplace(pluginName: string): void {
  const filepath = getCodexMarketplacePath()
  mkdirSync(dirname(filepath), { recursive: true })

  const marketplace = readCodexMarketplace(filepath)
  const nextPlugins = (marketplace.plugins ?? []).filter((plugin) => plugin.name !== pluginName)
  nextPlugins.push({
    name: pluginName,
    source: {
      source: 'local',
      path: getCodexMarketplacePluginPath(pluginName),
    },
    policy: {
      installation: 'AVAILABLE',
      authentication: 'ON_INSTALL',
    },
    category: 'Productivity',
  })

  writeFileSync(
    filepath,
    JSON.stringify({
      name: marketplace.name ?? 'pluxx-local',
      interface: marketplace.interface ?? { displayName: 'Pluxx Local' },
      plugins: nextPlugins,
    }, null, 2) + '\n',
  )
}

function removeCodexMarketplacePlugin(pluginName: string): void {
  const filepath = getCodexMarketplacePath()
  if (!existsSync(filepath)) return

  const marketplace = readCodexMarketplace(filepath)
  const nextPlugins = (marketplace.plugins ?? []).filter((plugin) => plugin.name !== pluginName)

  if (nextPlugins.length === (marketplace.plugins ?? []).length) {
    return
  }

  if (nextPlugins.length === 0) {
    rmSync(filepath, { force: true })
    return
  }

  writeFileSync(
    filepath,
    JSON.stringify({
      name: marketplace.name ?? 'pluxx-local',
      interface: marketplace.interface ?? { displayName: 'Pluxx Local' },
      plugins: nextPlugins,
    }, null, 2) + '\n',
  )
}

function clearCodexLocalCache(pluginName: string): void {
  const cacheRoot = getCodexLocalCachePluginRoot(pluginName)
  if (!existsSync(cacheRoot)) return
  rmSync(cacheRoot, { recursive: true, force: true })
}

function createCopiedInstall(
  target: PlannedInstallTarget,
  pluginName: string,
  prepare?: (stagePath: string) => void,
  validate?: (path: string) => void,
): void {
  const manifestPath = manifestPathForPlatform(target.platform)
  const validateBundle = (path: string): void => {
    if (manifestPath && existsSync(resolve(path, manifestPath))) {
      assertInstalledBundleIntegrity(path, target.platform, `Staged ${target.platform} plugin bundle`)
    }
    validate?.(path)
  }
  transactionalInstall({
    pluginName,
    platform: target.platform,
    sourcePath: target.sourceDir,
    installPath: target.pluginDir,
    kind: 'copy',
    prepare,
    validate: validateBundle,
  })
}

function materializeTemplateValue(value: string, env: Record<string, string>, secretEnvVars = new Set<string>()): string {
  return value.replace(
    /\$\{([A-Za-z_][A-Za-z0-9_]*)\}/g,
    (_match, name: string) => (secretEnvVars.has(name) ? `\${${name}}` : (env[name] ?? `\${${name}}`)),
  )
}

function materializeEnvRecord(
  input: Record<string, string> | undefined,
  env: Record<string, string>,
  secretEnvVars = new Set<string>(),
): Record<string, string> {
  const output: Record<string, string> = {}

  for (const [key, value] of Object.entries(input ?? {})) {
    output[key] = materializeTemplateValue(value, env, secretEnvVars)
  }

  return output
}

function materializeStdioEnvRecord(
  input: Record<string, string> | undefined,
  env: Record<string, string>,
  secretEnvVars: Set<string>,
  runtimeEnvVars: Set<string>,
): Record<string, string> | undefined {
  const filteredInput = filterRuntimeInheritedStdioEnvRecord(input, runtimeEnvVars)
  const output: Record<string, string> = {}

  for (const [key, value] of Object.entries(filteredInput ?? {})) {
    output[key] = materializeTemplateValue(value, env, secretEnvVars)
  }

  return Object.keys(output).length > 0 ? output : undefined
}

function ensureMcpRuntimeEnvScript(pluginDir: string): void {
  const filepath = resolve(pluginDir, MCP_RUNTIME_ENV_SCRIPT_RELATIVE_PATH)
  mkdirSync(dirname(filepath), { recursive: true })
  writeFileSync(filepath, buildMcpRuntimeEnvScript(), { mode: 0o755 })
}

function patchInstalledMcpConfig(
  pluginDir: string,
  platform: TargetPlatform,
  config: PluginConfig,
  entries: ResolvedUserConfigEntry[],
  runtimeRoot = pluginDir,
): void {
  if (!config.mcp) return

  const env = buildUserConfigEnvMap(entries)
  const secretEnvVars = new Set(
    entries
      .filter((entry) => entry.field.type === 'secret' && entry.envVar)
      .map((entry) => entry.envVar as string),
  )
  const runtimeEnvVars = collectRuntimeInheritedStdioEnvVars(config, [platform])

  if (platform === 'claude-code' || platform === 'cursor') {
    const filepath = resolve(pluginDir, platform === 'claude-code' ? '.mcp.json' : 'mcp.json')
    if (!existsSync(filepath)) return

    const mcpServers: Record<string, unknown> = {}
    const usesPlatformManagedAuth = platform === 'claude-code'
      ? config.platforms?.['claude-code']?.mcpAuth === 'platform'
      : config.platforms?.cursor?.mcpAuth === 'platform'

    for (const [name, server] of Object.entries(config.mcp)) {
      if (server.transport === 'stdio') {
        const serverRuntimeEnvVars = collectStdioServerRuntimeEnvVars(server.env, runtimeEnvVars)
        const commandConfig = serverRuntimeEnvVars.size > 0
          ? buildRuntimeWrappedStdioMcpCommand(server, platform, serverRuntimeEnvVars, runtimeRoot)
          : {
              command: materializeInstalledPluginOwnedStdioPathForPlatform(server.command, platform, runtimeRoot),
              args: (server.args ?? []).map((value) => materializeInstalledPluginOwnedStdioPathForPlatform(value, platform, runtimeRoot)),
            }
        const stdioEnv = materializeStdioEnvRecord(server.env, env, secretEnvVars, serverRuntimeEnvVars)
        if (serverRuntimeEnvVars.size > 0) ensureMcpRuntimeEnvScript(pluginDir)
        mcpServers[name] = {
          ...commandConfig,
          ...(stdioEnv ? { env: stdioEnv } : {}),
        }
        continue
      }

      const entry: Record<string, unknown> = {
        type: server.transport === 'sse' ? 'sse' : 'http',
        url: server.url,
      }

      const nativeHeaders = getNativeJsonHeadersOverride(config, platform, name)
      if (!usesPlatformManagedAuth && nativeHeaders) {
        entry.headers = materializeEnvRecord(nativeHeaders, env)
      } else if (!usesPlatformManagedAuth && server.auth?.type === 'bearer' && server.auth.envVar && env[server.auth.envVar]) {
        entry.headers = {
          Authorization: `Bearer ${env[server.auth.envVar]}`,
        }
      } else if (!usesPlatformManagedAuth && server.auth?.type === 'header' && server.auth.envVar && env[server.auth.envVar]) {
        entry.headers = {
          [server.auth.headerName]: server.auth.headerTemplate.replace('${value}', env[server.auth.envVar]),
        }
      }

      mcpServers[name] = entry
    }

    writeFileSync(filepath, JSON.stringify({ mcpServers }, null, 2) + '\n')
    return
  }

  if (platform === 'codex') {
    const filepath = resolve(pluginDir, '.mcp.json')
    if (!existsSync(filepath)) return

    const mcpServers: Record<string, unknown> = {}

    for (const [name, server] of Object.entries(config.mcp)) {
      if (server.transport === 'stdio') {
        const serverRuntimeEnvVars = collectStdioServerRuntimeEnvVars(server.env, runtimeEnvVars)
        const commandConfig = serverRuntimeEnvVars.size > 0
          ? buildRuntimeWrappedStdioMcpCommand(server, platform, serverRuntimeEnvVars, runtimeRoot)
          : {
              command: materializeInstalledPluginOwnedStdioPathForPlatform(server.command, platform, runtimeRoot),
              args: (server.args ?? []).map((value) => materializeInstalledPluginOwnedStdioPathForPlatform(value, platform, runtimeRoot)),
            }
        const stdioEnv = materializeStdioEnvRecord(server.env, env, secretEnvVars, serverRuntimeEnvVars)
        if (serverRuntimeEnvVars.size > 0) ensureMcpRuntimeEnvScript(pluginDir)
        mcpServers[name] = {
          ...commandConfig,
          ...(stdioEnv ? { env: stdioEnv } : {}),
        }
        continue
      }

      const entry: Record<string, unknown> = {
        url: server.url,
      }

      const nativeOverride = getNativeCodexMcpEntryOverride(config, name)
      if (nativeOverride) {
        if (typeof nativeOverride.bearer_token_env_var === 'string') {
          entry.bearer_token_env_var = nativeOverride.bearer_token_env_var
        }

        if (nativeOverride.auth) {
          entry.auth = nativeOverride.auth
        }

        if (nativeOverride.env_http_headers && typeof nativeOverride.env_http_headers === 'object') {
          entry.env_http_headers = Object.fromEntries(
            Object.entries(nativeOverride.env_http_headers as Record<string, unknown>)
              .filter(([, value]) => typeof value === 'string')
              .map(([headerName, envVar]) => [headerName, envVar]),
          )
        }

        if (nativeOverride.http_headers && typeof nativeOverride.http_headers === 'object') {
          entry.http_headers = materializeEnvRecord(
            nativeOverride.http_headers as Record<string, string>,
            env,
            secretEnvVars,
          )
        }
      } else if (server.auth?.type === 'bearer' && server.auth.envVar) {
        entry.bearer_token_env_var = server.auth.envVar
      } else if (server.auth?.type === 'header' && server.auth.envVar) {
        const isBearerAuthorizationHeader =
          server.auth.headerName === 'Authorization'
          && server.auth.headerTemplate === 'Bearer ${value}'
        if (isBearerAuthorizationHeader) {
          entry.bearer_token_env_var = server.auth.envVar
        } else if (server.auth.headerTemplate === '${value}') {
          entry.env_http_headers = {
            [server.auth.headerName]: server.auth.envVar,
          }
        }
      }

      mcpServers[name] = entry
    }

    writeFileSync(filepath, JSON.stringify({ mcpServers }, null, 2) + '\n')
  }
}

function writeInstalledUserConfig(
  pluginDir: string,
  config: PluginConfig,
  entries: ResolvedUserConfigEntry[],
  platform: TargetPlatform,
): void {
  const runtimeEnvVars = collectRuntimeInheritedStdioEnvVars(config, [platform])
  const persistentEntries = entries.filter((entry) => !entry.envVar || !runtimeEnvVars.has(entry.envVar))
  if (persistentEntries.length === 0) return

  const filepath = resolve(pluginDir, '.pluxx-user.json')
  const payload = buildInstalledUserConfigPayload(persistentEntries, {
    preserveSecretReferences: platform === 'codex',
  })

  writeFileSync(filepath, JSON.stringify(payload, null, 2) + '\n')
}

function disableInstalledEnvValidation(pluginDir: string, entries: ResolvedUserConfigEntry[]): void {
  if (entries.length === 0) return

  const filepath = resolve(pluginDir, 'scripts/check-env.sh')
  if (!existsSync(filepath)) return

  writeFileSync(
    filepath,
    '#!/usr/bin/env bash\nset -euo pipefail\n# pluxx install materialized required config for this local plugin install.\nexit 0\n',
  )
}

function materializeInstalledPlugin(
  pluginDir: string,
  platform: TargetPlatform,
  config: PluginConfig,
  entries: ResolvedUserConfigEntry[],
  runtimeRoot = pluginDir,
): void {
  const runtimeEnvVars = collectRuntimeInheritedStdioEnvVars(config, [platform])
  const persistentEntries = entries.filter((entry) => !entry.envVar || !runtimeEnvVars.has(entry.envVar))
  if (persistentEntries.length > 0) {
    writeInstalledUserConfig(pluginDir, config, persistentEntries, platform)
    disableInstalledEnvValidation(pluginDir, persistentEntries)
  }
  patchInstalledMcpConfig(pluginDir, platform, config, entries, runtimeRoot)
}

function codexInstallNeedsCopiedMaterialization(config?: PluginConfig): boolean {
  if (!config?.mcp) return false

  for (const server of Object.values(config.mcp)) {
    if (server.transport !== 'stdio') continue

    if (
      materializeInstalledPluginOwnedStdioPathForPlatform(server.command, 'codex', '/tmp/pluxx-codex-install-check') !== server.command
      || (server.args ?? []).some((value) => materializeInstalledPluginOwnedStdioPathForPlatform(value, 'codex', '/tmp/pluxx-codex-install-check') !== value)
    ) {
      return true
    }
  }

  return false
}

function getClaudeMarketplaceName(pluginName: string): string {
  return `pluxx-local-${pluginName}`
}

function getClaudeMarketplaceRoot(pluginName: string): string {
  const home = process.env.HOME ?? '~'
  return resolve(home, '.claude/plugins/data', getClaudeMarketplaceName(pluginName))
}

function readBundleManifestVersion(rootDir: string, platform: TargetPlatform): string | undefined {
  const manifestPath = manifestPathForPlatform(platform)
  if (!manifestPath) return undefined

  const filepath = resolve(rootDir, manifestPath)
  if (!existsSync(filepath)) return undefined

  try {
    const manifest = JSON.parse(readFileSync(filepath, 'utf-8')) as { version?: unknown }
    return typeof manifest.version === 'string' ? manifest.version : undefined
  } catch {
    return undefined
  }
}

function resolveClaudeInstalledCachePath(pluginName: string, version: string | undefined): string | undefined {
  if (!version) return undefined

  const home = process.env.HOME ?? '~'
  const cacheRoot = resolve(home, '.claude/plugins/cache')
  const expectedPath = resolve(cacheRoot, getClaudeMarketplaceName(pluginName), pluginName, version)
  if (existsSync(expectedPath)) return expectedPath
  if (!existsSync(cacheRoot)) return expectedPath

  const candidates: Array<{ path: string; mtimeMs: number }> = []
  for (const marketplace of readdirSync(cacheRoot, { withFileTypes: true })) {
    if (!marketplace.isDirectory()) continue
    const candidatePath = resolve(cacheRoot, marketplace.name, pluginName, version)
    if (!existsSync(candidatePath)) continue
    if (readBundleManifestVersion(candidatePath, 'claude-code') !== version) continue
    try {
      candidates.push({ path: candidatePath, mtimeMs: statSync(candidatePath).mtimeMs })
    } catch {
      // Ignore unreadable marketplace cache candidates.
    }
  }

  return candidates.sort((a, b) => b.mtimeMs - a.mtimeMs)[0]?.path ?? expectedPath
}

function resolveExpectedInstalledConsumerPath(target: PlannedInstallTarget, pluginName: string): string {
  if (target.platform === 'claude-code' && pluginName !== '') {
    const cachePath = resolveClaudeInstalledCachePath(
      pluginName,
      readBundleManifestVersion(target.sourceDir, 'claude-code'),
    )
    if (cachePath) return cachePath
  }

  return target.pluginDir
}

export function resolveInstalledConsumerPath(target: PlannedInstallTarget, pluginName: string): string {
  if (target.platform === 'claude-code' && pluginName !== '') {
    const expectedPath = resolveExpectedInstalledConsumerPath(target, pluginName)
    if (existsSync(expectedPath)) return expectedPath
    if (existsSync(target.pluginDir)) return target.pluginDir
    return expectedPath
  }

  return target.pluginDir
}

function manifestPathForPlatform(platform: TargetPlatform): string | undefined {
  switch (platform) {
    case 'claude-code':
      return '.claude-plugin/plugin.json'
    case 'cursor':
      return '.cursor-plugin/plugin.json'
    case 'codex':
      return '.codex-plugin/plugin.json'
    case 'opencode':
      return 'package.json'
    default:
      return undefined
  }
}

function isRelativeBundlePath(value: string): boolean {
  return value.startsWith('./')
    || value.startsWith('../')
    || value.startsWith('.\\')
    || value.startsWith('..\\')
}

function resolveBundleReference(rootDir: string, value: string): string | undefined {
  if (isRelativeBundlePath(value)) {
    return resolve(rootDir, value)
  }

  const pluginRootMatch = value.match(/^\$\{(?:CLAUDE_PLUGIN_ROOT|CURSOR_PLUGIN_ROOT|CODEX_PLUGIN_ROOT|OPENCODE_PLUGIN_ROOT|PLUGIN_ROOT|PLUXX_PLUGIN_ROOT)\}[\\/](.+)$/)
  if (pluginRootMatch) {
    return resolve(rootDir, pluginRootMatch[1])
  }

  return undefined
}

function readBundleManifestReferences(manifest: Record<string, unknown>): string[] {
  const references: string[] = []

  for (const key of ['commands', 'skills', 'hooks', 'mcpServers', 'rules', 'apps']) {
    const value = manifest[key]
    if (typeof value === 'string') {
      references.push(value)
    }
  }

  const agents = manifest.agents
  if (typeof agents === 'string') {
    references.push(agents)
  } else if (Array.isArray(agents)) {
    for (const entry of agents) {
      if (typeof entry === 'string') {
        references.push(entry)
      }
    }
  }

  return references
}

function collectHookCommandStrings(value: unknown, commands: string[]): void {
  if (Array.isArray(value)) {
    for (const entry of value) {
      collectHookCommandStrings(entry, commands)
    }
    return
  }

  if (!value || typeof value !== 'object') return

  for (const [key, child] of Object.entries(value)) {
    if (key === 'command' && typeof child === 'string') {
      commands.push(child)
      continue
    }
    collectHookCommandStrings(child, commands)
  }
}

function extractBundleCommandTargets(command: string): string[] {
  const matches = command.match(/\$\{(?:CLAUDE_PLUGIN_ROOT|CURSOR_PLUGIN_ROOT|CODEX_PLUGIN_ROOT|OPENCODE_PLUGIN_ROOT|PLUGIN_ROOT|PLUXX_PLUGIN_ROOT)\}[\\/][^\s"'`;$|&<>]+|\.\.?[\\/][^\s"'`;$|&<>]+/g)
  return matches ?? []
}

function extractRelativeBundleCommandTargets(command: string): string[] {
  return extractBundleCommandTargets(command).filter(isRelativeBundlePath)
}

function commandChangesToKnownPluginRoot(command: string): boolean {
  return /\bcd\s+["']?\$\{?(?:CLAUDE_PLUGIN_ROOT|CURSOR_PLUGIN_ROOT|CODEX_PLUGIN_ROOT|OPENCODE_PLUGIN_ROOT|PLUGIN_ROOT|PLUXX_PLUGIN_ROOT)\}?/.test(command)
}

function formatBundleRelativePath(rootDir: string, filePath: string): string {
  const relativePath = relative(rootDir, filePath)
  return relativePath && !relativePath.startsWith('..') ? relativePath : filePath
}

function findHookWrapperPaths(rootDir: string, command: string): string[] {
  return extractBundleCommandTargets(command)
    .map((target) => resolveBundleReference(rootDir, target))
    .filter((target): target is string => {
      if (!target) return false
      return existsSync(target)
        && basename(target).startsWith('pluxx-hook-command-')
        && (target.endsWith('.sh') || target.endsWith('.mjs'))
    })
}

function extractGeneratedHookWrapperCommand(wrapper: string): string {
  const shellAssignment = wrapper.match(/^PLUXX_HOOK_COMMAND=(.*)$/m)?.[1]
  if (shellAssignment) return shellAssignment

  const nodeAssignment = wrapper.match(/^const COMMAND = (.*)$/m)?.[1]
  if (!nodeAssignment) return ''

  try {
    return JSON.parse(nodeAssignment) as string
  } catch {
    return nodeAssignment
  }
}

function findCodexCwdUnsafeHookCommands(rootDir: string, commands: string[]): string[] {
  const issues = new Set<string>()

  for (const command of commands) {
    const relativeTargets = extractRelativeBundleCommandTargets(command)
    if (relativeTargets.length > 0 && !commandChangesToKnownPluginRoot(command)) {
      issues.add(`${command} uses cwd-relative bundle target(s): ${relativeTargets.join(', ')}`)
    }

    for (const wrapperPath of findHookWrapperPaths(rootDir, command)) {
      const wrapper = readFileSync(wrapperPath, 'utf-8')
      const hookCommand = extractGeneratedHookWrapperCommand(wrapper)
      const wrapperRelativeTargets = extractRelativeBundleCommandTargets(hookCommand)
      if (wrapperRelativeTargets.length > 0 && !commandChangesToKnownPluginRoot(wrapper)) {
        issues.add(`${formatBundleRelativePath(rootDir, wrapperPath)} evaluates cwd-relative bundle target(s): ${wrapperRelativeTargets.join(', ')}`)
      }
    }
  }

  return [...issues].sort()
}

function resolveInstalledHooksReference(
  rootDir: string,
  platform: TargetPlatform,
  manifest: Record<string, unknown>,
): {
  reference?: string
  path?: string
} {
  const manifestReference = typeof manifest.hooks === 'string' ? manifest.hooks : undefined
  if (manifestReference) {
    return {
      reference: manifestReference,
      path: resolveBundleReference(rootDir, manifestReference),
    }
  }

  if (platform === 'claude-code') {
    const fallbackReference = './hooks/hooks.json'
    const fallbackPath = resolve(rootDir, 'hooks/hooks.json')
    if (existsSync(fallbackPath)) {
      return {
        reference: fallbackReference,
        path: fallbackPath,
      }
    }
  }

  return {}
}

function getClaudeStandardHooksManifestIssue(
  rootDir: string,
  platform: TargetPlatform,
  manifest: Record<string, unknown>,
): string | undefined {
  if (platform !== 'claude-code') return undefined

  const manifestReference = typeof manifest.hooks === 'string' ? manifest.hooks : undefined
  if (!manifestReference) return undefined

  const manifestHooksPath = resolveBundleReference(rootDir, manifestReference)
  const standardHooksPath = resolve(rootDir, 'hooks/hooks.json')
  if (!manifestHooksPath || manifestHooksPath !== standardHooksPath || !existsSync(standardHooksPath)) {
    return undefined
  }

  return 'Claude auto-loads hooks/hooks.json. Current Claude CLI releases report a duplicate hooks file load error when manifest.hooks also points at ./hooks/hooks.json, so manifest.hooks should only reference additional hook files.'
}

export function findInstalledBundleIntegrityIssues(rootDir: string, platform: TargetPlatform): BundleIntegrityIssues {
  const manifestPath = manifestPathForPlatform(platform)
  if (!manifestPath) {
    return {
      missingManifestPaths: [],
      missingHookTargets: [],
      cwdUnsafeHookCommands: [],
      invalidRuntimeScripts: [],
    }
  }

  const manifestFile = resolve(rootDir, manifestPath)
  if (!existsSync(manifestFile)) {
    return {
      manifestIssue: `missing plugin manifest at ${manifestPath}`,
      missingManifestPaths: [],
      missingHookTargets: [],
      cwdUnsafeHookCommands: [],
      invalidRuntimeScripts: [],
    }
  }

  let manifest: Record<string, unknown>
  try {
    manifest = JSON.parse(readFileSync(manifestFile, 'utf-8')) as Record<string, unknown>
  } catch (error) {
    return {
      manifestIssue: `plugin manifest at ${manifestPath} is not parseable: ${error instanceof Error ? error.message : String(error)}`,
      missingManifestPaths: [],
      missingHookTargets: [],
      cwdUnsafeHookCommands: [],
      invalidRuntimeScripts: [],
    }
  }

  const missingManifestPaths = readBundleManifestReferences(manifest)
    .filter((value) => {
      const resolved = resolveBundleReference(rootDir, value)
      return resolved !== undefined && !existsSync(resolved)
    })
    .sort()
  const manifestIssue = getClaudeStandardHooksManifestIssue(rootDir, platform, manifest)

  const { reference: hooksReference, path: hooksPath } = resolveInstalledHooksReference(rootDir, platform, manifest)
  if (!hooksReference) {
    return {
      ...(manifestIssue ? { manifestIssue } : {}),
      missingManifestPaths,
      missingHookTargets: [],
      cwdUnsafeHookCommands: [],
      invalidRuntimeScripts: findInstalledRuntimeScriptIssues(rootDir, manifest),
    }
  }

  if (!hooksPath || !existsSync(hooksPath)) {
    return {
      ...(manifestIssue ? { manifestIssue } : {}),
      missingManifestPaths,
      missingHookTargets: [],
      cwdUnsafeHookCommands: [],
      invalidRuntimeScripts: findInstalledRuntimeScriptIssues(rootDir, manifest),
    }
  }

  try {
    const hooks = JSON.parse(readFileSync(hooksPath, 'utf-8')) as Record<string, unknown>
    const commands: string[] = []
    collectHookCommandStrings(hooks, commands)

    const missingHookTargets = [...new Set(
      commands
        .flatMap(extractBundleCommandTargets)
        .filter((value) => {
          const resolved = resolveBundleReference(rootDir, value)
          return resolved !== undefined && !existsSync(resolved)
        }),
    )].sort()
    const cwdUnsafeHookCommands = platform === 'codex'
      ? findCodexCwdUnsafeHookCommands(rootDir, commands)
      : []

    return {
      ...(manifestIssue ? { manifestIssue } : {}),
      missingManifestPaths,
      missingHookTargets,
      cwdUnsafeHookCommands,
      invalidRuntimeScripts: findInstalledRuntimeScriptIssues(rootDir, manifest),
    }
  } catch (error) {
    return {
      ...(manifestIssue ? { manifestIssue } : {}),
      hookConfigIssue: `hooks config at ${hooksReference} is not parseable: ${error instanceof Error ? error.message : String(error)}`,
      missingManifestPaths,
      missingHookTargets: [],
      cwdUnsafeHookCommands: [],
      invalidRuntimeScripts: findInstalledRuntimeScriptIssues(rootDir, manifest),
    }
  }
}

function findInstalledRuntimeScriptIssues(rootDir: string, manifest: Record<string, unknown>): string[] {
  const mcpReference = typeof manifest.mcpServers === 'string' ? manifest.mcpServers : undefined
  if (!mcpReference) return []

  const mcpPath = resolveBundleReference(rootDir, mcpReference)
  if (!mcpPath || !existsSync(mcpPath)) return []

  try {
    const parsed = JSON.parse(readFileSync(mcpPath, 'utf-8')) as { mcpServers?: Record<string, unknown> }
    const issues = new Set<string>()

    for (const [serverName, server] of Object.entries(parsed.mcpServers ?? {})) {
      if (!server || typeof server !== 'object') continue
      const serverRecord = server as Record<string, unknown>
      const args = Array.isArray(serverRecord.args)
        ? serverRecord.args.filter((value): value is string => typeof value === 'string')
        : []

      const commandTargets = [
        typeof serverRecord.command === 'string' ? serverRecord.command : '',
        ...args,
      ].flatMap(extractBundleCommandTargets)

      for (const target of commandTargets) {
        const resolved = resolveBundleReference(rootDir, target)
        if (!resolved || !existsSync(resolved) || !resolved.endsWith('.sh')) continue

        const content = readFileSync(resolved, 'utf-8')
        if (!content.includes('check-env.sh')) continue

        const relativePath = resolved.startsWith(`${rootDir}/`) ? resolved.slice(rootDir.length + 1) : resolved
        issues.add(`runtime script ${relativePath} for MCP server "${serverName}" still references installer-owned scripts/check-env.sh`)
      }
    }

    return [...issues].sort()
  } catch {
    return []
  }
}

function assertInstalledBundleIntegrity(rootDir: string, platform: TargetPlatform, label: string): void {
  const issues = findInstalledBundleIntegrityIssues(rootDir, platform)
  const details: string[] = []

  if (issues.manifestIssue) {
    details.push(issues.manifestIssue)
  }
  if (issues.hookConfigIssue) {
    details.push(issues.hookConfigIssue)
  }
  if (issues.missingManifestPaths.length > 0) {
    details.push(`manifest paths missing: ${issues.missingManifestPaths.join(', ')}`)
  }
  if (issues.missingHookTargets.length > 0) {
    details.push(`hook targets missing: ${issues.missingHookTargets.join(', ')}`)
  }
  if (issues.cwdUnsafeHookCommands.length > 0) {
    details.push(`hook commands require plugin-root cwd: ${issues.cwdUnsafeHookCommands.join('; ')}`)
  }
  if (issues.invalidRuntimeScripts.length > 0) {
    details.push(`runtime script issues: ${issues.invalidRuntimeScripts.join(', ')}`)
  }

  if (details.length > 0) {
    throw new Error(`${label} is incomplete: ${details.join('; ')}`)
  }
}

function ensureClaudeMarketplace(
  pluginName: string,
  sourceDir: string,
  materialized?: {
    config: PluginConfig
    entries: ResolvedUserConfigEntry[]
  },
): { marketplaceName: string; marketplaceRoot: string } {
  const marketplaceName = getClaudeMarketplaceName(pluginName)
  const marketplaceRoot = getClaudeMarketplaceRoot(pluginName)
  const marketplaceManifestDir = resolve(marketplaceRoot, '.claude-plugin')
  const marketplacePluginDir = resolve(marketplaceRoot, 'plugins', pluginName)
  const pluginManifestPath = resolve(sourceDir, '.claude-plugin/plugin.json')

  const pluginManifest = JSON.parse(readFileSync(pluginManifestPath, 'utf-8')) as {
    description?: string
    version?: string
    author?: unknown
    license?: string
    homepage?: string
    repository?: string
    keywords?: string[]
  }

  rmSync(marketplaceRoot, { recursive: true, force: true })
  mkdirSync(marketplaceManifestDir, { recursive: true })
  mkdirSync(resolve(marketplaceRoot, 'plugins'), { recursive: true })
  cpSync(sourceDir, marketplacePluginDir, { recursive: true })
  if (materialized && materialized.entries.length > 0) {
    materializeInstalledPlugin(marketplacePluginDir, 'claude-code', materialized.config, materialized.entries)
  }
  assertInstalledBundleIntegrity(marketplacePluginDir, 'claude-code', 'Claude marketplace bundle')

  writeFileSync(
    resolve(marketplaceManifestDir, 'marketplace.json'),
    JSON.stringify({
      name: marketplaceName,
      owner: {
        name: 'Pluxx',
      },
      plugins: [
        {
          name: pluginName,
          source: `./plugins/${pluginName}`,
          description: pluginManifest.description ?? `Local Pluxx-built ${pluginName} plugin.`,
          version: pluginManifest.version ?? '0.1.0',
          author: pluginManifest.author ?? { name: 'Pluxx' },
          license: pluginManifest.license ?? 'MIT',
          ...(pluginManifest.homepage ? { homepage: pluginManifest.homepage } : {}),
          ...(pluginManifest.repository ? { repository: pluginManifest.repository } : {}),
          ...(pluginManifest.keywords ? { keywords: pluginManifest.keywords } : {}),
        },
      ],
    }, null, 2),
  )

  return { marketplaceName, marketplaceRoot }
}

function ensureClaudeMarketplaceRegistered(
  pluginName: string,
  sourceDir: string,
  runCommand: CommandRunner,
  materialized?: {
    config: PluginConfig
    entries: ResolvedUserConfigEntry[]
  },
): string {
  const { marketplaceName, marketplaceRoot } = ensureClaudeMarketplace(pluginName, sourceDir, materialized)
  const marketplaces = runCommand('claude', ['plugin', 'marketplace', 'list', '--json'])

  if (marketplaces.status !== 0) {
    throw new Error(`Failed to list Claude marketplaces: ${marketplaces.stderr || marketplaces.stdout}`)
  }

  const known = JSON.parse(marketplaces.stdout) as Array<{ name?: string }>
  if (!known.some(entry => entry.name === marketplaceName)) {
    const add = runCommand('claude', ['plugin', 'marketplace', 'add', marketplaceRoot])
    if (add.status !== 0) {
      throw new Error(`Failed to add Claude marketplace: ${add.stderr || add.stdout}`)
    }
  }

  return marketplaceName
}

function installClaudePlugin(
  target: PlannedInstallTarget,
  pluginName: string,
  runCommand: CommandRunner,
  materialized?: {
    config: PluginConfig
    entries: ResolvedUserConfigEntry[]
  },
): void {
  const marketplaceName = ensureClaudeMarketplaceRegistered(pluginName, target.sourceDir, runCommand, materialized)

  if (existsSync(target.pluginDir)) {
    rmSync(target.pluginDir, { recursive: true, force: true })
  }

  runCommand('claude', ['plugin', 'uninstall', `${pluginName}@${marketplaceName}`])

  const install = runCommand('claude', ['plugin', 'install', `${pluginName}@${marketplaceName}`, '--scope', 'user'])
  if (install.status !== 0) {
    throw new Error(`Failed to install Claude plugin: ${install.stderr || install.stdout}`)
  }

  assertInstalledBundleIntegrity(
    resolveExpectedInstalledConsumerPath(target, pluginName),
    'claude-code',
    'Installed Claude plugin bundle',
  )
}

function uninstallClaudePlugin(
  target: InstallTarget,
  pluginName: string,
  runCommand: CommandRunner,
  options: { quiet?: boolean } = {},
): boolean {
  const marketplaceName = getClaudeMarketplaceName(pluginName)
  const uninstall = runCommand('claude', ['plugin', 'uninstall', `${pluginName}@${marketplaceName}`])

  if (uninstall.status !== 0 && !options.quiet) {
    const detail = uninstall.stderr || uninstall.stdout
    if (detail.trim().length > 0) {
      console.warn(`  warning claude-code uninstall: ${detail.trim()}`)
    }
  }

  const marketplaceRoot = getClaudeMarketplaceRoot(pluginName)
  const hadMarketplaceRoot = existsSync(marketplaceRoot)
  rmSync(marketplaceRoot, { recursive: true, force: true })

  const hadLegacyPluginDir = existsSync(target.pluginDir)
  if (hadLegacyPluginDir) {
    rmSync(target.pluginDir, { recursive: true, force: true })
  }

  return uninstall.status === 0 || hadMarketplaceRoot || hadLegacyPluginDir
}

export function planInstallPlugin(
  distDir: string,
  pluginName: string,
  platforms?: TargetPlatform[],
): PlannedInstallTarget[] {
  const targets = getInstallTargets(pluginName)
  const filtered = platforms
    ? targets.filter(t => platforms.includes(t.platform))
    : targets

  return filtered.map((target) => {
    const sourceDir = resolve(distDir, target.platform)
    return {
      ...target,
      sourceDir,
      built: existsSync(sourceDir),
      existing: existsSync(target.pluginDir),
    }
  })
}

export async function installPlugin(
  distDir: string,
  pluginName: string,
  platforms?: TargetPlatform[],
  options: {
    config?: PluginConfig
    quiet?: boolean
    useNativeClaudeInstall?: boolean
    runCommand?: CommandRunner
    resolvedUserConfig?: ResolvedUserConfigEntry[]
  } = {},
): Promise<void> {
  const filtered = planInstallPlugin(distDir, pluginName, platforms)
  const runCommand = options.runCommand ?? runCommandDefault
  const useNativeClaudeInstall = options.useNativeClaudeInstall ?? true

  let installed = 0

  for (const target of filtered) {
    if (!target.built) {
      if (!options.quiet) {
        console.log(`  skip ${target.platform} (not built)`)
      }
      continue
    }

    if (target.platform === 'codex') {
      syncCodexAgentRegistration({
        consumerRoot: target.sourceDir,
        pluginName,
        dryRun: true,
      })
    }

    const targetConfigEntries = options.resolvedUserConfig
      ? resolveUserConfigEntriesForTarget(options.resolvedUserConfig, target.platform)
      : []
    const shouldMaterialize = targetConfigEntries.length > 0 && options.config
    const shouldMaterializeCodexInstall = target.platform === 'codex' && codexInstallNeedsCopiedMaterialization(options.config)

    if (target.platform === 'claude-code' && useNativeClaudeInstall) {
      installClaudePlugin(
        target,
        pluginName,
        runCommand,
        shouldMaterialize
          ? {
              config: options.config!,
              entries: targetConfigEntries,
            }
          : undefined,
      )
    } else if (target.platform === 'opencode' && shouldMaterialize) {
      createOpenCodeInstall(
        target,
        pluginName,
        'copy',
        stagePath => materializeInstalledPlugin(stagePath, target.platform, options.config!, targetConfigEntries, target.pluginDir),
      )
    } else if (target.platform === 'opencode') {
      createOpenCodeInstall(target, pluginName, 'symlink')
      verifyOpenCodeInstall(target.pluginDir, pluginName)
    } else if (shouldMaterialize || shouldMaterializeCodexInstall) {
      createCopiedInstall(
        target,
        pluginName,
        stagePath => materializeInstalledPlugin(stagePath, target.platform, options.config!, targetConfigEntries, target.pluginDir),
      )
    } else {
      createSymlinkInstall(target, pluginName)
    }
    const manifestPath = manifestPathForPlatform(target.platform)
    if (manifestPath && existsSync(resolve(target.pluginDir, manifestPath))) {
      assertInstalledBundleIntegrity(target.pluginDir, target.platform, `Installed ${target.platform} plugin bundle`)
    }
    if (target.platform === 'codex') {
      ensureCodexMarketplace(pluginName)
      clearCodexLocalCache(pluginName)
      syncCodexAgentRegistration({ consumerRoot: target.pluginDir, pluginName })
    }
    if (!options.quiet) {
      console.log(`  ${target.platform} -> ${target.description}`)
    }
    installed++
  }

  if (installed === 0 && !options.quiet) {
    console.log('Nothing to install. Run `pluxx build` first.')
  } else if (!options.quiet) {
    console.log(`\nInstalled ${installed} plugin(s).`)
    console.log('Next checks:')
    console.log(`  1. Run: pluxx verify-install --target ${filtered.map((target) => target.platform).join(',')}`)
    console.log('  2. Open the host plugin screen and confirm the plugin appears there.')
    console.log('  3. Reload or restart the host if it was already open.')
    for (const note of getInstallFollowupNotes(filtered.map((target) => target.platform))) {
      console.log(note)
    }
  }
}

export async function uninstallPlugin(
  pluginName: string,
  platforms?: TargetPlatform[],
  options: { quiet?: boolean; runCommand?: CommandRunner } = {},
): Promise<void> {
  const targets = getInstallTargets(pluginName)
  const filtered = platforms
    ? targets.filter(t => platforms.includes(t.platform))
    : targets
  const runCommand = options.runCommand ?? runCommandDefault

  let removed = 0

  for (const target of filtered) {
    if (target.platform === 'claude-code') {
      const removedClaude = uninstallClaudePlugin(target, pluginName, runCommand, { quiet: options.quiet })
      if (removedClaude) {
        if (!options.quiet) {
          console.log(`  removed ${target.description}`)
        }
        removed++
      }
      continue
    }

    const ownershipRecords = target.platform === 'opencode'
      ? listInstallOwnership(pluginName, target.platform)
      : []
    const removals = target.platform === 'opencode' && ownershipRecords.length > 0
      ? ownershipRecords.map((record) => removeOwnedInstall(pluginName, target.platform, record.installPath, record.surface))
      : [removeOwnedInstall(pluginName, target.platform, target.pluginDir)]
    let removedTarget = removals.some((removal) => removal.changed)
    const preserved = removals.flatMap((removal) => removal.preserved)
    if (preserved.length > 0 && !options.quiet) {
      console.warn(`  preserved ${preserved.length} modified or unowned installed path(s) for ${target.description}`)
    }
    if (target.platform === 'opencode') {
      if (ownershipRecords.length === 0) {
        const unownedCompanions = [getOpenCodeEntryPath(target.pluginDir)]
        const skillRoot = getOpenCodeSkillRoot()
        if (existsSync(skillRoot)) {
          unownedCompanions.push(...readdirSync(skillRoot)
            .filter((name) => name.startsWith(`${pluginName}-`))
            .map((name) => resolve(skillRoot, name)))
        }
        const existingUnowned = unownedCompanions.filter(existsSync)
        if (existingUnowned.length > 0 && !options.quiet) {
          console.warn(`  preserved ${existingUnowned.length} unowned OpenCode companion path(s)`)
        }
      }
    }
    if (target.platform === 'codex') {
      const agentRemoval = removeCodexAgentRegistration({ pluginName })
      if (agentRemoval.changed) removedTarget = true
      if (agentRemoval.preserved.length > 0 && !options.quiet) {
        console.warn(
          `  preserved ${agentRemoval.preserved.length} user-modified Codex agent registration(s) under ${agentRemoval.agentRoot}`,
        )
      }
      removeCodexMarketplacePlugin(pluginName)
      clearCodexLocalCache(pluginName)
    }
    if (removedTarget) {
      if (!options.quiet) {
        console.log(`  removed ${target.description}`)
      }
      removed++
    }
  }

  if (removed === 0 && !options.quiet) {
    console.log('Nothing to uninstall.')
  } else if (!options.quiet) {
    console.log(`\nRemoved ${removed} plugin(s).`)
  }
}
