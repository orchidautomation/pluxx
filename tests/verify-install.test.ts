import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { cpSync, mkdirSync, rmSync, symlinkSync, writeFileSync } from 'fs'
import { resolve } from 'path'
import { installPlugin } from '../src/cli/install'
import { printVerifyInstallResult, verifyInstall } from '../src/cli/verify-install'
import { buildGeneratedPermissionHookScript } from '../src/permissions'
import type { PluginConfig } from '../src/schema'

const ROOT = resolve(import.meta.dir, '.verify-install-fixture')
const DIST_DIR = resolve(ROOT, 'dist')
const HOME_DIR = resolve(ROOT, 'home')

function makeConfig(): PluginConfig {
  return {
    name: 'verify-plugin',
    version: '0.1.0',
    description: 'A verify test plugin',
    author: { name: 'Test Author' },
    license: 'MIT',
    skills: './skills/',
    instructions: './INSTRUCTIONS.md',
    targets: ['codex'],
    outDir: './dist',
  }
}

function makeCodexRuntimeConfig(): PluginConfig {
  return {
    name: 'verify-plugin',
    version: '0.1.0',
    description: 'A verify test plugin',
    author: { name: 'Test Author' },
    license: 'MIT',
    skills: './skills/',
    targets: ['codex'],
    outDir: './dist',
    mcp: {
      fixture: {
        transport: 'stdio',
        command: 'node',
        args: ['./mcp-server/dist/index.js', '--stdio'],
      },
    },
  }
}

function makeClaudeConfig(): PluginConfig {
  return {
    name: 'verify-plugin',
    version: '0.1.0',
    description: 'A verify test plugin',
    author: { name: 'Test Author' },
    license: 'MIT',
    skills: './skills/',
    targets: ['claude-code'],
    outDir: './dist',
  }
}

beforeEach(() => {
  rmSync(ROOT, { recursive: true, force: true })
  mkdirSync(DIST_DIR, { recursive: true })
  mkdirSync(HOME_DIR, { recursive: true })
  process.env.HOME = HOME_DIR
})

afterEach(() => {
  rmSync(ROOT, { recursive: true, force: true })
})

