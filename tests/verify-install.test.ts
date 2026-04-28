import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { mkdirSync, rmSync, symlinkSync, writeFileSync } from 'fs'
import { resolve } from 'path'
import { installPlugin } from '../src/cli/install'
import { printVerifyInstallResult, verifyInstall } from '../src/cli/verify-install'
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
})
