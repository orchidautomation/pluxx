import { accessSync, constants, existsSync, statSync } from 'fs'
import { delimiter, resolve } from 'path'
import { homedir } from 'os'
import type { TargetPlatform } from './schema'
import { CORE_FOUR_PLATFORMS, type CoreFourPlatform } from './validation/platform-rules'

export const CORE_HOST_FAMILIES = CORE_FOUR_PLATFORMS

export type HostDetectionEvidenceType =
  | 'cli'
  | 'app'
  | 'user-config'
  | 'project-config'
  | 'installed-plugin'

export interface HostDetectionEvidence {
  type: HostDetectionEvidenceType
  label: string
  path?: string
  command?: string
}

export interface HostDetectionResult {
  host: CoreFourPlatform
  detected: boolean
  evidence: HostDetectionEvidence[]
}

export interface HostDetectionReport {
  hosts: HostDetectionResult[]
  detectedHosts: CoreFourPlatform[]
}

export interface HostDetectionOptions {
  rootDir?: string
  homeDir?: string
  pathEnv?: string
  appDirs?: string[]
  platform?: NodeJS.Platform
  hosts?: readonly CoreFourPlatform[]
}

export interface HostTargetSelection {
  source: 'explicit-targets' | 'config-targets'
  selectedTargets: TargetPlatform[]
  detectedHosts: CoreFourPlatform[]
  suggestedTargets: CoreFourPlatform[]
  explicitOverride: boolean
  note: string
}

interface HostEvidenceCandidate {
  type: HostDetectionEvidenceType
  label: string
  path?: (context: HostDetectionContext) => string
  command?: string
}

interface HostDetectionContext {
  rootDir: string
  homeDir: string
  pathEnv: string
  appDirs: string[]
  platform: NodeJS.Platform
}

const HOST_EVIDENCE: Record<CoreFourPlatform, HostEvidenceCandidate[]> = {
  'claude-code': [
    { type: 'cli', label: 'Claude Code CLI', command: 'claude' },
    { type: 'user-config', label: 'Claude user config', path: ({ homeDir }) => resolve(homeDir, '.claude.json') },
    { type: 'user-config', label: 'Claude settings directory', path: ({ homeDir }) => resolve(homeDir, '.claude/settings.json') },
    { type: 'project-config', label: 'Claude project MCP config', path: ({ rootDir }) => resolve(rootDir, '.mcp.json') },
    { type: 'project-config', label: 'Claude project settings', path: ({ rootDir }) => resolve(rootDir, '.claude/settings.json') },
    { type: 'installed-plugin', label: 'Claude plugin cache', path: ({ homeDir }) => resolve(homeDir, '.claude/plugins/cache') },
    { type: 'installed-plugin', label: 'Legacy Claude plugin directory', path: ({ homeDir }) => resolve(homeDir, '.claude/plugins') },
  ],
  cursor: [
    { type: 'cli', label: 'Cursor CLI', command: 'cursor' },
    { type: 'cli', label: 'Cursor agent CLI', command: 'cursor-agent' },
    { type: 'app', label: 'Cursor app bundle', path: ({ appDirs }) => resolveFirstAppPath(appDirs, 'Cursor.app') },
    { type: 'user-config', label: 'Cursor user MCP config', path: ({ homeDir }) => resolve(homeDir, '.cursor/mcp.json') },
    { type: 'user-config', label: 'Cursor user settings', path: ({ homeDir }) => resolve(homeDir, '.cursor/settings.json') },
    { type: 'project-config', label: 'Cursor project MCP config', path: ({ rootDir }) => resolve(rootDir, '.cursor/mcp.json') },
    { type: 'project-config', label: 'Cursor project rules', path: ({ rootDir }) => resolve(rootDir, '.cursor/rules') },
    { type: 'project-config', label: 'Cursor root MCP config', path: ({ rootDir }) => resolve(rootDir, 'mcp.json') },
    { type: 'installed-plugin', label: 'Cursor local plugins', path: ({ homeDir }) => resolve(homeDir, '.cursor/plugins/local') },
  ],
  codex: [
    { type: 'cli', label: 'Codex CLI', command: 'codex' },
    { type: 'app', label: 'Codex app bundle', path: ({ appDirs }) => resolveFirstAppPath(appDirs, 'Codex.app') },
    { type: 'user-config', label: 'Codex user config', path: ({ homeDir }) => resolve(homeDir, '.codex/config.toml') },
    { type: 'project-config', label: 'Codex project config', path: ({ rootDir }) => resolve(rootDir, '.codex/config.toml') },
    { type: 'project-config', label: 'Codex project agents', path: ({ rootDir }) => resolve(rootDir, '.codex/agents') },
    { type: 'installed-plugin', label: 'Codex local plugins', path: ({ homeDir }) => resolve(homeDir, '.codex/plugins') },
    { type: 'installed-plugin', label: 'Codex local marketplace catalog', path: ({ homeDir }) => resolve(homeDir, '.agents/plugins/marketplace.json') },
  ],
  opencode: [
    { type: 'cli', label: 'OpenCode CLI', command: 'opencode' },
    { type: 'user-config', label: 'OpenCode user config', path: ({ homeDir }) => resolve(homeDir, '.config/opencode/opencode.json') },
    { type: 'project-config', label: 'OpenCode project config', path: ({ rootDir }) => resolve(rootDir, 'opencode.json') },
    { type: 'project-config', label: 'OpenCode alternate project config', path: ({ rootDir }) => resolve(rootDir, '.opencode.json') },
    { type: 'project-config', label: 'OpenCode project directory', path: ({ rootDir }) => resolve(rootDir, '.opencode') },
    { type: 'installed-plugin', label: 'OpenCode local plugins', path: ({ homeDir }) => resolve(homeDir, '.config/opencode/plugins') },
    { type: 'installed-plugin', label: 'OpenCode synced skills', path: ({ homeDir }) => resolve(homeDir, '.config/opencode/skills') },
  ],
}

