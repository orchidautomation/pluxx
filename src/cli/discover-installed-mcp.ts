import { existsSync, readFileSync, realpathSync } from 'fs'
import { homedir } from 'os'
import { isAbsolute, relative, resolve } from 'path'
import type { McpAuth, McpServer, PluginConfig, TargetPlatform } from '../schema'
import { buildNativeMcpPlatformOverrides } from '../mcp-native-overrides'
import { parseTomlValue, stripTomlComment } from '../toml-lite'

export const INSTALLED_MCP_HOSTS = ['claude-code', 'cursor', 'codex', 'opencode'] as const satisfies readonly TargetPlatform[]
export type InstalledMcpHost = typeof INSTALLED_MCP_HOSTS[number]

export interface DiscoveredInstalledMcpServer {
  id: string
  host: InstalledMcpHost
  serverName: string
  sourcePath: string
  sourceScope?: string
  server: McpServer
  warnings: string[]
  platformOverrides?: PluginConfig['platforms']
}

export interface DiscoverInstalledMcpOptions {
  rootDir?: string
  homeDir?: string
  hosts?: InstalledMcpHost[]
}

interface CommonMcpConfig {
  mcpServers?: Record<string, unknown> | string
  mcp?: Record<string, unknown>
  [key: string]: unknown
}

interface FileCandidate {
  host: InstalledMcpHost
  path: string
  parser: 'json' | 'toml'
}

interface JsonMcpEntry {
  serverName: string
  config: unknown
  sourceScope?: string
}

export function discoverInstalledMcpServers(options: DiscoverInstalledMcpOptions = {}): DiscoveredInstalledMcpServer[] {
  const rootDir = options.rootDir ?? process.cwd()
  const homeDir = options.homeDir ?? homedir()
  const hostSet = new Set(options.hosts ?? INSTALLED_MCP_HOSTS)
  const results: DiscoveredInstalledMcpServer[] = []
  const seen = new Set<string>()

  for (const candidate of installedMcpFileCandidates(rootDir, homeDir)) {
    if (!hostSet.has(candidate.host) || !existsSync(candidate.path)) continue

    const parsed = candidate.parser === 'json'
      ? parseJsonMcpFile(candidate.path, candidate.host, rootDir, homeDir)
      : parseCodexTomlMcpFile(candidate.path)

    for (const discovered of parsed) {
      const key = `${discovered.host}:${discovered.serverName}:${discovered.sourcePath}:${discovered.sourceScope ?? ''}`
      if (seen.has(key)) continue
      seen.add(key)
      results.push(discovered)
    }
  }

  const withStableIds = assignDiscoveredIds(results, rootDir, homeDir)

  return withStableIds.sort((a, b) => {
    const hostOrder = INSTALLED_MCP_HOSTS.indexOf(a.host) - INSTALLED_MCP_HOSTS.indexOf(b.host)
    if (hostOrder !== 0) return hostOrder
    return a.serverName.localeCompare(b.serverName)
  })
}

export function resolveInstalledMcpSelector(
  selector: string,
  candidates: DiscoveredInstalledMcpServer[],
): DiscoveredInstalledMcpServer {
  const trimmed = selector.trim()
  if (!trimmed) {
    throw new Error('Provide an installed MCP selector such as `exa` or `codex:exa`.')
  }

  const exactId = candidates.filter((candidate) => candidate.id === trimmed)
  if (exactId.length === 1) return exactId[0]

  const hostMatch = trimmed.match(/^([^:]+):(.+)$/)
  if (hostMatch) {
    const host = normalizeInstalledMcpHost(hostMatch[1])
    const serverName = hostMatch[2]
    const matches = candidates.filter((candidate) => candidate.host === host && candidate.serverName === serverName)
    if (matches.length === 1) return matches[0]
    if (matches.length > 1) {
      throw new Error(`Installed MCP selector "${trimmed}" matched multiple config files. Use one of: ${matches.map(match => match.id).join(', ')}`)
    }
  }

  const nameMatches = candidates.filter((candidate) => candidate.serverName === trimmed)
  if (nameMatches.length === 1) return nameMatches[0]
  if (nameMatches.length > 1) {
    throw new Error(`Installed MCP selector "${trimmed}" is ambiguous. Use one of: ${nameMatches.map(match => match.id).join(', ')}`)
  }

  const available = candidates.map((candidate) => candidate.id).join(', ') || 'none'
  throw new Error(`No installed MCP named "${trimmed}" was found. Available installed MCPs: ${available}`)
}

