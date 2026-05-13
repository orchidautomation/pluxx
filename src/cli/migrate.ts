import { basename, dirname, relative, resolve } from 'path'
import { existsSync, readdirSync, mkdirSync, cpSync, readFileSync, writeFileSync } from 'fs'
import {
  MCP_SCAFFOLD_METADATA_PATH,
  MCP_TAXONOMY_PATH,
  type McpScaffoldMetadata,
  type PersistedSkill,
} from './init-from-mcp'
import type { HookEntry, McpServer, PluginConfig } from '../schema'
import {
  PLUXX_COMPILER_INTENT_PATH,
  type CompilerIntentFile,
  type CompilerIntentSkillPolicy,
} from '../compiler-intent'
import { getCanonicalSkillMetadata, parseSkillMarkdown, readCanonicalSkillFiles, serializeSkillMarkdown } from '../skills'
import { buildNativeMcpPlatformOverrides } from '../mcp-native-overrides'
import { parseTomlValue, stripTomlComment } from '../toml-lite'
import { writeTextFile } from '../text-files'

type DetectedPlatform = 'claude-code' | 'cursor' | 'codex' | 'opencode'

interface DetectionResult {
  platform: DetectedPlatform
  manifestPath?: string
}

interface ParsedManifest {
  name?: string
  version?: string
  description?: string
  author?: { name: string; url?: string; email?: string }
  repository?: string
  license?: string
  keywords?: string[]
  brand?: Record<string, unknown>
  platforms?: Record<string, Record<string, unknown>>
}

interface ParsedMcp {
  [serverName: string]: {
    url?: string
    transport?: 'http' | 'sse' | 'stdio'
    command?: string
    args?: string[]
    env?: Record<string, string>
    auth?: {
      type: 'bearer' | 'header' | 'none' | 'platform'
      envVar?: string
      headerName?: string
      headerTemplate?: string
      mode?: 'oauth'
    }
    warnings?: string[]
  }
}

interface ParsedHooks {
  [event: string]: HookEntry[]
}

interface CanonicalSourcePaths {
  skills?: string
  commands?: string
  agents?: string
  scripts?: string
  assets?: string
}

interface MigrateResult {
  platform: DetectedPlatform
  manifest: ParsedManifest
  mcp: ParsedMcp
  runtimeAuthMode: 'inline' | 'platform'
  hooks: ParsedHooks
  permissions?: {
    allow?: string[]
    ask?: string[]
    deny?: string[]
  }
  permissionNotes: string[]
  passthrough: string[]
  instructions?: string
  sourcePaths: CanonicalSourcePaths
  persistedSkills: PersistedSkill[]
  compilerIntent?: CompilerIntentFile
  warnings: string[]
  extraCopyPaths: string[]
}

// ── Platform Detection ──────────────────────────────────────────

function detectPlatform(pluginDir: string): DetectionResult | null {
  const checks: Array<{ dir: string; platform: DetectedPlatform }> = [
    { dir: '.claude-plugin', platform: 'claude-code' },
    { dir: '.cursor-plugin', platform: 'cursor' },
    { dir: '.codex-plugin', platform: 'codex' },
  ]

  for (const check of checks) {
    const manifestPath = resolve(pluginDir, check.dir, 'plugin.json')
    if (existsSync(manifestPath)) {
      return { platform: check.platform, manifestPath }
    }
  }

  // Check for OpenCode (package.json with @opencode-ai/plugin)
  const pkgPath = resolve(pluginDir, 'package.json')
  if (existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'))
      const deps = {
        ...pkg.dependencies,
        ...pkg.devDependencies,
        ...pkg.peerDependencies,
      }
      if (deps && '@opencode-ai/plugin' in deps) {
        return { platform: 'opencode', manifestPath: pkgPath }
      }
    } catch {
      // not valid JSON, skip
    }
  }

  if (existsSync(resolve(pluginDir, 'CLAUDE.md'))) {
    return { platform: 'claude-code' }
  }

  return null
}

// ── Manifest Parsing ────────────────────────────────────────────

function parseManifest(detection: DetectionResult): ParsedManifest {
  if (!detection.manifestPath) {
    return {}
  }

  const raw = JSON.parse(readFileSync(detection.manifestPath, 'utf-8'))

  const result: ParsedManifest = {}
  const brand: Record<string, unknown> = {}
  const platforms: Record<string, Record<string, unknown>> = {}

  if (raw.name) result.name = raw.name
  if (raw.version) result.version = raw.version
  if (raw.description) result.description = raw.description
  if (raw.license) result.license = raw.license
  if (raw.keywords) result.keywords = raw.keywords
  if (raw.repository) {
    result.repository = typeof raw.repository === 'string'
      ? raw.repository
      : raw.repository?.url
  }

  if (raw.author) {
    if (typeof raw.author === 'string') {
      result.author = { name: raw.author }
    } else {
      result.author = {
        name: raw.author.name,
        ...(raw.author.url && { url: raw.author.url }),
        ...(raw.author.email && { email: raw.author.email }),
      }
    }
  }

  const homepage = typeof raw.homepage === 'string' ? raw.homepage : undefined
  if (homepage) brand.websiteURL = homepage
  if (typeof raw.icon === 'string') brand.icon = raw.icon
  if (typeof raw.logo === 'string') {
    brand.logo = raw.logo
    if (!brand.icon) brand.icon = raw.logo
  }

  const codexInterface = asRecord(raw.interface)
  if (codexInterface) {
    if (typeof codexInterface.displayName === 'string') brand.displayName = codexInterface.displayName
    if (typeof codexInterface.shortDescription === 'string') brand.shortDescription = codexInterface.shortDescription
    if (typeof codexInterface.longDescription === 'string') brand.longDescription = codexInterface.longDescription
    if (typeof codexInterface.category === 'string') brand.category = codexInterface.category
    if (typeof codexInterface.brandColor === 'string') brand.color = codexInterface.brandColor
    if (typeof codexInterface.composerIcon === 'string') brand.icon = codexInterface.composerIcon
    if (typeof codexInterface.logo === 'string') brand.logo = codexInterface.logo
    if (Array.isArray(codexInterface.defaultPrompt)) {
      const prompts = codexInterface.defaultPrompt.filter(value => typeof value === 'string')
      if (prompts.length > 0) brand.defaultPrompts = prompts
    }
    if (typeof codexInterface.websiteURL === 'string') brand.websiteURL = codexInterface.websiteURL
    if (typeof codexInterface.privacyPolicyURL === 'string') brand.privacyPolicyURL = codexInterface.privacyPolicyURL
    if (typeof codexInterface.termsOfServiceURL === 'string') brand.termsOfServiceURL = codexInterface.termsOfServiceURL
    if (Array.isArray(codexInterface.screenshots)) {
      const screenshots = codexInterface.screenshots.filter(value => typeof value === 'string')
      if (screenshots.length > 0) brand.screenshots = screenshots
    }

    const remainingInterface = Object.fromEntries(
      Object.entries(codexInterface).filter(([key]) => !new Set([
        'displayName',
        'shortDescription',
        'longDescription',
        'category',
        'brandColor',
        'composerIcon',
        'logo',
        'defaultPrompt',
        'websiteURL',
        'privacyPolicyURL',
        'termsOfServiceURL',
        'screenshots',
      ]).has(key)),
    )
    if (Object.keys(remainingInterface).length > 0) {
      platforms.codex = {
        ...(platforms.codex ?? {}),
        interface: remainingInterface,
      }
    }
  }

  if (detection.platform === 'cursor') {
    const marketplacePath = resolve(dirname(detection.manifestPath), 'marketplace.json')
    if (existsSync(marketplacePath)) {
      try {
        const marketplace = JSON.parse(readFileSync(marketplacePath, 'utf-8'))
        if (marketplace && typeof marketplace === 'object') {
          platforms.cursor = {
            ...(platforms.cursor ?? {}),
            marketplace,
          }
        }
      } catch {
        // ignore malformed marketplace metadata
      }
    }
  }

  if (detection.platform === 'codex') {
    const appPath = resolve(dirname(dirname(detection.manifestPath)), '.app.json')
    if (existsSync(appPath)) {
      try {
        const app = JSON.parse(readFileSync(appPath, 'utf-8'))
        if (app && typeof app === 'object' && !Array.isArray(app)) {
          platforms.codex = {
            ...(platforms.codex ?? {}),
            app,
          }
        }
      } catch {
        // ignore malformed app metadata
      }
    }
  }

  if (detection.platform === 'opencode') {
    const pluginConfig = asRecord(raw.plugin)
    if (pluginConfig) {
      platforms.opencode = {
        ...(platforms.opencode ?? {}),
        plugin: pluginConfig,
      }
    }
  }

  if (Object.keys(brand).length > 0) result.brand = brand
  if (Object.keys(platforms).length > 0) result.platforms = platforms

  return result
}

// ── MCP Parsing ─────────────────────────────────────────────────

