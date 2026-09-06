import { spawnSync } from 'node:child_process'
import { isAbsolute, resolve, sep } from 'node:path'
import { realpathSync, readFileSync } from 'node:fs'

export interface ClaudePluginRequest {
  name: string
  version?: string
  selector?: string
  scope?: string
  requireEnabled?: boolean
}
export interface ClaudePluginObservation {
  id: string
  version: string | null
  scope: string
  enabled: boolean
  installPath: string
}
export type ClaudePluginVerification = {
  ok: boolean
  code: string
  detail: string
  action: string
  observation?: ClaudePluginObservation
}

// Kept self-contained so generated installers execute the same classifier.
export function selectClaudePlugin(inventory: unknown, request: ClaudePluginRequest): ClaudePluginVerification {
  const fail = (code: string, detail: string): ClaudePluginVerification => ({
    ok: false, code, detail,
    action: 'Inspect claude plugin list --json in the intended workspace; select the exact plugin@marketplace and rerun verification. No other plugin was removed by this check.',
  })
  if (!request.name || (request.selector && (!request.selector.startsWith(request.name + '@') || !/^[^@\s]+@[^@\s]+$/.test(request.selector)))) {
    return fail('claude-plugin-request-invalid', 'The requested Claude selector must match the plugin name.')
  }
  if (!Array.isArray(inventory)) return fail('claude-plugin-inventory-unavailable', 'Claude installed inventory is not an array.')
  const rows: ClaudePluginObservation[] = []
  const seen = new Set<string>()
  for (const raw of inventory) {
    if (!raw || typeof raw !== 'object' || typeof raw.id !== 'string' || !/^[^@\s\x00-\x1f]+@[^@\s\x00-\x1f]+$/.test(raw.id)
      || raw.id.length > 512 || (raw.version !== null && typeof raw.version !== 'string')
      || typeof raw.enabled !== 'boolean' || !['user', 'project', 'local', 'managed'].includes(raw.scope)
      || typeof raw.installPath !== 'string' || !/^(?:\/|[A-Za-z]:[\\/])/.test(raw.installPath) || /[\x00-\x1f]/.test(raw.installPath)) {
      return fail('claude-plugin-inventory-unavailable', 'Claude installed inventory contains an unsupported or incomplete record.')
    }
    const row: ClaudePluginObservation = { id: raw.id, version: raw.version, scope: raw.scope, enabled: raw.enabled, installPath: raw.installPath }
    const identity = JSON.stringify(row)
    if (!seen.has(identity)) { seen.add(identity); rows.push(row) }
  }
  const relevant = rows.filter(row => row.id.split('@')[0] === request.name)
    .filter(row => !request.selector || row.id === request.selector)
    .filter(row => !request.scope || row.scope === request.scope)
  if (!relevant.length) return fail('claude-plugin-source-missing', 'The requested Claude installation is not present in native inventory.')
  if (new Set(relevant.map(row => row.id)).size > 1) return fail('claude-plugin-source-ambiguous', 'Multiple registered Claude sources match; supply an exact plugin@marketplace selector.')
  if (relevant.length > 1) return fail('claude-plugin-inventory-unavailable', 'Claude scope records disagree; effective source attribution is unavailable.')
  const observation = relevant[0]!
  if (request.version && observation.version !== request.version) return { ...fail('claude-plugin-version-mismatch', 'The registered Claude version does not match the requested bundle.'), observation }
  if (request.requireEnabled && !observation.enabled) return { ...fail('claude-plugin-disabled', 'The requested Claude installation is registered but disabled.'), observation }
  return { ok: true, code: 'claude-plugin-source-verified', detail: 'Exact registered Claude source verified. Inventory enablement is not proof of runtime activation.', action: 'Reload Claude and verify the intended components in the same workspace.', observation }
}