export function normalizeInstalledMcpHost(value: string): InstalledMcpHost {
  const normalized = value.trim().toLowerCase()
  const aliases: Record<string, InstalledMcpHost> = {
    claude: 'claude-code',
    'claude-code': 'claude-code',
    cursor: 'cursor',
    codex: 'codex',
    open: 'opencode',
    opencode: 'opencode',
  }
  const host = aliases[normalized]
  if (!host) {
    throw new Error(`Installed MCP host must be one of: ${INSTALLED_MCP_HOSTS.join(', ')}`)
  }
  return host
}

export function formatInstalledMcpSource(discovered: DiscoveredInstalledMcpServer): string {
  const transport = discovered.server.transport
  const endpoint = transport === 'stdio'
    ? [discovered.server.command, ...(discovered.server.args ?? [])].join(' ')
    : discovered.server.url
  return `${discovered.id} (${transport}: ${endpoint})`
}

function installedMcpFileCandidates(rootDir: string, homeDir: string): FileCandidate[] {
  return [
    { host: 'claude-code', path: resolve(rootDir, '.mcp.json'), parser: 'json' },
    { host: 'claude-code', path: resolve(rootDir, '.claude-plugin/plugin.json'), parser: 'json' },
    { host: 'claude-code', path: resolve(homeDir, '.claude.json'), parser: 'json' },
    { host: 'cursor', path: resolve(rootDir, 'mcp.json'), parser: 'json' },
    { host: 'cursor', path: resolve(rootDir, '.cursor/mcp.json'), parser: 'json' },
    { host: 'cursor', path: resolve(homeDir, '.cursor/mcp.json'), parser: 'json' },
    { host: 'codex', path: resolve(rootDir, '.mcp.json'), parser: 'json' },
    { host: 'codex', path: resolve(rootDir, '.codex/config.toml'), parser: 'toml' },
    { host: 'codex', path: resolve(homeDir, '.codex/config.toml'), parser: 'toml' },
    { host: 'opencode', path: resolve(rootDir, 'opencode.json'), parser: 'json' },
    { host: 'opencode', path: resolve(rootDir, '.opencode.json'), parser: 'json' },
    { host: 'opencode', path: resolve(homeDir, '.config/opencode/opencode.json'), parser: 'json' },
  ]
}

function parseJsonMcpFile(
  path: string,
  host: InstalledMcpHost,
  rootDir: string,
  homeDir: string,
): DiscoveredInstalledMcpServer[] {
  try {
    const raw = JSON.parse(readFileSync(path, 'utf-8')) as CommonMcpConfig
    const entries = extractJsonMcpEntries(raw, path, host, rootDir, homeDir)
    return entries.flatMap(({ serverName, config, sourceScope }) => {
      const normalized = normalizeCommonMcpServer(config, host)
      if (!normalized) return []
      const platformOverrides = buildNativeMcpPlatformOverrides(host, { [serverName]: config })
      return [toDiscovered(host, serverName, path, normalized.server, normalized.warnings, platformOverrides, sourceScope)]
    })
  } catch {
    return []
  }
}

