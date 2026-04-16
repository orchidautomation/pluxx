import { existsSync, readdirSync, readFileSync } from 'fs'
import { resolve, relative, basename, dirname } from 'path'
import { loadConfig } from '../config/load'
import type { PluginConfig, TargetPlatform } from '../schema'
import { PLATFORM_LIMITS } from '../validation/platform-rules'
import { collectPermissionRules, permissionRulesNeedToolLevelDowngrade } from '../permissions'
import {
  CURSOR_LOOP_LIMIT_HOOK_EVENTS,
  CURSOR_SUPPORTED_HOOK_EVENTS,
  mapHookEventToPascalCase,
} from '../hook-events'

const AGENT_SKILLS_RULES = { name: { pattern: /^[a-z0-9-]+$/, maxLength: 64 }, description: { maxLength: 1024 } }
const CLAUDE_CODE_RULES = { description: { maxDisplayLength: 250 } }
const CODEX_RULES = {
  interface: { maxDefaultPrompts: 3, maxDefaultPromptLength: 128, brandColorPattern: /^#[0-9a-fA-F]{6}$/, knownCapabilities: ['Interactive', 'Write', 'Read'] as const },
  manifestPaths: { requiredPrefix: './' },
  mcp: { serverNamePattern: /^[a-z0-9_-]+$/ },
  hooks: { supportedEvents: ['SessionStart', 'PreToolUse', 'PostToolUse', 'UserPromptSubmit', 'Stop'] as const },
  agents: { maxThreadsMin: 1, maxDepthMin: 1 },
  settings: { validKeys: ['agent'] as const },
}

const CLAUDE_CODE_HOOK_EVENTS = [
  'SessionStart', 'PreToolUse', 'PostToolUse', 'UserPromptSubmit',
  'PermissionRequest', 'PermissionDenied', 'PostToolUseFailure',
  'Notification', 'SubagentStart', 'SubagentStop',
  'TaskCreated', 'TaskCompleted', 'Stop', 'StopFailure',
  'TeammateIdle', 'InstructionsLoaded', 'ConfigChange', 'CwdChanged',
  'FileChanged', 'WorktreeCreate', 'WorktreeRemove',
  'PreCompact', 'PostCompact', 'Elicitation', 'ElicitationResult', 'SessionEnd',
] as const

const CLAUDE_CODE_HOOK_TYPES = ['command', 'http', 'prompt', 'agent'] as const

const AGENT_FORBIDDEN_FRONTMATTER = ['hooks', 'mcpServers', 'permissionMode'] as const

const SEMVER_REGEX = /^\d+\.\d+\.\d+$/

const PLUGIN_NAME_KEBAB = /^[a-z0-9]+(-[a-z0-9]+)*$/

type LintLevel = 'error' | 'warning'

interface LintIssue {
  level: LintLevel
  code: string
  message: string
  file?: string
  platform?: string
}

interface FrontmatterField {
  key: string
  value: string
  rawValue: string
  quoted: boolean
}

interface ParsedFrontmatterFile {
  parsed: { fields: Map<string, FrontmatterField>; valid: boolean }
}

export interface LintResult {
  errors: number
  warnings: number
  issues: LintIssue[]
}

export interface LintProjectOptions {
  targets?: TargetPlatform[]
}

const SKILL_NAME_REGEX = AGENT_SKILLS_RULES.name.pattern
const MAX_AGENT_SKILLS_DESCRIPTION = AGENT_SKILLS_RULES.description.maxLength
const MAX_CLAUDE_DESCRIPTION = CLAUDE_CODE_RULES.description.maxDisplayLength
const MAX_SKILL_NAME = AGENT_SKILLS_RULES.name.maxLength
const MAX_CODEX_DEFAULT_PROMPTS = CODEX_RULES.interface.maxDefaultPrompts
const MAX_CODEX_PROMPT_LENGTH = CODEX_RULES.interface.maxDefaultPromptLength
const HEX_COLOR_REGEX = CODEX_RULES.interface.brandColorPattern

function pushIssue(issues: LintIssue[], issue: LintIssue): void {
  issues.push(issue)
}

function collectSkillFiles(dir: string): string[] {
  if (!existsSync(dir)) return []

  const files: string[] = []
  const entries = readdirSync(dir, { withFileTypes: true })

  for (const entry of entries) {
    const fullPath = resolve(dir, entry.name)
    if (entry.isDirectory()) {
      files.push(...collectSkillFiles(fullPath))
      continue
    }
    if (entry.isFile() && entry.name === 'SKILL.md') {
      files.push(fullPath)
    }
  }

  return files
}

function unquote(value: string): { value: string; quoted: boolean } {
  const trimmed = value.trim()
  if (trimmed.length >= 2) {
    if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
      return { value: trimmed.slice(1, -1), quoted: true }
    }
  }
  return { value: trimmed, quoted: false }
}

function parseFrontmatter(content: string): { fields: Map<string, FrontmatterField>; valid: boolean } {
  const lines = content.split(/\r?\n/)
  if (lines[0]?.trim() !== '---') {
    return { fields: new Map(), valid: false }
  }

  let endIndex = -1
  for (let i = 1; i < lines.length; i += 1) {
    if (lines[i].trim() === '---') {
      endIndex = i
      break
    }
  }

  if (endIndex === -1) {
    return { fields: new Map(), valid: false }
  }

  const fields = new Map<string, FrontmatterField>()
  for (const line of lines.slice(1, endIndex)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue

    const match = trimmed.match(/^([A-Za-z0-9_-]+)\s*:\s*(.*)$/)
    if (!match) continue

    const key = match[1]
    const rawValue = match[2]
    const parsed = unquote(rawValue)
    fields.set(key, {
      key,
      value: parsed.value,
      rawValue: rawValue.trim(),
      quoted: parsed.quoted,
    })
  }

  return { fields, valid: true }
}