function parseMcp(pluginDir: string, detection: DetectionResult): {
  servers: ParsedMcp
  runtimeAuthMode: 'inline' | 'platform'
  warnings: string[]
  platformOverrides?: Record<string, Record<string, unknown>>
} {
  const mcpCandidates: Array<{ path: string; parser: 'json' | 'toml' }> = [
    { path: resolve(pluginDir, '.mcp.json'), parser: 'json' },
    { path: resolve(pluginDir, 'mcp.json'), parser: 'json' },
  ]

  if (detection.platform === 'codex') {
    mcpCandidates.push({ path: resolve(pluginDir, '.codex/config.toml'), parser: 'toml' })
  }

  if (detection.platform === 'opencode') {
    mcpCandidates.push({ path: resolve(pluginDir, 'opencode.json'), parser: 'json' })
    mcpCandidates.push({ path: resolve(pluginDir, '.opencode.json'), parser: 'json' })
  }

  // Also check if the manifest references an mcpServers file
  if (detection.manifestPath) {
    try {
      const manifest = JSON.parse(readFileSync(detection.manifestPath, 'utf-8'))
      if (manifest.mcpServers && typeof manifest.mcpServers === 'string') {
        mcpCandidates.unshift({ path: resolve(pluginDir, manifest.mcpServers), parser: 'json' })
      }
    } catch {
      // ignore
    }
  }

  const mergedServers: ParsedMcp = {}
  const mergedWarnings = new Set<string>()
  let runtimeAuthMode: 'inline' | 'platform' = 'inline'
  let platformOverrides: Record<string, Record<string, unknown>> | undefined

  for (const candidate of mcpCandidates) {
    if (!existsSync(candidate.path)) continue

    const parsed = candidate.parser === 'toml'
      ? parseTomlMcpFile(candidate.path, detection.platform)
      : parseJsonMcpFile(candidate.path, detection.platform)
    if (Object.keys(parsed.servers).length === 0) continue

    for (const [serverName, server] of Object.entries(parsed.servers)) {
      const previous = mergedServers[serverName]
      const combinedWarnings = [...new Set([...(previous?.warnings ?? []), ...(server.warnings ?? [])])]
      mergedServers[serverName] = {
        ...(previous ?? {}),
        ...server,
        ...(combinedWarnings.length > 0 ? { warnings: combinedWarnings } : {}),
      }
    }

    if (parsed.runtimeAuthMode === 'platform') {
      runtimeAuthMode = 'platform'
    }

    for (const warning of parsed.warnings) {
      mergedWarnings.add(warning)
    }

    platformOverrides = mergePlatformOverrideMaps(platformOverrides, parsed.platformOverrides)
  }

  if (Object.keys(mergedServers).length > 0) {
    return {
      servers: mergedServers,
      runtimeAuthMode,
      warnings: [...mergedWarnings],
      ...(platformOverrides ? { platformOverrides } : {}),
    }
  }

  return {
    servers: {},
    runtimeAuthMode: 'inline',
    warnings: [],
  }
}

// ── Hooks Parsing ───────────────────────────────────────────────

// Maps platform-specific hook event names to pluxx schema names
const HOOK_EVENT_MAP: Record<string, string> = {
  SessionStart: 'sessionStart',
  SessionEnd: 'sessionEnd',
  PreToolUse: 'preToolUse',
  PostToolUse: 'postToolUse',
  UserPromptSubmit: 'beforeSubmitPrompt',
  BeforeShellExecution: 'beforeShellExecution',
  AfterShellExecution: 'afterShellExecution',
  BeforeMCPExecution: 'beforeMCPExecution',
  AfterMCPExecution: 'afterMCPExecution',
  AfterFileEdit: 'afterFileEdit',
  BeforeReadFile: 'beforeReadFile',
  BeforeSubmitPrompt: 'beforeSubmitPrompt',
  Stop: 'stop',
  // Also handle already-normalized names
  sessionStart: 'sessionStart',
  sessionEnd: 'sessionEnd',
  preToolUse: 'preToolUse',
  postToolUse: 'postToolUse',
}

function parseHooks(pluginDir: string, detection: DetectionResult): ParsedHooks {
  const hooksPaths = [
    resolve(pluginDir, '.codex', 'hooks.json'),
    resolve(pluginDir, 'hooks.json'),
    resolve(pluginDir, 'hooks', 'hooks.json'),
  ]

  // Check if manifest references a hooks file
  if (detection.manifestPath) {
    try {
      const manifest = JSON.parse(readFileSync(detection.manifestPath, 'utf-8'))
      if (manifest.hooks && typeof manifest.hooks === 'string') {
        hooksPaths.unshift(resolve(pluginDir, manifest.hooks))
      }
    } catch {
      // ignore
    }
  }

  for (const hooksPath of hooksPaths) {
    if (!existsSync(hooksPath)) continue
    try {
      const raw = JSON.parse(readFileSync(hooksPath, 'utf-8'))
      const hooksObj = raw.hooks ?? raw
      if (!hooksObj || typeof hooksObj !== 'object') continue

      const result: ParsedHooks = {}

      for (const [event, entries] of Object.entries(hooksObj)) {
        const normalizedEvent = HOOK_EVENT_MAP[event] ?? event
        const hookEntries: ParsedHooks[string] = []

        if (!Array.isArray(entries)) continue

        for (const entry of entries) {
          // Claude Code format: { hooks: [{ type: 'command', command: '...' }] }
          if (entry.hooks && Array.isArray(entry.hooks)) {
            for (const hook of entry.hooks) {
              const parsedHook = parseMigratedHookEntry(hook, entry.matcher)
              if (parsedHook) hookEntries.push(parsedHook)
            }
          }
          // Direct format: { command: '...' } or other HookEntry-shaped records.
          else {
            const parsedHook = parseMigratedHookEntry(entry)
            if (parsedHook) {
              hookEntries.push(parsedHook)
            }
          }
        }

        if (hookEntries.length > 0) {
          result[normalizedEvent] = hookEntries
        }
      }

      return result
    } catch {
      continue
    }
  }

  return {}
}

function parseMigratedHookEntry(raw: unknown, fallbackMatcher?: unknown): HookEntry | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null

  const candidate = raw as Record<string, unknown>
  const inferredType = candidate.type
  const type: HookEntry['type']
    = inferredType === 'command'
      || inferredType === 'http'
      || inferredType === 'mcp_tool'
      || inferredType === 'prompt'
      || inferredType === 'agent'
      ? inferredType
      : typeof candidate.prompt === 'string'
        ? 'prompt'
        : typeof candidate.url === 'string'
          ? 'http'
          : typeof candidate.server === 'string' || typeof candidate.tool === 'string'
            ? 'mcp_tool'
            : 'command'

  const entry: HookEntry = { type }

  if (typeof candidate.command === 'string') entry.command = candidate.command
  if (typeof candidate.prompt === 'string') entry.prompt = candidate.prompt
  if (typeof candidate.model === 'string') entry.model = candidate.model
  if (typeof candidate.url === 'string') entry.url = candidate.url
  if (candidate.headers && typeof candidate.headers === 'object' && !Array.isArray(candidate.headers)) {
    entry.headers = Object.fromEntries(
      Object.entries(candidate.headers as Record<string, unknown>)
        .filter(([, value]) => typeof value === 'string')
        .map(([key, value]) => [key, value as string]),
    )
  }
  if (Array.isArray(candidate.allowedEnvVars) && candidate.allowedEnvVars.every(value => typeof value === 'string')) {
    entry.allowedEnvVars = candidate.allowedEnvVars as string[]
  }
  if (typeof candidate.server === 'string') entry.server = candidate.server
  if (typeof candidate.tool === 'string') entry.tool = candidate.tool
  if (candidate.input && typeof candidate.input === 'object' && !Array.isArray(candidate.input)) {
    entry.input = candidate.input as Record<string, unknown>
  }
  if (typeof candidate.if === 'string') entry.if = candidate.if
  if (typeof candidate.async === 'boolean') entry.async = candidate.async
  if (typeof candidate.asyncRewake === 'boolean') entry.asyncRewake = candidate.asyncRewake
  if (candidate.shell === 'bash') entry.shell = 'bash'
  if (typeof candidate.timeout === 'number') entry.timeout = candidate.timeout

  const matcher = candidate.matcher ?? fallbackMatcher
  if (typeof matcher === 'string') {
    entry.matcher = matcher
  } else if (matcher && typeof matcher === 'object' && !Array.isArray(matcher)) {
    entry.matcher = matcher as Record<string, unknown>
  }

  if (typeof candidate.failClosed === 'boolean') entry.failClosed = candidate.failClosed
  if (typeof candidate.loop_limit === 'number' || candidate.loop_limit === null) {
    entry.loop_limit = candidate.loop_limit
  }

  if (type === 'command' && !entry.command) return null
  if (type === 'http' && !entry.url) return null
  if (type === 'mcp_tool' && (!entry.server || !entry.tool)) return null
  if ((type === 'prompt' || type === 'agent') && !entry.prompt) return null

  return entry
}

// ── Instructions Detection ──────────────────────────────────────

interface InstructionSourceResult {
  primary?: string
  extraPaths: string[]
  platformOverrides?: Record<string, Record<string, unknown>>
}

function findInstructions(pluginDir: string): string | undefined {
  const candidates = [
    'CLAUDE.md',
    'AGENTS.md',
    'instructions.md',
    'INSTRUCTIONS.md',
    'README.md',
  ]

  for (const candidate of candidates) {
    const filePath = resolve(pluginDir, candidate)
    if (existsSync(filePath)) {
      return `./${candidate}`
    }
  }

  return undefined
}

interface ParsedCursorRule {
  description: string
  globs?: string | string[]
  alwaysApply?: boolean
  content?: string
  path?: string
}

function parseCursorRules(pluginDir: string, detection: DetectionResult): ParsedCursorRule[] {
  if (detection.platform !== 'cursor') return []

  const manifest = detection.manifestPath ? tryReadJson(detection.manifestPath) : null
  const configuredRulesDir = typeof manifest?.rules === 'string' ? stripRelativePrefix(manifest.rules) : undefined
  const candidates = [
    configuredRulesDir,
    'rules',
    '.cursor/rules',
  ].filter((value): value is string => Boolean(value))

  for (const relativeDir of candidates) {
    const dirPath = resolve(pluginDir, relativeDir)
    if (!existsSync(dirPath)) continue

    const entries = collectFiles(dirPath, (entry) => entry.endsWith('.mdc'))
      .map((entry) => parseCursorRuleFile(pluginDir, entry))
      .filter((entry): entry is ParsedCursorRule => Boolean(entry))

    if (entries.length > 0) return entries
  }

  return []
}

