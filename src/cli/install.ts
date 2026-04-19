import { resolve, basename, dirname } from 'path'
import { existsSync, symlinkSync, mkdirSync, rmSync, readFileSync, writeFileSync, cpSync } from 'fs'
import { spawnSync } from 'child_process'
import * as readline from 'readline'
import type { PluginConfig, TargetPlatform, UserConfigEntry } from '../schema'
import {
  buildUserConfigEnvMap,
  buildUserConfigValueMap,
  collectUserConfigEntries,
  defaultUserConfigEnvVar,
  resolveUserConfigEntriesForTarget,
  type ResolvedUserConfigEntry,
} from '../user-config'

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
  const entries = collectUserConfigEntries(config, platforms)

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
      const hint = entry.envVar ? ` Export ${entry.envVar} or install interactively.` : ' Re-run interactively to provide it.'
      throw new Error(`Missing required userConfig "${entry.field.key}".${hint}`)
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
      `Refusing to install plugin with hooks in non-interactive mode. Re-run with --trust to continue.`
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
      description: `~/.config/opencode/plugins/${pluginName}`,
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

export function getInstallFollowupNotes(platforms: TargetPlatform[]): string[] {
  const notes: string[] = []

  if (platforms.includes('claude-code')) {
    notes.push('Claude Code note: if Claude is already open, run /reload-plugins in the session to pick up the new install.')
  }

  return notes
}

function runCommandDefault(command: string, args: string[]): CommandResult {
  const result = spawnSync(command, args, { encoding: 'utf-8' })
  return {
    status: result.status,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
  }
}

function createSymlinkInstall(target: PlannedInstallTarget): void {
  const parentDir = resolve(target.pluginDir, '..')
  mkdirSync(parentDir, { recursive: true })

  if (existsSync(target.pluginDir)) {
    rmSync(target.pluginDir, { recursive: true, force: true })
  }

  symlinkSync(target.sourceDir, target.pluginDir)
}

function getCodexMarketplacePath(): string {
  const home = process.env.HOME ?? '~'
  return resolve(home, '.agents/plugins/marketplace.json')
}

