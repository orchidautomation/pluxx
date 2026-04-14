import { resolve, basename } from 'path'
import { existsSync, symlinkSync, mkdirSync, rmSync, readFileSync, writeFileSync } from 'fs'
import { spawnSync } from 'child_process'
import * as readline from 'readline'
import type { PluginConfig, TargetPlatform } from '../schema'

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

type CommandRunner = (command: string, args: string[]) => CommandResult

export interface HookCommand {
  event: string
  command: string
}

type PluginHooks = PluginConfig['hooks']

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
      pluginDir: resolve(home, 'plugins', pluginName),
      description: `~/plugins/${pluginName}`,
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
  symlinkSync(sourceDir, marketplacePluginDir)

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
): string {
  const { marketplaceName, marketplaceRoot } = ensureClaudeMarketplace(pluginName, sourceDir)
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
): void {
  const marketplaceName = ensureClaudeMarketplaceRegistered(pluginName, target.sourceDir, runCommand)

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
    quiet?: boolean
    useNativeClaudeInstall?: boolean
    runCommand?: CommandRunner
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

    if (target.platform === 'claude-code' && useNativeClaudeInstall) {
      installClaudePlugin(target, pluginName, runCommand)
    } else {
      createSymlinkInstall(target)
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
  }

  if (removed === 0 && !options.quiet) {
    console.log('Nothing to uninstall.')
  } else if (!options.quiet) {
    console.log(`\nRemoved ${removed} plugin(s).`)
  }
}
