import { describe, it, expect, beforeEach, afterEach } from 'bun:test'
import { mkdirSync, rmSync, existsSync, lstatSync, readlinkSync } from 'fs'
import { resolve } from 'path'
import { ensureHookTrust, installPlugin, listHookCommands, uninstallPlugin } from '../src/cli/install'
import type { PluginConfig, TargetPlatform } from '../src/schema'

const TEST_DIR = resolve(import.meta.dir, '.install-fixture')
const DIST_DIR = resolve(TEST_DIR, 'dist')
const HOME_DIR = resolve(TEST_DIR, 'home')

const ALL_PLATFORMS: TargetPlatform[] = [
  'claude-code',
  'cursor',
  'codex',
  'opencode',
  'github-copilot',
  'openhands',
  'warp',
  'gemini-cli',
  'roo-code',
  'cline',
  'amp',
]

const INSTALL_PATHS: Record<TargetPlatform, string> = {
  'claude-code': '.claude/plugins/megamind',
  cursor: '.cursor/plugins/local/megamind',
  codex: 'plugins/megamind',
  opencode: '.config/opencode/plugins/megamind',
  'github-copilot': '.github-copilot/plugins/megamind',
  openhands: '.openhands/plugins/megamind',
  warp: '.warp/plugins/megamind',
  'gemini-cli': '.gemini/extensions/megamind',
  'roo-code': '.roo/plugins/megamind',
  cline: '.cline/plugins/megamind',
  amp: '.amp/plugins/megamind',
}

const HOOKS_WITH_COMMANDS: NonNullable<PluginConfig['hooks']> = {
  sessionStart: [
    { type: 'command', command: 'echo setup' },
    { type: 'prompt', prompt: 'continue?' },
  ],
  beforeSubmitPrompt: [
    { type: 'command', command: 'bash -lc "echo validate"' },
  ],
}

beforeEach(() => {
  rmSync(TEST_DIR, { recursive: true, force: true })
  mkdirSync(DIST_DIR, { recursive: true })
  mkdirSync(HOME_DIR, { recursive: true })
  process.env.HOME = HOME_DIR
})

afterEach(() => {
  rmSync(TEST_DIR, { recursive: true, force: true })
})

describe('install', () => {
  it('resolves and installs all 11 target paths', async () => {
    for (const platform of ALL_PLATFORMS) {
      mkdirSync(resolve(DIST_DIR, platform), { recursive: true })
    }

    await installPlugin(DIST_DIR, 'megamind', undefined, { useNativeClaudeInstall: false })

    for (const platform of ALL_PLATFORMS) {
      const installedPath = resolve(HOME_DIR, INSTALL_PATHS[platform])
      expect(existsSync(installedPath)).toBe(true)
      expect(lstatSync(installedPath).isSymbolicLink()).toBe(true)
      expect(readlinkSync(installedPath)).toBe(resolve(DIST_DIR, platform))
    }
  })

  it('installs only requested target subset when --target is used', async () => {
    mkdirSync(resolve(DIST_DIR, 'cursor'), { recursive: true })
    mkdirSync(resolve(DIST_DIR, 'openhands'), { recursive: true })
    mkdirSync(resolve(DIST_DIR, 'claude-code'), { recursive: true })

    await installPlugin(DIST_DIR, 'megamind', ['cursor', 'openhands'], { useNativeClaudeInstall: false })

    expect(existsSync(resolve(HOME_DIR, INSTALL_PATHS.cursor))).toBe(true)
    expect(existsSync(resolve(HOME_DIR, INSTALL_PATHS.openhands))).toBe(true)
    expect(existsSync(resolve(HOME_DIR, INSTALL_PATHS['claude-code']))).toBe(false)
  })

  it('uninstalls installed symlinks for selected targets', async () => {
    mkdirSync(resolve(DIST_DIR, 'cursor'), { recursive: true })
    mkdirSync(resolve(DIST_DIR, 'openhands'), { recursive: true })
    await installPlugin(DIST_DIR, 'megamind', ['cursor', 'openhands'], { useNativeClaudeInstall: false })

    await uninstallPlugin('megamind', ['cursor'])

    expect(existsSync(resolve(HOME_DIR, INSTALL_PATHS.cursor))).toBe(false)
    expect(existsSync(resolve(HOME_DIR, INSTALL_PATHS.openhands))).toBe(true)
  })

  it('lists only command hooks for install trust warning', () => {
    const commands = listHookCommands(HOOKS_WITH_COMMANDS)
    expect(commands).toEqual([
      { event: 'sessionStart', command: 'echo setup' },
      { event: 'beforeSubmitPrompt', command: 'bash -lc "echo validate"' },
    ])
  })

  it('skips confirmation when --trust is provided', async () => {
    await expect(
      ensureHookTrust({
        pluginName: 'megamind',
        hooks: HOOKS_WITH_COMMANDS,
        trust: true,
        isTTY: false,
      }),
    ).resolves.toBeUndefined()
  })

  it('fails non-interactive installs with hook commands unless --trust is set', async () => {
    await expect(
      ensureHookTrust({
        pluginName: 'megamind',
        hooks: HOOKS_WITH_COMMANDS,
        isTTY: false,
      }),
    ).rejects.toThrow('Re-run with --trust')
  })

  it('cancels install when user declines trust confirmation', async () => {
    await expect(
      ensureHookTrust({
        pluginName: 'megamind',
        hooks: HOOKS_WITH_COMMANDS,
        isTTY: true,
        confirmPrompt: async () => false,
      }),
    ).rejects.toThrow('Install cancelled')
  })

  it('uses Claude native install flow via a generated local marketplace', async () => {
    mkdirSync(resolve(DIST_DIR, 'claude-code/.claude-plugin'), { recursive: true })
    await Bun.write(
      resolve(DIST_DIR, 'claude-code/.claude-plugin/plugin.json'),
      JSON.stringify({
        name: 'megamind',
        version: '1.2.3',
        description: 'Megamind plugin',
        author: { name: 'Test Author' },
        license: 'MIT',
      }),
    )

    const calls: Array<{ command: string; args: string[] }> = []
    const runCommand = (command: string, args: string[]) => {
      calls.push({ command, args })
      if (args.join(' ') === 'plugin marketplace list --json') {
        return { status: 0, stdout: '[]', stderr: '' }
      }
      return { status: 0, stdout: '', stderr: '' }
    }

    await installPlugin(DIST_DIR, 'megamind', ['claude-code'], { runCommand })

    const marketplaceRoot = resolve(HOME_DIR, '.claude/plugins/data/pluxx-local-megamind')
    const marketplaceManifest = resolve(marketplaceRoot, '.claude-plugin/marketplace.json')
    expect(existsSync(marketplaceManifest)).toBe(true)
    expect(lstatSync(resolve(marketplaceRoot, 'plugins/megamind')).isSymbolicLink()).toBe(true)

    expect(calls).toEqual([
      { command: 'claude', args: ['plugin', 'marketplace', 'list', '--json'] },
      { command: 'claude', args: ['plugin', 'marketplace', 'add', marketplaceRoot] },
      { command: 'claude', args: ['plugin', 'uninstall', 'megamind@pluxx-local-megamind'] },
      { command: 'claude', args: ['plugin', 'install', 'megamind@pluxx-local-megamind', '--scope', 'user'] },
    ])
  })
})