function parseCursorRuleFile(pluginDir: string, filePath: string): ParsedCursorRule | null {
  const content = readFileSync(filePath, 'utf-8')
  const { hasFrontmatter, frontmatterLines, body } = splitMarkdownFrontmatter(content)
  if (!hasFrontmatter) return null

  const description = parseTopLevelStringFrontmatter(frontmatterLines, 'description')
    ?? titleCaseFromDirName(basename(filePath, '.mdc'))
  const globs = parseTopLevelStringOrStringArrayFrontmatter(frontmatterLines, 'globs')
  const alwaysApply = parseTopLevelBooleanFrontmatter(frontmatterLines, 'alwaysApply')

  return {
    description,
    ...(globs !== undefined ? { globs } : {}),
    ...(alwaysApply !== undefined ? { alwaysApply } : {}),
    ...(body.trim() ? { content: body.trim() } : {}),
    path: `./${relative(pluginDir, filePath).replace(/\\/g, '/')}`,
  }
}

function collectFiles(dir: string, predicate: (relativePath: string) => boolean): string[] {
  const results: string[] = []
  const stack = [dir]

  while (stack.length > 0) {
    const current = stack.pop()!
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const fullPath = resolve(current, entry.name)
      if (entry.isDirectory()) {
        stack.push(fullPath)
        continue
      }
      if (entry.isFile() && predicate(entry.name)) {
        results.push(fullPath)
      }
    }
  }

  return results.sort((a, b) => a.localeCompare(b))
}

function findOpenCodeConfiguredInstructions(pluginDir: string): string[] {
  const candidates = [resolve(pluginDir, 'opencode.json'), resolve(pluginDir, '.opencode.json')]
  const discovered = new Set<string>()

  for (const path of candidates) {
    const raw = tryReadJson(path)
    if (!raw) continue

    const instructions = raw.instructions
    const values = typeof instructions === 'string'
      ? [instructions]
      : Array.isArray(instructions)
        ? instructions.filter((value): value is string => typeof value === 'string')
        : []

    for (const value of values) {
      if (value.startsWith('./') || value.startsWith('../')) {
        const normalized = `./${stripRelativePrefix(value)}`
        if (existsSync(resolve(pluginDir, normalized))) {
          discovered.add(normalized)
        }
      }
    }
  }

  return [...discovered]
}

function findInstructionSources(pluginDir: string, detection: DetectionResult): InstructionSourceResult {
  const primary = findInstructions(pluginDir)
  const extraPaths = new Set<string>()
  const platformOverrides: Record<string, Record<string, unknown>> = {}

  if (detection.platform === 'cursor') {
    const nestedAgents = collectFiles(pluginDir, (entry) => entry === 'AGENTS.md')
      .map((path) => `./${relative(pluginDir, path).replace(/\\/g, '/')}`)
      .filter((path) => path !== primary)

    if (nestedAgents.length > 0) {
      platformOverrides.cursor = {
        ...(platformOverrides.cursor ?? {}),
        instructionSources: {
          ...(asRecord(platformOverrides.cursor?.instructionSources) ?? {}),
          nestedAgents,
        },
      }
      for (const path of nestedAgents) extraPaths.add(path)
    }
  }

  if (detection.platform === 'codex') {
    const overridePath = './AGENTS.override.md'
    if (existsSync(resolve(pluginDir, stripRelativePrefix(overridePath)))) {
      platformOverrides.codex = {
        ...(platformOverrides.codex ?? {}),
        instructionSources: {
          ...(asRecord(platformOverrides.codex?.instructionSources) ?? {}),
          override: overridePath,
        },
      }
      if (overridePath !== primary) {
        extraPaths.add(overridePath)
      }
    }
  }

  if (detection.platform === 'opencode') {
    const configured = findOpenCodeConfiguredInstructions(pluginDir)
    if (configured.length > 0) {
      platformOverrides.opencode = {
        ...(platformOverrides.opencode ?? {}),
        instructionSources: {
          ...(asRecord(platformOverrides.opencode?.instructionSources) ?? {}),
          configured,
        },
      }
      for (const path of configured) {
        if (path !== primary) extraPaths.add(path)
      }
    }
  }

  return {
    primary: primary ?? (detection.platform === 'opencode' ? findOpenCodeConfiguredInstructions(pluginDir)[0] : undefined),
    extraPaths: [...extraPaths].sort(),
    ...(Object.keys(platformOverrides).length > 0 ? { platformOverrides } : {}),
  }
}

function collectPackageEntryPaths(value: unknown, acc: Set<string>): void {
  if (typeof value === 'string') {
    if (value.startsWith('./') || value.startsWith('../')) {
      acc.add(`./${stripRelativePrefix(value)}`)
    }
    return
  }

  if (!value || typeof value !== 'object' || Array.isArray(value)) return
  for (const nested of Object.values(value as Record<string, unknown>)) {
    collectPackageEntryPaths(nested, acc)
  }
}

function findOpenCodeDistributionSources(pluginDir: string, detection: DetectionResult): {
  extraPaths: string[]
  platformOverrides?: Record<string, Record<string, unknown>>
} {
  if (detection.platform !== 'opencode' || !detection.manifestPath) {
    return { extraPaths: [] }
  }

  const pkg = tryReadJson(detection.manifestPath)
  if (!pkg) return { extraPaths: [] }

  const entrypoints: Record<string, unknown> = {}
  const extraPaths = new Set<string>()

  for (const key of ['main', 'module', 'types']) {
    const value = pkg[key]
    if (typeof value === 'string') {
      entrypoints[key] = value
      collectPackageEntryPaths(value, extraPaths)
    }
  }

  if (pkg.exports !== undefined) {
    entrypoints.exports = pkg.exports
    collectPackageEntryPaths(pkg.exports, extraPaths)
  }

  const fallbackEntries = ['./index.ts', './index.js', './src/index.ts', './src/index.js']
  if (Object.keys(entrypoints).length === 0) {
    for (const candidate of fallbackEntries) {
      if (existsSync(resolve(pluginDir, stripRelativePrefix(candidate)))) {
        entrypoints.entry = candidate
        extraPaths.add(candidate)
        break
      }
    }
  }

  const presentPaths = [...extraPaths].filter((entry) => existsSync(resolve(pluginDir, stripRelativePrefix(entry))))
  if (Object.keys(entrypoints).length === 0) {
    return { extraPaths: presentPaths }
  }

  return {
    extraPaths: presentPaths,
    platformOverrides: {
      opencode: {
        entrypoints,
      },
    },
  }
}

function tryReadJson(path: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(readFileSync(path, 'utf-8'))
    return asRecord(parsed) ?? null
  } catch {
    return null
  }
}

function parseJsonMcpFile(path: string, platform: DetectedPlatform): {
  servers: ParsedMcp
  runtimeAuthMode: 'inline' | 'platform'
  warnings: string[]
  platformOverrides?: Record<string, Record<string, unknown>>
} {
  const raw = tryReadJson(path)
  if (!raw) {
    return { servers: {}, runtimeAuthMode: 'inline', warnings: [] }
  }

  const servers = extractJsonMcpServers(raw, platform, path)
  if (!servers) {
    return { servers: {}, runtimeAuthMode: 'inline', warnings: [] }
  }

  return parseMcpServerRecords(servers, platform)
}

function extractJsonMcpServers(
  raw: Record<string, unknown>,
  platform: DetectedPlatform,
  path: string,
): Record<string, unknown> | null {
  if (platform === 'opencode') {
    const mcp = asRecord(raw.mcp)
    if (mcp) return mcp
  }

  const mcpServers = asRecord(raw.mcpServers)
  if (mcpServers) return mcpServers
  if (typeof raw.mcpServers === 'string') return null

  if (path.endsWith('mcp.json') || path.endsWith('.mcp.json')) {
    return raw
  }

  return null
}

