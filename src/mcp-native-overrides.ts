import type { PluginConfig, TargetPlatform, UserConfigEntry } from './schema'
import { defaultUserConfigEnvVar } from './user-config'

type JsonRecord = Record<string, unknown>
type NativeMcpServerOverrides = Record<string, Record<string, unknown>>
type NativeMcpPlatformOverrides = Partial<Record<TargetPlatform, { mcpServers: NativeMcpServerOverrides }>>

function asRecord(value: unknown): JsonRecord | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined
  return value as JsonRecord
}

function cloneRecord<T extends JsonRecord>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

function firstString(...values: unknown[]): string | undefined {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim()
  }
  return undefined
}

function readStringRecord(value: unknown): Record<string, string> | undefined {
  const record = asRecord(value)
  if (!record) return undefined

  const stringRecord = Object.fromEntries(
    Object.entries(record).filter(([, entryValue]) => typeof entryValue === 'string'),
  ) as Record<string, string>

  return Object.keys(stringRecord).length > 0 ? stringRecord : undefined
}

export function extractNativeMcpAuthConfig(cfg: Record<string, unknown>): Record<string, unknown> | undefined {
  const preserved: Record<string, unknown> = {}

  const auth = asRecord(cfg.auth)
  if (auth) preserved.auth = cloneRecord(auth)

  const bearerTokenEnv = firstString(cfg.bearer_token_env_var, cfg.bearerTokenEnvVar)
  if (typeof cfg.bearer_token_env_var === 'string') {
    preserved.bearer_token_env_var = cfg.bearer_token_env_var
  } else if (typeof cfg.bearerTokenEnvVar === 'string' && bearerTokenEnv) {
    preserved.bearerTokenEnvVar = bearerTokenEnv
  }

  for (const key of ['env_http_headers', 'envHttpHeaders', 'headers', 'http_headers', 'httpHeaders'] as const) {
    const value = asRecord(cfg[key])
    if (value) {
      preserved[key] = cloneRecord(value)
    }
  }

  return Object.keys(preserved).length > 0 ? preserved : undefined
}

export function buildNativeMcpPlatformOverrides(
  platform: TargetPlatform,
  servers: Record<string, unknown>,
): NativeMcpPlatformOverrides | undefined {
  const preservedServers: NativeMcpServerOverrides = {}

  for (const [serverName, rawConfig] of Object.entries(servers)) {
    const cfg = asRecord(rawConfig)
    if (!cfg) continue
    const nativeAuth = extractNativeMcpAuthConfig(cfg)
    if (!nativeAuth) continue
    preservedServers[serverName] = nativeAuth
  }

  if (Object.keys(preservedServers).length === 0) return undefined

  return {
    [platform]: {
      mcpServers: preservedServers,
    },
  }
}

function extractEnvVar(value: string): string | undefined {
  const match = value.match(/\$\{(?:env:)?([A-Za-z_][A-Za-z0-9_]*)\}|\$([A-Za-z_][A-Za-z0-9_]*)/)
  return match?.[1] ?? match?.[2]
}

function envVarToKey(envVar: string): string {
  return envVar.toLowerCase().replace(/_/g, '-')
}

export function getNativeMcpServerOverride(
  config: PluginConfig,
  platform: TargetPlatform,
  serverName: string,
): JsonRecord | undefined {
  const platformConfig = asRecord((config.platforms as JsonRecord | undefined)?.[platform])
  const mcpServers = asRecord(platformConfig?.mcpServers)
  const serverOverride = asRecord(mcpServers?.[serverName])
  return serverOverride ? cloneRecord(serverOverride) : undefined
}

export function getNativeJsonHeadersOverride(
  config: PluginConfig,
  platform: TargetPlatform,
  serverName: string,
): Record<string, string> | undefined {
  const override = getNativeMcpServerOverride(config, platform, serverName)
  return readStringRecord(override?.headers)
}

export function getNativeCodexMcpEntryOverride(
  config: PluginConfig,
  serverName: string,
): JsonRecord | undefined {
  const override = getNativeMcpServerOverride(config, 'codex', serverName)
  if (!override) return undefined

  const entry: JsonRecord = {}
  const bearerTokenEnv = firstString(override.bearer_token_env_var, override.bearerTokenEnvVar)
  if (bearerTokenEnv) entry.bearer_token_env_var = bearerTokenEnv

  const envHttpHeaders = readStringRecord(override.env_http_headers ?? override.envHttpHeaders)
  if (envHttpHeaders) entry.env_http_headers = envHttpHeaders

  const httpHeaders = readStringRecord(override.http_headers ?? override.httpHeaders)
  if (httpHeaders) entry.http_headers = httpHeaders

  const auth = asRecord(override.auth)
  if (auth) entry.auth = cloneRecord(auth)

  return Object.keys(entry).length > 0 ? entry : undefined
}

export function collectNativeMcpAuthUserConfigEntries(
  config: PluginConfig,
  platforms: TargetPlatform[],
  existingFields: UserConfigEntry[],
): UserConfigEntry[] {
  const next: UserConfigEntry[] = []
  const seenKeys = new Set(existingFields.map((field) => field.key))
  const seenEnvVars = new Set(
    existingFields.map((field) => field.envVar ?? defaultUserConfigEnvVar(field.key)),
  )

  const pushDerived = (envVar: string, platform: TargetPlatform, serverName: string) => {
    if (!envVar || seenEnvVars.has(envVar)) return

    const key = envVarToKey(envVar)
    if (seenKeys.has(key)) return

    seenEnvVars.add(envVar)
    seenKeys.add(key)
    next.push({
      key,
      title: envVar,
      description: `Derived from native ${platform} MCP auth for ${serverName}.`,
      type: 'secret',
      required: true,
      envVar,
      targets: [platform],
    })
  }

  for (const platform of platforms) {
    const platformConfig = asRecord((config.platforms as JsonRecord | undefined)?.[platform])
    const mcpServers = asRecord(platformConfig?.mcpServers)
    if (!mcpServers) continue

    for (const [serverName, rawOverride] of Object.entries(mcpServers)) {
      const override = asRecord(rawOverride)
      if (!override) continue

      const bearerTokenEnv = firstString(override.bearer_token_env_var, override.bearerTokenEnvVar)
      if (bearerTokenEnv) pushDerived(bearerTokenEnv, platform, serverName)

      for (const record of [
        readStringRecord(override.env_http_headers ?? override.envHttpHeaders),
        readStringRecord(override.headers),
        readStringRecord(override.http_headers ?? override.httpHeaders),
      ]) {
        for (const value of Object.values(record ?? {})) {
          const envVar = extractEnvVar(value) ?? value
          pushDerived(envVar, platform, serverName)
        }
      }
    }
  }

  return next
}
