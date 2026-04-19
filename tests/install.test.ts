import { describe, it, expect, beforeEach, afterEach } from 'bun:test'
import { mkdirSync, rmSync, existsSync, lstatSync, readlinkSync, readFileSync } from 'fs'
import { resolve } from 'path'
import { ensureHookTrust, installPlugin, listHookCommands, planInstallUserConfig, uninstallPlugin } from '../src/cli/install'
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
  codex: '.codex/plugins/megamind',
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

    const codexMarketplace = JSON.parse(readFileSync(resolve(HOME_DIR, '.agents/plugins/marketplace.json'), 'utf-8')) as {
      plugins: Array<{ name: string; source: { path: string } }>
    }
    expect(codexMarketplace.plugins.some((plugin) => plugin.name === 'megamind' && plugin.source.path === './.codex/plugins/megamind')).toBe(true)
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

  it('removes Codex marketplace entries on uninstall', async () => {
    mkdirSync(resolve(DIST_DIR, 'codex'), { recursive: true })
    await installPlugin(DIST_DIR, 'megamind', ['codex'], { useNativeClaudeInstall: false })

    await uninstallPlugin('megamind', ['codex'])

    expect(existsSync(resolve(HOME_DIR, INSTALL_PATHS.codex))).toBe(false)
    expect(existsSync(resolve(HOME_DIR, '.agents/plugins/marketplace.json'))).toBe(false)
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

  it('derives install-time config requirements from MCP auth', () => {
    process.env.TEST_API_KEY = 'from-env'

    const planned = planInstallUserConfig({
      name: 'fixture',
      version: '0.1.0',
      description: 'Fixture',
      author: { name: 'Test Author' },
      license: 'MIT',
      skills: './skills/',
      mcp: {
        fixture: {
          transport: 'http',
          url: 'https://example.com/mcp',
          auth: {
            type: 'bearer',
            envVar: 'TEST_API_KEY',
            headerName: 'Authorization',
            headerTemplate: 'Bearer ${value}',
          },
        },
      },
      targets: ['cursor', 'codex'],
      outDir: './dist',
    })

    expect(planned).toHaveLength(1)
    expect(planned[0].field.key).toBe('test-api-key')
    expect(planned[0].envVar).toBe('TEST_API_KEY')
    expect(planned[0].source).toBe('env')
  })

  it('materializes local install config for cursor, codex, and opencode', async () => {
    mkdirSync(resolve(DIST_DIR, 'cursor/scripts'), { recursive: true })
    mkdirSync(resolve(DIST_DIR, 'codex/scripts'), { recursive: true })
    mkdirSync(resolve(DIST_DIR, 'opencode/scripts'), { recursive: true })

    await Bun.write(resolve(DIST_DIR, 'cursor/mcp.json'), JSON.stringify({ mcpServers: {} }, null, 2))
    await Bun.write(resolve(DIST_DIR, 'codex/.mcp.json'), JSON.stringify({ mcpServers: {} }, null, 2))
    await Bun.write(resolve(DIST_DIR, 'opencode/index.ts'), 'export const plugin = {};\n')
    await Bun.write(resolve(DIST_DIR, 'opencode/package.json'), JSON.stringify({ name: 'opencode-megamind' }, null, 2))
    await Bun.write(resolve(DIST_DIR, 'cursor/scripts/check-env.sh'), '#!/usr/bin/env bash\nexit 1\n')
    await Bun.write(resolve(DIST_DIR, 'codex/scripts/check-env.sh'), '#!/usr/bin/env bash\nexit 1\n')
    await Bun.write(resolve(DIST_DIR, 'opencode/scripts/check-env.sh'), '#!/usr/bin/env bash\nexit 1\n')

    const config: PluginConfig = {
      name: 'megamind',
      version: '1.0.0',
      description: 'Fixture plugin',
      author: { name: 'Test Author' },
      license: 'MIT',
      skills: './skills/',
      mcp: {
        fixture: {
          transport: 'http',
          url: 'https://example.com/mcp',
          auth: {
            type: 'bearer',
            envVar: 'TEST_API_KEY',
            headerName: 'Authorization',
            headerTemplate: 'Bearer ${value}',
          },
        },
      },
      targets: ['cursor', 'codex', 'opencode'],
      outDir: './dist',
    }

    await installPlugin(DIST_DIR, 'megamind', ['cursor', 'codex', 'opencode'], {
      config,
      resolvedUserConfig: [{
        field: {
          key: 'test-api-key',
          title: 'Test API Key',
          description: 'Fixture token',
          type: 'secret',
          required: true,
          envVar: 'TEST_API_KEY',
        },
        value: 'shh-secret',
        envVar: 'TEST_API_KEY',
      }],
      useNativeClaudeInstall: false,
      quiet: true,
    })

    const cursorInstall = resolve(HOME_DIR, INSTALL_PATHS.cursor)
    const codexInstall = resolve(HOME_DIR, INSTALL_PATHS.codex)
    const opencodeInstall = resolve(HOME_DIR, INSTALL_PATHS.opencode)

    expect(lstatSync(cursorInstall).isSymbolicLink()).toBe(false)
    expect(lstatSync(codexInstall).isSymbolicLink()).toBe(false)
    expect(lstatSync(opencodeInstall).isSymbolicLink()).toBe(false)

    const cursorMcp = JSON.parse(readFileSync(resolve(cursorInstall, 'mcp.json'), 'utf-8'))
    const codexMcp = JSON.parse(readFileSync(resolve(codexInstall, '.mcp.json'), 'utf-8'))
    const opencodeUserConfig = JSON.parse(readFileSync(resolve(opencodeInstall, '.pluxx-user.json'), 'utf-8'))

    expect(cursorMcp.mcpServers.fixture.headers.Authorization).toBe('Bearer shh-secret')
    expect(codexMcp.mcpServers.fixture.http_headers.Authorization).toBe('Bearer shh-secret')
    expect(opencodeUserConfig.env.TEST_API_KEY).toBe('shh-secret')
    expect(readFileSync(resolve(cursorInstall, 'scripts/check-env.sh'), 'utf-8')).toContain('materialized required config')
  })
})
