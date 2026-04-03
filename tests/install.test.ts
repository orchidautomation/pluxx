import { describe, it, expect, beforeEach, afterEach } from 'bun:test'
import { mkdirSync, rmSync, existsSync, lstatSync, readlinkSync } from 'fs'
import { resolve } from 'path'
import { installPlugin, uninstallPlugin } from '../src/cli/install'
import type { TargetPlatform } from '../src/schema'

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

    await installPlugin(DIST_DIR, 'megamind')

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

    await installPlugin(DIST_DIR, 'megamind', ['cursor', 'openhands'])

    expect(existsSync(resolve(HOME_DIR, INSTALL_PATHS.cursor))).toBe(true)
    expect(existsSync(resolve(HOME_DIR, INSTALL_PATHS.openhands))).toBe(true)
    expect(existsSync(resolve(HOME_DIR, INSTALL_PATHS['claude-code']))).toBe(false)
  })

  it('uninstalls installed symlinks for selected targets', async () => {
    mkdirSync(resolve(DIST_DIR, 'cursor'), { recursive: true })
    mkdirSync(resolve(DIST_DIR, 'openhands'), { recursive: true })
    await installPlugin(DIST_DIR, 'megamind', ['cursor', 'openhands'])

    await uninstallPlugin('megamind', ['cursor'])

    expect(existsSync(resolve(HOME_DIR, INSTALL_PATHS.cursor))).toBe(false)
    expect(existsSync(resolve(HOME_DIR, INSTALL_PATHS.openhands))).toBe(true)
  })
})