function parseTomlMcpFile(path: string, platform: DetectedPlatform): {
  servers: ParsedMcp
  runtimeAuthMode: 'inline' | 'platform'
  warnings: string[]
  platformOverrides?: Record<string, Record<string, unknown>>
} {
  const content = readFileSync(path, 'utf-8')
  const servers: Record<string, Record<string, unknown>> = {}
  let currentServer: string | undefined
  let currentSubtable: string | undefined

  for (const rawLine of content.split(/\r?\n/)) {
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

  return parseMcpServerRecords(servers, platform)
}

function parseMcpServerRecords(
  servers: Record<string, unknown>,
  platform: DetectedPlatform,
): {
  servers: ParsedMcp
  runtimeAuthMode: 'inline' | 'platform'
  warnings: string[]
  platformOverrides?: Record<string, Record<string, unknown>>
} {
  const parsed: ParsedMcp = {}
  const warnings: string[] = []
  let runtimeAuthMode: 'inline' | 'platform' = 'inline'
  const nativePlatformOverrides = buildNativeMcpPlatformOverrides(platform, servers)

  for (const [name, config] of Object.entries(servers)) {
    const cfg = asRecord(config)
    if (!cfg) continue

    const entryWarnings: string[] = []
    const entry = parseMcpServerEntry(cfg, entryWarnings)
    if (entry.auth?.type === 'platform' && entry.transport !== 'stdio') {
      runtimeAuthMode = 'platform'
    }
    if (entryWarnings.length > 0) {
      entry.warnings = entryWarnings
      warnings.push(...entryWarnings.map((warning) => `${name}: ${warning}`))
    }
    parsed[name] = entry
  }

  return {
    servers: parsed,
    runtimeAuthMode,
    warnings,
    ...(nativePlatformOverrides ? { platformOverrides: nativePlatformOverrides } : {}),
  }
}

function parseMcpServerEntry(
  cfg: Record<string, unknown>,
  warnings: string[],
): ParsedMcp[string] {
  const entry: ParsedMcp[string] = {}

  if (typeof cfg.url === 'string') entry.url = cfg.url

  if (cfg.type === 'stdio' || cfg.command) {
    entry.transport = 'stdio'
    entry.command = normalizeCommandValue(cfg.command)
    entry.args = normalizeStringArray(cfg.args)
    entry.env = normalizeEnvRecord(cfg.env)
  } else if (cfg.type === 'sse') {
    entry.transport = 'sse'
  } else {
    entry.transport = 'http'
  }

  const auth = inferMigrateAuth(cfg, warnings)
  if (auth) entry.auth = auth

  return entry
}

function inferMigrateAuth(
  cfg: Record<string, unknown>,
  warnings: string[],
): ParsedMcp[string]['auth'] | undefined {
  const explicitAuth = asRecord(cfg.auth)
  const explicitType = typeof explicitAuth?.type === 'string' ? explicitAuth.type : undefined

  if (explicitType === 'platform') {
    return {
      type: 'platform',
      mode: explicitAuth?.mode === 'oauth' ? 'oauth' : 'oauth',
    }
  }

  if (explicitType === 'none') {
    return { type: 'none' }
  }

  if (explicitType === 'bearer') {
    const envVar = firstString(explicitAuth?.envVar, explicitAuth?.env_var)
    if (envVar) {
      return {
        type: 'bearer',
        envVar,
        headerName: firstString(explicitAuth?.headerName, explicitAuth?.header_name) ?? 'Authorization',
        headerTemplate: firstString(explicitAuth?.headerTemplate, explicitAuth?.header_template) ?? 'Bearer ${value}',
      }
    }
  }

  if (explicitType === 'header') {
    const envVar = firstString(explicitAuth?.envVar, explicitAuth?.env_var)
    const headerName = firstString(explicitAuth?.headerName, explicitAuth?.header_name)
    if (envVar && headerName) {
      return {
        type: 'header',
        envVar,
        headerName,
        headerTemplate: firstString(explicitAuth?.headerTemplate, explicitAuth?.header_template) ?? '${value}',
      }
    }
  }

  const bearerTokenEnv = firstString(cfg.bearer_token_env_var, cfg.bearerTokenEnvVar)
  if (bearerTokenEnv) {
    return {
      type: 'bearer',
      envVar: bearerTokenEnv,
      headerName: 'Authorization',
      headerTemplate: 'Bearer ${value}',
    }
  }

  const envHttpHeaders = asRecord(cfg.env_http_headers ?? cfg.envHttpHeaders)
  if (envHttpHeaders) {
    const stringHeaders = Object.entries(envHttpHeaders)
      .filter(([, value]) => typeof value === 'string')
      .map(([key, value]) => [key, String(value)] as const)
    if (stringHeaders.length > 0) {
      const preferred = stringHeaders.find(([key]) => key.toLowerCase() === 'authorization') ?? stringHeaders[0]
      const [headerName, envVar] = preferred
      const extras = stringHeaders.filter(([key]) => key !== headerName)
      if (extras.length > 0) {
        warnings.push(`Preserved ${headerName} as canonical auth but native env_http_headers declared additional header auth keys (${extras.map(([key]) => key).join(', ')}). Review the migrated MCP config and platform overrides.`)
      }
      return {
        type: headerName.toLowerCase() === 'authorization' ? 'bearer' : 'header',
        envVar,
        headerName,
        headerTemplate: headerName.toLowerCase() === 'authorization' ? 'Bearer ${value}' : '${value}',
      }
    }
  }

  const headers = asRecord(cfg.headers ?? cfg.http_headers ?? cfg.httpHeaders)
  if (!headers) return undefined

  const envBackedHeaders = Object.entries(headers)
    .filter(([, value]) => typeof value === 'string')
    .map(([headerName, rawValue]) => ({
      headerName,
      rawValue: rawValue as string,
      envVar: extractEnvVar(rawValue as string),
    }))
    .filter((entry) => Boolean(entry.envVar))

  if (envBackedHeaders.length > 0) {
    const preferred = envBackedHeaders.find((entry) => entry.headerName.toLowerCase() === 'authorization') ?? envBackedHeaders[0]
    const extras = envBackedHeaders.filter((entry) => entry.headerName !== preferred.headerName)
    if (extras.length > 0) {
      warnings.push(`Preserved ${preferred.headerName} as canonical auth but native headers declared additional env-backed auth keys (${extras.map((entry) => entry.headerName).join(', ')}). Review the migrated MCP config and platform overrides.`)
    }
    return {
      type: preferred.headerName.toLowerCase() === 'authorization' ? 'bearer' : 'header',
      envVar: preferred.envVar!,
      headerName: preferred.headerName,
      headerTemplate: preferred.rawValue.replace(envReferencePattern(preferred.envVar!), '${value}'),
    }
  }

  return undefined
}

function normalizeCommandValue(value: unknown): string | undefined {
  if (typeof value === 'string') return value
  if (Array.isArray(value) && typeof value[0] === 'string') return value[0]
  return undefined
}

function normalizeStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined
  return value.map(String)
}

function normalizeEnvRecord(value: unknown): Record<string, string> | undefined {
  const record = asRecord(value)
  if (!record) return undefined
  const env = Object.fromEntries(
    Object.entries(record)
      .filter(([, rawValue]) => typeof rawValue === 'string')
      .map(([key, rawValue]) => [key, rawValue as string]),
  )
  return Object.keys(env).length > 0 ? env : undefined
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined
  return value as Record<string, unknown>
}

function firstString(...values: unknown[]): string | undefined {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim()
  }
  return undefined
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

function parseTopLevelStringFrontmatter(frontmatterLines: string[], key: string): string | undefined {
  const match = frontmatterLines.find((line) => new RegExp(`^${escapeRegExp(key)}\\s*:`).test(line.trim()))
  if (!match) return undefined
  const rawValue = match.replace(/^[^:]+:\s*/, '')
  return unquoteFrontmatterValue(rawValue)
}

function parseTopLevelBooleanFrontmatter(frontmatterLines: string[], key: string): boolean | undefined {
  const value = parseTopLevelStringFrontmatter(frontmatterLines, key)?.toLowerCase()
  if (value === 'true') return true
  if (value === 'false') return false
  return undefined
}

function parseTopLevelStringOrStringArrayFrontmatter(frontmatterLines: string[], key: string): string | string[] | undefined {
  const match = frontmatterLines.find((line) => new RegExp(`^${escapeRegExp(key)}\\s*:`).test(line.trim()))
  if (!match) return undefined
  const rawValue = match.replace(/^[^:]+:\s*/, '').trim()
  if (rawValue.startsWith('[') && rawValue.endsWith(']')) {
    try {
      const parsed = JSON.parse(rawValue)
      if (Array.isArray(parsed) && parsed.every(value => typeof value === 'string')) {
        return parsed
      }
    } catch {
      return undefined
    }
  }
  return unquoteFrontmatterValue(rawValue)
}

function unquoteFrontmatterValue(value: string): string {
  const trimmed = value.trim()
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"'))
    || (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1)
  }
  return trimmed
}

// ── Directory Detection ─────────────────────────────────────────

const CANONICAL_SOURCE_CANDIDATES: Record<keyof CanonicalSourcePaths, string[]> = {
  skills: ['skills', '.claude/skills', '.cursor/skills', '.agents/skills', '.opencode/skills'],
  commands: ['commands', '.opencode/commands'],
  agents: ['agents', '.claude/agents', '.cursor/agents', '.opencode/agents', '.codex/agents'],
  scripts: ['scripts'],
  assets: ['assets'],
}

