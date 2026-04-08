import { resolve, basename } from 'path'
import { existsSync, symlinkSync, mkdirSync, rmSync } from 'fs'
import * as readline from 'readline'
import type { PluginConfig, TargetPlatform } from '../schema'

interface InstallTarget {
  platform: TargetPlatform
  pluginDir: string
  description: string
}

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
      description: `~/.claude/plugins/${pluginName}`,
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

export async function installPlugin(
  distDir: string,
  pluginName: string,
  platforms?: TargetPlatform[],
): Promise<void> {
  const targets = getInstallTargets(pluginName)
  const filtered = platforms
    ? targets.filter(t => platforms.includes(t.platform))
    : targets

  let installed = 0

  for (const target of filtered) {
    const srcDir = resolve(distDir, target.platform)
    if (!existsSync(srcDir)) {
      console.log(`  skip ${target.platform} (not built)`)
      continue
    }

    // Ensure parent directory exists
    const parentDir = resolve(target.pluginDir, '..')
    mkdirSync(parentDir, { recursive: true })

    // Remove existing symlink/dir
    if (existsSync(target.pluginDir)) {
      rmSync(target.pluginDir, { recursive: true, force: true })
    }

    // Create symlink
    symlinkSync(srcDir, target.pluginDir)
    console.log(`  ${target.platform} -> ${target.description}`)
    installed++
  }

  if (installed === 0) {
    console.log('Nothing to install. Run `pluxx build` first.')
  } else {
    console.log(`\nInstalled ${installed} plugin(s). Restart your tools to pick them up.`)
  }
}

export async function uninstallPlugin(
  pluginName: string,
  platforms?: TargetPlatform[],
): Promise<void> {
  const targets = getInstallTargets(pluginName)
  const filtered = platforms
    ? targets.filter(t => platforms.includes(t.platform))
    : targets

  let removed = 0

  for (const target of filtered) {
    if (existsSync(target.pluginDir)) {
      rmSync(target.pluginDir, { recursive: true, force: true })
      console.log(`  removed ${target.description}`)
      removed++
    }
  }

  if (removed === 0) {
    console.log('Nothing to uninstall.')
  } else {
    console.log(`\nRemoved ${removed} plugin(s).`)
  }
}