export type ClaudeInventoryRunner = (command: string, args: string[]) => { status: number | null; stdout: string; stderr?: string }
export function readClaudePluginInventory(options: { cwd?: string; runCommand?: ClaudeInventoryRunner } = {}): unknown {
  const home = process.env.HOME
  const configRoot = process.env.CLAUDE_CONFIG_DIR || (home && resolve(home, '.claude'))
  if (!home || !isAbsolute(home) || !configRoot || !isAbsolute(configRoot)) throw new Error('Claude inventory requires absolute HOME and config roots.')
  const run = options.runCommand ?? ((command: string, args: string[]) => spawnSync(command, args, {
    cwd: options.cwd, env: process.env, encoding: 'utf8', timeout: 15_000, maxBuffer: 2 * 1024 * 1024,
  }))
  const result = run('claude', ['plugin', 'list', '--json'])
  if (result.status !== 0 || Buffer.byteLength(result.stdout) > 2 * 1024 * 1024) throw new Error('Claude installed inventory unavailable; no native state was verified.')
  try { return JSON.parse(result.stdout) } catch { throw new Error('claude-plugin-inventory-unavailable: Claude inventory returned malformed JSON.') }
}

export function verifyClaudePlugin(request: ClaudePluginRequest, options: { cwd?: string; runCommand?: ClaudeInventoryRunner } = {}): ClaudePluginVerification {
  try {
    const result = selectClaudePlugin(readClaudePluginInventory(options), request)
    if (result.ok && result.observation) {
      const configRoot = process.env.CLAUDE_CONFIG_DIR || resolve(process.env.HOME || '', '.claude')
      if (!isAbsolute(configRoot) || !process.env.HOME) throw new Error('unbound config')
      const cacheRoot = realpathSync(resolve(configRoot, 'plugins/cache'))
      const actual = realpathSync(result.observation.installPath)
      if (!actual.startsWith(cacheRoot + sep)) throw new Error('unsupported external install path')
      const manifest = JSON.parse(readFileSync(resolve(actual, '.claude-plugin/plugin.json'), 'utf8'))
      if (manifest.name !== request.name || (request.version && manifest.version !== request.version)) throw new Error('manifest identity mismatch')
    }
    return result
  } catch {
    return { ok: false, code: 'claude-plugin-inventory-unavailable', detail: 'Claude inventory or its cache path could not be verified. External/link-mode and unsupported scope layouts require manual verification.', action: 'Check Claude CLI availability and the intended HOME/CLAUDE_CONFIG_DIR, then rerun native verification. Use file-only validation for offline bundles.' }
  }
}

/** Standalone generated installer reader; shares the exact pure classifier. */
export function renderClaudeInventoryScript(): string {
  return [
    "const fs = require('fs'), path = require('path'), cp = require('child_process')",
    'const __name = (value) => value',
    selectClaudePlugin.toString(),
    'const [mode, name, marketplace, version] = process.argv.slice(2)',
    'let result',
    'try {',
    "  if (!process.env.HOME || !path.isAbsolute(process.env.HOME) || (process.env.CLAUDE_CONFIG_DIR && !path.isAbsolute(process.env.CLAUDE_CONFIG_DIR))) throw new Error('unbound root')",
    "  const read = cp.spawnSync('claude', ['plugin', 'list', '--json'], { encoding: 'utf8', timeout: 15000, maxBuffer: 2 * 1024 * 1024 })",
    "  if (read.status !== 0) throw new Error('unavailable')",
    "  result = selectClaudePlugin(JSON.parse(read.stdout), { name, selector: name + '@' + marketplace, scope: 'user', ...(mode === 'postflight' ? { version } : {}) })",
    "  if (mode === 'preflight' && result.code === 'claude-plugin-source-missing') result = { ok: true }",
    '  if (mode === "postflight" && result.ok) {',
    "    const root = process.env.CLAUDE_CONFIG_DIR || path.resolve(process.env.HOME || '', '.claude')",
    "    if (!process.env.HOME || !path.isAbsolute(root)) throw new Error('unbound root')",
    "    const cache = fs.realpathSync(path.join(root, 'plugins/cache'))",
    '    const installed = fs.realpathSync(result.observation.installPath)',
    "    if (!installed.startsWith(cache + path.sep)) throw new Error('external path')",
    "    const manifest = JSON.parse(fs.readFileSync(path.join(installed, '.claude-plugin/plugin.json'), 'utf8'))",
    "    if (manifest.name !== name || manifest.version !== version) throw new Error('manifest identity')",
    '  }',
    '} catch { result = { ok: false, code: "claude-plugin-inventory-unavailable", detail: "Claude native inventory or installed cache could not be verified.", action: "Inspect Claude inventory in the intended workspace and rerun verification; requested install changes may remain." } }',
    'console.log(JSON.stringify(result))',
    'process.exitCode = result.ok ? 0 : 1',
    '',
  ].join('\n')
}