function getParsedFrontmatterFile(filePath: string, cache: Map<string, ParsedFrontmatterFile>): ParsedFrontmatterFile {
  const cached = cache.get(filePath)
  if (cached) return cached

  const entry = {
    parsed: parseFrontmatter(readFileSync(filePath, 'utf-8')),
  }
  cache.set(filePath, entry)
  return entry
}

function needsQuotes(value: string): boolean {
  const startsWithSpecial = /^[\[\]{},&*!|>@`]/.test(value)
  const containsCommentChar = /\s#/.test(value)
  const containsYamlColon = /:\s/.test(value)
  const hasLeadingOrTrailingSpace = value !== value.trim()
  return startsWithSpecial || containsCommentChar || containsYamlColon || hasLeadingOrTrailingSpace
}

function normalizeWhitespace(value: string): string {
  return value.split(/\s+/).filter(Boolean).join(' ')
}

function isCodexTargetEnabled(config: PluginConfig): boolean {
  return config.targets.includes('codex')
}

function isCodexManifestRelativePath(path: string): boolean {
  if (!path.startsWith(CODEX_RULES.manifestPaths.requiredPrefix)) return false
  if (path === CODEX_RULES.manifestPaths.requiredPrefix) return false
  const relativePath = path.slice(CODEX_RULES.manifestPaths.requiredPrefix.length)
  if (relativePath.includes('..')) return false
  return !relativePath.startsWith('/') && !relativePath.startsWith('\\')
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

function lintSkillFile(
  skillFile: string,
  targets: TargetPlatform[],
  issues: LintIssue[],
  frontmatterCache: Map<string, ParsedFrontmatterFile>,
): void {
  const { parsed } = getParsedFrontmatterFile(skillFile, frontmatterCache)

  if (!parsed.valid) {
    pushIssue(issues, {
      level: 'error',
      code: 'skill-frontmatter',
      message: 'SKILL.md must start with valid YAML frontmatter delimited by --- lines.',
      file: skillFile,
      platform: 'Agent Skills',
    })
    return
  }

  const nameField = parsed.fields.get('name')
  const descriptionField = parsed.fields.get('description')

  if (!nameField?.value) {
    pushIssue(issues, {
      level: 'error',
      code: 'skill-name-missing',
      message: 'Frontmatter must include a non-empty `name` field.',
      file: skillFile,
      platform: 'Agent Skills',
    })
  } else {
    if (!SKILL_NAME_REGEX.test(nameField.value)) {
      pushIssue(issues, {
        level: 'error',
        code: 'skill-name-format',
        message: 'Skill name must be lowercase with hyphens only.',
        file: skillFile,
        platform: 'Agent Skills',
      })
    }

    if (nameField.value.length > MAX_SKILL_NAME) {
      pushIssue(issues, {
        level: 'error',
        code: 'skill-name-length',
        message: `Skill name exceeds ${MAX_SKILL_NAME} characters.`,
        file: skillFile,
        platform: 'Agent Skills',
      })
    }

    // Check skill name must match directory for platforms that require it
    const expectedDirName = basename(dirname(skillFile))
    const platformsRequiringDirMatch = targets.filter(t => PLATFORM_LIMITS[t].skillNameMustMatchDir)
    if (platformsRequiringDirMatch.length > 0 && nameField.value !== expectedDirName) {
      const platformNames = platformsRequiringDirMatch.join(', ')
      pushIssue(issues, {
        level: 'error',
        code: 'skill-name-dir-mismatch',
        message: `Skill name "${nameField.value}" must match directory name "${expectedDirName}" (required by ${platformNames}).`,
        file: skillFile,
        platform: platformsRequiringDirMatch[0],
      })
    }

    if (!nameField.quoted && needsQuotes(nameField.rawValue)) {
      pushIssue(issues, {
        level: 'warning',
        code: 'yaml-quote-special-chars',
        message: 'Frontmatter name contains YAML-sensitive characters and should be quoted.',
        file: skillFile,
        platform: 'YAML',
      })
    }
  }

  if (!descriptionField?.value) {
    pushIssue(issues, {
      level: 'error',
      code: 'skill-description-missing',
      message: 'Frontmatter must include a non-empty `description` field.',
      file: skillFile,
      platform: 'Agent Skills',
    })
  } else {
    // Check hard description max for each platform
    for (const target of targets) {
      const limits = PLATFORM_LIMITS[target]
      if (limits.skillDescriptionMax !== null && descriptionField.value.length > limits.skillDescriptionMax) {
        pushIssue(issues, {
          level: 'error',
          code: 'skill-description-length',
          message: `Description exceeds ${target} max of ${limits.skillDescriptionMax} characters.`,
          file: skillFile,
          platform: target,
        })
      }
    }

    // Check display truncation thresholds for each platform
    for (const target of targets) {
      const limits = PLATFORM_LIMITS[target]
      if (limits.skillDescriptionDisplayMax !== null && descriptionField.value.length > limits.skillDescriptionDisplayMax) {
        pushIssue(issues, {
          level: 'warning',
          code: 'skill-description-truncation',
          message: `Description will be truncated in ${target} (display limit: ${limits.skillDescriptionDisplayMax}).`,
          file: skillFile,
          platform: target,
        })
      }
    }

    if (!descriptionField.quoted && needsQuotes(descriptionField.rawValue)) {
      pushIssue(issues, {
        level: 'warning',
        code: 'yaml-quote-special-chars',
        message: 'Frontmatter description contains YAML-sensitive characters and should be quoted.',
        file: skillFile,
        platform: 'YAML',
      })
    }
  }
}

function lintBrandMetadata(config: PluginConfig, issues: LintIssue[]): void {
  if (!config.brand) return

  if (config.brand.color && !HEX_COLOR_REGEX.test(config.brand.color)) {
    pushIssue(issues, {
      level: 'error',
      code: 'brand-color-hex',
      message: 'Brand color must be a valid Codex hex color (#RRGGBB).',
      file: 'pluxx.config.ts',
      platform: 'Codex',
    })
  }

  if (config.brand.defaultPrompts) {
    if (config.brand.defaultPrompts.length > MAX_CODEX_DEFAULT_PROMPTS) {
      pushIssue(issues, {
        level: 'error',
        code: 'codex-default-prompts-count',
        message: `Codex supports at most ${MAX_CODEX_DEFAULT_PROMPTS} default prompts.`,
        file: 'pluxx.config.ts',
        platform: 'Codex',
      })
    }

    for (const prompt of config.brand.defaultPrompts) {
      if (prompt.length > MAX_CODEX_PROMPT_LENGTH) {
        pushIssue(issues, {
          level: 'error',
          code: 'codex-default-prompt-length',
          message: `A default prompt exceeds ${MAX_CODEX_PROMPT_LENGTH} characters.`,
          file: 'pluxx.config.ts',
          platform: 'Codex',
        })
      }
    }
  }
}

function lintCodexOverrides(config: PluginConfig, issues: LintIssue[]): void {
  if (!isCodexTargetEnabled(config)) return

  const iface = asRecord(config.platforms?.codex?.interface)
  if (!iface) return

  if (typeof iface.brandColor === 'string' && !HEX_COLOR_REGEX.test(iface.brandColor)) {
    pushIssue(issues, {
      level: 'error',
      code: 'codex-interface-brand-color-hex',
      message: 'Codex interface.brandColor must be a valid hex color (#RRGGBB).',
      file: 'pluxx.config.ts',
      platform: 'Codex',
    })
  }

  if (typeof iface.composerIcon === 'string' && !isCodexManifestRelativePath(iface.composerIcon)) {
    pushIssue(issues, {
      level: 'error',
      code: 'codex-interface-composer-icon-path',
      message: 'Codex interface.composerIcon must be a plugin-root-relative path starting with `./`.',
      file: 'pluxx.config.ts',
      platform: 'Codex',
    })
  }

  if (typeof iface.logo === 'string' && !isCodexManifestRelativePath(iface.logo)) {
    pushIssue(issues, {
      level: 'error',
      code: 'codex-interface-logo-path',
      message: 'Codex interface.logo must be a plugin-root-relative path starting with `./`.',
      file: 'pluxx.config.ts',
      platform: 'Codex',
    })
  }

  if (Array.isArray(iface.screenshots)) {
    for (const screenshot of iface.screenshots) {
      if (typeof screenshot !== 'string' || !isCodexManifestRelativePath(screenshot)) {
        pushIssue(issues, {
          level: 'error',
          code: 'codex-interface-screenshot-path',
          message: 'Codex interface.screenshots entries must be plugin-root-relative paths starting with `./`.',
          file: 'pluxx.config.ts',
          platform: 'Codex',
        })
        break
      }
    }
  }

  const defaultPrompt = iface.defaultPrompt
  const prompts = typeof defaultPrompt === 'string'
    ? [defaultPrompt]
    : Array.isArray(defaultPrompt) ? defaultPrompt : null

  if (prompts) {
    if (prompts.length > MAX_CODEX_DEFAULT_PROMPTS) {
      pushIssue(issues, {
        level: 'error',
        code: 'codex-default-prompts-count',
        message: `Codex supports at most ${MAX_CODEX_DEFAULT_PROMPTS} default prompts.`,
        file: 'pluxx.config.ts',
        platform: 'Codex',
      })
    }
    for (const prompt of prompts) {
      if (typeof prompt !== 'string') {
        pushIssue(issues, {
          level: 'error',
          code: 'codex-default-prompt-type',
          message: 'Codex interface.defaultPrompt must be a string or an array of strings.',
          file: 'pluxx.config.ts',
          platform: 'Codex',
        })
        break
      }
      const normalized = normalizeWhitespace(prompt)
      if (!normalized) {
        pushIssue(issues, {
          level: 'error',
          code: 'codex-default-prompt-empty',
          message: 'Codex default prompts must not be empty after whitespace normalization.',
          file: 'pluxx.config.ts',
          platform: 'Codex',
        })
      } else if (normalized.length > MAX_CODEX_PROMPT_LENGTH) {
        pushIssue(issues, {
          level: 'error',
          code: 'codex-default-prompt-length',
          message: `A default prompt exceeds ${MAX_CODEX_PROMPT_LENGTH} characters.`,
          file: 'pluxx.config.ts',
          platform: 'Codex',
        })
      }
    }
  }

  if (Array.isArray(iface.capabilities)) {
    for (const capability of iface.capabilities) {
      if (typeof capability !== 'string') {
        pushIssue(issues, {
          level: 'error',
          code: 'codex-interface-capability-type',
          message: 'Codex interface.capabilities must contain only strings.',
          file: 'pluxx.config.ts',
          platform: 'Codex',
        })
        break
      }
      if (!CODEX_RULES.interface.knownCapabilities.includes(capability as typeof CODEX_RULES.interface.knownCapabilities[number])) {
        pushIssue(issues, {
          level: 'warning',
          code: 'codex-interface-capability-unknown',
          message: `Capability "${capability}" is not in Codex's documented capability set (${CODEX_RULES.interface.knownCapabilities.join(', ')}).`,
          file: 'pluxx.config.ts',
          platform: 'Codex',
        })
      }
    }
  }
}

