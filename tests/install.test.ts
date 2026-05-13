import { describe, it, expect, beforeEach, afterEach } from 'bun:test'
import { mkdirSync, rmSync, existsSync, lstatSync, readlinkSync, readFileSync, writeFileSync, cpSync } from 'fs'
import { resolve } from 'path'
import { ensureHookTrust, getInstallFollowupNotes, installPlugin, listHookCommands, planInstallUserConfig, resolveInstallUserConfig, uninstallPlugin } from '../src/cli/install'
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

const OPENCODE_ENTRY_PATH = '.config/opencode/plugins/megamind.ts'
const OPENCODE_SKILL_PATH = '.config/opencode/skills/megamind-client-intel'

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

  it('installs OpenCode with a root entry file and globally discoverable skills', async () => {
    mkdirSync(resolve(DIST_DIR, 'opencode/skills/client-intel'), { recursive: true })
    await Bun.write(resolve(DIST_DIR, 'opencode/index.ts'), 'export const MegamindPlugin = async () => ({});\n')
    await Bun.write(
      resolve(DIST_DIR, 'opencode/skills/client-intel/SKILL.md'),
      '---\nname: client-intel\ndescription: Client intel\n---\n\n# Client Intel\n',
    )

    await installPlugin(DIST_DIR, 'megamind', ['opencode'], { useNativeClaudeInstall: false })

    const opencodeInstall = resolve(HOME_DIR, INSTALL_PATHS.opencode)
    const opencodeEntry = resolve(HOME_DIR, OPENCODE_ENTRY_PATH)
    const opencodeSkill = resolve(HOME_DIR, OPENCODE_SKILL_PATH)

    expect(lstatSync(opencodeInstall).isSymbolicLink()).toBe(true)
    expect(readlinkSync(opencodeInstall)).toBe(resolve(DIST_DIR, 'opencode'))
    expect(existsSync(opencodeEntry)).toBe(true)
    expect(readFileSync(opencodeEntry, 'utf-8')).toContain('import * as PluginModule from "./megamind/index.ts"')
    expect(readFileSync(opencodeEntry, 'utf-8')).toContain('directory: join(context.directory, "megamind")')
    expect(lstatSync(opencodeSkill).isSymbolicLink()).toBe(false)
    expect(readFileSync(resolve(opencodeSkill, 'SKILL.md'), 'utf-8')).toContain('name: megamind/client-intel')
  })

  it('removes Codex marketplace entries on uninstall', async () => {
    mkdirSync(resolve(DIST_DIR, 'codex'), { recursive: true })
    await installPlugin(DIST_DIR, 'megamind', ['codex'], { useNativeClaudeInstall: false })

    await uninstallPlugin('megamind', ['codex'])

    expect(existsSync(resolve(HOME_DIR, INSTALL_PATHS.codex))).toBe(false)
    expect(existsSync(resolve(HOME_DIR, '.agents/plugins/marketplace.json'))).toBe(false)
  })

  it('clears stale Codex local cache entries on install', async () => {
    mkdirSync(resolve(DIST_DIR, 'codex/.codex-plugin'), { recursive: true })
    writeFileSync(
      resolve(DIST_DIR, 'codex/.codex-plugin/plugin.json'),
      JSON.stringify({
        name: 'megamind',
        version: '1.0.0',
      }),
    )

    const staleCacheRoot = resolve(HOME_DIR, '.codex/plugins/cache/local-plugins/megamind/0.9.0/.codex-plugin')
    mkdirSync(staleCacheRoot, { recursive: true })
    writeFileSync(
      resolve(staleCacheRoot, 'plugin.json'),
      JSON.stringify({
        name: 'megamind',
        version: '0.9.0',
      }),
    )

    await installPlugin(DIST_DIR, 'megamind', ['codex'], { useNativeClaudeInstall: false })

    expect(existsSync(resolve(HOME_DIR, '.codex/plugins/cache/local-plugins/megamind'))).toBe(false)
    expect(existsSync(resolve(HOME_DIR, INSTALL_PATHS.codex))).toBe(true)
    expect(existsSync(resolve(HOME_DIR, '.agents/plugins/marketplace.json'))).toBe(true)
  })

  it('clears Codex local cache entries on uninstall', async () => {
    mkdirSync(resolve(DIST_DIR, 'codex'), { recursive: true })
    await installPlugin(DIST_DIR, 'megamind', ['codex'], { useNativeClaudeInstall: false })

    const staleCacheRoot = resolve(HOME_DIR, '.codex/plugins/cache/local-plugins/megamind/0.9.0/.codex-plugin')
    mkdirSync(staleCacheRoot, { recursive: true })
    writeFileSync(
      resolve(staleCacheRoot, 'plugin.json'),
      JSON.stringify({
        name: 'megamind',
        version: '0.9.0',
      }),
    )

    await uninstallPlugin('megamind', ['codex'])

    expect(existsSync(resolve(HOME_DIR, '.codex/plugins/cache/local-plugins/megamind'))).toBe(false)
    expect(existsSync(resolve(HOME_DIR, INSTALL_PATHS.codex))).toBe(false)
    expect(existsSync(resolve(HOME_DIR, '.agents/plugins/marketplace.json'))).toBe(false)
  })

  it('uninstalls OpenCode wrapper files and exported skills', async () => {
    mkdirSync(resolve(DIST_DIR, 'opencode/skills/client-intel'), { recursive: true })
    await Bun.write(resolve(DIST_DIR, 'opencode/index.ts'), 'export const MegamindPlugin = async () => ({});\n')
    await Bun.write(
      resolve(DIST_DIR, 'opencode/skills/client-intel/SKILL.md'),
      '---\nname: client-intel\ndescription: Client intel\n---\n\n# Client Intel\n',
    )

    await installPlugin(DIST_DIR, 'megamind', ['opencode'], { useNativeClaudeInstall: false })
    await uninstallPlugin('megamind', ['opencode'])

    expect(existsSync(resolve(HOME_DIR, INSTALL_PATHS.opencode))).toBe(false)
    expect(existsSync(resolve(HOME_DIR, OPENCODE_ENTRY_PATH))).toBe(false)
    expect(existsSync(resolve(HOME_DIR, OPENCODE_SKILL_PATH))).toBe(false)
  })

  it('lists only command hooks for install trust warning', () => {
    const commands = listHookCommands(HOOKS_WITH_COMMANDS)
    expect(commands).toEqual([
      { event: 'sessionStart', command: 'echo setup' },
      { event: 'beforeSubmitPrompt', command: 'bash -lc "echo validate"' },
    ])
  })

  it('reports host-specific reload guidance for the core four install surfaces', () => {
    expect(getInstallFollowupNotes(['claude-code', 'cursor', 'codex', 'opencode'])).toEqual([
      'Claude Code note: if Claude is already open, run /reload-plugins in the session to pick up the new install.',
      'Cursor note: if Cursor is already open, use Developer: Reload Window or restart Cursor to pick up the new install.',
      'Codex note: if Codex is already open, use Plugins > Refresh if that action is available in your current UI, or restart Codex to pick up the new install. Plugin-bundled MCP servers may appear on the plugin detail page without appearing in the global MCP servers settings page.',
      'OpenCode note: if OpenCode is already open, restart or reload it so the plugin is picked up.',
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
    mkdirSync(resolve(DIST_DIR, 'claude-code/commands'), { recursive: true })
    mkdirSync(resolve(DIST_DIR, 'claude-code/skills/research'), { recursive: true })
    mkdirSync(resolve(DIST_DIR, 'claude-code/scripts'), { recursive: true })
    mkdirSync(resolve(DIST_DIR, 'claude-code/hooks'), { recursive: true })
    await Bun.write(
      resolve(DIST_DIR, 'claude-code/.claude-plugin/plugin.json'),
      JSON.stringify({
        name: 'megamind',
        version: '1.2.3',
        description: 'Megamind plugin',
        author: { name: 'Test Author' },
        license: 'MIT',
        commands: './commands/',
        skills: './skills/',
      }),
    )
    await Bun.write(resolve(DIST_DIR, 'claude-code/commands/pulse.md'), '# pulse\n')
    await Bun.write(resolve(DIST_DIR, 'claude-code/skills/research/SKILL.md'), '# Research\n')
    await Bun.write(resolve(DIST_DIR, 'claude-code/scripts/session-start.sh'), '#!/usr/bin/env bash\nexit 0\n')
    await Bun.write(
      resolve(DIST_DIR, 'claude-code/hooks/hooks.json'),
      JSON.stringify({
        hooks: {
          SessionStart: [
            {
              hooks: [
                {
                  type: 'command',
                  command: 'bash "${CLAUDE_PLUGIN_ROOT}/scripts/session-start.sh"',
                },
              ],
            },
          ],
        },
      }),
    )

    const calls: Array<{ command: string; args: string[] }> = []
    const runCommand = (command: string, args: string[]) => {
      calls.push({ command, args })
      if (args.join(' ') === 'plugin marketplace list --json') {
        return { status: 0, stdout: '[]', stderr: '' }
      }
      if (args.join(' ') === 'plugin install megamind@pluxx-local-megamind --scope user') {
        mkdirSync(resolve(HOME_DIR, '.claude/plugins/cache/pluxx-local-megamind/megamind'), { recursive: true })
        cpSync(
          resolve(HOME_DIR, '.claude/plugins/data/pluxx-local-megamind/plugins/megamind'),
          resolve(HOME_DIR, '.claude/plugins/cache/pluxx-local-megamind/megamind/1.2.3'),
          { recursive: true },
        )
      }
      return { status: 0, stdout: '', stderr: '' }
    }

    await installPlugin(DIST_DIR, 'megamind', ['claude-code'], { runCommand })

    const marketplaceRoot = resolve(HOME_DIR, '.claude/plugins/data/pluxx-local-megamind')
    const marketplaceManifest = resolve(marketplaceRoot, '.claude-plugin/marketplace.json')
    const installedBundle = resolve(HOME_DIR, '.claude/plugins/cache/pluxx-local-megamind/megamind/1.2.3')
    const installedManifest = JSON.parse(readFileSync(resolve(installedBundle, '.claude-plugin/plugin.json'), 'utf-8')) as {
      hooks?: string
    }
    expect(existsSync(marketplaceManifest)).toBe(true)
    expect(lstatSync(resolve(marketplaceRoot, 'plugins/megamind')).isSymbolicLink()).toBe(false)
    expect(existsSync(resolve(marketplaceRoot, 'plugins/megamind/commands/pulse.md'))).toBe(true)
    expect(existsSync(resolve(marketplaceRoot, 'plugins/megamind/skills/research/SKILL.md'))).toBe(true)
    expect(existsSync(resolve(marketplaceRoot, 'plugins/megamind/scripts/session-start.sh'))).toBe(true)
    expect(existsSync(resolve(installedBundle, '.claude-plugin/plugin.json'))).toBe(true)
    expect(installedManifest.hooks).toBeUndefined()

    expect(calls).toEqual([
      { command: 'claude', args: ['plugin', 'marketplace', 'list', '--json'] },
      { command: 'claude', args: ['plugin', 'marketplace', 'add', marketplaceRoot] },
      { command: 'claude', args: ['plugin', 'uninstall', 'megamind@pluxx-local-megamind'] },
      { command: 'claude', args: ['plugin', 'install', 'megamind@pluxx-local-megamind', '--scope', 'user'] },
    ])
  })

  it('fails Claude native install when the host never materializes the installed bundle', async () => {
    mkdirSync(resolve(DIST_DIR, 'claude-code/.claude-plugin'), { recursive: true })
    await Bun.write(
      resolve(DIST_DIR, 'claude-code/.claude-plugin/plugin.json'),
      JSON.stringify({
        name: 'megamind',
        version: '1.2.3',
      }),
    )

    const runCommand = (_command: string, args: string[]) => {
      if (args.join(' ') === 'plugin marketplace list --json') {
        return { status: 0, stdout: '[]', stderr: '' }
      }
      return { status: 0, stdout: '', stderr: '' }
    }

    await expect(installPlugin(DIST_DIR, 'megamind', ['claude-code'], { runCommand }))
      .rejects.toThrow('Installed Claude plugin bundle is incomplete: missing plugin manifest at .claude-plugin/plugin.json')
  })

  it('fails Claude native install when the host writes an unreadable installed manifest', async () => {
    mkdirSync(resolve(DIST_DIR, 'claude-code/.claude-plugin'), { recursive: true })
    await Bun.write(
      resolve(DIST_DIR, 'claude-code/.claude-plugin/plugin.json'),
      JSON.stringify({
        name: 'megamind',
        version: '1.2.3',
      }),
    )

    const runCommand = (_command: string, args: string[]) => {
      if (args.join(' ') === 'plugin marketplace list --json') {
        return { status: 0, stdout: '[]', stderr: '' }
      }
      if (args.join(' ') === 'plugin install megamind@pluxx-local-megamind --scope user') {
        mkdirSync(resolve(HOME_DIR, '.claude/plugins/cache/pluxx-local-megamind/megamind/1.2.3/.claude-plugin'), { recursive: true })
        writeFileSync(resolve(HOME_DIR, '.claude/plugins/cache/pluxx-local-megamind/megamind/1.2.3/.claude-plugin/plugin.json'), '{broken')
      }
      return { status: 0, stdout: '', stderr: '' }
    }

    await expect(installPlugin(DIST_DIR, 'megamind', ['claude-code'], { runCommand }))
      .rejects.toThrow('Installed Claude plugin bundle is incomplete: plugin manifest at .claude-plugin/plugin.json is not parseable')
  })

  it('uninstalls Claude native installs and removes the generated local marketplace', async () => {
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

    const installCalls: Array<{ command: string; args: string[] }> = []
    const installRunner = (command: string, args: string[]) => {
      installCalls.push({ command, args })
      if (args.join(' ') === 'plugin marketplace list --json') {
        return { status: 0, stdout: '[]', stderr: '' }
      }
      if (args.join(' ') === 'plugin install megamind@pluxx-local-megamind --scope user') {
        mkdirSync(resolve(HOME_DIR, '.claude/plugins/cache/pluxx-local-megamind/megamind'), { recursive: true })
        cpSync(
          resolve(HOME_DIR, '.claude/plugins/data/pluxx-local-megamind/plugins/megamind'),
          resolve(HOME_DIR, '.claude/plugins/cache/pluxx-local-megamind/megamind/1.2.3'),
          { recursive: true },
        )
      }
      return { status: 0, stdout: '', stderr: '' }
    }

    await installPlugin(DIST_DIR, 'megamind', ['claude-code'], { runCommand: installRunner })

    const marketplaceRoot = resolve(HOME_DIR, '.claude/plugins/data/pluxx-local-megamind')
    expect(existsSync(marketplaceRoot)).toBe(true)

    const uninstallCalls: Array<{ command: string; args: string[] }> = []
    const uninstallRunner = (command: string, args: string[]) => {
      uninstallCalls.push({ command, args })
      return { status: 0, stdout: '', stderr: '' }
    }

    await uninstallPlugin('megamind', ['claude-code'], { runCommand: uninstallRunner })

    expect(existsSync(marketplaceRoot)).toBe(false)
    expect(uninstallCalls).toEqual([
      { command: 'claude', args: ['plugin', 'uninstall', 'megamind@pluxx-local-megamind'] },
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

  it('derives install-time config requirements from preserved native MCP auth overrides', () => {
    process.env.METRICS_API_KEY = 'from-env'
    process.env.METRICS_WORKSPACE_ID = 'workspace-from-env'

    const planned = planInstallUserConfig({
      name: 'fixture',
      version: '0.1.0',
      description: 'Fixture',
      author: { name: 'Test Author' },
      license: 'MIT',
      skills: './skills/',
      mcp: {
        metrics: {
          transport: 'http',
          url: 'https://metrics.example.com/mcp',
          auth: {
            type: 'header',
            envVar: 'METRICS_API_KEY',
            headerName: 'X-API-Key',
            headerTemplate: '${value}',
          },
        },
      },
      platforms: {
        codex: {
          mcpServers: {
            metrics: {
              env_http_headers: {
                'X-API-Key': 'METRICS_API_KEY',
                'X-Workspace': 'METRICS_WORKSPACE_ID',
              },
            },
          },
        },
      },
      targets: ['codex'],
      outDir: './dist',
    })

    expect(planned.map((entry) => entry.envVar)).toContain('METRICS_API_KEY')
    expect(planned.map((entry) => entry.envVar)).toContain('METRICS_WORKSPACE_ID')
  })

  it('refuses placeholder-looking secret values during install config resolution', async () => {
    process.env.TEST_API_KEY = 'dummy API key'

    const config: PluginConfig = {
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
      targets: ['codex'],
      outDir: './dist',
    }

    await expect(resolveInstallUserConfig(config, ['codex'], { isTTY: false }))
      .rejects
      .toThrow('Refusing to install placeholder secret')
  })

  it('materializes local install config for cursor, codex, and opencode', async () => {
    mkdirSync(resolve(DIST_DIR, 'cursor/scripts'), { recursive: true })
    mkdirSync(resolve(DIST_DIR, 'codex/scripts'), { recursive: true })
    mkdirSync(resolve(DIST_DIR, 'opencode/scripts'), { recursive: true })
    mkdirSync(resolve(DIST_DIR, 'opencode/skills/client-intel'), { recursive: true })

    await Bun.write(resolve(DIST_DIR, 'cursor/mcp.json'), JSON.stringify({ mcpServers: {} }, null, 2))
    await Bun.write(resolve(DIST_DIR, 'codex/.mcp.json'), JSON.stringify({ mcpServers: {} }, null, 2))
    await Bun.write(resolve(DIST_DIR, 'opencode/index.ts'), 'export const plugin = {};\n')
    await Bun.write(resolve(DIST_DIR, 'opencode/package.json'), JSON.stringify({ name: 'opencode-megamind' }, null, 2))
    await Bun.write(
      resolve(DIST_DIR, 'opencode/skills/client-intel/SKILL.md'),
      '---\nname: client-intel\ndescription: Client intel\n---\n\n# Client Intel\n',
    )
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
    const opencodeEntry = resolve(HOME_DIR, OPENCODE_ENTRY_PATH)
    const opencodeSkill = resolve(HOME_DIR, OPENCODE_SKILL_PATH)

    expect(lstatSync(cursorInstall).isSymbolicLink()).toBe(false)
    expect(lstatSync(codexInstall).isSymbolicLink()).toBe(false)
    expect(lstatSync(opencodeInstall).isSymbolicLink()).toBe(false)

    const cursorMcp = JSON.parse(readFileSync(resolve(cursorInstall, 'mcp.json'), 'utf-8'))
    const codexMcp = JSON.parse(readFileSync(resolve(codexInstall, '.mcp.json'), 'utf-8'))
    const opencodeUserConfig = JSON.parse(readFileSync(resolve(opencodeInstall, '.pluxx-user.json'), 'utf-8'))

    expect(cursorMcp.mcpServers.fixture.headers.Authorization).toBe('Bearer shh-secret')
    expect(codexMcp.mcpServers.fixture.http_headers.Authorization).toBe('Bearer shh-secret')
    expect(opencodeUserConfig.env.TEST_API_KEY).toBe('shh-secret')
    expect(readFileSync(opencodeEntry, 'utf-8')).toContain('directory: join(context.directory, "megamind")')
    expect(lstatSync(opencodeSkill).isSymbolicLink()).toBe(false)
    expect(readFileSync(resolve(opencodeSkill, 'SKILL.md'), 'utf-8')).toContain('name: megamind/client-intel')
    expect(readFileSync(resolve(cursorInstall, 'scripts/check-env.sh'), 'utf-8')).toContain('materialized required config')
  })

  it('materializes richer native Codex MCP auth overrides during local install', async () => {
    mkdirSync(resolve(DIST_DIR, 'codex/scripts'), { recursive: true })
    await Bun.write(resolve(DIST_DIR, 'codex/.mcp.json'), JSON.stringify({ mcpServers: {} }, null, 2))
    await Bun.write(resolve(DIST_DIR, 'codex/scripts/check-env.sh'), '#!/usr/bin/env bash\nexit 1\n')

    const config: PluginConfig = {
      name: 'megamind',
      version: '1.0.0',
      description: 'Fixture plugin',
      author: { name: 'Test Author' },
      license: 'MIT',
      skills: './skills/',
      mcp: {
        metrics: {
          transport: 'http',
          url: 'https://metrics.example.com/mcp',
          auth: {
            type: 'header',
            envVar: 'METRICS_API_KEY',
            headerName: 'X-API-Key',
            headerTemplate: '${value}',
          },
        },
      },
      platforms: {
        codex: {
          mcpServers: {
            metrics: {
              env_http_headers: {
                'X-API-Key': 'METRICS_API_KEY',
                'X-Workspace': 'METRICS_WORKSPACE_ID',
              },
            },
          },
        },
      },
      targets: ['codex'],
      outDir: './dist',
    }

    await installPlugin(DIST_DIR, 'megamind', ['codex'], {
      config,
      resolvedUserConfig: [
        {
          field: {
            key: 'metrics-api-key',
            title: 'Metrics API Key',
            description: 'Fixture token',
            type: 'secret',
            required: true,
            envVar: 'METRICS_API_KEY',
          },
          value: 'secret-key',
          envVar: 'METRICS_API_KEY',
        },
        {
          field: {
            key: 'metrics-workspace-id',
            title: 'Metrics Workspace ID',
            description: 'Fixture workspace',
            type: 'secret',
            required: true,
            envVar: 'METRICS_WORKSPACE_ID',
          },
          value: 'ws-123',
          envVar: 'METRICS_WORKSPACE_ID',
        },
      ],
      useNativeClaudeInstall: false,
      quiet: true,
    })

    const codexInstall = resolve(HOME_DIR, INSTALL_PATHS.codex)
    const codexMcp = JSON.parse(readFileSync(resolve(codexInstall, '.mcp.json'), 'utf-8'))
    expect(codexMcp.mcpServers.metrics.http_headers).toEqual({
      'X-API-Key': 'secret-key',
      'X-Workspace': 'ws-123',
    })
  })

  it('normalizes plugin-owned stdio MCP paths consistently during local install materialization', async () => {
    mkdirSync(resolve(DIST_DIR, 'cursor/scripts'), { recursive: true })
    mkdirSync(resolve(DIST_DIR, 'codex/scripts'), { recursive: true })

    await Bun.write(resolve(DIST_DIR, 'cursor/mcp.json'), JSON.stringify({ mcpServers: {} }, null, 2))
    await Bun.write(resolve(DIST_DIR, 'codex/.mcp.json'), JSON.stringify({ mcpServers: {} }, null, 2))
    await Bun.write(resolve(DIST_DIR, 'cursor/scripts/start-mcp.sh'), '#!/usr/bin/env bash\nexit 0\n')
    await Bun.write(resolve(DIST_DIR, 'codex/scripts/start-mcp.sh'), '#!/usr/bin/env bash\nexit 0\n')

    const config: PluginConfig = {
      name: 'megamind',
      version: '1.0.0',
      description: 'Fixture plugin',
      author: { name: 'Test Author' },
      license: 'MIT',
      skills: './skills/',
      mcp: {
        sendlens: {
          transport: 'stdio',
          command: 'bash',
          args: ['${CLAUDE_PLUGIN_ROOT}/scripts/start-mcp.sh'],
          env: {
            SENDLENS_TOKEN: '${SENDLENS_TOKEN}',
          },
        },
      },
      targets: ['cursor', 'codex'],
      outDir: './dist',
    }

    await installPlugin(DIST_DIR, 'megamind', ['cursor', 'codex'], {
      config,
      resolvedUserConfig: [{
        field: {
          key: 'sendlens-token',
          title: 'SendLens Token',
          description: 'Fixture token',
          type: 'secret',
          required: true,
          envVar: 'SENDLENS_TOKEN',
        },
        value: 'shh-secret',
        envVar: 'SENDLENS_TOKEN',
      }],
      useNativeClaudeInstall: false,
      quiet: true,
    })

    const cursorInstall = resolve(HOME_DIR, INSTALL_PATHS.cursor)
    const codexInstall = resolve(HOME_DIR, INSTALL_PATHS.codex)
    const cursorMcp = JSON.parse(readFileSync(resolve(cursorInstall, 'mcp.json'), 'utf-8'))
    const codexMcp = JSON.parse(readFileSync(resolve(codexInstall, '.mcp.json'), 'utf-8'))

    expect(cursorMcp.mcpServers.sendlens).toEqual({
      command: 'bash',
      args: ['./scripts/start-mcp.sh'],
      env: {
        SENDLENS_TOKEN: 'shh-secret',
      },
    })
    expect(codexMcp.mcpServers.sendlens).toEqual({
      command: 'bash',
      args: [resolve(codexInstall, 'scripts/start-mcp.sh')],
      env: {
        SENDLENS_TOKEN: 'shh-secret',
      },
    })
  })

  it('materializes plugin-owned Codex stdio MCP paths even without install-time user config', async () => {
    mkdirSync(resolve(DIST_DIR, 'codex/.codex-plugin'), { recursive: true })
    mkdirSync(resolve(DIST_DIR, 'codex/scripts'), { recursive: true })
    mkdirSync(resolve(DIST_DIR, 'codex/skills/research'), { recursive: true })

    await Bun.write(
      resolve(DIST_DIR, 'codex/.codex-plugin/plugin.json'),
      JSON.stringify({
        name: 'megamind',
        version: '1.0.0',
        skills: './skills/',
        mcpServers: './.mcp.json',
      }, null, 2),
    )
    await Bun.write(
      resolve(DIST_DIR, 'codex/.mcp.json'),
      JSON.stringify({ mcpServers: {} }, null, 2),
    )
    await Bun.write(resolve(DIST_DIR, 'codex/scripts/start-mcp.sh'), '#!/usr/bin/env bash\nexit 0\n')
    await Bun.write(resolve(DIST_DIR, 'codex/skills/research/SKILL.md'), '# Research\n')

    const config: PluginConfig = {
      name: 'megamind',
      version: '1.0.0',
      description: 'Fixture plugin',
      author: { name: 'Test Author' },
      license: 'MIT',
      skills: './skills/',
      mcp: {
        sendlens: {
          transport: 'stdio',
          command: 'bash',
          args: ['./scripts/start-mcp.sh'],
        },
      },
      targets: ['codex'],
      outDir: './dist',
    }

    await installPlugin(DIST_DIR, 'megamind', ['codex'], {
      config,
      quiet: true,
      useNativeClaudeInstall: false,
    })

    const codexInstall = resolve(HOME_DIR, INSTALL_PATHS.codex)
    const codexMcp = JSON.parse(readFileSync(resolve(codexInstall, '.mcp.json'), 'utf-8'))

    expect(lstatSync(codexInstall).isSymbolicLink()).toBe(false)
    expect(codexMcp.mcpServers.sendlens).toEqual({
      command: 'bash',
      args: [resolve(codexInstall, 'scripts/start-mcp.sh')],
      env: {},
    })
  })

  it('fails install when a bundled stdio runtime script still chains through installer-owned check-env.sh', async () => {
    mkdirSync(resolve(DIST_DIR, 'codex/.codex-plugin'), { recursive: true })
    mkdirSync(resolve(DIST_DIR, 'codex/scripts'), { recursive: true })

    await Bun.write(
      resolve(DIST_DIR, 'codex/.codex-plugin/plugin.json'),
      JSON.stringify({
        name: 'megamind',
        version: '1.0.0',
        skills: './skills/',
        mcpServers: './.mcp.json',
      }, null, 2),
    )
    await Bun.write(
      resolve(DIST_DIR, 'codex/.mcp.json'),
      JSON.stringify({
        mcpServers: {
          sendlens: {
            command: 'bash',
            args: ['./scripts/start-mcp.sh'],
          },
        },
      }, null, 2),
    )
    await Bun.write(resolve(DIST_DIR, 'codex/scripts/check-env.sh'), '#!/usr/bin/env bash\nexit 0\n')
    await Bun.write(resolve(DIST_DIR, 'codex/scripts/start-mcp.sh'), '#!/usr/bin/env bash\nbash "./scripts/check-env.sh"\n')

    await expect(installPlugin(DIST_DIR, 'megamind', ['codex'], { useNativeClaudeInstall: false }))
      .rejects
      .toThrow('runtime script issues: runtime script scripts/start-mcp.sh for MCP server "sendlens" still references installer-owned scripts/check-env.sh')
  })
})