function getCodexMarketplacePluginPath(pluginName: string): string {
  return `./.codex/plugins/${pluginName}`
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

function createCopiedInstall(target: PlannedInstallTarget): void {
  const parentDir = resolve(target.pluginDir, '..')
  mkdirSync(parentDir, { recursive: true })

  if (existsSync(target.pluginDir)) {
    rmSync(target.pluginDir, { recursive: true, force: true })
  }

  cpSync(target.sourceDir, target.pluginDir, { recursive: true })
}

function materializeTemplateValue(value: string, env: Record<string, string>): string {
  return value.replace(/\$\{([A-Za-z_][A-Za-z0-9_]*)\}/g, (_match, name: string) => env[name] ?? `\${${name}}`)
}

function materializeEnvRecord(
  input: Record<string, string> | undefined,
  env: Record<string, string>,
): Record<string, string> {
  const output: Record<string, string> = {}

  for (const [key, value] of Object.entries(input ?? {})) {
    output[key] = materializeTemplateValue(value, env)
  }

  return output
}

function patchInstalledMcpConfig(
  pluginDir: string,
  platform: TargetPlatform,
  config: PluginConfig,
  entries: ResolvedUserConfigEntry[],
): void {
  if (!config.mcp) return

  const env = buildUserConfigEnvMap(entries)

  if (platform === 'claude-code' || platform === 'cursor') {
    const filepath = resolve(pluginDir, platform === 'claude-code' ? '.mcp.json' : 'mcp.json')
    if (!existsSync(filepath)) return

    const mcpServers: Record<string, unknown> = {}
    const usesPlatformManagedAuth = platform === 'claude-code'
      ? config.platforms?.['claude-code']?.mcpAuth === 'platform'
      : config.platforms?.cursor?.mcpAuth === 'platform'

    for (const [name, server] of Object.entries(config.mcp)) {
      if (server.transport === 'stdio') {
        mcpServers[name] = {
          command: server.command,
          args: server.args ?? [],
          env: materializeEnvRecord(server.env, env),
        }
        continue
      }

      const entry: Record<string, unknown> = {
        type: server.transport === 'sse' ? 'sse' : 'http',
        url: server.url,
      }

      if (!usesPlatformManagedAuth && server.auth?.type === 'bearer' && server.auth.envVar && env[server.auth.envVar]) {
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
        mcpServers[name] = {
          command: server.command,
          args: server.args ?? [],
          env: materializeEnvRecord(server.env, env),
        }
        continue
      }

      const entry: Record<string, unknown> = {
        url: server.url,
      }

      if (server.auth?.type === 'bearer' && server.auth.envVar && env[server.auth.envVar]) {
        entry.http_headers = {
          Authorization: `Bearer ${env[server.auth.envVar]}`,
        }
      } else if (server.auth?.type === 'header' && server.auth.envVar && env[server.auth.envVar]) {
        entry.http_headers = {
          [server.auth.headerName]: server.auth.headerTemplate.replace('${value}', env[server.auth.envVar]),
        }
      }

      mcpServers[name] = entry
    }

    writeFileSync(filepath, JSON.stringify({ mcpServers }, null, 2) + '\n')
  }
}

function writeInstalledUserConfig(
  pluginDir: string,
  entries: ResolvedUserConfigEntry[],
): void {
  if (entries.length === 0) return

  const filepath = resolve(pluginDir, '.pluxx-user.json')
  const payload = {
    values: buildUserConfigValueMap(entries),
    env: buildUserConfigEnvMap(entries),
  }

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
): void {
  if (entries.length === 0) return

  writeInstalledUserConfig(pluginDir, entries)
  disableInstalledEnvValidation(pluginDir, entries)
  patchInstalledMcpConfig(pluginDir, platform, config, entries)
}

function getClaudeMarketplaceName(pluginName: string): string {
  return `pluxx-local-${pluginName}`
}

function getClaudeMarketplaceRoot(pluginName: string): string {
  const home = process.env.HOME ?? '~'
  return resolve(home, '.claude/plugins/data', getClaudeMarketplaceName(pluginName))
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
  if (materialized && materialized.entries.length > 0) {
    cpSync(sourceDir, marketplacePluginDir, { recursive: true })
    materializeInstalledPlugin(marketplacePluginDir, 'claude-code', materialized.config, materialized.entries)
  } else {
    symlinkSync(sourceDir, marketplacePluginDir)
  }

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

    const targetConfigEntries = options.resolvedUserConfig
      ? resolveUserConfigEntriesForTarget(options.resolvedUserConfig, target.platform)
      : []
    const shouldMaterialize = targetConfigEntries.length > 0 && options.config

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
    } else if (shouldMaterialize) {
      createCopiedInstall(target)
      materializeInstalledPlugin(target.pluginDir, target.platform, options.config!, targetConfigEntries)
    } else {
      createSymlinkInstall(target)
    }
    if (target.platform === 'codex') {
      ensureCodexMarketplace(pluginName)
    }
    if (!options.quiet) {
      console.log(`  ${target.platform} -> ${target.description}`)
    }
    installed++
  }

  if (installed === 0 && !options.quiet) {
    console.log('Nothing to install. Run `pluxx build` first.')
  } else if (!options.quiet) {
    console.log(`\nInstalled ${installed} plugin(s). Reload or restart your tools to pick them up.`)
    for (const note of getInstallFollowupNotes(filtered.map((target) => target.platform))) {
      console.log(note)
    }
  }
}

export async function uninstallPlugin(
  pluginName: string,
  platforms?: TargetPlatform[],
  options: { quiet?: boolean } = {},
): Promise<void> {
  const targets = getInstallTargets(pluginName)
  const filtered = platforms
    ? targets.filter(t => platforms.includes(t.platform))
    : targets

  let removed = 0

  for (const target of filtered) {
    if (existsSync(target.pluginDir)) {
      rmSync(target.pluginDir, { recursive: true, force: true })
      if (!options.quiet) {
        console.log(`  removed ${target.description}`)
      }
      removed++
    }
    if (target.platform === 'codex') {
      removeCodexMarketplacePlugin(pluginName)
    }
  }

  if (removed === 0 && !options.quiet) {
    console.log('Nothing to uninstall.')
  } else if (!options.quiet) {
    console.log(`\nRemoved ${removed} plugin(s).`)
  }
}