function normalizeRelativeDir(relativePath: string): string {
  const trimmed = relativePath.replace(/\\/g, '/').replace(/^\.\//, '').replace(/\/$/, '')
  return `./${trimmed}/`
}

function stripRelativePrefix(relativePath: string): string {
  return relativePath.replace(/\\/g, '/').replace(/^\.\//, '').replace(/\/$/, '')
}

function detectCanonicalSourcePaths(pluginDir: string): CanonicalSourcePaths {
  const result: CanonicalSourcePaths = {}

  for (const bucket of Object.keys(CANONICAL_SOURCE_CANDIDATES) as Array<keyof CanonicalSourcePaths>) {
    for (const candidate of CANONICAL_SOURCE_CANDIDATES[bucket]) {
      const normalized = stripRelativePrefix(candidate)
      if (!existsSync(resolve(pluginDir, normalized))) continue
      result[bucket] = normalizeRelativeDir(normalized)
      break
    }
  }

  return result
}

function detectPassthroughDirs(pluginDir: string, mcp: ParsedMcp): string[] {
  const passthrough = new Set<string>()

  for (const server of Object.values(mcp)) {
    const parts = [server.command ?? '', ...(server.args ?? [])]
    for (const part of parts) {
      const match = part.match(/\$\{[A-Z_]*PLUGIN_ROOT\}\/([^/]+)/)
      if (!match?.[1]) continue

      const dirName = match[1]
      const dirPath = resolve(pluginDir, dirName)
      if (existsSync(dirPath)) {
        passthrough.add(`./${dirName}/`)
      }
    }
  }

  return [...passthrough].sort()
}

function toKebabCase(value: string): string {
  return value
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/[^A-Za-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()
}

function titleCaseFromDirName(value: string): string {
  return value
    .split(/[-_]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function normalizeMigratedAllowedTool(rawTool: string): string | undefined {
  const trimmed = rawTool.trim()
  if (!trimmed) return undefined

  if (/^(Read|Edit|Bash|Skill|MCP)\(/.test(trimmed)) {
    return trimmed
  }

  if (trimmed === 'Read' || trimmed === 'Edit' || trimmed === 'Bash') {
    return `${trimmed}(*)`
  }

  if (trimmed.startsWith('mcp__')) {
    const match = trimmed.match(/^mcp__([^_]+)__(.+)$/)
    if (!match) return undefined
    const server = match[1]
    const tool = match[2].replace(/__/g, '.')
    return `MCP(${server}.${tool})`
  }

  return undefined
}

function inferPermissionsFromMigratedSkills(pluginDir: string, sourcePaths: CanonicalSourcePaths): {
  permissions?: { allow?: string[] }
  skillPolicies: CompilerIntentSkillPolicy[]
  notes: string[]
} {
  if (!sourcePaths.skills) {
    return { notes: [], skillPolicies: [] }
  }

  const skillsDir = resolve(pluginDir, stripRelativePrefix(sourcePaths.skills))
  const entries = readdirSync(skillsDir, { withFileTypes: true })
  const allow = new Set<string>()
  const notes: string[] = []
  const skillPolicies: CompilerIntentSkillPolicy[] = []
  let sawAllowedTools = false

  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    const skillPath = resolve(skillsDir, entry.name, 'SKILL.md')
    if (!existsSync(skillPath)) continue

    const skill = getCanonicalSkillMetadata({
      filePath: skillPath,
      relativeDir: entry.name,
      dirName: entry.name,
      ...parseSkillMarkdown(readFileSync(skillPath, 'utf-8')),
    })
    const inferredRules = skill.allowedTools
      .map(normalizeMigratedAllowedTool)
      .filter((rule): rule is string => Boolean(rule))

    if (inferredRules.length === 0) continue
    sawAllowedTools = true
    for (const rule of inferredRules) {
      allow.add(rule)
    }

    const sourceFrontmatter: Record<string, unknown> = {}
    if (skill.whenToUse) sourceFrontmatter.when_to_use = skill.whenToUse
    if (skill.argumentHint) sourceFrontmatter['argument-hint'] = skill.argumentHint
    if (skill.arguments.length > 0) sourceFrontmatter.arguments = skill.arguments
    if (typeof skill.disableModelInvocation === 'boolean') sourceFrontmatter['disable-model-invocation'] = skill.disableModelInvocation
    if (typeof skill.userInvocable === 'boolean') sourceFrontmatter['user-invocable'] = skill.userInvocable
    if (skill.model) sourceFrontmatter.model = skill.model
    if (skill.effort) sourceFrontmatter.effort = skill.effort
    if (skill.context) sourceFrontmatter.context = skill.context
    if (skill.agent) sourceFrontmatter.agent = skill.agent
    if (skill.hooks !== undefined) sourceFrontmatter.hooks = skill.hooks
    if (skill.paths.length > 0) sourceFrontmatter.paths = skill.paths
    if (skill.shell) sourceFrontmatter.shell = skill.shell

    skillPolicies.push({
      skillDir: entry.name,
      title: skill.title,
      description: skill.description,
      ...(Object.keys(sourceFrontmatter).length > 0 ? { sourceFrontmatter } : {}),
      source: {
        kind: 'claude-allowed-tools',
        platform: 'claude-code',
      },
      permissions: {
        allow: [...new Set(inferredRules)].sort(),
      },
    })
  }

  if (!sawAllowedTools || allow.size === 0) {
    return { notes: [], skillPolicies: [] }
  }

  notes.push('Inferred from Claude-style allowed-tools frontmatter.')
  notes.push(`Preserved skill-scoped tool access in ${PLUXX_COMPILER_INTENT_PATH} and flattened it into plugin-level canonical permissions as a fallback.`)
  notes.push(`Preserved richer Claude skill frontmatter in ${PLUXX_COMPILER_INTENT_PATH} so migrate does not collapse author intent back into opaque markdown.`)

  return {
    permissions: {
      allow: [...allow].sort(),
    },
    skillPolicies,
    notes,
  }
}

function readMigratedSkills(pluginDir: string, sourcePaths: CanonicalSourcePaths): PersistedSkill[] {
  const skills: PersistedSkill[] = []

  if (sourcePaths.skills) {
    const skillsDir = resolve(pluginDir, stripRelativePrefix(sourcePaths.skills))
    for (const skill of readCanonicalSkillFiles(skillsDir)) {
      const metadata = getCanonicalSkillMetadata(skill)
      skills.push({
        dirName: skill.dirName,
        title: metadata.title,
        description: metadata.description,
        toolNames: [],
      })
    }
  }

  if (skills.length === 0 && sourcePaths.commands) {
    const commandsDir = resolve(pluginDir, stripRelativePrefix(sourcePaths.commands))
    const entries = readdirSync(commandsDir, { withFileTypes: true })

    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.endsWith('.md')) continue
      const dirName = toKebabCase(entry.name.replace(/\.md$/, '')) || 'command'
      const content = readFileSync(resolve(commandsDir, entry.name), 'utf-8')
      const parsed = parseSkillMarkdown(content)
      skills.push({
        dirName,
        title: parsed.firstHeading ?? titleCaseFromDirName(dirName),
        description: parsed.description,
        toolNames: [],
      })
    }
  }

  return skills.sort((a, b) => a.dirName.localeCompare(b.dirName))
}

const HOST_NATIVE_SKILL_FRONTMATTER_KEYS = new Set([
  'allowed-tools',
])

function sanitizeMigratedSkillFrontmatter(outputDir: string): void {
  if (!existsSync(resolve(outputDir, 'skills'))) return

  const skillsDir = resolve(outputDir, 'skills')
  const entries = readdirSync(skillsDir, { withFileTypes: true })

  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    const skillPath = resolve(skillsDir, entry.name, 'SKILL.md')
    if (!existsSync(skillPath)) continue

    const parsed = parseSkillMarkdown(readFileSync(skillPath, 'utf-8'))
    if (!parsed.hasValidFrontmatter) continue

    const sanitized = parsed.frontmatterLines.filter((line) => {
      const match = /^([A-Za-z0-9_-]+)\s*:/.exec(line.trim())
      if (!match) return true
      return !HOST_NATIVE_SKILL_FRONTMATTER_KEYS.has(match[1])
    })

    if (sanitized.length === parsed.frontmatterLines.length) continue

    writeFileSync(skillPath, serializeSkillMarkdown(sanitized, parsed.body), 'utf-8')
  }
}

interface ParsedCodexAgent {
  name?: string
  description?: string
  model?: string
  effort?: string
  sandboxMode?: string
  developerInstructions?: string
}

const PRESERVED_CODEX_AGENT_FIELDS = [
  'name',
  'description',
  'model',
  'model_reasoning_effort',
  'sandbox_mode',
  'developer_instructions',
]

function readTomlScalarValue(content: string, key: string): string | undefined {
  const match = content.match(new RegExp(`(?:^|\\n)${key}\\s*=\\s*"([^"\\\\]*(?:\\\\.[^"\\\\]*)*)"`, 'm'))
  return match?.[1]?.replace(/\\"/g, '"').replace(/\\\\/g, '\\')
}

function readTomlMultilineValue(content: string, key: string): string | undefined {
  const match = content.match(new RegExp(`(?:^|\\n)${key}\\s*=\\s*"""\\n?([\\s\\S]*?)\\n?"""`, 'm'))
  return match?.[1]?.trim()
}

function parseCodexAgentToml(content: string): ParsedCodexAgent {
  return {
    name: readTomlScalarValue(content, 'name'),
    description: readTomlScalarValue(content, 'description'),
    model: readTomlScalarValue(content, 'model'),
    effort: readTomlScalarValue(content, 'model_reasoning_effort'),
    sandboxMode: readTomlScalarValue(content, 'sandbox_mode'),
    developerInstructions: readTomlMultilineValue(content, 'developer_instructions'),
  }
}

function renderMigratedAgentMarkdown(fileStem: string, parsed: ParsedCodexAgent): string {
  const agentName = toKebabCase(parsed.name ?? fileStem) || 'agent'
  const title = parsed.name ?? titleCaseFromDirName(agentName)
  const bodyLines: string[] = []

  if (parsed.developerInstructions) {
    bodyLines.push(parsed.developerInstructions.trim())
  } else {
    bodyLines.push('Migrated from a native Codex custom agent.')
  }

  const frontmatter = [
    '---',
    `name: ${JSON.stringify(agentName)}`,
    ...(parsed.description ? [`description: ${JSON.stringify(parsed.description)}`] : []),
    ...(parsed.model ? [`model: ${JSON.stringify(parsed.model)}`] : []),
    ...(parsed.effort ? [`model_reasoning_effort: ${JSON.stringify(parsed.effort)}`] : []),
    ...(parsed.sandboxMode ? [`sandbox_mode: ${JSON.stringify(parsed.sandboxMode)}`] : []),
    '---',
    '',
    `# ${title}`,
    '',
    ...bodyLines,
    '',
  ]

  return frontmatter.join('\n')
}

function collectCodexAgentMigrationWarnings(sourceDir: string, normalizedSourcePath: string): string[] {
  if (normalizedSourcePath !== '.codex/agents') return []
  if (!existsSync(sourceDir)) return []

  const warnings: string[] = []
  for (const entry of readdirSync(sourceDir, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith('.toml')) continue

    const content = readFileSync(resolve(sourceDir, entry.name), 'utf-8')
    if (!content.includes('[mcp_servers.')) continue

    const mentionsApprovals = content.includes('approval_mode = "approve"')
    warnings.push(
      `Codex native agent ${entry.name} declares agent-local mcp_servers${mentionsApprovals ? ' and per-tool approval stanzas' : ''}. Pluxx currently migrates only ${PRESERVED_CODEX_AGENT_FIELDS.join(', ')} for native Codex agents, so that agent-local MCP config is not preserved automatically. Review the source TOML and rebuild the intended Codex behavior manually.`,
    )
  }

  return warnings
}

function buildFallbackAgentDescription(agentName: string): string {
  return `Migrated ${titleCaseFromDirName(agentName)} agent.`
}

function splitMarkdownFrontmatter(content: string): {
  hasFrontmatter: boolean
  frontmatterLines: string[]
  body: string
} {
  const lines = content.split(/\r?\n/)
  if (lines[0]?.trim() !== '---') {
    return {
      hasFrontmatter: false,
      frontmatterLines: [],
      body: content,
    }
  }

  let endIndex = -1
  for (let i = 1; i < lines.length; i += 1) {
    if (lines[i].trim() === '---') {
      endIndex = i
      break
    }
  }

  if (endIndex === -1) {
    return {
      hasFrontmatter: false,
      frontmatterLines: [],
      body: content,
    }
  }

  return {
    hasFrontmatter: true,
    frontmatterLines: lines.slice(1, endIndex),
    body: lines.slice(endIndex + 1).join('\n'),
  }
}

function hasTopLevelFrontmatterKey(frontmatterLines: string[], key: string): boolean {
  return frontmatterLines.some((line) => {
    if (/^\s/.test(line)) return false
    const match = line.match(/^([A-Za-z0-9_-]+)\s*:/)
    return match?.[1] === key
  })
}

function normalizeMigratedOpenCodeAgentFile(agentPath: string): boolean {
  const original = readFileSync(agentPath, 'utf-8')
  const parsed = splitMarkdownFrontmatter(original)
  const fileStem = toKebabCase(basename(agentPath, '.md')) || 'agent'
  const fallbackDescription = buildFallbackAgentDescription(fileStem)

  if (!parsed.hasFrontmatter) {
    const rewritten = [
      '---',
      `name: ${JSON.stringify(fileStem)}`,
      `description: ${JSON.stringify(fallbackDescription)}`,
      '---',
      '',
      original.trimEnd(),
      '',
    ].join('\n')
    writeFileSync(agentPath, rewritten, 'utf-8')
    return true
  }

  const additions: string[] = []
  if (!hasTopLevelFrontmatterKey(parsed.frontmatterLines, 'name')) {
    additions.push(`name: ${JSON.stringify(fileStem)}`)
  }
  if (!hasTopLevelFrontmatterKey(parsed.frontmatterLines, 'description')) {
    const inferredDescription = parseSkillMarkdown(parsed.body).firstHeading ?? fallbackDescription
    additions.push(`description: ${JSON.stringify(inferredDescription)}`)
  }

  if (additions.length === 0) {
    return false
  }

  const rewritten = [
    '---',
    ...additions,
    ...parsed.frontmatterLines,
    '---',
    parsed.body,
  ].join('\n')

  writeFileSync(agentPath, rewritten, 'utf-8')
  return true
}

function walkMarkdownFiles(dir: string): string[] {
  const entries = readdirSync(dir, { withFileTypes: true })
  const files: string[] = []

  for (const entry of entries) {
    const fullPath = resolve(dir, entry.name)
    if (entry.isDirectory()) {
      files.push(...walkMarkdownFiles(fullPath))
      continue
    }
    if (entry.isFile() && entry.name.endsWith('.md')) {
      files.push(fullPath)
    }
  }

  return files
}

function normalizeMigratedOpenCodeAgents(destDir: string): string[] {
  if (!existsSync(destDir)) return []

  const normalized: string[] = []
  for (const filePath of walkMarkdownFiles(destDir)) {
    if (normalizeMigratedOpenCodeAgentFile(filePath)) {
      normalized.push(relative(destDir, filePath).replace(/\\/g, '/'))
    }
  }

  return normalized.sort()
}

function copyCodexAgents(sourceDir: string, destDir: string): boolean {
  const entries = readdirSync(sourceDir, { withFileTypes: true })
  const tomlEntries = entries.filter((entry) => entry.isFile() && entry.name.endsWith('.toml'))
  if (tomlEntries.length === 0) return false

  mkdirSync(destDir, { recursive: true })
  for (const entry of tomlEntries) {
    const sourcePath = resolve(sourceDir, entry.name)
    const parsed = parseCodexAgentToml(readFileSync(sourcePath, 'utf-8'))
    const fallbackName = entry.name.replace(/\.toml$/, '')
    const fileName = `${toKebabCase(parsed.name ?? fallbackName) || 'agent'}.md`
    writeFileSync(resolve(destDir, fileName), renderMigratedAgentMarkdown(fallbackName, parsed), 'utf-8')
  }

  return true
}

function primarySource(result: MigrateResult): McpServer {
  const [serverName, server] = Object.entries(result.mcp)[0] ?? []
  const auth = normalizeMigrateAuth(server?.auth)
  if (server) {
    if (server.transport === 'stdio') {
      return {
        transport: 'stdio',
        command: server.command ?? 'TODO_MCP_COMMAND',
        args: server.args ?? [],
        ...(server.env ? { env: server.env } : {}),
        ...(auth ? { auth } : {}),
      }
    }

    if (server.transport === 'sse') {
      return {
        transport: 'sse',
        url: server.url ?? `https://example.com/${serverName ?? 'mcp'}`,
        ...(auth ? { auth } : {}),
      }
    }

    return {
      transport: 'http',
      url: server.url ?? `https://example.com/${serverName ?? 'mcp'}`,
      ...(auth ? { auth } : {}),
    }
  }

  return {
    transport: 'stdio',
    command: 'TODO_MCP_COMMAND',
    args: [],
  }
}

function normalizeMigrateAuth(auth: ParsedMcp[string]['auth']) {
  if (!auth) return undefined
  if (auth.type === 'none') {
    return { type: 'none' as const }
  }
  if (auth.type === 'platform') {
    return {
      type: 'platform' as const,
      mode: auth.mode ?? 'oauth',
    }
  }
  if (auth.type === 'bearer' && auth.envVar) {
    return {
      type: 'bearer' as const,
      envVar: auth.envVar,
      headerName: auth.headerName ?? 'Authorization',
      headerTemplate: auth.headerTemplate ?? 'Bearer ${value}',
    }
  }
  if (auth.type === 'header' && auth.envVar && auth.headerName) {
    return {
      type: 'header' as const,
      envVar: auth.envVar,
      headerName: auth.headerName,
      headerTemplate: auth.headerTemplate ?? '${value}',
    }
  }
  return undefined
}

function buildMigratedScaffoldMetadata(result: MigrateResult, outputDir: string): McpScaffoldMetadata {
  const pluginName = result.manifest.name ?? 'my-plugin'
  const displayName = result.manifest.name ? titleCaseFromDirName(result.manifest.name) : 'Migrated Plugin'
  const description = result.manifest.description ?? 'Migrated plugin scaffold.'
  const generatedHookEvents = Object.keys(result.hooks)
  const managedFiles = [
    ...(result.instructions ? [result.instructions.replace(/^\.\//, '')] : []),
    ...result.extraCopyPaths.map((path) => path.replace(/^\.\//, '')),
    ...(['skills', 'commands', 'agents', 'scripts', 'assets'] as const).flatMap((dir) => {
      if (!result.sourcePaths[dir]) return []
      const baseDir = dir
      const dirPath = resolve(outputDir, baseDir)
      if (!existsSync(dirPath)) return []
      const entries = readdirSync(dirPath, { withFileTypes: true })
      const files: string[] = []
      for (const entry of entries) {
        if (entry.isDirectory()) {
          const nestedDir = resolve(dirPath, entry.name)
          for (const nested of readdirSync(nestedDir, { withFileTypes: true })) {
            if (nested.isFile()) {
              files.push(`${baseDir}/${entry.name}/${nested.name}`)
            }
          }
          continue
        }
        if (entry.isFile()) {
          files.push(`${baseDir}/${entry.name}`)
        }
      }
      return files
    }),
    'pluxx.config.ts',
    MCP_TAXONOMY_PATH,
    MCP_SCAFFOLD_METADATA_PATH,
    ...(result.compilerIntent ? [PLUXX_COMPILER_INTENT_PATH] : []),
  ]

  return {
    version: 1,
    source: primarySource(result),
    serverInfo: {
      name: pluginName,
      title: displayName,
      version: result.manifest.version ?? '0.1.0',
      description,
      ...(result.manifest.repository ? { websiteUrl: result.manifest.repository } : {}),
    },
    settings: {
      pluginName,
      displayName,
      description,
      skillGrouping: 'workflow',
      requestedHookMode: generatedHookEvents.length > 0 ? 'safe' : 'none',
      generatedHookMode: generatedHookEvents.length > 0 ? 'safe' : 'none',
      generatedHookEvents,
      runtimeAuthMode: result.runtimeAuthMode,
    },
    userConfig: [],
    tools: [],
    resources: [],
    resourceTemplates: [],
    prompts: [],
    skills: result.persistedSkills.map((skill) => ({
      dirName: skill.dirName,
      title: skill.title,
      description: skill.description,
      toolNames: skill.toolNames,
    })),
    managedFiles: [...new Set(managedFiles)].sort(),
  }
}

// ── Copy Directories ────────────────────────────────────────────

function copyDirectories(
  pluginDir: string,
  outputDir: string,
  sourcePaths: CanonicalSourcePaths,
  passthrough: string[],
): string[] {
  const copied: string[] = []
  const toCopy = ['skills', 'commands', 'agents', 'scripts', 'assets'] as const

  for (const dir of toCopy) {
    const sourcePath = sourcePaths[dir]
    if (!sourcePath) continue
    const normalizedSource = stripRelativePrefix(sourcePath)
    const src = resolve(pluginDir, normalizedSource)
    const dest = resolve(outputDir, dir)
    if (existsSync(dest)) {
      console.log(`  skip ./${dir}/ (already exists)`)
      continue
    }
    const copiedCodexAgents = dir === 'agents' && normalizedSource === '.codex/agents'
      ? copyCodexAgents(src, dest)
      : false
    if (!copiedCodexAgents) {
      cpSync(src, dest, { recursive: true })
    }
    if (dir === 'agents' && normalizedSource === '.opencode/agents') {
      normalizeMigratedOpenCodeAgents(dest)
    }
    copied.push(dir)
  }

  for (const entry of passthrough) {
    const normalized = entry.replace(/^\.\//, '').replace(/\/$/, '')
    const src = resolve(pluginDir, normalized)
    const dest = resolve(outputDir, normalized)
    if (existsSync(dest)) {
      console.log(`  skip ./${normalized}/ (already exists)`)
      continue
    }
    cpSync(src, dest, { recursive: true })
    copied.push(normalized)
  }

  return copied
}

// ── Config Generation ───────────────────────────────────────────

function generateConfigTs(result: MigrateResult): string {
  const lines: string[] = []
  lines.push(`import { definePlugin } from 'pluxx'`)
  lines.push('')
  lines.push('export default definePlugin({')

  // Identity
  const name = result.manifest.name ?? 'my-plugin'
  lines.push(`  name: ${quote(name)},`)
  if (result.manifest.version) {
    lines.push(`  version: ${quote(result.manifest.version)},`)
  }
  lines.push(`  description: ${quote(result.manifest.description ?? 'TODO: Describe your plugin')},`)

  // Author
  if (result.manifest.author) {
    const a = result.manifest.author
    lines.push('  author: {')
    lines.push(`    name: ${quote(a.name)},`)
    if (a.url) lines.push(`    url: ${quote(a.url)},`)
    if (a.email) lines.push(`    email: ${quote(a.email)},`)
    lines.push('  },')
  } else {
    lines.push('  author: { name: \'TODO: Your Name\' },')
  }

  if (result.manifest.repository) {
    lines.push(`  repository: ${quote(result.manifest.repository)},`)
  }
  if (result.manifest.license) {
    lines.push(`  license: ${quote(result.manifest.license)},`)
  }
  if (result.manifest.keywords && result.manifest.keywords.length > 0) {
    lines.push(`  keywords: [${result.manifest.keywords.map(k => quote(k)).join(', ')}],`)
  }
  if (result.manifest.brand && Object.keys(result.manifest.brand).length > 0) {
    lines.push('  brand: ' + renderIndentedTsValue(result.manifest.brand, 2) + ',')
  }

  if (result.warnings.length > 0) {
    lines.push('')
    lines.push('  // Migration warnings:')
    for (const warning of result.warnings) {
      lines.push(`  // ${warning}`)
    }
  }

  lines.push('')

  // Directories
  if (result.sourcePaths.skills) {
    lines.push(`  skills: './skills/',`)
  }
  if (result.sourcePaths.commands) {
    lines.push(`  commands: './commands/',`)
  }
  if (result.sourcePaths.agents) {
    lines.push(`  agents: './agents/',`)
  }
  if (result.sourcePaths.scripts) {
    lines.push(`  scripts: './scripts/',`)
  }
  if (result.sourcePaths.assets) {
    lines.push(`  assets: './assets/',`)
  }
  if (result.instructions) {
    lines.push(`  instructions: ${quote(result.instructions)},`)
  }
  if (result.passthrough.length > 0) {
    lines.push(`  passthrough: [${result.passthrough.map((entry) => quote(entry)).join(', ')}],`)
  }
  if (result.permissions) {
    lines.push('')
    for (const note of result.permissionNotes) {
      lines.push(`  // ${note}`)
    }
    lines.push('  permissions: {')
    if (result.permissions.allow?.length) {
      lines.push(`    allow: [${result.permissions.allow.map((entry) => quote(entry)).join(', ')}],`)
    }
    if (result.permissions.ask?.length) {
      lines.push(`    ask: [${result.permissions.ask.map((entry) => quote(entry)).join(', ')}],`)
    }
    if (result.permissions.deny?.length) {
      lines.push(`    deny: [${result.permissions.deny.map((entry) => quote(entry)).join(', ')}],`)
    }
    lines.push('  },')
  }

  // MCP
  const mcpNames = Object.keys(result.mcp)
  if (mcpNames.length > 0) {
    lines.push('')
    lines.push('  mcp: {')
    for (const name of mcpNames) {
      const server = result.mcp[name]
      lines.push(`    ${quote(name)}: {`)
      for (const warning of server.warnings ?? []) {
        lines.push(`      // ${warning}`)
      }
      if (server.url) lines.push(`      url: ${quote(server.url)},`)
      if (server.transport && server.transport !== 'http') {
        lines.push(`      transport: ${quote(server.transport)},`)
      }
      if (server.command) lines.push(`      command: ${quote(server.command)},`)
      if (server.args && server.args.length > 0) {
        lines.push(`      args: [${server.args.map(a => quote(a)).join(', ')}],`)
      }
      if (server.env) {
        lines.push('      env: {')
        for (const [k, v] of Object.entries(server.env)) {
          lines.push(`        ${quote(k)}: ${quote(v)},`)
        }
        lines.push('      },')
      }
      if (server.auth) {
        lines.push('      auth: {')
        lines.push(`        type: ${quote(server.auth.type)},`)
        if (server.auth.envVar) lines.push(`        envVar: ${quote(server.auth.envVar)},`)
        if (server.auth.mode && server.auth.type === 'platform') {
          lines.push(`        mode: ${quote(server.auth.mode)},`)
        }
        if (server.auth.headerName && server.auth.headerName !== 'Authorization') {
          lines.push(`        headerName: ${quote(server.auth.headerName)},`)
        }
        if (server.auth.headerTemplate && server.auth.headerTemplate !== 'Bearer ${value}') {
          lines.push(`        headerTemplate: ${quote(server.auth.headerTemplate)},`)
        }
        lines.push('      },')
      }
      lines.push('    },')
    }
    lines.push('  },')
  }

  const platforms = buildMigratedPlatformOverrides(result)
  if (platforms && Object.keys(platforms).length > 0) {
    lines.push('')
    lines.push('  platforms: ' + renderIndentedTsValue(platforms, 2) + ',')
  }

  // Hooks
  const hookEvents = Object.keys(result.hooks)
  if (hookEvents.length > 0) {
    lines.push('')
    lines.push('  hooks: {')
    for (const event of hookEvents) {
      const entries = result.hooks[event]
      lines.push(`    ${event}: [`)
      for (const entry of entries) {
        const parts: string[] = []
        if (entry.type && entry.type !== 'command') parts.push(`type: ${renderTsValue(entry.type)}`)
        if (entry.command) parts.push(`command: ${renderTsValue(entry.command)}`)
        if (entry.prompt) parts.push(`prompt: ${renderTsValue(entry.prompt)}`)
        if (entry.model) parts.push(`model: ${renderTsValue(entry.model)}`)
        if (entry.url) parts.push(`url: ${renderTsValue(entry.url)}`)
        if (entry.headers) parts.push(`headers: ${renderTsValue(entry.headers)}`)
        if (entry.allowedEnvVars) parts.push(`allowedEnvVars: ${renderTsValue(entry.allowedEnvVars)}`)
        if (entry.server) parts.push(`server: ${renderTsValue(entry.server)}`)
        if (entry.tool) parts.push(`tool: ${renderTsValue(entry.tool)}`)
        if (entry.input) parts.push(`input: ${renderTsValue(entry.input)}`)
        if (entry.if) parts.push(`if: ${renderTsValue(entry.if)}`)
        if (entry.async !== undefined) parts.push(`async: ${renderTsValue(entry.async)}`)
        if (entry.asyncRewake !== undefined) parts.push(`asyncRewake: ${renderTsValue(entry.asyncRewake)}`)
        if (entry.shell) parts.push(`shell: ${renderTsValue(entry.shell)}`)
        if (entry.timeout !== undefined) parts.push(`timeout: ${renderTsValue(entry.timeout)}`)
        if (entry.matcher !== undefined) parts.push(`matcher: ${renderTsValue(entry.matcher)}`)
        if (entry.failClosed !== undefined) parts.push(`failClosed: ${renderTsValue(entry.failClosed)}`)
        if (entry.loop_limit !== undefined) parts.push(`loop_limit: ${renderTsValue(entry.loop_limit)}`)
        lines.push(`      { ${parts.join(', ')} },`)
      }
      lines.push('    ],')
    }
    lines.push('  },')
  }

  lines.push('')
  lines.push(`  // Migrated from ${result.platform} plugin`)
  lines.push(`  targets: ['claude-code', 'cursor', 'codex', 'opencode'],`)
  lines.push('})')
  lines.push('')

  return lines.join('\n')
}

function quote(s: string): string {
  // Use single quotes, escape single quotes inside
  return `'${s.replace(/'/g, "\\'")}'`
}

function renderTsValue(value: unknown): string {
  if (typeof value === 'string') return quote(value)
  return JSON.stringify(value)
}

function renderIndentedTsValue(value: unknown, indentLevel: number): string {
  const rendered = JSON.stringify(value, null, 2)
  if (!rendered.includes('\n')) return rendered

  const indent = ' '.repeat(indentLevel)
  return rendered
    .split('\n')
    .map((line, index) => (index === 0 ? line : indent + line))
    .join('\n')
}

function buildMigratedPlatformOverrides(result: MigrateResult): Record<string, Record<string, unknown>> | undefined {
  const platforms = cloneRecordMap(result.manifest.platforms)

  if (result.runtimeAuthMode === 'platform') {
    platforms['claude-code'] = {
      ...(platforms['claude-code'] ?? {}),
      mcpAuth: 'platform',
    }
    platforms.cursor = {
      ...(platforms.cursor ?? {}),
      mcpAuth: 'platform',
    }
  }

  return mergePlatformOverrideMaps(platforms)
}

function cloneRecordMap(
  input: Record<string, Record<string, unknown>> | undefined,
): Record<string, Record<string, unknown>> {
  if (!input) return {}
  return JSON.parse(JSON.stringify(input)) as Record<string, Record<string, unknown>>
}

function mergePlatformOverrideMaps(
  ...maps: Array<Record<string, Record<string, unknown>> | undefined>
): Record<string, Record<string, unknown>> | undefined {
  const merged: Record<string, Record<string, unknown>> = {}

  for (const map of maps) {
    if (!map) continue
    for (const [platform, override] of Object.entries(map)) {
      const current = asRecord(merged[platform]) ?? {}
      const next = asRecord(override) ?? {}
      const mergedPlatform: Record<string, unknown> = {
        ...current,
        ...next,
      }

      const currentMcpServers = asRecord(current.mcpServers)
      const nextMcpServers = asRecord(next.mcpServers)
      if (currentMcpServers || nextMcpServers) {
        const mergedMcpServers: Record<string, unknown> = {}
        for (const [serverName, serverConfig] of Object.entries(currentMcpServers ?? {})) {
          const currentServerConfig = asRecord(serverConfig)
          mergedMcpServers[serverName] = currentServerConfig
            ? { ...currentServerConfig }
            : serverConfig
        }
        for (const [serverName, serverConfig] of Object.entries(nextMcpServers ?? {})) {
          const previousServerConfig = asRecord(mergedMcpServers[serverName])
          const nextServerConfig = asRecord(serverConfig)
          mergedMcpServers[serverName] = previousServerConfig && nextServerConfig
            ? { ...previousServerConfig, ...nextServerConfig }
            : serverConfig
        }
        mergedPlatform.mcpServers = mergedMcpServers
      }

      merged[platform] = mergedPlatform
    }
  }

  return Object.keys(merged).length > 0 ? merged : undefined
}

// ── Main Migrate Function ───────────────────────────────────────

export async function migrate(inputPath: string): Promise<void> {
  const pluginDir = resolve(inputPath)
  const outputDir = process.cwd()

  if (!existsSync(pluginDir)) {
    console.error(`Error: Path does not exist: ${pluginDir}`)
    process.exit(1)
  }

  console.log(`Scanning ${pluginDir} ...`)

  // 1. Detect platform
  const detection = detectPlatform(pluginDir)
  if (!detection) {
    console.error('Error: Could not detect plugin platform.')
    console.error('Expected one of:')
    console.error('  .claude-plugin/plugin.json')
    console.error('  or a manifest-less Claude plugin with CLAUDE.md')
    console.error('  .cursor-plugin/plugin.json')
    console.error('  .codex-plugin/plugin.json')
    console.error('  package.json with @opencode-ai/plugin dependency')
    process.exit(1)
  }

  console.log(`Detected: ${detection.platform} plugin`)

  // 2. Parse manifest
  const manifest = parseManifest(detection)
  console.log(`  name: ${manifest.name ?? '(none)'}`)
  console.log(`  version: ${manifest.version ?? '(none)'}`)

  // 3. Parse MCP
  const parsedMcp = parseMcp(pluginDir, detection)
  const mcp = parsedMcp.servers
  const mcpCount = Object.keys(mcp).length
  if (mcpCount > 0) {
    console.log(`  mcp servers: ${Object.keys(mcp).join(', ')}`)
  }

  // 4. Parse hooks
  const hooks = parseHooks(pluginDir, detection)
  const hookCount = Object.keys(hooks).length
  if (hookCount > 0) {
    console.log(`  hooks: ${Object.keys(hooks).join(', ')}`)
  }

  // 5. Find instructions
  const instructionSources = findInstructionSources(pluginDir, detection)
  const instructions = instructionSources.primary
  if (instructions) {
    console.log(`  instructions: ${instructions}`)
  }
  if (instructionSources.platformOverrides) {
    manifest.platforms = mergePlatformOverrideMaps(manifest.platforms, instructionSources.platformOverrides)
  }
  const cursorRules = parseCursorRules(pluginDir, detection)
  const openCodeDistributionSources = findOpenCodeDistributionSources(pluginDir, detection)
  if (cursorRules.length > 0) {
    manifest.platforms = {
      ...(manifest.platforms ?? {}),
      cursor: {
        ...(manifest.platforms?.cursor ?? {}),
        rules: cursorRules,
      },
    }
    console.log(`  cursor rules: ${cursorRules.length}`)
  }
  if (openCodeDistributionSources.platformOverrides) {
    manifest.platforms = mergePlatformOverrideMaps(manifest.platforms, openCodeDistributionSources.platformOverrides)
  }
  if (parsedMcp.platformOverrides) {
    manifest.platforms = mergePlatformOverrideMaps(manifest.platforms, parsedMcp.platformOverrides)
  }

  // 6. Detect directories
  const sourcePaths = detectCanonicalSourcePaths(pluginDir)
  const passthrough = detectPassthroughDirs(pluginDir, mcp)
  const persistedSkills = readMigratedSkills(pluginDir, sourcePaths)
  const inferredPermissions = inferPermissionsFromMigratedSkills(pluginDir, sourcePaths)
  const dirNames = Object.entries(sourcePaths)
    .filter(([, sourcePath]) => Boolean(sourcePath))
    .map(([, sourcePath]) => stripRelativePrefix(sourcePath!))
    .concat(passthrough.map((entry) => entry.replace(/^\.\//, '').replace(/\/$/, '')))
  if (dirNames.length > 0) {
    console.log(`  directories: ${dirNames.join(', ')}`)
  }
  if (persistedSkills.length > 0) {
    console.log(`  migrated skills: ${persistedSkills.map((skill) => skill.dirName).join(', ')}`)
  }
  if (inferredPermissions.permissions?.allow?.length) {
    console.log(`  inferred permissions: ${inferredPermissions.permissions.allow.join(', ')}`)
  }

  const codexAgentWarnings = sourcePaths.agents
    ? collectCodexAgentMigrationWarnings(
        resolve(pluginDir, stripRelativePrefix(sourcePaths.agents)),
        stripRelativePrefix(sourcePaths.agents),
      )
    : []

  // 7. Build result
  const result: MigrateResult = {
    platform: detection.platform,
    manifest,
    mcp,
    runtimeAuthMode: parsedMcp.runtimeAuthMode,
    hooks,
    permissions: inferredPermissions.permissions,
    permissionNotes: inferredPermissions.notes,
    passthrough,
    instructions,
    sourcePaths,
    persistedSkills,
    warnings: [...parsedMcp.warnings, ...codexAgentWarnings],
    extraCopyPaths: [...new Set([
      ...instructionSources.extraPaths,
      ...openCodeDistributionSources.extraPaths,
    ])].sort(),
    ...(inferredPermissions.skillPolicies.length > 0
      ? {
          compilerIntent: {
            version: 1,
            skillPolicies: inferredPermissions.skillPolicies,
          },
        }
      : {}),
  }

  // 8. Generate config
  const configContent = generateConfigTs(result)
  const configPath = resolve(outputDir, 'pluxx.config.ts')

  if (existsSync(configPath)) {
    console.error(`\nError: pluxx.config.ts already exists in ${outputDir}`)
    console.error('Remove it first or run from a different directory.')
    process.exit(1)
  }

  await writeTextFile(configPath, configContent)
  console.log(`\nGenerated pluxx.config.ts`)

  // 9. Copy directories
  const copied = copyDirectories(pluginDir, outputDir, sourcePaths, passthrough)
  if (copied.length > 0) {
    console.log(`Copied: ${copied.map(d => `./${d}/`).join(', ')}`)
  }

  sanitizeMigratedSkillFrontmatter(outputDir)

  // 10. Copy instructions file if it exists.
  if (instructions) {
    const srcInstr = resolve(pluginDir, instructions)
    const destInstr = resolve(outputDir, instructions)
    if (!existsSync(destInstr)) {
      const content = readFileSync(srcInstr, 'utf-8')
      await writeTextFile(destInstr, content)
      console.log(`Copied: ${instructions}`)
    }
  }
  for (const copiedPath of result.extraCopyPaths) {
    const srcPath = resolve(pluginDir, copiedPath)
    const destPath = resolve(outputDir, copiedPath)
    if (existsSync(destPath)) continue
    const content = readFileSync(srcPath, 'utf-8')
    await writeTextFile(destPath, content)
    console.log(`Copied: ${copiedPath}`)
  }

  // 11. Create synthetic migration metadata/taxonomy so Agent Mode and evals work.
  const taxonomyPath = resolve(outputDir, MCP_TAXONOMY_PATH)
  const metadataPath = resolve(outputDir, MCP_SCAFFOLD_METADATA_PATH)
  mkdirSync(resolve(outputDir, '.pluxx'), { recursive: true })
  await writeTextFile(taxonomyPath, `${JSON.stringify(result.persistedSkills, null, 2)}\n`)
  if (result.compilerIntent) {
    await writeTextFile(
      resolve(outputDir, PLUXX_COMPILER_INTENT_PATH),
      `${JSON.stringify(result.compilerIntent, null, 2)}\n`,
    )
  }
  await writeTextFile(metadataPath, `${JSON.stringify(buildMigratedScaffoldMetadata(result, outputDir), null, 2)}\n`)
  const generatedPluxxFiles = [
    MCP_TAXONOMY_PATH,
    ...(result.compilerIntent ? [PLUXX_COMPILER_INTENT_PATH] : []),
    MCP_SCAFFOLD_METADATA_PATH,
  ]
  console.log(`Generated: ${generatedPluxxFiles.join(', ')}`)

  if (result.warnings.length > 0) {
    console.log('')
    console.log('Migration warnings:')
    for (const warning of result.warnings) {
      console.log(`  - ${warning}`)
    }
  }

  console.log('')
  console.log('Migration complete! Next steps:')
  console.log('  1. Review pluxx.config.ts and fill in any TODOs')
  console.log('  2. Run: pluxx doctor')
  console.log('  3. Run: pluxx eval')
  console.log('  4. Run: pluxx build')
}
