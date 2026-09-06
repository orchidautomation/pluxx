import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, realpathSync } from 'node:fs'
import { resolve, relative } from 'node:path'

export interface CodexPluginIdentity {
  selector: string
  version: string | null
  sourceIdentity: string
}
export interface CodexPluginDiagnostic {
  code: 'same-name-cross-marketplace' | 'codex-plugin-inventory-unavailable'
  requested?: CodexPluginIdentity
  requestedRegistration?: 'enabled' | 'disabled' | 'absent'
  conflicts: CodexPluginIdentity[]
  totalConflicts: number
  omittedConflicts: number
  error: string
  action: string
}
export interface CodexCollisionRequest {
  name: string
  version?: string | null
  marketplace?: string
  sourcePath?: string
}

/** Self-contained so generated installers execute this exact classifier, not a fork. */
export function detectCodexPluginCollisions(
  inventory: unknown,
  requested: CodexCollisionRequest,
  digest: (text: string) => string,
): CodexPluginDiagnostic | undefined {
  const unavailable = (): CodexPluginDiagnostic => ({
    code: 'codex-plugin-inventory-unavailable', conflicts: [], totalConflicts: 0, omittedConflicts: 0,
    error: 'Codex enabled plugin inventory or requested marketplace identity could not be verified.',
    action: 'Check that codex plugin list --json works with the intended Codex home, then rerun verification.',
  })
  const segment = (value: unknown): value is string => typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(value)
  const version = (value: unknown): value is string | null => value === null || (typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9._+-]{0,127}$/.test(value))
  try {
    if (!segment(requested.name) || !version(requested.version ?? null)) return unavailable()
    const data = inventory as { installed?: unknown[] }
    if (!data || !Array.isArray(data.installed)) return unavailable()
    const rows = new Map<string, { identity: CodexPluginIdentity; name: string; marketplace: string; enabled: boolean; path?: string }>()
    for (const value of data.installed) {
      const row = value as Record<string, any>
      if (!row || !segment(row.name) || !segment(row.marketplaceName) || row.pluginId !== `${row.name}@${row.marketplaceName}`
        || row.installed !== true || typeof row.enabled !== 'boolean' || !version(row.version)
        || !row.source || !['local', 'remote', 'git', 'git-subdir', 'npm'].includes(row.source.source)) return unavailable()
      const source = row.source
      const location = source.source === 'local' ? source.path : source.source === 'remote' ? source.id : source.source === 'npm' ? source.package : source.url
      if (typeof location !== 'string' || !location || location.length > 4096) return unavailable()
      const normalized = { identity: { selector: row.pluginId, version: row.version, sourceIdentity: `${source.source}:sha256:${digest(location)}` },
        name: row.name, marketplace: row.marketplaceName, enabled: row.enabled,
        ...(source.source === 'local' ? { path: location } : {}) }
      const previous = rows.get(row.pluginId)
      if (previous && JSON.stringify(previous) !== JSON.stringify(normalized)) return unavailable()
      rows.set(row.pluginId, normalized)
    }
    let marketplace = requested.marketplace
    if (marketplace !== undefined && !segment(marketplace)) return unavailable()
    // With no enabled instance of this name there is no collision, even for a
    // built bundle that has not yet been assigned a marketplace. This does not
    // establish native registration or runtime discovery.
    if (!marketplace && ![...rows.values()].some(row => row.enabled && row.name === requested.name)) return undefined
    if (!marketplace && requested.sourcePath) {
      const matches = [...rows.values()].filter(row => row.name === requested.name && row.path === requested.sourcePath)
      if (matches.length === 1) marketplace = matches[0].marketplace
    }
    if (!segment(marketplace)) return unavailable()
    const selector = `${requested.name}@${marketplace}`
    const own = rows.get(selector)
    const conflicts = [...rows.values()].filter(row => row.enabled && row.name === requested.name && row.marketplace !== marketplace)
      .map(row => row.identity).sort((a, b) => a.selector < b.selector ? -1 : a.selector > b.selector ? 1 : 0)
    if (!conflicts.length) return undefined
    return {
      code: 'same-name-cross-marketplace',
      requested: own?.identity ?? { selector, version: requested.version ?? null, sourceIdentity: `local:sha256:${digest(requested.sourcePath ?? selector)}` },
      requestedRegistration: own ? own.enabled ? 'enabled' : 'disabled' : 'absent',
      conflicts: conflicts.slice(0, 20), totalConflicts: conflicts.length, omittedConflicts: Math.max(0, conflicts.length - 20),
      error: 'Enabled same-name Codex plugins from different marketplaces require operator action.',
      action: 'Review the exact selectors in the Codex native plugin manager. Choose which to keep enabled, disable or remove only your chosen conflict, refresh or restart Codex, then rerun verification.',
    }
  } catch { return unavailable() }
}