function lintMcpUrls(config: PluginConfig, issues: LintIssue[]): void {
  if (!config.mcp) return

  for (const [serverName, server] of Object.entries(config.mcp)) {
    if (!CODEX_RULES.mcp.serverNamePattern.test(serverName)) {
      pushIssue(issues, {
        level: 'error',
        code: 'mcp-server-name-format',
        message: `MCP server name "${serverName}" must match ${CODEX_RULES.mcp.serverNamePattern}.`,
        file: 'pluxx.config.ts',
        platform: 'MCP',
      })
    }

    if (!('url' in server) || !server.url) continue
    try {
      const parsed = new URL(server.url)
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        pushIssue(issues, {
          level: 'error',
          code: 'mcp-url-protocol',
          message: `MCP server "${serverName}" must use http:// or https:// URL.`,
          file: 'pluxx.config.ts',
          platform: 'MCP',
        })
      }
    } catch {
      pushIssue(issues, {
        level: 'error',
        code: 'mcp-url-invalid',
        message: `MCP server "${serverName}" has an invalid URL.`,
        file: 'pluxx.config.ts',
        platform: 'MCP',
      })
    }
  }
}

function lintCodexHookCompatibility(config: PluginConfig, issues: LintIssue[]): void {
  if (!isCodexTargetEnabled(config) || !config.hooks) return

  for (const hookEvent of Object.keys(config.hooks)) {
    const mappedEvent = mapHookEventToPascalCase(hookEvent)
    if (!CODEX_RULES.hooks.supportedEvents.includes(mappedEvent as typeof CODEX_RULES.hooks.supportedEvents[number])) {
      pushIssue(issues, {
        level: 'warning',
        code: 'codex-hook-event-unsupported',
        message: `Codex hooks only support ${CODEX_RULES.hooks.supportedEvents.join(', ')}; "${hookEvent}" maps to "${mappedEvent}", which is not supported.`,
        file: 'pluxx.config.ts',
        platform: 'Codex',
      })
    }
  }
}