export function detectHostFamilies(options: HostDetectionOptions = {}): HostDetectionReport {
  const context: HostDetectionContext = {
    rootDir: options.rootDir ?? process.cwd(),
    homeDir: options.homeDir ?? homedir(),
    pathEnv: options.pathEnv ?? process.env.PATH ?? '',
    appDirs: options.appDirs ?? defaultAppDirs(options.homeDir ?? homedir()),
    platform: options.platform ?? process.platform,
  }
  const hostSet = new Set(options.hosts ?? CORE_HOST_FAMILIES)
  const hosts = CORE_HOST_FAMILIES
    .filter((host) => hostSet.has(host))
    .map((host) => detectHostFamily(host, context))

  return {
    hosts,
    detectedHosts: hosts.filter((host) => host.detected).map((host) => host.host),
  }
}

export function buildHostTargetSelection(
  configTargets: TargetPlatform[],
  explicitTargets: TargetPlatform[] | undefined,
  report: HostDetectionReport,
): HostTargetSelection {
  const selectedTargets = explicitTargets ?? configTargets
  const configCoreTargets = configTargets.filter(isCoreHostFamily)
  const suggestedTargets = report.detectedHosts.filter((host) => configCoreTargets.includes(host))
  const explicitOverride = explicitTargets !== undefined

  return {
    source: explicitOverride ? 'explicit-targets' : 'config-targets',
    selectedTargets,
    detectedHosts: report.detectedHosts,
    suggestedTargets,
    explicitOverride,
    note: explicitOverride
      ? 'Explicit --target selection is authoritative; host detection did not change selected targets.'
      : 'Host detection is informational; install targets still come from pluxx.config targets.',
  }
}

function detectHostFamily(host: CoreFourPlatform, context: HostDetectionContext): HostDetectionResult {
  const evidence = HOST_EVIDENCE[host]
    .map((candidate) => resolveEvidence(candidate, context))
    .filter((item): item is HostDetectionEvidence => item !== undefined)

  return {
    host,
    detected: evidence.some(isMachineLevelEvidence),
    evidence,
  }
}

function isMachineLevelEvidence(evidence: HostDetectionEvidence): boolean {
  return evidence.type !== 'project-config'
}

function resolveEvidence(
  candidate: HostEvidenceCandidate,
  context: HostDetectionContext,
): HostDetectionEvidence | undefined {
  if (candidate.command) {
    const commandPath = findExecutable(candidate.command, context.pathEnv, context.platform)
    if (!commandPath) return undefined
    return {
      type: candidate.type,
      label: candidate.label,
      command: candidate.command,
      path: commandPath,
    }
  }

  if (!candidate.path) return undefined
  const evidencePath = candidate.path(context)
  if (!evidencePath || !existsSync(evidencePath)) return undefined

  return {
    type: candidate.type,
    label: candidate.label,
    path: evidencePath,
  }
}

function findExecutable(command: string, pathEnv: string, platform: NodeJS.Platform): string | undefined {
  if (!pathEnv.trim()) return undefined

  const names = platform === 'win32'
    ? [command, `${command}.exe`, `${command}.cmd`, `${command}.bat`]
    : [command]

  for (const dir of pathEnv.split(delimiter).filter(Boolean)) {
    for (const name of names) {
      const candidate = resolve(dir, name)
      if (isExecutableFile(candidate, platform)) return candidate
    }
  }

  return undefined
}

function isExecutableFile(path: string, platform: NodeJS.Platform): boolean {
  try {
    if (!statSync(path).isFile()) return false
    if (platform === 'win32') return true
    accessSync(path, constants.X_OK)
    return true
  } catch {
    return false
  }
}

function defaultAppDirs(homeDir: string): string[] {
  return [
    '/Applications',
    resolve(homeDir, 'Applications'),
  ]
}

function resolveFirstAppPath(appDirs: string[], appName: string): string {
  return appDirs.map((dir) => resolve(dir, appName)).find((path) => existsSync(path)) ?? resolve(appDirs[0] ?? '/', appName)
}

function isCoreHostFamily(target: TargetPlatform): target is CoreFourPlatform {
  return (CORE_HOST_FAMILIES as readonly TargetPlatform[]).includes(target)
}