export function renderCodexPluginDiagnostic(diagnostic: CodexPluginDiagnostic): string {
  const describe = (row: CodexPluginIdentity) => `${row.selector} (${row.version ?? 'unknown version'}; ${row.sourceIdentity})`
  return [diagnostic.error, diagnostic.requested ? `Requested: ${describe(diagnostic.requested)}; registration: ${diagnostic.requestedRegistration}.` : '',
    ...diagnostic.conflicts.map(row => `Conflicting: ${describe(row)}.`),
    diagnostic.omittedConflicts ? `${diagnostic.omittedConflicts} additional conflicts omitted.` : '', diagnostic.action].filter(Boolean).join('\n')
}

export function inspectCodexPluginCollisions(requested: CodexCollisionRequest, options: {
  env?: NodeJS.ProcessEnv
  cwd?: string
  run?: typeof spawnSync
} = {}): CodexPluginDiagnostic | undefined {
  let inventory: unknown
  try {
    const result = (options.run ?? spawnSync)('codex', ['plugin', 'list', '--json'], {
      env: options.env ?? process.env, cwd: options.cwd, encoding: 'utf8', timeout: 15000, maxBuffer: 2 * 1024 * 1024,
    })
    if (result.status === 0 && !result.error) inventory = JSON.parse(String(result.stdout))
  } catch { /* Do not expose raw provider errors or host state. */ }
  return detectCodexPluginCollisions(inventory, requested, text => createHash('sha256').update(text).digest('hex'))
}

export function codexRequestedIdentity(name: string, version: string | null, sourcePath: string, marketplacePath?: string, consumer = false): CodexCollisionRequest {
  const catalog = marketplacePath ?? process.env.PLUXX_CODEX_MARKETPLACE_PATH ?? resolve(process.env.HOME ?? '~', '.agents/plugins/marketplace.json')
  try {
    // Existing catalogs own their identity; do not replace it with an environment default.
    const hasCatalog = existsSync(catalog)
    const data = hasCatalog ? JSON.parse(readFileSync(catalog, 'utf8')) : undefined
    if (hasCatalog && (!data || typeof data.name !== 'string' || !data.name)) return { name, version, sourcePath: resolve(sourcePath), marketplace: '' }
    let marketplace = data ? data.name ?? '' : 'pluxx-local'
    if (consumer) {
      const home = process.env.HOME ?? '~'
      const cache = resolve(process.env.CODEX_HOME ?? resolve(home, '.codex'), 'plugins/cache')
      const parts = relative(cache, resolve(sourcePath)).split('/')
      if (parts.length === 3 && parts[1] === name && parts[0] !== '..') marketplace = parts[0]
      else if (resolve(sourcePath) !== resolve(home, '.codex/plugins', name)) {
        marketplace = undefined
        const canonical = (p: string) => { try { return realpathSync(p) } catch { return resolve(p) } }
        const matches = (data?.plugins ?? []).filter((entry: any) => entry.name === name && entry.source?.source === 'local'
          && typeof entry.source.path === 'string' && canonical(resolve(home, entry.source.path)) === canonical(sourcePath))
        if (matches.length === 1) marketplace = data.name
      }
    }
    return { name, version, sourcePath: resolve(sourcePath), marketplace }
  } catch { return { name, version, sourcePath: resolve(sourcePath), marketplace: '' } }
}

export class CodexPluginCollisionError extends Error {
  readonly result: { target: 'codex'; state: 'failed'; reason: string; error: string; action: string; diagnostics: CodexPluginDiagnostic[] }
  constructor(diagnostic: CodexPluginDiagnostic) {
    super(renderCodexPluginDiagnostic(diagnostic))
    this.name = 'CodexPluginCollisionError'
    this.result = { target: 'codex', state: 'failed', reason: diagnostic.code, error: diagnostic.error, action: diagnostic.action, diagnostics: [diagnostic] }
  }
}