function lintManifestPromptLimits(config: PluginConfig, issues: LintIssue[]): void {
  for (const target of config.targets) {
    const limits = PLATFORM_LIMITS[target]
    if (limits.manifestPromptCountMax === null && limits.manifestPromptMax === null) continue

    const prompts = config.brand?.defaultPrompts
    if (!prompts) continue

    if (limits.manifestPromptCountMax !== null && prompts.length > limits.manifestPromptCountMax) {
      pushIssue(issues, {
        level: 'error',
        code: 'platform-prompt-count',
        message: `${target} supports at most ${limits.manifestPromptCountMax} default prompts (found ${prompts.length}).`,
        file: 'pluxx.config.ts',
        platform: target,
      })
    }

    if (limits.manifestPromptMax !== null) {
      for (const prompt of prompts) {
        if (prompt.length > limits.manifestPromptMax) {
          pushIssue(issues, {
            level: 'error',
            code: 'platform-prompt-length',
            message: `A default prompt exceeds ${target} max of ${limits.manifestPromptMax} characters.`,
            file: 'pluxx.config.ts',
            platform: target,
          })
        }
      }
    }
  }
}

function lintInstructionsFileLimits(config: PluginConfig, dir: string, issues: LintIssue[]): void {
  for (const target of config.targets) {
    const limits = PLATFORM_LIMITS[target]
    if (limits.instructionsMaxBytes === null) continue

    // Check common instructions files
    const instructionsFiles = ['AGENTS.md', 'CLAUDE.md', 'INSTRUCTIONS.md']
    for (const file of instructionsFiles) {
      const filePath = resolve(dir, file)
      if (!existsSync(filePath)) continue

      const content = readFileSync(filePath, 'utf-8')
      const byteSize = Buffer.byteLength(content, 'utf-8')
      if (byteSize > limits.instructionsMaxBytes) {
        pushIssue(issues, {
          level: 'warning',
          code: 'platform-instructions-size',
          message: `${file} is ${byteSize} bytes, exceeding ${target} max of ${limits.instructionsMaxBytes} bytes.`,
          file,
          platform: target,
        })
      }
    }
  }
}

function lintRulesFileLimits(config: PluginConfig, dir: string, issues: LintIssue[]): void {
  for (const target of config.targets) {
    const limits = PLATFORM_LIMITS[target]
    if (limits.rulesMaxLines === null) continue

    // Check common rules files
    const rulesFiles = ['.cursorrules', '.clinerules']
    for (const file of rulesFiles) {
      const filePath = resolve(dir, file)
      if (!existsSync(filePath)) continue

      const content = readFileSync(filePath, 'utf-8')
      const lineCount = content.split(/\r?\n/).length
      if (lineCount > limits.rulesMaxLines) {
        pushIssue(issues, {
          level: 'warning',
          code: 'platform-rules-lines',
          message: `${file} has ${lineCount} lines, exceeding ${target} recommended max of ${limits.rulesMaxLines} lines.`,
          file,
          platform: target,
        })
      }
    }
  }
}

// ── Gotcha #1: Plugin directories must be at plugin root, not inside .claude-plugin/ ──
function lintPluginDirectoryPlacement(dir: string, issues: LintIssue[]): void {
  const pluginSubDirs = ['commands', 'agents', 'skills', 'hooks']
  const nestedParents = ['.claude-plugin', '.plugin']

  for (const parent of nestedParents) {
    for (const subDir of pluginSubDirs) {
      const nestedPath = resolve(dir, parent, subDir)
      if (existsSync(nestedPath)) {
        pushIssue(issues, {
          level: 'error',
          code: 'plugin-dir-nested',
          message: `"${subDir}/" must be at the plugin root, not inside ${parent}/. Move ${parent}/${subDir}/ to ./${subDir}/`,
          file: `${parent}/${subDir}/`,
          platform: 'Claude Code',
        })
      }
    }
  }
}