function extractJsonMcpEntries(
  raw: CommonMcpConfig,
  path: string,
  host: InstalledMcpHost,
  rootDir: string,
  homeDir: string,
): JsonMcpEntry[] {
  const entries: JsonMcpEntry[] = []

  if (host === 'opencode' && raw.mcp && typeof raw.mcp === 'object') {
    entries.push(...toJsonMcpEntries(raw.mcp as Record<string, unknown>))
  }

  if (raw.mcpServers && typeof raw.mcpServers === 'object') {
    entries.push(...toJsonMcpEntries(raw.mcpServers as Record<string, unknown>))
  }

  // Claude user config (~/.claude.json) can carry local-scoped project MCP config
  // under absolute project keys inside `projects`.
  if (host === 'claude-code' && raw.projects && typeof raw.projects === 'object') {
    for (const [projectPath, projectConfig] of Object.entries(raw.projects as Record<string, unknown>)) {
      if (!projectConfig || typeof projectConfig !== 'object') continue
      const mcpServers = (projectConfig as CommonMcpConfig).mcpServers
      if (!mcpServers || typeof mcpServers !== 'object') continue
      const sourceScope = buildClaudeProjectSourceScope(projectPath, rootDir, homeDir)
      entries.push(...toJsonMcpEntries(mcpServers as Record<string, unknown>, sourceScope))
    }
  }

  // Avoid treating plugin manifests that only reference an external MCP file as inline config.
  if (typeof raw.mcpServers === 'string') return entries

  if (entries.length === 0 && (path.endsWith('mcp.json') || path.endsWith('.mcp.json'))) {
    entries.push(...toJsonMcpEntries(raw as Record<string, unknown>))
  }

  return entries
}

function toJsonMcpEntries(servers: Record<string, unknown>, sourceScope?: string): JsonMcpEntry[] {
  return Object.entries(servers).map(([serverName, config]) => ({
    serverName,
    config,
    ...(sourceScope ? { sourceScope } : {}),
  }))
}

function buildClaudeProjectSourceScope(projectPath: string, rootDir: string, homeDir: string): string {
  const rootRelative = buildRelativeScopePath(rootDir, projectPath)
  if (rootRelative) return `projects/${rootRelative}`

  const homeRelative = buildRelativeScopePath(homeDir, projectPath)
  if (homeRelative) return `projects/home/${homeRelative}`

  return `projects/absolute/${normalizeScopePath(projectPath)}`
}

function buildRelativeScopePath(baseDir: string, targetPath: string): string | undefined {
  const relativePath = relative(baseDir, targetPath)
  if (!relativePath.startsWith('..') && !isAbsolute(relativePath)) {
    return normalizeScopePath(relativePath)
  }

  if (!existsSync(baseDir) || !existsSync(targetPath)) return undefined

  try {
    const realRelativePath = relative(realpathSync(baseDir), realpathSync(targetPath))
    if (realRelativePath.startsWith('..') || isAbsolute(realRelativePath)) return undefined
    return normalizeScopePath(realRelativePath)
  } catch {
    return undefined
  }
}

function normalizeScopePath(value: string): string {
  const normalized = value.replace(/\\/g, '/').replace(/^\.\/+/, '').replace(/^\/+/, '')
  return normalized || 'root'
}

function parseCodexTomlMcpFile(path: string): DiscoveredInstalledMcpServer[] {
  const text = readFileSync(path, 'utf-8')
  const servers: Record<string, Record<string, unknown>> = {}
  let currentServer: string | undefined
  let currentSubtable: string | undefined

  for (const rawLine of text.split(/\r?\n/)) {
    const line = stripTomlComment(rawLine).trim()
    if (!line) continue

    const section = line.match(/^\[mcp_servers\.([A-Za-z0-9_.-]+)(?:\.([A-Za-z0-9_.-]+))?\]$/)
    if (section) {
      currentServer = section[1]
      currentSubtable = section[2]
      servers[currentServer] ??= {}
      if (currentSubtable) {
        const existing = servers[currentServer][currentSubtable]
        if (!existing || typeof existing !== 'object' || Array.isArray(existing)) {
          servers[currentServer][currentSubtable] = {}
        }
      }
      continue
    }

    if (!currentServer) continue
    const assignment = line.match(/^([A-Za-z0-9_-]+)\s*=\s*(.+)$/)
    if (!assignment) continue

    const key = assignment[1]
    const value = parseTomlValue(assignment[2].trim())
    if (currentSubtable) {
      const table = servers[currentServer][currentSubtable] as Record<string, unknown>
      table[key] = value
    } else {
      servers[currentServer][key] = value
    }
  }

  return Object.entries(servers).flatMap(([serverName, config]) => {
    const normalized = normalizeCommonMcpServer(config, 'codex')
    if (!normalized) return []
    const platformOverrides = buildNativeMcpPlatformOverrides('codex', { [serverName]: config })
    return [toDiscovered('codex', serverName, path, normalized.server, normalized.warnings, platformOverrides)]
  })
}

