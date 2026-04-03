import { existsSync, readdirSync, readFileSync } from 'fs'
import { resolve, relative, basename, dirname } from 'path'
import { loadConfig } from '../config/load'
import type { PluginConfig } from '../schema'

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

const SKILL_NAME_REGEX = /^[a-z0-9-]+$/
const MAX_AGENT_SKILLS_DESCRIPTION = 1024
const MAX_CLAUDE_DESCRIPTION = 250
const MAX_SKILL_NAME = 64
const MAX_CODEX_DEFAULT_PROMPTS = 3
const MAX_CODEX_PROMPT_LENGTH = 128
const HEX_COLOR_REGEX = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/

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
      message: 'Brand color must be a valid hex color (#RGB or #RRGGBB).',
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

function lintMcpUrls(config: PluginConfig, issues: LintIssue[]): void {
  if (!config.mcp) return

  for (const [serverName, server] of Object.entries(config.mcp)) {
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