// ── Gotcha #2 & #3: Manifest paths must be relative with ./ prefix, no ../ traversal ──
function lintManifestPaths(config: PluginConfig, issues: LintIssue[]): void {
  const pathFields: { name: string; value: string | undefined }[] = [
    { name: 'skills', value: config.skills },
    { name: 'commands', value: config.commands },
    { name: 'agents', value: config.agents },
    { name: 'instructions', value: config.instructions },
    { name: 'scripts', value: config.scripts },
    { name: 'assets', value: config.assets },
    { name: 'outDir', value: config.outDir },
  ]

  for (const field of pathFields) {
    if (!field.value) continue

    if (!field.value.startsWith('./')) {
      pushIssue(issues, {
        level: 'error',
        code: 'manifest-path-prefix',
        message: `Config path "${field.name}" must start with "./" (got "${field.value}").`,
        file: 'pluxx.config.ts',
        platform: 'Plugin Structure',
      })
    }

    if (field.value.includes('..')) {
      pushIssue(issues, {
        level: 'error',
        code: 'manifest-path-traversal',
        message: `Config path "${field.name}" must not traverse outside plugin root (contains "..").`,
        file: 'pluxx.config.ts',
        platform: 'Plugin Structure',
      })
    }
  }
}

// ── Gotcha #4: Plugin name must be kebab-case ──
function lintPluginName(config: PluginConfig, issues: LintIssue[]): void {
  if (!PLUGIN_NAME_KEBAB.test(config.name)) {
    pushIssue(issues, {
      level: 'error',
      code: 'plugin-name-kebab',
      message: `Plugin name "${config.name}" must be kebab-case (lowercase letters, numbers, hyphens, no spaces).`,
      file: 'pluxx.config.ts',
      platform: 'Plugin Structure',
    })
  }
}

// ── Gotcha #5 & #6: Validate hook event names and hook types ──
function lintHookEvents(config: PluginConfig, issues: LintIssue[]): void {
  if (!config.hooks) return

  for (const [hookEvent, hookEntries] of Object.entries(config.hooks)) {
    const pascalEvent = mapHookEventToPascalCase(hookEvent)
    if (!(CLAUDE_CODE_HOOK_EVENTS as readonly string[]).includes(pascalEvent)) {
      pushIssue(issues, {
        level: 'warning',
        code: 'hook-event-unknown',
        message: `Hook event "${hookEvent}" (as "${pascalEvent}") is not a recognized Claude Code hook event. Valid events: ${CLAUDE_CODE_HOOK_EVENTS.join(', ')}`,
        file: 'pluxx.config.ts',
        platform: 'Claude Code',
      })
    }

    if (!Array.isArray(hookEntries)) continue
    for (const entry of hookEntries) {
      if (!entry || typeof entry !== 'object') continue
      const hookType = (entry as Record<string, unknown>).type as string | undefined
      if (hookType && !(CLAUDE_CODE_HOOK_TYPES as readonly string[]).includes(hookType)) {
        pushIssue(issues, {
          level: 'error',
          code: 'hook-type-invalid',
          message: `Hook type "${hookType}" in "${hookEvent}" is not valid. Must be one of: ${CLAUDE_CODE_HOOK_TYPES.join(', ')}`,
          file: 'pluxx.config.ts',
          platform: 'Claude Code',
        })
      }
    }
  }
}

// ── Gotcha #7: Agent frontmatter must not include hooks, mcpServers, permissionMode ──
function lintAgentFrontmatter(
  agentFiles: string[],
  issues: LintIssue[],
  frontmatterCache: Map<string, ParsedFrontmatterFile>,
): void {
  for (const file of agentFiles) {
    const { parsed } = getParsedFrontmatterFile(file, frontmatterCache)
    if (!parsed.valid) continue

    for (const forbidden of AGENT_FORBIDDEN_FRONTMATTER) {
      if (parsed.fields.has(forbidden)) {
        pushIssue(issues, {
          level: 'warning',
          code: 'agent-forbidden-frontmatter',
          message: `Agent file uses "${forbidden}" in frontmatter. Plugin agents do not support hooks, mcpServers, or permissionMode.`,
          file,
          platform: 'Claude Code',
        })
      }
    }
  }
}

function collectMarkdownFiles(dir: string): string[] {
  if (!existsSync(dir)) return []
  const files: string[] = []
  const entries = readdirSync(dir, { withFileTypes: true })
  for (const entry of entries) {
    const fullPath = resolve(dir, entry.name)
    if (entry.isDirectory()) {
      files.push(...collectMarkdownFiles(fullPath))
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      files.push(fullPath)
    }
  }
  return files
}

// ── Gotcha #8: Agent isolation field only accepts "worktree" ──
function lintAgentIsolation(
  agentFiles: string[],
  issues: LintIssue[],
  frontmatterCache: Map<string, ParsedFrontmatterFile>,
): void {
  for (const file of agentFiles) {
    const { parsed } = getParsedFrontmatterFile(file, frontmatterCache)
    if (!parsed.valid) continue

    const isolation = parsed.fields.get('isolation')
    if (isolation && isolation.value !== 'worktree') {
      pushIssue(issues, {
        level: 'error',
        code: 'agent-isolation-invalid',
        message: `Agent isolation field must be "worktree" (got "${isolation.value}").`,
        file,
        platform: 'Claude Code',
      })
    }
  }
}