function normalizeCommonMcpServer(
  config: unknown,
  host: InstalledMcpHost,
): { server: McpServer; warnings: string[] } | null {
  if (!config || typeof config !== 'object') return null
  const cfg = config as Record<string, unknown>
  const warnings: string[] = []
  const auth = inferAuth(cfg, warnings)

  const remoteUrl = firstString(cfg.url, cfg.endpoint)
  if (remoteUrl) {
    const server: McpServer = cfg.type === 'sse' || cfg.transport === 'sse'
      ? {
          transport: 'sse',
          url: remoteUrl,
          ...(auth ? { auth } : {}),
        }
      : {
          transport: 'http',
          url: remoteUrl,
          ...(auth ? { auth } : {}),
        }
    return { server, warnings }
  }

  const command = normalizeCommand(cfg.command, host)
  if (!command) return null

  const args = normalizeArgs(cfg.command, cfg.args, host)
  const env = normalizeEnv(cfg.env, warnings)
  return {
    server: {
      transport: 'stdio',
      command,
      ...(args.length > 0 ? { args } : {}),
      ...(Object.keys(env).length > 0 ? { env } : {}),
      ...(auth ? { auth } : {}),
    } satisfies McpServer,
    warnings,
  }
}

function normalizeCommand(value: unknown, host: InstalledMcpHost): string | undefined {
  if (typeof value === 'string') return value
  if (host === 'opencode' && Array.isArray(value) && typeof value[0] === 'string') {
    return value[0]
  }
  return undefined
}

function normalizeArgs(command: unknown, args: unknown, host: InstalledMcpHost): string[] {
  if (host === 'opencode' && Array.isArray(command)) {
    return command.slice(1).map(String)
  }
  return normalizeStringArray(args)
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.map(String)
}

function normalizeEnv(value: unknown, warnings: string[]): Record<string, string> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}

  const env: Record<string, string> = {}
  for (const [key, rawValue] of Object.entries(value as Record<string, unknown>)) {
    if (typeof rawValue !== 'string') continue
    const placeholder = envPlaceholder(rawValue)
    if (placeholder) {
      env[key] = placeholder
      continue
    }
    if (looksSecretKey(key)) {
      env[key] = `\${${key}}`
      warnings.push(`Literal secret-like env value for ${key} was replaced with \${${key}}.`)
      continue
    }
    env[key] = rawValue
  }
  return env
}

function inferAuth(cfg: Record<string, unknown>, warnings: string[]): McpAuth | undefined {
  const bearerTokenEnv = firstString(cfg.bearer_token_env_var, cfg.bearerTokenEnvVar)
  if (bearerTokenEnv) {
    return {
      type: 'bearer',
      envVar: bearerTokenEnv,
      headerName: 'Authorization',
      headerTemplate: 'Bearer ${value}',
    }
  }

  const envHttpHeaders = cfg.env_http_headers ?? cfg.envHttpHeaders
  if (envHttpHeaders && typeof envHttpHeaders === 'object' && !Array.isArray(envHttpHeaders)) {
    const [headerName, envVar] = Object.entries(envHttpHeaders as Record<string, unknown>)
      .find(([, value]) => typeof value === 'string') ?? []
    if (typeof headerName === 'string' && typeof envVar === 'string') {
      return {
        type: headerName.toLowerCase() === 'authorization' ? 'bearer' : 'header',
        envVar,
        headerName,
        headerTemplate: headerName.toLowerCase() === 'authorization' ? 'Bearer ${value}' : '${value}',
      }
    }
  }

  const headers = cfg.headers ?? cfg.http_headers ?? cfg.httpHeaders
  if (!headers || typeof headers !== 'object' || Array.isArray(headers)) return undefined

  const headerEntries = Object.entries(headers as Record<string, unknown>)
  for (const [headerName, rawValue] of headerEntries) {
    if (typeof rawValue !== 'string') continue
    const envVar = extractEnvVar(rawValue)
    if (envVar) {
      return {
        type: headerName.toLowerCase() === 'authorization' ? 'bearer' : 'header',
        envVar,
        headerName,
        headerTemplate: rawValue.replace(envReferencePattern(envVar), '${value}'),
      }
    }
    if (looksSecretValue(rawValue)) {
      warnings.push(`Literal ${headerName} header value was not copied. Re-run init with --auth-env if this server needs auth.`)
    }
  }

  return undefined
}