describe('verifyInstall', () => {
  it('passes for an installed codex bundle in its native local path', async () => {
    mkdirSync(resolve(DIST_DIR, 'codex/.codex-plugin'), { recursive: true })
    writeFileSync(
      resolve(DIST_DIR, 'codex/.codex-plugin/plugin.json'),
      JSON.stringify({
        name: 'verify-plugin',
        version: '0.1.0',
      }),
    )

    await installPlugin(DIST_DIR, 'verify-plugin', ['codex'])

    const result = await verifyInstall(makeConfig(), {
      rootDir: ROOT,
      targets: ['codex'],
    })

    expect(result.ok).toBe(true)
    expect(result.checks).toHaveLength(1)
    expect(result.checks[0]).toMatchObject({
      platform: 'codex',
      built: true,
      installed: true,
      stale: false,
      ok: true,
      errors: 0,
    })
  })

  it('fails when the target is not installed in the host-visible path', async () => {
    mkdirSync(resolve(DIST_DIR, 'codex/.codex-plugin'), { recursive: true })
    writeFileSync(
      resolve(DIST_DIR, 'codex/.codex-plugin/plugin.json'),
      JSON.stringify({
        name: 'verify-plugin',
        version: '0.1.0',
      }),
    )

    const result = await verifyInstall(makeConfig(), {
      rootDir: ROOT,
      targets: ['codex'],
    })

    expect(result.ok).toBe(false)
    expect(result.checks).toHaveLength(1)
    expect(result.checks[0]).toMatchObject({
      platform: 'codex',
      built: true,
      installed: false,
      stale: false,
      ok: false,
    })
    expect(result.checks[0].errors).toBeGreaterThan(0)
  })

  it('fails when the installed codex bundle is stale relative to the current build', async () => {
    mkdirSync(resolve(DIST_DIR, 'codex/.codex-plugin'), { recursive: true })
    writeFileSync(
      resolve(DIST_DIR, 'codex/.codex-plugin/plugin.json'),
      JSON.stringify({
        name: 'verify-plugin',
        version: '0.2.0',
      }),
    )

    const staleInstall = resolve(ROOT, 'stale-codex-install')
    mkdirSync(resolve(staleInstall, '.codex-plugin'), { recursive: true })
    writeFileSync(
      resolve(staleInstall, '.codex-plugin/plugin.json'),
      JSON.stringify({
        name: 'verify-plugin',
        version: '0.1.0',
      }),
    )
    mkdirSync(resolve(HOME_DIR, '.codex/plugins'), { recursive: true })
    symlinkSync(staleInstall, resolve(HOME_DIR, '.codex/plugins/verify-plugin'))

    const result = await verifyInstall(makeConfig(), {
      rootDir: ROOT,
      targets: ['codex'],
    })

    expect(result.ok).toBe(false)
    expect(result.checks[0]).toMatchObject({
      platform: 'codex',
      built: true,
      installed: true,
      stale: true,
      ok: false,
    })
    expect(result.checks[0].staleReason).toContain('not the current build')
    expect(result.checks[0].errors).toBeGreaterThan(0)
  })

  it('fails when Codex has a stale active cache for the installed plugin', async () => {
    mkdirSync(resolve(DIST_DIR, 'codex/.codex-plugin'), { recursive: true })
    writeFileSync(
      resolve(DIST_DIR, 'codex/.codex-plugin/plugin.json'),
      JSON.stringify({
        name: 'verify-plugin',
        version: '0.2.0',
      }),
    )

    await installPlugin(DIST_DIR, 'verify-plugin', ['codex'])

    const staleCache = resolve(HOME_DIR, '.codex/plugins/cache/local-plugins/verify-plugin/0.1.0')
    mkdirSync(resolve(staleCache, '.codex-plugin'), { recursive: true })
    writeFileSync(
      resolve(staleCache, '.codex-plugin/plugin.json'),
      JSON.stringify({
        name: 'verify-plugin',
        version: '0.1.0',
      }),
    )

    const result = await verifyInstall(makeConfig(), {
      rootDir: ROOT,
      targets: ['codex'],
    })

    expect(result.ok).toBe(false)
    expect(result.checks[0]).toMatchObject({
      platform: 'codex',
      built: true,
      installed: true,
      stale: true,
      ok: false,
    })
    expect(result.checks[0].staleReason).toContain('Codex active cache appears stale')
    expect(result.checks[0].errors).toBeGreaterThan(0)
  })

  it('prints concrete recovery actions for failed verification', async () => {
    mkdirSync(resolve(DIST_DIR, 'codex/.codex-plugin'), { recursive: true })
    writeFileSync(
      resolve(DIST_DIR, 'codex/.codex-plugin/plugin.json'),
      JSON.stringify({
        name: 'verify-plugin',
        version: '0.1.0',
      }),
    )

    const result = await verifyInstall(makeConfig(), {
      rootDir: ROOT,
      targets: ['codex'],
    })
    const logs: string[] = []
    const originalLog = console.log
    console.log = (message?: unknown) => {
      logs.push(String(message ?? ''))
    }

    try {
      printVerifyInstallResult(result)
    } finally {
      console.log = originalLog
    }

    expect(logs.join('\n')).toContain('fix: run pluxx install --target codex')
    expect(logs.join('\n')).toContain('pluxx verify-install failed.')
  })

  it('fails when an installed stdio MCP runtime exits immediately', async () => {
    mkdirSync(resolve(DIST_DIR, 'codex/.codex-plugin'), { recursive: true })
    mkdirSync(resolve(DIST_DIR, 'codex/skills/hello'), { recursive: true })
    mkdirSync(resolve(DIST_DIR, 'codex/mcp-server/dist'), { recursive: true })
    writeFileSync(
      resolve(DIST_DIR, 'codex/.codex-plugin/plugin.json'),
      JSON.stringify({
        name: 'verify-plugin',
        version: '0.1.0',
        skills: './skills/',
        mcpServers: './.mcp.json',
      }),
    )
    writeFileSync(resolve(DIST_DIR, 'codex/skills/hello/SKILL.md'), '# Hello\n')
    writeFileSync(
      resolve(DIST_DIR, 'codex/.mcp.json'),
      JSON.stringify({
        mcpServers: {
          fixture: {
            command: 'node',
            args: ['./mcp-server/dist/index.js', '--stdio'],
          },
        },
      }),
    )
    writeFileSync(resolve(DIST_DIR, 'codex/mcp-server/dist/index.js'), 'process.exit(0)\n')

    await installPlugin(DIST_DIR, 'verify-plugin', ['codex'], { quiet: true, useNativeClaudeInstall: false })

    const result = await verifyInstall(makeCodexRuntimeConfig(), {
      rootDir: ROOT,
      targets: ['codex'],
    })

    expect(result.ok).toBe(false)
    expect(result.checks[0]).toMatchObject({
      platform: 'codex',
      built: true,
      installed: true,
      ok: false,
    })
    expect(result.checks[0].errors).toBeGreaterThan(0)
  })

  it('passes for an installed codex bundle with plugin-bundled hooks', async () => {
    mkdirSync(resolve(DIST_DIR, 'codex/.codex-plugin'), { recursive: true })
    mkdirSync(resolve(DIST_DIR, 'codex/skills/hello'), { recursive: true })
    mkdirSync(resolve(DIST_DIR, 'codex/hooks'), { recursive: true })
    mkdirSync(resolve(DIST_DIR, 'codex/scripts'), { recursive: true })
    writeFileSync(
      resolve(DIST_DIR, 'codex/.codex-plugin/plugin.json'),
      JSON.stringify({
        name: 'verify-plugin',
        version: '0.1.0',
        skills: './skills/',
        hooks: './hooks/hooks.json',
      }),
    )
    writeFileSync(resolve(DIST_DIR, 'codex/skills/hello/SKILL.md'), '# Hello\n')
    writeFileSync(resolve(DIST_DIR, 'codex/scripts/session-start.sh'), '#!/usr/bin/env bash\nexit 0\n')
    writeFileSync(
      resolve(DIST_DIR, 'codex/hooks/hooks.json'),
      JSON.stringify({
        version: 1,
        hooks: {
          SessionStart: [
            {
              command: 'bash ./scripts/session-start.sh',
            },
          ],
        },
      }),
    )

    await installPlugin(DIST_DIR, 'verify-plugin', ['codex'], { quiet: true, useNativeClaudeInstall: false })

    const result = await verifyInstall(makeConfig(), {
      rootDir: ROOT,
      targets: ['codex'],
    })

    expect(result.ok).toBe(true)
    expect(result.checks[0]).toMatchObject({
      platform: 'codex',
      built: true,
      installed: true,
      ok: true,
      errors: 0,
    })
  })

  it('checks the actual Claude install path instead of the local marketplace staging bundle', async () => {
    mkdirSync(resolve(DIST_DIR, 'claude-code/.claude-plugin'), { recursive: true })
    mkdirSync(resolve(DIST_DIR, 'claude-code/commands'), { recursive: true })
    mkdirSync(resolve(DIST_DIR, 'claude-code/skills/research'), { recursive: true })
    mkdirSync(resolve(DIST_DIR, 'claude-code/scripts'), { recursive: true })
    mkdirSync(resolve(DIST_DIR, 'claude-code/hooks'), { recursive: true })

    writeFileSync(
      resolve(DIST_DIR, 'claude-code/.claude-plugin/plugin.json'),
      JSON.stringify({
        name: 'verify-plugin',
        version: '0.1.0',
        commands: './commands/',
        skills: './skills/',
        hooks: './hooks/hooks.json',
      }),
    )
    writeFileSync(resolve(DIST_DIR, 'claude-code/commands/pulse.md'), '# pulse\n')
    writeFileSync(resolve(DIST_DIR, 'claude-code/skills/research/SKILL.md'), '# Research\n')
    writeFileSync(resolve(DIST_DIR, 'claude-code/scripts/session-start.sh'), '#!/usr/bin/env bash\nexit 0\n')
    writeFileSync(
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

    const marketplaceBundle = resolve(HOME_DIR, '.claude/plugins/data/pluxx-local-verify-plugin/plugins/verify-plugin')
    mkdirSync(resolve(marketplaceBundle, '.claude-plugin'), { recursive: true })
    cpSync(resolve(DIST_DIR, 'claude-code'), marketplaceBundle, { recursive: true })

    const installedBundle = resolve(HOME_DIR, '.claude/plugins/cache/pluxx-local-verify-plugin/verify-plugin/0.1.0')
    mkdirSync(resolve(HOME_DIR, '.claude/plugins/cache/pluxx-local-verify-plugin/verify-plugin'), { recursive: true })
    cpSync(resolve(DIST_DIR, 'claude-code'), installedBundle, { recursive: true })
    rmSync(resolve(installedBundle, 'commands'), { recursive: true, force: true })

    const result = await verifyInstall(makeClaudeConfig(), {
      rootDir: ROOT,
      targets: ['claude-code'],
    })

    expect(result.ok).toBe(false)
    expect(result.checks).toHaveLength(1)
    expect(result.checks[0]).toMatchObject({
      platform: 'claude-code',
      built: true,
      installed: true,
      ok: false,
    })
    expect(result.checks[0].installPath).toBe(installedBundle)
    expect(result.checks[0].consumerPath).toBe(installedBundle)
    expect(result.checks[0].errors).toBeGreaterThan(0)
  })

  it('passes when an installed Claude bundle can execute its bundled permission hook behavior', async () => {
    mkdirSync(resolve(DIST_DIR, 'claude-code/.claude-plugin'), { recursive: true })
    mkdirSync(resolve(DIST_DIR, 'claude-code/skills/research'), { recursive: true })
    mkdirSync(resolve(DIST_DIR, 'claude-code/hooks'), { recursive: true })

    writeFileSync(
      resolve(DIST_DIR, 'claude-code/.claude-plugin/plugin.json'),
      JSON.stringify({
        name: 'verify-plugin',
        version: '0.1.0',
        skills: './skills/',
        hooks: './hooks/hooks.json',
      }),
    )
    writeFileSync(resolve(DIST_DIR, 'claude-code/skills/research/SKILL.md'), '# Research\n')
    writeFileSync(
      resolve(DIST_DIR, 'claude-code/hooks/hooks.json'),
      JSON.stringify({
        hooks: {
          PreToolUse: [
            {
              matcher: 'Read',
              hooks: [
                {
                  type: 'command',
                  command: 'node "${CLAUDE_PLUGIN_ROOT}/hooks/pluxx-permissions.mjs" claude-pretool',
                },
              ],
            },
          ],
        },
      }),
    )
    writeFileSync(
      resolve(DIST_DIR, 'claude-code/hooks/pluxx-permissions.mjs'),
      buildGeneratedPermissionHookScript({
        allow: ['Read(src/**)'],
        deny: ['Edit(.env)'],
      }) ?? '',
    )

    const installedBundle = resolve(HOME_DIR, '.claude/plugins/cache/pluxx-local-verify-plugin/verify-plugin/0.1.0')
    mkdirSync(resolve(HOME_DIR, '.claude/plugins/cache/pluxx-local-verify-plugin/verify-plugin'), { recursive: true })
    cpSync(resolve(DIST_DIR, 'claude-code'), installedBundle, { recursive: true })

    const result = await verifyInstall(makeClaudeConfig(), {
      rootDir: ROOT,
      targets: ['claude-code'],
    })

    expect(result.ok).toBe(true)
    expect(result.checks[0]).toMatchObject({
      platform: 'claude-code',
      built: true,
      installed: true,
      ok: true,
      errors: 0,
    })
  })

  it('fails when an installed Claude bundled permission hook no longer returns usable decisions', async () => {
    mkdirSync(resolve(DIST_DIR, 'claude-code/.claude-plugin'), { recursive: true })
    mkdirSync(resolve(DIST_DIR, 'claude-code/skills/research'), { recursive: true })
    mkdirSync(resolve(DIST_DIR, 'claude-code/hooks'), { recursive: true })

    writeFileSync(
      resolve(DIST_DIR, 'claude-code/.claude-plugin/plugin.json'),
      JSON.stringify({
        name: 'verify-plugin',
        version: '0.1.0',
        skills: './skills/',
        hooks: './hooks/hooks.json',
      }),
    )
    writeFileSync(resolve(DIST_DIR, 'claude-code/skills/research/SKILL.md'), '# Research\n')
    writeFileSync(
      resolve(DIST_DIR, 'claude-code/hooks/hooks.json'),
      JSON.stringify({
        hooks: {
          PreToolUse: [
            {
              matcher: 'Read',
              hooks: [
                {
                  type: 'command',
                  command: 'node "${CLAUDE_PLUGIN_ROOT}/hooks/pluxx-permissions.mjs" claude-pretool',
                },
              ],
            },
          ],
        },
      }),
    )
    writeFileSync(
      resolve(DIST_DIR, 'claude-code/hooks/pluxx-permissions.mjs'),
      '#!/usr/bin/env node\nprocess.stdout.write("{}")\n',
    )

    const installedBundle = resolve(HOME_DIR, '.claude/plugins/cache/pluxx-local-verify-plugin/verify-plugin/0.1.0')
    mkdirSync(resolve(HOME_DIR, '.claude/plugins/cache/pluxx-local-verify-plugin/verify-plugin'), { recursive: true })
    cpSync(resolve(DIST_DIR, 'claude-code'), installedBundle, { recursive: true })

    const result = await verifyInstall(makeClaudeConfig(), {
      rootDir: ROOT,
      targets: ['claude-code'],
    })

    expect(result.ok).toBe(false)
    expect(result.checks[0]).toMatchObject({
      platform: 'claude-code',
      built: true,
      installed: true,
      ok: false,
    })
    expect(result.checks[0].errors).toBeGreaterThan(0)
  })
})