// ── Gotcha #9: Warn if absolute paths used in hooks/MCP instead of ${CLAUDE_PLUGIN_ROOT} ──
function lintAbsolutePaths(config: PluginConfig, issues: LintIssue[]): void {
  const absolutePathPattern = /^\/[a-zA-Z]|^[A-Z]:\\/

  // Check hooks commands
  if (config.hooks) {
    for (const [eventName, hookEntries] of Object.entries(config.hooks)) {
      if (!Array.isArray(hookEntries)) continue
      for (const entry of hookEntries) {
        if (!entry || typeof entry !== 'object') continue
        const cmd = (entry as Record<string, unknown>).command
        if (typeof cmd === 'string' && absolutePathPattern.test(cmd)) {
          pushIssue(issues, {
            level: 'warning',
            code: 'hook-absolute-path',
            message: `Hook "${eventName}" uses an absolute path in command. Use \${CLAUDE_PLUGIN_ROOT} for portability.`,
            file: 'pluxx.config.ts',
            platform: 'Claude Code',
          })
        }
      }
    }
  }

  // Check MCP server commands
  if (config.mcp) {
    for (const [serverName, server] of Object.entries(config.mcp)) {
      if ('command' in server && typeof server.command === 'string' && absolutePathPattern.test(server.command)) {
        pushIssue(issues, {
          level: 'warning',
          code: 'mcp-absolute-path',
          message: `MCP server "${serverName}" uses an absolute path in command. Use \${CLAUDE_PLUGIN_ROOT} for portability.`,
          file: 'pluxx.config.ts',
          platform: 'Claude Code',
        })
      }
    }
  }
}

// ── Gotcha #11: settings.json only supports "agent" key ──
function lintSettingsJson(dir: string, issues: LintIssue[]): void {
  const settingsPath = resolve(dir, 'settings.json')
  if (!existsSync(settingsPath)) return

  try {
    const content = JSON.parse(readFileSync(settingsPath, 'utf-8'))
    if (typeof content === 'object' && content !== null) {
      const keys = Object.keys(content)
      for (const key of keys) {
        if (!(CODEX_RULES.settings.validKeys as readonly string[]).includes(key)) {
          pushIssue(issues, {
            level: 'warning',
            code: 'settings-unknown-key',
            message: `settings.json key "${key}" is not recognized. Currently only "${CODEX_RULES.settings.validKeys.join(', ')}" is supported.`,
            file: 'settings.json',
            platform: 'Claude Code',
          })
        }
      }
    }
  } catch {
    // If settings.json can't be parsed, skip
  }
}

// ── Gotcha #12: Version must follow semver ──
function lintVersionFormat(config: PluginConfig, issues: LintIssue[]): void {
  if (!SEMVER_REGEX.test(config.version)) {
    pushIssue(issues, {
      level: 'error',
      code: 'version-semver',
      message: `Version "${config.version}" must follow semantic versioning (MAJOR.MINOR.PATCH).`,
      file: 'pluxx.config.ts',
      platform: 'Plugin Structure',
    })
  }
}

// ── Commands are a first-class optional surface alongside skills ──
function lintLegacyCommandsDir(dir: string, config: PluginConfig, issues: LintIssue[]): void {
  void dir
  void config
  void issues
}

// ── Gotcha #15: Codex agents.max_threads minimum is 1 ──
// ── Gotcha #16: Codex agents.max_depth minimum is 1 ──
function lintCodexAgentsConfig(config: PluginConfig, issues: LintIssue[]): void {
  if (!isCodexTargetEnabled(config)) return

  const codexOverrides = asRecord(config.platforms?.codex)
  if (!codexOverrides) return

  const agents = asRecord(codexOverrides.agents)
  if (!agents) return

  if (typeof agents.max_threads === 'number' && agents.max_threads < CODEX_RULES.agents.maxThreadsMin) {
    pushIssue(issues, {
      level: 'error',
      code: 'codex-agents-max-threads',
      message: `Codex agents.max_threads must be at least ${CODEX_RULES.agents.maxThreadsMin} (got ${agents.max_threads}).`,
      file: 'pluxx.config.ts',
      platform: 'Codex',
    })
  }

  if (typeof agents.max_depth === 'number' && agents.max_depth < CODEX_RULES.agents.maxDepthMin) {
    pushIssue(issues, {
      level: 'error',
      code: 'codex-agents-max-depth',
      message: `Codex agents.max_depth must be at least ${CODEX_RULES.agents.maxDepthMin} (got ${agents.max_depth}).`,
      file: 'pluxx.config.ts',
      platform: 'Codex',
    })
  }
}

// ── Gotcha #18: Codex hooks live in Codex config, not plugin bundles ──
function lintCodexHooksExternalConfig(config: PluginConfig, issues: LintIssue[]): void {
  if (!isCodexTargetEnabled(config) || !config.hooks) return
  if (Object.keys(config.hooks).length === 0) return

  const codexOverrides = asRecord(config.platforms?.codex)
  const features = codexOverrides ? asRecord(codexOverrides.features) : null
  const hasPluxxCodexHooksFlag = features && features.codex_hooks === true

  const featureNote = hasPluxxCodexHooksFlag
    ? 'Note: `platforms.codex.features.codex_hooks` in pluxx.config.ts is not emitted into Codex plugin output today.'
    : 'If you want Codex to run these hooks, configure them in `~/.codex/hooks.json` or `<repo>/.codex/hooks.json` and enable `codex_hooks = true` in Codex itself.'

  pushIssue(issues, {
    level: 'warning',
    code: 'codex-hooks-external-config',
    message: `Codex plugin docs currently separate hook configuration from plugin packaging, so Pluxx does not bundle Codex hooks into generated plugin output. ${featureNote}`,
    file: 'pluxx.config.ts',
    platform: 'Codex',
  })
}

