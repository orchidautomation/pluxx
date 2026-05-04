import { existsSync, readdirSync, readFileSync, statSync } from 'fs'
import { relative, resolve } from 'path'

export interface SkillFrontmatterField {
  key: string
  value: string
  rawValue: string
  quoted: boolean
}

export interface ParsedSkillMarkdown {
  hasValidFrontmatter: boolean
  frontmatterLines: string[]
  frontmatterFields: Map<string, SkillFrontmatterField>
  body: string
  name?: string
  description?: string
  whenToUse?: string
  argumentHint?: string
  arguments: string[]
  disableModelInvocation?: boolean
  userInvocable?: boolean
  allowedTools: string[]
  model?: string
  effort?: string
  context?: string
  agent?: string
  hooks?: unknown
  paths: string[]
  shell?: string
  firstHeading?: string
}

export interface ParsedSkillMarkdownFile extends ParsedSkillMarkdown {
  filePath: string
  relativeDir: string
  dirName: string
}

function unquote(value: string): { value: string; quoted: boolean } {
  const trimmed = value.trim()
  if (trimmed.length >= 2) {
    if (
      (trimmed.startsWith('"') && trimmed.endsWith('"'))
      || (trimmed.startsWith("'") && trimmed.endsWith("'"))
    ) {
      return { value: trimmed.slice(1, -1), quoted: true }
    }
  }
  return { value: trimmed, quoted: false }
}

function firstHeading(content: string): string | undefined {
  for (const line of content.split(/\r?\n/)) {
    const match = /^#\s+(.+)$/.exec(line.trim())
    if (match?.[1]?.trim()) return match[1].trim()
  }
  return undefined
}

function splitMarkdownFrontmatter(content: string): {
  hasValidFrontmatter: boolean
  frontmatterLines: string[]
  body: string
} {
  const lines = content.split(/\r?\n/)
  if (lines[0]?.trim() !== '---') {
    return {
      hasValidFrontmatter: false,
      frontmatterLines: [],
      body: content,
    }
  }

  let endIndex = -1
  for (let index = 1; index < lines.length; index += 1) {
    if (lines[index].trim() === '---') {
      endIndex = index
      break
    }
  }

  if (endIndex === -1) {
    return {
      hasValidFrontmatter: false,
      frontmatterLines: [],
      body: content,
    }
  }

  return {
    hasValidFrontmatter: true,
    frontmatterLines: lines.slice(1, endIndex),
    body: lines.slice(endIndex + 1).join('\n'),
  }
}

