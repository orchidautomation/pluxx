import { existsSync, readdirSync, readFileSync } from 'fs'
import { resolve, relative, basename, dirname } from 'path'
import { loadConfig } from '../config/load'
import type { PluginConfig } from '../schema'
import { AGENT_SKILLS_RULES, CLAUDE_CODE_RULES, CODEX_RULES } from '../validation/platform-rules'

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

export interface LintResult {
  errors: number
  warnings: number
  issues: LintIssue[]
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

function lintSkillFile(skillFile: string, issues: LintIssue[]): void {
  const content = readFileSync(skillFile, 'utf-8')
  const parsed = parseFrontmatter(content)

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

    const expectedDirName = basename(dirname(skillFile))
    if (nameField.value !== expectedDirName) {
      pushIssue(issues, {
        level: 'error',
        code: 'cursor-dir-name-match',
        message: `Skill name "${nameField.value}" must match directory name "${expectedDirName}".`,
        file: skillFile,
        platform: 'Cursor',
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
    if (descriptionField.value.length > MAX_AGENT_SKILLS_DESCRIPTION) {
      pushIssue(issues, {
        level: 'error',
        code: 'skill-description-length',
        message: `Description exceeds Agent Skills max of ${MAX_AGENT_SKILLS_DESCRIPTION} characters.`,
        file: skillFile,
        platform: 'Agent Skills',
      })
    }

    if (descriptionField.value.length > MAX_CLAUDE_DESCRIPTION) {
      pushIssue(issues, {
        level: 'warning',
        code: 'claude-description-truncation',
        message: `Description exceeds Claude Code display limit (${MAX_CLAUDE_DESCRIPTION}) and will be truncated.`,
        file: skillFile,
        platform: 'Claude Code',
      })
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
    if (!CODEX_RULES.hooks.supportedEvents.includes(hookEvent as typeof CODEX_RULES.hooks.supportedEvents[number])) {
      pushIssue(issues, {
        level: 'warning',
        code: 'codex-hook-event-unsupported',
        message: `Codex hooks only support ${CODEX_RULES.hooks.supportedEvents.join(', ')}; "${hookEvent}" will not map cleanly.`,
        file: 'pluxx.config.ts',
        platform: 'Codex',
      })
    }
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

export async function lintProject(dir: string = process.cwd()): Promise<LintResult> {
  const issues: LintIssue[] = []

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

  lintMcpUrls(config, issues)
  lintBrandMetadata(config, issues)
  lintCodexOverrides(config, issues)
  lintCodexHookCompatibility(config, issues)

  const skillsDir = resolve(dir, config.skills)
  if (!existsSync(skillsDir)) {
    pushIssue(issues, {
      level: 'error',
      code: 'skills-dir-missing',
      message: `Skills directory not found: ${config.skills}`,
      file: 'pluxx.config.ts',
      platform: 'Agent Skills',
    })
  } else {
    const skillFiles = collectSkillFiles(skillsDir)
    if (skillFiles.length === 0) {
      pushIssue(issues, {
        level: 'warning',
        code: 'skills-none-found',
        message: `No SKILL.md files found in ${config.skills}`,
        file: 'pluxx.config.ts',
        platform: 'Agent Skills',
      })
    }

    for (const skillFile of skillFiles) {
      lintSkillFile(skillFile, issues)
    }
  }

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