// ── Cursor-specific hook + frontmatter checks (fixes failing test) ──
function lintCursorHooks(config: PluginConfig, issues: LintIssue[]): void {
  if (!config.targets.includes('cursor') || !config.hooks) return

  for (const [hookEvent, hookEntries] of Object.entries(config.hooks)) {
    if (!(CURSOR_SUPPORTED_HOOK_EVENTS as readonly string[]).includes(hookEvent)) {
      pushIssue(issues, {
        level: 'warning',
        code: 'cursor-hook-event-unknown',
        message: `Cursor does not support hook event "${hookEvent}". Supported: ${CURSOR_SUPPORTED_HOOK_EVENTS.join(', ')}`,
        file: 'pluxx.config.ts',
        platform: 'Cursor',
      })
    }

    if (!Array.isArray(hookEntries)) continue
    for (const entry of hookEntries) {
      if (!entry || typeof entry !== 'object') continue
      const rec = entry as Record<string, unknown>

      if (rec.loop_limit !== undefined && !(CURSOR_LOOP_LIMIT_HOOK_EVENTS as readonly string[]).includes(hookEvent)) {
        pushIssue(issues, {
          level: 'warning',
          code: 'cursor-hook-loop-limit-unsupported-event',
          message: `Hook "${hookEvent}" has loop_limit but Cursor only supports loop_limit on ${CURSOR_LOOP_LIMIT_HOOK_EVENTS.join(', ')}.`,
          file: 'pluxx.config.ts',
          platform: 'Cursor',
        })
      }
    }
  }
}

function lintCursorSkillFrontmatter(
  config: PluginConfig,
  skillFiles: string[],
  issues: LintIssue[],
  frontmatterCache: Map<string, ParsedFrontmatterFile>,
): void {
  if (!config.targets.includes('cursor')) return

  const cursorSupportedFrontmatter = ['name', 'description', 'license', 'compatibility', 'metadata', 'disable-model-invocation']

  for (const skillFile of skillFiles) {
    const { parsed } = getParsedFrontmatterFile(skillFile, frontmatterCache)
    if (!parsed.valid) continue

    for (const [key] of parsed.fields) {
      if (!cursorSupportedFrontmatter.includes(key)) {
        pushIssue(issues, {
          level: 'warning',
          code: 'cursor-skill-frontmatter-unsupported',
          message: `Skill frontmatter field "${key}" is not supported by Cursor. Supported: ${cursorSupportedFrontmatter.join(', ')}`,
          file: skillFile,
          platform: 'Cursor',
        })
      }
    }
  }
}

function lintSkillListingBudgets(
  skillFiles: string[],
  targets: TargetPlatform[],
  issues: LintIssue[],
  frontmatterCache: Map<string, ParsedFrontmatterFile>,
): void {
  for (const target of targets) {
    const budget = PLATFORM_LIMITS[target].skillListingBudgetMax
    if (budget === null) continue

    let total = 0
    for (const skillFile of skillFiles) {
      const { parsed } = getParsedFrontmatterFile(skillFile, frontmatterCache)
      if (!parsed.valid) continue
      const description = parsed.fields.get('description')?.value
      if (description) total += description.length
    }

    if (total > budget) {
      pushIssue(issues, {
        level: 'warning',
        code: 'platform-skill-listing-budget',
        message: `Combined skill descriptions total ${total} characters, exceeding ${target} listing budget of ${budget} characters.`,
        file: 'skills/',
        platform: target,
      })
    }
  }
}

function lintCursorRuleContentLimits(config: PluginConfig, issues: LintIssue[]): void {
  if (!config.targets.includes('cursor')) return

  const maxLines = PLATFORM_LIMITS.cursor.rulesMaxLines
  if (maxLines === null) return

  for (const rule of config.platforms?.cursor?.rules ?? []) {
    const lineCount = (rule.content ?? '').split(/\r?\n/).length
    if (lineCount > maxLines) {
      pushIssue(issues, {
        level: 'warning',
        code: 'platform-rules-lines',
        message: `Cursor rule "${rule.description}" has ${lineCount} lines, exceeding the recommended max of ${maxLines} lines.`,
        file: 'pluxx.config.ts',
        platform: 'cursor',
      })
    }
  }
}

function lintPermissions(config: PluginConfig, issues: LintIssue[]): void {
  if (!config.permissions) return

  for (const action of ['allow', 'ask', 'deny'] as const) {
    const seen = new Set<string>()
    for (const raw of config.permissions[action] ?? []) {
      const trimmed = raw.trim()

      if (seen.has(trimmed)) {
        pushIssue(issues, {
          level: 'warning',
          code: 'permissions-duplicate',
          message: `Permission rule "${trimmed}" is duplicated in "${action}".`,
          file: 'pluxx.config.ts',
          platform: 'Permissions',
        })
      }

      seen.add(trimmed)
    }
  }

  const rules = collectPermissionRules(config.permissions)
  const seen = new Map<string, Set<string>>()

  for (const rule of rules) {
    const key = `${rule.kind}:${rule.pattern}`
    const actions = seen.get(key) ?? new Set<string>()
    actions.add(rule.action)
    seen.set(key, actions)
  }

  for (const [key, actions] of seen) {
    if (actions.size > 1) {
      pushIssue(issues, {
        level: 'warning',
        code: 'permissions-conflict',
        message: `Permission rule "${key}" is declared in multiple actions (${Array.from(actions).join(', ')}). Deny should win, but this intent should be made explicit.`,
        file: 'pluxx.config.ts',
        platform: 'Permissions',
      })
    }
  }

  if (config.targets.includes('codex')) {
    pushIssue(issues, {
      level: 'warning',
      code: 'codex-permissions-external-config',
      message: 'Codex does not currently support plugin-packaged permission enforcement. Mirror canonical permissions into Codex user/admin config or external hooks for real enforcement (Pluxx emits .codex/permissions.generated.json as a starter mirror).',
      file: 'pluxx.config.ts',
      platform: 'Codex',
    })
  }

  if (rules.some(rule => rule.kind === 'Skill')) {
    const nonClaudeTargets = config.targets.filter(target => target !== 'claude-code')
    if (nonClaudeTargets.length > 0) {
      pushIssue(issues, {
        level: 'warning',
        code: 'permissions-skill-selector-limited',
        message: `Skill(...) permission rules are Claude-style and will require downgrade or docs-only handling on ${nonClaudeTargets.join(', ')}.`,
        file: 'pluxx.config.ts',
        platform: 'Permissions',
      })
    }
  }

  if (config.targets.includes('opencode') && permissionRulesNeedToolLevelDowngrade(config.permissions)) {
    pushIssue(issues, {
      level: 'warning',
      code: 'permissions-opencode-downgrade',
      message: 'OpenCode permission output is currently tool-level. Selector patterns like file globs and specific MCP tool names are downgraded to coarse tool permissions there.',
      file: 'pluxx.config.ts',
      platform: 'OpenCode',
    })
  }
}