function parseFrontmatterFields(frontmatterLines: string[]): Map<string, SkillFrontmatterField> {
  const fields = new Map<string, SkillFrontmatterField>()

  for (const line of frontmatterLines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue

    const match = /^([A-Za-z0-9_-]+)\s*:\s*(.*)$/.exec(trimmed)
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

  return fields
}

function parseAllowedTools(
  hasValidFrontmatter: boolean,
  frontmatterLines: string[],
  frontmatterFields: Map<string, SkillFrontmatterField>,
): string[] {
  if (!hasValidFrontmatter || !frontmatterFields.has('allowed-tools')) return []

  const inlineField = frontmatterFields.get('allowed-tools')
  const inlineValue = inlineField?.rawValue.trim() ?? ''
  if (inlineValue) {
    const raw = inlineValue.startsWith('[') && inlineValue.endsWith(']')
      ? inlineValue.slice(1, -1)
      : inlineValue
    return raw
      .split(',')
      .map(part => unquote(part).value)
      .map(part => part.trim())
      .filter(Boolean)
  }

  const lineIndex = frontmatterLines.findIndex((line) => /^allowed-tools:\s*$/i.test(line.trim()))
  if (lineIndex === -1) return []

  const tools: string[] = []
  for (let index = lineIndex + 1; index < frontmatterLines.length; index += 1) {
    const itemMatch = /^\s*-\s+(.+)$/.exec(frontmatterLines[index])
    if (!itemMatch?.[1]) break
    const value = unquote(itemMatch[1]).value.trim()
    if (value) tools.push(value)
  }

  return tools
}

function parseBooleanField(frontmatterFields: Map<string, SkillFrontmatterField>, key: string): boolean | undefined {
  const value = frontmatterFields.get(key)?.value.trim().toLowerCase()
  if (value === 'true') return true
  if (value === 'false') return false
  return undefined
}

function parseInlineStringArray(rawValue: string): string[] {
  const trimmed = rawValue.trim()
  if (!trimmed.startsWith('[') || !trimmed.endsWith(']')) return []

  const inner = trimmed.slice(1, -1).trim()
  if (!inner) return []

  return inner
    .split(',')
    .map(part => unquote(part).value.trim())
    .filter(Boolean)
}

function parseStringArrayField(frontmatterFields: Map<string, SkillFrontmatterField>, key: string): string[] {
  const rawValue = frontmatterFields.get(key)?.rawValue
  if (!rawValue) return []
  return parseInlineStringArray(rawValue)
}

function parseJsonField(frontmatterFields: Map<string, SkillFrontmatterField>, key: string): unknown {
  const rawValue = frontmatterFields.get(key)?.rawValue?.trim()
  if (!rawValue) return undefined
  if (!(rawValue.startsWith('{') || rawValue.startsWith('['))) return undefined

  try {
    return JSON.parse(rawValue)
  } catch {
    return undefined
  }
}

export function parseSkillMarkdown(content: string): ParsedSkillMarkdown {
  const {
    hasValidFrontmatter,
    frontmatterLines,
    body,
  } = splitMarkdownFrontmatter(content)
  const frontmatterFields = parseFrontmatterFields(frontmatterLines)

  return {
    hasValidFrontmatter,
    frontmatterLines,
    frontmatterFields,
    body,
    name: frontmatterFields.get('name')?.value,
    description: frontmatterFields.get('description')?.value,
    whenToUse: frontmatterFields.get('when_to_use')?.value,
    argumentHint: frontmatterFields.get('argument-hint')?.value,
    arguments: parseStringArrayField(frontmatterFields, 'arguments'),
    disableModelInvocation: parseBooleanField(frontmatterFields, 'disable-model-invocation'),
    userInvocable: parseBooleanField(frontmatterFields, 'user-invocable'),
    allowedTools: parseAllowedTools(hasValidFrontmatter, frontmatterLines, frontmatterFields),
    model: frontmatterFields.get('model')?.value,
    effort: frontmatterFields.get('effort')?.value,
    context: frontmatterFields.get('context')?.value,
    agent: frontmatterFields.get('agent')?.value,
    hooks: parseJsonField(frontmatterFields, 'hooks'),
    paths: parseStringArrayField(frontmatterFields, 'paths'),
    shell: frontmatterFields.get('shell')?.value,
    firstHeading: firstHeading(body),
  }
}

export function walkSkillFiles(skillsDir: string | undefined): string[] {
  if (!skillsDir || !existsSync(skillsDir)) return []

  const entries = readdirSync(skillsDir)
  const files: string[] = []

  for (const entry of entries) {
    const fullPath = resolve(skillsDir, entry)
    const stat = statSync(fullPath)
    if (stat.isDirectory()) {
      files.push(...walkSkillFiles(fullPath))
      continue
    }
    if (stat.isFile() && entry === 'SKILL.md') {
      files.push(fullPath)
    }
  }

  return files
}

export function readSkillMarkdownFile(filePath: string): ParsedSkillMarkdown {
  return parseSkillMarkdown(readFileSync(filePath, 'utf-8'))
}

export function readCanonicalSkillFiles(skillsDir: string | undefined): ParsedSkillMarkdownFile[] {
  if (!skillsDir || !existsSync(skillsDir)) return []

  return walkSkillFiles(skillsDir)
    .sort((a, b) => a.localeCompare(b))
    .map((filePath) => {
      const relativeDir = relative(skillsDir, filePath)
        .replace(/\\/g, '/')
        .replace(/\/SKILL\.md$/i, '')
      return {
        filePath,
        relativeDir,
        dirName: relativeDir,
        ...readSkillMarkdownFile(filePath),
      }
    })
}

export function serializeSkillMarkdown(frontmatterLines: string[], body: string): string {
  return ['---', ...frontmatterLines, '---', body ? `\n${body.replace(/^\n/, '')}` : ''].join('\n')
}
