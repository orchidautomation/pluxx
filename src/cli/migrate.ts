import { basename, relative, resolve } from 'path'
import { existsSync, readdirSync, mkdirSync, cpSync, readFileSync, writeFileSync } from 'fs'
import {
  MCP_SCAFFOLD_METADATA_PATH,
  MCP_TAXONOMY_PATH,
  type McpScaffoldMetadata,
  type PersistedSkill,
} from './init-from-mcp'
import type { McpServer } from '../schema'
import {
  PLUXX_COMPILER_INTENT_PATH,
  type CompilerIntentFile,
  type CompilerIntentSkillPolicy,
} from '../compiler-intent'
import { getCanonicalSkillMetadata, parseSkillMarkdown, readCanonicalSkillFiles, serializeSkillMarkdown } from '../skills'
import { writeTextFile } from '../text-files'

type DetectedPlatform = 'claude-code' | 'cursor' | 'codex' | 'opencode'

interface DetectionResult {
  platform: DetectedPlatform
  manifestPath: string
}

interface ParsedManifest {
  name?: string
  version?: string
  description?: string
  author?: { name: string; url?: string; email?: string }
  repository?: string
  license?: string
  keywords?: string[]
}

interface ParsedMcp {
  [serverName: string]: {
    url?: string
    transport?: 'http' | 'sse' | 'stdio'
    command?: string
    args?: string[]
    env?: Record<string, string>
    auth?: {
      type: 'bearer' | 'header' | 'none'
      envVar?: string
      headerName?: string
      headerTemplate?: string
    }
  }
}

interface ParsedHooks {
  [event: string]: Array<{
    command: string
    timeout?: number
    matcher?: string
  }>
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

  return null
}

// ── Manifest Parsing ────────────────────────────────────────────

function parseManifest(detection: DetectionResult): ParsedManifest {
  const raw = JSON.parse(readFileSync(detection.manifestPath, 'utf-8'))

  const result: ParsedManifest = {}

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

  return result
}

// ── MCP Parsing ─────────────────────────────────────────────────

function parseMcp(pluginDir: string, detection: DetectionResult): ParsedMcp {
  const mcpPaths = [
    resolve(pluginDir, '.mcp.json'),
    resolve(pluginDir, 'mcp.json'),
  ]

  // Also check if the manifest references an mcpServers file
  try {
    const manifest = JSON.parse(readFileSync(detection.manifestPath, 'utf-8'))
    if (manifest.mcpServers && typeof manifest.mcpServers === 'string') {
      mcpPaths.unshift(resolve(pluginDir, manifest.mcpServers))
    }
  } catch {
    // ignore
  }

  for (const mcpPath of mcpPaths) {
    if (!existsSync(mcpPath)) continue
    try {
      const raw = JSON.parse(readFileSync(mcpPath, 'utf-8'))
      const servers = raw.mcpServers ?? raw
      if (!servers || typeof servers !== 'object') continue

      const result: ParsedMcp = {}

      for (const [name, config] of Object.entries(servers)) {
        const cfg = config as Record<string, unknown>
        const entry: ParsedMcp[string] = {}

        if (cfg.url) entry.url = cfg.url as string

        // Detect transport
        if (cfg.type === 'stdio' || cfg.command) {
          entry.transport = 'stdio'
          if (cfg.command) entry.command = cfg.command as string
          if (cfg.args) entry.args = cfg.args as string[]
          if (cfg.env) entry.env = cfg.env as Record<string, string>
        } else if (cfg.type === 'sse') {
          entry.transport = 'sse'
        } else {
          entry.transport = 'http'
        }

        // Parse auth from headers
        if (cfg.headers && typeof cfg.headers === 'object') {
          const headers = cfg.headers as Record<string, string>
          const authHeader = headers['Authorization'] ?? headers['authorization']
          if (authHeader) {
            // Extract env var from patterns like "Bearer ${SOME_KEY}"
            const envMatch = authHeader.match(/\$\{(\w+)\}/)
            if (envMatch) {
              entry.auth = {
                type: 'bearer',
                envVar: envMatch[1],
                headerTemplate: authHeader.replace(/\$\{\w+\}/, '${value}'),
              }
            }
          }
        }

        // Codex-style bearer_token_env_var
        if (cfg.bearer_token_env_var) {
          entry.auth = {
            type: 'bearer',
            envVar: cfg.bearer_token_env_var as string,
          }
        }

        // Codex-style env_http_headers
        if (cfg.env_http_headers && typeof cfg.env_http_headers === 'object') {
          const envHeaders = Object.entries(cfg.env_http_headers as Record<string, string>)
          if (envHeaders.length > 0) {
            const [headerName, envVar] = envHeaders[0]
            entry.auth = {
              type: 'header',
              envVar,
              headerName,
              headerTemplate: '${value}',
            }
          }
        }

        result[name] = entry
      }

      return result
    } catch {
      continue
    }
  }

  return {}
}

// ── Hooks Parsing ───────────────────────────────────────────────

// Maps platform-specific hook event names to pluxx schema names
const HOOK_EVENT_MAP: Record<string, string> = {
  SessionStart: 'sessionStart',
  SessionEnd: 'sessionEnd',
  PreToolUse: 'preToolUse',
  PostToolUse: 'postToolUse',
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
  try {
    const manifest = JSON.parse(readFileSync(detection.manifestPath, 'utf-8'))
    if (manifest.hooks && typeof manifest.hooks === 'string') {
      hooksPaths.unshift(resolve(pluginDir, manifest.hooks))
    }
  } catch {
    // ignore
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
              if (hook.command) {
                hookEntries.push({
                  command: hook.command,
                  ...(hook.timeout && { timeout: hook.timeout }),
                })
              }
            }
          }
          // Direct format: { command: '...' }
          else if (entry.command) {
            hookEntries.push({
              command: entry.command,
              ...(entry.timeout && { timeout: entry.timeout }),
              ...(entry.matcher && { matcher: entry.matcher }),
            })
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

// ── Instructions Detection ──────────────────────────────────────

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
  developerInstructions?: string
}

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
    '---',
    '',
    `# ${title}`,
    '',
    ...bodyLines,
    '',
  ]

  return frontmatter.join('\n')
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
      runtimeAuthMode: 'inline',
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

  // Hooks
  const hookEvents = Object.keys(result.hooks)
  if (hookEvents.length > 0) {
    lines.push('')
    lines.push('  hooks: {')
    for (const event of hookEvents) {
      const entries = result.hooks[event]
      lines.push(`    ${event}: [`)
      for (const entry of entries) {
        const parts: string[] = [`command: ${quote(entry.command)}`]
        if (entry.timeout) parts.push(`timeout: ${entry.timeout}`)
        if (entry.matcher) parts.push(`matcher: ${quote(entry.matcher)}`)
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
  const mcp = parseMcp(pluginDir, detection)
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
  const instructions = findInstructions(pluginDir)
  if (instructions) {
    console.log(`  instructions: ${instructions}`)
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

  // 7. Build result
  const result: MigrateResult = {
    platform: detection.platform,
    manifest,
    mcp,
    hooks,
    permissions: inferredPermissions.permissions,
    permissionNotes: inferredPermissions.notes,
    passthrough,
    instructions,
    sourcePaths,
    persistedSkills,
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

  console.log('')
  console.log('Migration complete! Next steps:')
  console.log('  1. Review pluxx.config.ts and fill in any TODOs')
  console.log('  2. Run: pluxx doctor')
  console.log('  3. Run: pluxx eval')
  console.log('  4. Run: pluxx build')
}
