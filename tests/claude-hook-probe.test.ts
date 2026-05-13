import { afterEach, describe, expect, it } from 'bun:test'
import { chmodSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { resolve } from 'path'
import { runClaudeHookProbeSuite, type ClaudeHookProbeScenario } from '../src/claude-hook-probe'

const TMP_ROOTS: string[] = []

function makeTempDir(prefix: string): string {
  const dir = mkdtempSync(resolve(tmpdir(), prefix))
  TMP_ROOTS.push(dir)
  return dir
}

function makeStubExecutable(path: string, body: string): void {
  writeFileSync(path, body)
  chmodSync(path, 0o755)
}

afterEach(() => {
  while (TMP_ROOTS.length > 0) {
    rmSync(TMP_ROOTS.pop()!, { recursive: true, force: true })
  }
})

function makeFakeClaude(rootDir: string, options: { pluginless?: boolean } = {}): string {
  const binDir = resolve(rootDir, '.bin')
  mkdirSync(binDir, { recursive: true })
  const binary = resolve(binDir, 'claude')
  makeStubExecutable(binary, `#!/usr/bin/env node
const fs = require('fs')
const path = require('path')

function readJson(filePath) {
  if (!fs.existsSync(filePath)) return undefined
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'))
  } catch {
    return undefined
  }
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2))
}

function writeSideEffect(filePath, label) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, label + '\\n')
}

function copyDir(source, target) {
  fs.mkdirSync(target, { recursive: true })
  for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
    const sourcePath = path.join(source, entry.name)
    const targetPath = path.join(target, entry.name)
    if (entry.isDirectory()) {
      copyDir(sourcePath, targetPath)
      continue
    }
    fs.copyFileSync(sourcePath, targetPath)
  }
}

function marketplacesPath(home) {
  return path.join(home, '.claude', 'fake-marketplaces.json')
}

function readMarketplaces(home) {
  return readJson(marketplacesPath(home)) || {}
}

function writeMarketplaces(home, value) {
  writeJson(marketplacesPath(home), value)
}

function pluginSettingsPath(home) {
  return path.join(home, '.claude', 'settings.json')
}

function installedPluginsPath(home) {
  return path.join(home, '.claude', 'plugins', 'installed_plugins.json')
}

function managedSettingsPath() {
  return process.env.PLUXX_CLAUDE_MANAGED_SETTINGS_PATH || ''
}

function duplicateHookError(installPath) {
  const manifest = readJson(path.join(installPath, '.claude-plugin', 'plugin.json'))
  const standardHooksPath = path.join(installPath, 'hooks', 'hooks.json')
  if (!manifest || manifest.hooks !== './hooks/hooks.json' || !fs.existsSync(standardHooksPath)) {
    return undefined
  }
  return 'Hook load failed: Duplicate hooks file detected: ./hooks/hooks.json resolves to already-loaded file ' + standardHooksPath + '. The standard hooks/hooks.json is loaded automatically, so manifest.hooks should only reference additional hook files.'
}

function listInstalledPluginEntries(home) {
  const installed = readJson(installedPluginsPath(home))
  const pluginMap = installed && installed.plugins && typeof installed.plugins === 'object' ? installed.plugins : {}
  const entries = []
  for (const [pluginId, installs] of Object.entries(pluginMap)) {
    if (!Array.isArray(installs)) continue
    for (const install of installs) {
      if (!install || typeof install !== 'object') continue
      const installPath = typeof install.installPath === 'string' ? install.installPath : ''
      const manifest = readJson(path.join(installPath, '.claude-plugin', 'plugin.json')) || {}
      entries.push({
        id: pluginId,
        name: typeof manifest.name === 'string' ? manifest.name : String(pluginId).split('@')[0],
        installPath,
        scope: typeof install.scope === 'string' ? install.scope : 'user',
        errors: duplicateHookError(installPath) ? [duplicateHookError(installPath)] : [],
      })
    }
  }
  return entries
}

const cwd = process.cwd()
const home = process.env.HOME || cwd
const args = process.argv.slice(2)

if (args[0] === 'plugin' && args[1] === 'marketplace' && args[2] === 'add') {
  const marketplaceRoot = args[3]
  const manifest = readJson(path.join(marketplaceRoot, '.claude-plugin', 'marketplace.json')) || {}
  const marketplaces = readMarketplaces(home)
  marketplaces[String(manifest.name || path.basename(marketplaceRoot))] = marketplaceRoot
  writeMarketplaces(home, marketplaces)
  process.exit(0)
}

if (args[0] === 'plugin' && args[1] === 'install') {
  const pluginRef = args[2] || ''
  const scopeIndex = args.indexOf('--scope')
  const scope = scopeIndex === -1 ? 'user' : String(args[scopeIndex + 1] || 'user')
  const [pluginName, marketplaceName] = pluginRef.split('@')
  const marketplaces = readMarketplaces(home)
  const marketplaceRoot = marketplaces[marketplaceName]
  const marketplace = readJson(path.join(marketplaceRoot, '.claude-plugin', 'marketplace.json')) || {}
  const pluginEntry = Array.isArray(marketplace.plugins) ? marketplace.plugins.find((entry) => entry && entry.name === pluginName) : undefined
  if (!pluginEntry || typeof pluginEntry.source !== 'string') {
    process.exit(1)
  }

  const sourceDir = path.resolve(marketplaceRoot, pluginEntry.source)
  const manifest = readJson(path.join(sourceDir, '.claude-plugin', 'plugin.json')) || {}
  const version = String(manifest.version || pluginEntry.version || '0.0.0')
  const installPath = path.join(home, '.claude', 'plugins', 'cache', marketplaceName, pluginName, version)
  copyDir(sourceDir, installPath)

  const settings = readJson(pluginSettingsPath(home)) || {}
  settings.extraKnownMarketplaces = {
    ...(settings.extraKnownMarketplaces || {}),
    [marketplaceName]: {
      source: {
        source: 'directory',
        path: marketplaceRoot,
      },
    },
  }
  settings.enabledPlugins = {
    ...(settings.enabledPlugins || {}),
    [pluginRef]: true,
  }
  writeJson(pluginSettingsPath(home), settings)

  writeJson(installedPluginsPath(home), {
    version: 2,
    plugins: {
      [pluginRef]: [
        {
          scope,
          installPath,
          version,
          installedAt: '2026-05-13T00:00:00.000Z',
          lastUpdated: '2026-05-13T00:00:00.000Z',
        },
      ],
    },
  })
  process.exit(0)
}

if (args[0] === 'plugin' && args[1] === 'list' && args[2] === '--json') {
  console.log(JSON.stringify(listInstalledPluginEntries(home)))
  process.exit(0)
}

const settingSourcesIndex = args.indexOf('--setting-sources')
const settingSources = settingSourcesIndex === -1
  ? ['user', 'project', 'local']
  : String(args[settingSourcesIndex + 1] || '').split(',').filter(Boolean)
const sideEffectsDir = path.join(cwd, 'side-effects')
const managedSettings = readJson(managedSettingsPath())
const userSettings = readJson(path.join(home, '.claude', 'settings.json'))
const projectSettings = readJson(path.join(cwd, '.claude', 'settings.json'))
const localSettings = readJson(path.join(cwd, '.claude', 'settings.local.json'))
const installedPlugins = ${options.pluginless === true ? '[]' : 'listInstalledPluginEntries(home)'}

const activeSettings = {
  managed: managedSettings,
  user: settingSources.includes('user') ? userSettings : undefined,
  project: settingSources.includes('project') ? projectSettings : undefined,
  local: settingSources.includes('local') ? localSettings : undefined,
}
const managedDisableAllHooks = Boolean(activeSettings.managed && activeSettings.managed.disableAllHooks === true)
const allowManagedHooksOnly = Boolean(activeSettings.managed && activeSettings.managed.allowManagedHooksOnly === true)
const lowerScopeDisableAllHooks = ['user', 'project', 'local'].some((scope) => {
  const settings = activeSettings[scope]
  return Boolean(settings && settings.disableAllHooks === true)
})

function hookCanRun(scope) {
  if (managedDisableAllHooks) return false
  if (allowManagedHooksOnly) return scope === 'managed'
  if (lowerScopeDisableAllHooks) return scope === 'managed'
  return true
}

if (activeSettings.managed && activeSettings.managed.hooks && hookCanRun('managed')) {
  writeSideEffect(path.join(sideEffectsDir, 'managed.txt'), 'managed')
}
if (activeSettings.user && activeSettings.user.hooks && hookCanRun('user')) {
  writeSideEffect(path.join(sideEffectsDir, 'user.txt'), 'user')
}
if (activeSettings.project && activeSettings.project.hooks && hookCanRun('project')) {
  writeSideEffect(path.join(sideEffectsDir, 'project.txt'), 'project')
}
if (activeSettings.local && activeSettings.local.hooks && hookCanRun('local')) {
  writeSideEffect(path.join(sideEffectsDir, 'local.txt'), 'local')
}
if (installedPlugins.some((plugin) => hookCanRun(plugin.scope) && fs.existsSync(path.join(plugin.installPath, 'hooks', 'hooks.json')))) {
  writeSideEffect(path.join(sideEffectsDir, 'plugin.txt'), 'plugin')
}

console.log(JSON.stringify({
  type: 'system',
  subtype: 'init',
  plugins: installedPlugins.map((plugin) => ({
    name: plugin.name,
    source: plugin.id,
    path: plugin.installPath,
    scope: plugin.scope,
  })),
}))
if (
  fs.existsSync(path.join(sideEffectsDir, 'plugin.txt'))
  || fs.existsSync(path.join(sideEffectsDir, 'managed.txt'))
  || fs.existsSync(path.join(sideEffectsDir, 'user.txt'))
  || fs.existsSync(path.join(sideEffectsDir, 'project.txt'))
  || fs.existsSync(path.join(sideEffectsDir, 'local.txt'))
) {
  console.log(JSON.stringify({ type: 'hook.event' }))
}
console.log(JSON.stringify({ type: 'turn.completed' }))
`)
  return binary
}

function makePluginlessClaude(rootDir: string): string {
  return makeFakeClaude(rootDir, { pluginless: true })
}

async function runScenario(
  scenario: ClaudeHookProbeScenario,
  options: {
    managedSettingsShadow?: boolean
    pluginless?: boolean
  } = {},
) {
  const rootDir = makeTempDir('pluxx-claude-hook-probe-')
  const claudeBinary = options.pluginless ? makePluginlessClaude(rootDir) : makeFakeClaude(rootDir)

  const suite = await runClaudeHookProbeSuite([scenario], {
    claudeBinary,
    timeoutMs: 2000,
    managedSettingsShadow: options.managedSettingsShadow,
  })

  expect(suite.results).toHaveLength(1)
  return suite.results[0]!
}

describe('claude hook probe', () => {
  it('reports hook-executed for a plugin-bundled SessionStart hook', async () => {
    const result = await runScenario({
      name: 'plugin-default',
      pluginHook: true,
    })

    expect(result.status).toBe('hook-executed')
    expect(result.sideEffects.map((effect) => effect.name)).toEqual(['plugin'])
    expect(result.eventTypes).toContain('system')
    expect(result.loadedPlugins.some((plugin) => plugin.includes('probe-plugin'))).toBe(true)
  })

  it('reports duplicate-hook-load-error when manifest.hooks redundantly points at hooks/hooks.json', async () => {
    const result = await runScenario({
      name: 'plugin-duplicate-manifest',
      pluginHook: true,
      includeStandardManifestHooks: true,
    })

    expect(result.status).toBe('duplicate-hook-load-error')
    expect(result.duplicateHooksError).toBe(true)
    expect(result.sideEffects.map((effect) => effect.name)).toEqual(['plugin'])
    expect(result.pluginListErrors.some((error) => error.includes('Duplicate hooks file detected'))).toBe(true)
  })

  it('reports plugin-not-loaded when a plugin scenario never surfaces as loaded in Claude init output', async () => {
    const rootDir = makeTempDir('pluxx-claude-hook-probe-missing-plugin-')
    const claudeBinary = makePluginlessClaude(rootDir)
    const suite = await runClaudeHookProbeSuite([{
      name: 'plugin-default',
      pluginHook: true,
    }], {
      claudeBinary,
      timeoutMs: 2000,
    })

    const result = suite.results[0]!
    expect(result.status).toBe('plugin-not-loaded')
    expect(result.loadedPlugins).toEqual([])
    expect(result.sideEffects).toHaveLength(0)
  })

  it('reports no-hook-side-effect when local hooks are filtered out by --setting-sources user,project', async () => {
    const result = await runScenario({
      name: 'local-settings-filtered',
      localHook: true,
      settingSources: ['user', 'project'],
    })

    expect(result.status).toBe('no-hook-side-effect')
    expect(result.sideEffects).toHaveLength(0)
    expect(result.settingSources).toEqual(['user', 'project'])
  })

  it('reports no-hook-side-effect when user disableAllHooks suppresses an otherwise-present local hook', async () => {
    const result = await runScenario({
      name: 'local-settings-disabled-by-user',
      localHook: true,
      userDisableAllHooks: true,
    })

    expect(result.status).toBe('no-hook-side-effect')
    expect(result.sideEffects).toHaveLength(0)
    expect(result.eventTypes).toContain('turn.completed')
  })

  it('reports no-hook-side-effect when managed disableAllHooks suppresses a lower-scope local hook', async () => {
    const result = await runScenario({
      name: 'managed-settings-disable-all-beats-local',
      localHook: true,
      managedDisableAllHooks: true,
    }, {
      managedSettingsShadow: true,
    })

    expect(result.status).toBe('no-hook-side-effect')
    expect(result.sideEffects).toHaveLength(0)
    expect(result.managedDisableAllHooks).toBe(true)
  })

  it('reports hook-executed for managed settings when allowManagedHooksOnly suppresses a local hook', async () => {
    const result = await runScenario({
      name: 'managed-settings-allow-managed-only',
      managedHook: true,
      localHook: true,
      managedAllowManagedHooksOnly: true,
    }, {
      managedSettingsShadow: true,
    })

    expect(result.status).toBe('hook-executed')
    expect(result.sideEffects.map((effect) => effect.name)).toEqual(['managed'])
    expect(result.managedAllowManagedHooksOnly).toBe(true)
  })

  it('reports hook-executed for a managed-scope plugin hook when allowManagedHooksOnly is enabled', async () => {
    const result = await runScenario({
      name: 'managed-settings-allow-managed-only-plugin',
      pluginHook: true,
      pluginScope: 'managed',
      managedAllowManagedHooksOnly: true,
    }, {
      managedSettingsShadow: true,
    })

    expect(result.status).toBe('hook-executed')
    expect(result.pluginScope).toBe('managed')
    expect(result.sideEffects.map((effect) => effect.name)).toEqual(['plugin'])
    expect(result.loadedPlugins.some((plugin) => plugin.includes('probe-plugin'))).toBe(true)
  })
})