function sortIssues(issues: LintIssue[]): LintIssue[] {
  return [...issues].sort((a, b) => {
    if (a.level === b.level) {
      return a.code.localeCompare(b.code)
    }
    return a.level === 'error' ? -1 : 1
  })
}

export async function lintProject(
  dir: string = process.cwd(),
  options: LintProjectOptions = {},
): Promise<LintResult> {
  const issues: LintIssue[] = []
  const frontmatterCache = new Map<string, ParsedFrontmatterFile>()

  let config: PluginConfig
  try {
    config = await loadConfig(dir)
  } catch (err) {
    pushIssue(issues, {
      level: 'error',
      code: 'config-invalid',
      message: err instanceof Error ? err.message : String(err),
      file: 'pluxx.config.ts',
      platform: 'Config',
    })
    return { errors: 1, warnings: 0, issues }
  }

  const lintConfig: PluginConfig = options.targets
    ? { ...config, targets: options.targets }
    : config

  // Plugin structure checks
  lintPluginName(lintConfig, issues)
  lintVersionFormat(lintConfig, issues)
  lintManifestPaths(lintConfig, issues)
  lintPluginDirectoryPlacement(dir, issues)
  lintAbsolutePaths(lintConfig, issues)
  lintSettingsJson(dir, issues)
  lintLegacyCommandsDir(dir, lintConfig, issues)

  // Hook and event validation
  lintHookEvents(lintConfig, issues)

  // Agent file checks
  const agentsDir = resolve(dir, 'agents')
  const agentFiles = existsSync(agentsDir) ? collectMarkdownFiles(agentsDir) : []
  lintAgentFrontmatter(agentFiles, issues, frontmatterCache)
  lintAgentIsolation(agentFiles, issues, frontmatterCache)

  // MCP and brand
  lintMcpUrls(lintConfig, issues)
  lintBrandMetadata(lintConfig, issues)
  lintCodexOverrides(lintConfig, issues)
  lintCodexHookCompatibility(lintConfig, issues)
  lintCodexAgentsConfig(lintConfig, issues)
  lintCodexHooksExternalConfig(lintConfig, issues)
  lintPermissions(lintConfig, issues)

  // Cursor-specific checks
  lintCursorHooks(lintConfig, issues)
  lintCursorRuleContentLimits(lintConfig, issues)

  const skillsDir = resolve(dir, lintConfig.skills)
  let skillFiles: string[] = []
  if (!existsSync(skillsDir)) {
    pushIssue(issues, {
      level: 'error',
      code: 'skills-dir-missing',
      message: `Skills directory not found: ${lintConfig.skills}`,
      file: 'pluxx.config.ts',
      platform: 'Agent Skills',
    })
  } else {
    skillFiles = collectSkillFiles(skillsDir)
    if (skillFiles.length === 0) {
      pushIssue(issues, {
        level: 'warning',
        code: 'skills-none-found',
        message: `No SKILL.md files found in ${lintConfig.skills}`,
        file: 'pluxx.config.ts',
        platform: 'Agent Skills',
      })
    }

    for (const skillFile of skillFiles) {
      lintSkillFile(skillFile, lintConfig.targets, issues, frontmatterCache)
    }
  }

  // Cursor skill frontmatter checks
  lintCursorSkillFrontmatter(lintConfig, skillFiles, issues, frontmatterCache)
  lintSkillListingBudgets(skillFiles, lintConfig.targets, issues, frontmatterCache)

  // Platform limit checks for manifest prompts (Codex)
  lintManifestPromptLimits(lintConfig, issues)

  // Platform limit checks for instructions file size
  lintInstructionsFileLimits(lintConfig, dir, issues)

  // Platform limit checks for rules file line count
  lintRulesFileLimits(lintConfig, dir, issues)

  const sorted = sortIssues(issues)
  const errors = sorted.filter(i => i.level === 'error').length
  const warnings = sorted.filter(i => i.level === 'warning').length

  return { errors, warnings, issues: sorted }
}

export function printLintResult(result: LintResult, dir: string = process.cwd()): void {
  for (const issue of result.issues) {
    const levelLabel = issue.level === 'error' ? 'ERROR' : 'WARN '
    const platformLabel = issue.platform ? `[${issue.platform}] ` : ''
    const loc = issue.file ? `${relative(dir, resolve(dir, issue.file))}: ` : ''
    console.log(`${levelLabel} ${issue.code} ${platformLabel}${loc}${issue.message}`)
  }

  if (result.errors === 0 && result.warnings === 0) {
    console.log('No lint issues found.')
  } else {
    console.log('')
    console.log(`Lint summary: ${result.errors} error(s), ${result.warnings} warning(s)`)
  }
}

export async function runLint(dir: string = process.cwd()): Promise<number> {
  const result = await lintProject(dir)
  printLintResult(result, dir)
  return result.errors > 0 ? 1 : 0
}