function toDiscovered(
  host: InstalledMcpHost,
  serverName: string,
  sourcePath: string,
  server: McpServer,
  warnings: string[],
  platformOverrides?: PluginConfig['platforms'],
  sourceScope?: string,
): DiscoveredInstalledMcpServer {
  return {
    id: `${host}:${serverName}`,
    host,
    serverName,
    sourcePath,
    ...(sourceScope ? { sourceScope } : {}),
    server,
    warnings,
    ...(platformOverrides ? { platformOverrides } : {}),
  }
}

function assignDiscoveredIds(
  discovered: DiscoveredInstalledMcpServer[],
  rootDir: string,
  homeDir: string,
): DiscoveredInstalledMcpServer[] {
  const groups = new Map<string, DiscoveredInstalledMcpServer[]>()

  for (const server of discovered) {
    const key = `${server.host}:${server.serverName}`
    groups.set(key, [...(groups.get(key) ?? []), server])
  }

  return discovered.map((server) => {
    const baseId = `${server.host}:${server.serverName}`
    const group = groups.get(baseId) ?? []
    if (group.length <= 1) return server

    const sourceLabel = buildInstalledMcpSourceLabel(server, rootDir, homeDir)
    return {
      ...server,
      id: `${baseId}@${sourceLabel}`,
    }
  })
}

function buildInstalledMcpSourceLabel(
  discovered: Pick<DiscoveredInstalledMcpServer, 'sourcePath' | 'sourceScope'>,
  rootDir: string,
  homeDir: string,
): string {
  const projectRelative = buildRelativeSelectorLabel('project', rootDir, discovered.sourcePath)
  if (projectRelative) return discovered.sourceScope ? `${projectRelative}:${discovered.sourceScope}` : projectRelative

  const userRelative = buildRelativeSelectorLabel('user', homeDir, discovered.sourcePath)
  if (userRelative) return discovered.sourceScope ? `${userRelative}:${discovered.sourceScope}` : userRelative

  const base = `file:${discovered.sourcePath}`
  return discovered.sourceScope ? `${base}:${discovered.sourceScope}` : base
}

function buildRelativeSelectorLabel(prefix: 'project' | 'user', baseDir: string, sourcePath: string): string | undefined {
  const relativePath = relative(baseDir, sourcePath)
  if (relativePath === '') return `${prefix}:.`
  if (relativePath.startsWith('..') || isAbsolute(relativePath)) return undefined
  return `${prefix}:${relativePath.replace(/\\/g, '/')}`
}

function firstString(...values: unknown[]): string | undefined {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim()
  }
  return undefined
}

function envPlaceholder(value: string): string | undefined {
  const envVar = extractEnvVar(value)
  return envVar ? `\${${envVar}}` : undefined
}

function extractEnvVar(value: string): string | undefined {
  const match = value.match(/\$\{(?:env:)?([A-Za-z_][A-Za-z0-9_]*)\}|\$([A-Za-z_][A-Za-z0-9_]*)/)
  return match?.[1] ?? match?.[2]
}

function envReferencePattern(envVar: string): RegExp {
  return new RegExp(`\\$\\{(?:env:)?${escapeRegExp(envVar)}\\}|\\$${escapeRegExp(envVar)}`)
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function looksSecretKey(value: string): boolean {
  return /(api|auth|secret|token|key|password|credential)/i.test(value)
}

function looksSecretValue(value: string): boolean {
  return value.length >= 16 && !extractEnvVar(value)
}
