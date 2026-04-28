import type { McpServer, PluginConfig, TargetPlatform, UserConfigEntry } from './schema'

export interface ResolvedUserConfigEntry {
  field: UserConfigEntry
  value: string | number | boolean
  envVar?: string
}

interface DerivedUserConfigEntry extends UserConfigEntry {
  source: 'explicit' | 'mcp-auth' | 'mcp-env'
}

const ENV_VAR_NAME = /^[A-Za-z_][A-Za-z0-9_]*$/
const PLACEHOLDER_SECRET_PATTERNS = [
  /\bdummy\b/i,
  /\bplaceholder\b/i,
  /\bexample\b/i,
  /\bchangeme\b/i,
  /\breplace[_ -]?me\b/i,
  /\byour[_ -]?(api[_ -]?)?key\b/i,
  /\bapi[_ -]?key[_ -]?here\b/i,
  /\btoken[_ -]?here\b/i,
]

export function normalizeUserConfigKey(value: string): string {
  return value
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1-$2')
    .replace(/[._/\s]+/g, '-')
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export function humanizeUserConfigLabel(value: string): string {
  return value
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .replace(/[._/]+/g, ' ')
    .replace(/-/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ')
}

export function defaultUserConfigEnvVar(key: string): string {
  return key
    .replace(/[^A-Za-z0-9]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toUpperCase()
}

export function extractEnvReference(value: string | undefined): string | undefined {
  if (!value) return undefined
  const match = value.match(/^\$\{([A-Za-z_][A-Za-z0-9_]*)\}$/)
  return match?.[1]
}

export function isPlaceholderSecretValue(value: unknown): boolean {
  if (typeof value !== 'string') return false
  const normalized = value.trim()
  if (normalized === '') return false
  return PLACEHOLDER_SECRET_PATTERNS.some((pattern) => pattern.test(normalized))
}

function isRuntimePlatformManaged(config: PluginConfig, target: TargetPlatform, server: McpServer): boolean {
  if (server.transport === 'stdio') return false

  if (server.auth?.type === 'platform') {
    return true
  }

  if (target === 'claude-code') {
    return config.platforms?.['claude-code']?.mcpAuth === 'platform'
  }

  if (target === 'cursor') {
    return config.platforms?.cursor?.mcpAuth === 'platform'
  }

  return false
}

function targetApplies(entry: UserConfigEntry, target: TargetPlatform): boolean {
  return !entry.targets || entry.targets.includes(target)
}

function dedupeUserConfigEntries(entries: DerivedUserConfigEntry[]): DerivedUserConfigEntry[] {
  const deduped: DerivedUserConfigEntry[] = []
  const seenKeys = new Set<string>()
  const seenEnvVars = new Set<string>()

  for (const entry of entries) {
    const envVar = entry.envVar?.trim()

    if (seenKeys.has(entry.key)) continue
    if (envVar && seenEnvVars.has(envVar)) continue

    deduped.push(entry)
    seenKeys.add(entry.key)
    if (envVar) seenEnvVars.add(envVar)
  }

  return deduped
}

export function collectUserConfigEntries(
  config: PluginConfig,
  platforms: TargetPlatform[] = config.targets,
): DerivedUserConfigEntry[] {
  const explicitEntries = (config.userConfig ?? [])
    .filter((entry) => !entry.targets || entry.targets.some((target) => platforms.includes(target)))
    .map((entry) => ({ ...entry, source: 'explicit' as const }))

  const derivedEntries: DerivedUserConfigEntry[] = []

  for (const [serverName, server] of Object.entries(config.mcp ?? {})) {
    const applicableTargets = platforms.filter((target) => !isRuntimePlatformManaged(config, target, server))

    if (
      server.auth?.type
      && server.auth.type !== 'none'
      && server.auth.type !== 'platform'
      && ENV_VAR_NAME.test(server.auth.envVar)
      && applicableTargets.length > 0
    ) {
      derivedEntries.push({
        key: normalizeUserConfigKey(server.auth.envVar),
        title: humanizeUserConfigLabel(server.auth.envVar),
        description: `Authentication credential for the ${serverName} MCP server.`,
        type: 'secret',
        required: true,
        envVar: server.auth.envVar,
        targets: applicableTargets,
        source: 'mcp-auth',
      })
    }

    if (server.transport === 'stdio') {
      for (const [key, rawValue] of Object.entries(server.env ?? {})) {
        const envVar = extractEnvReference(rawValue) ?? (ENV_VAR_NAME.test(key) ? key : undefined)
        if (!envVar || !ENV_VAR_NAME.test(envVar)) continue

        // Skip constant stdio env values that do not need install-time input.
        if (extractEnvReference(rawValue) === undefined && rawValue !== '') {
          continue
        }

        derivedEntries.push({
          key: normalizeUserConfigKey(envVar),
          title: humanizeUserConfigLabel(envVar),
          description: `Environment value required to launch the ${serverName} stdio MCP server.`,
          type: 'secret',
          required: true,
          envVar,
          targets: applicableTargets.length > 0 ? applicableTargets : platforms,
          source: 'mcp-env',
        })
      }
    }
  }

  return dedupeUserConfigEntries([
    ...explicitEntries,
    ...derivedEntries,
  ])
}

export function resolveUserConfigEntriesForTarget(
  entries: ResolvedUserConfigEntry[],
  target: TargetPlatform,
): ResolvedUserConfigEntry[] {
  return entries.filter(({ field }) => targetApplies(field, target))
}

export function buildUserConfigEnvMap(entries: ResolvedUserConfigEntry[]): Record<string, string> {
  const env: Record<string, string> = {}
  for (const entry of entries) {
    if (!entry.envVar) continue
    env[entry.envVar] = String(entry.value)
  }
  return env
}

export function buildUserConfigValueMap(entries: ResolvedUserConfigEntry[]): Record<string, string | number | boolean> {
  const values: Record<string, string | number | boolean> = {}
  for (const entry of entries) {
    values[entry.field.key] = entry.value
  }
  return values
}
