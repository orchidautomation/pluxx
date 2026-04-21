import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { mkdirSync, rmSync, writeFileSync } from 'fs'
import { resolve } from 'path'
import { installPlugin } from '../src/cli/install'
import { verifyInstall } from '../src/cli/verify-install'
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
      ok: false,
    })
    expect(result.checks[0].errors).toBeGreaterThan(0)
  })
})
