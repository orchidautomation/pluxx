import { existsSync, readdirSync, readFileSync, statSync } from 'fs'
import { relative, resolve } from 'path'

export interface CommandFrontmatterField {
  key: string
  value: string
  rawValue: string
  quoted: boolean
}

export interface ParsedCommandMarkdownFile {
  filePath: string
  relativeStem: string
  commandId: string
  frontmatterLines: string[]
  frontmatterFields: Map<string, CommandFrontmatterField>
  title: string
  description?: string
  whenToUse?: string
  argumentHint?: string
  arguments: string[]
  examples: string[]
  skill?: string
  skills: string[]
  agent?: string
  subtask?: boolean
  model?: string
  context?: string
  body: string
}

export interface CanonicalCommandMetadata {
  commandId: string
  title: string
  description?: string
  whenToUse?: string
  argumentHint?: string
  arguments: string[]
  examples: string[]
  skill?: string
  skills: string[]
  agent?: string
  subtask?: boolean
  model?: string
  context?: string
  template: string
}

function unquote(value: string): { value: string; quoted: boolean } {
  const trimmed = value.trim()
  if (
    trimmed.length >= 2
    && (
      (trimmed.startsWith('"') && trimmed.endsWith('"'))
      || (trimmed.startsWith("'") && trimmed.endsWith("'"))
    )
  ) {
    return { value: trimmed.slice(1, -1), quoted: true }
  }
  return { value: trimmed, quoted: false }
}

function firstHeading(content: string): string | undefined {
  const lines = content.split(/\r?\n/)
  for (const line of lines) {
    const match = line.match(/^#\s+(.*)$/)
    if (match?.[1]?.trim()) return match[1].trim()
  }
  return undefined
}

function splitMarkdownFrontmatter(content: string): {
  frontmatterLines: string[]
  body: string
} {
  const lines = content.split(/\r?\n/)
  if (lines[0]?.trim() !== '---') {
    return {
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
      frontmatterLines: [],
      body: content,
    }
  }

  return {
    frontmatterLines: lines.slice(1, endIndex),
    body: lines.slice(endIndex + 1).join('\n'),
  }
}

function stripYamlScalar(value: string): string {
  return unquote(value).value.trim()
}

function parseFrontmatterFields(frontmatterLines: string[]): Map<string, CommandFrontmatterField> {
  const fields = new Map<string, CommandFrontmatterField>()

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

function parseCommandFrontmatterDescription(frontmatterLines: string[]): string | undefined {
  for (const line of frontmatterLines) {
    const match = /^description:\s*(.+)\s*$/i.exec(line.trim())
    if (match?.[1]) {
      return stripYamlScalar(match[1])
    }
  }

  return undefined
}

function parseCommandFrontmatterString(
  frontmatterFields: Map<string, CommandFrontmatterField>,
  key: string,
): string | undefined {
  return frontmatterFields.get(key)?.value
}

function parseCommandFrontmatterBoolean(
  frontmatterFields: Map<string, CommandFrontmatterField>,
  key: string,
): boolean | undefined {
  const value = parseCommandFrontmatterString(frontmatterFields, key)
  if (!value) return undefined

  if (/^true$/i.test(value)) return true
  if (/^false$/i.test(value)) return false

  return undefined
}

function parseInlineStringArray(rawValue: string): string[] {
  const trimmed = rawValue.trim()
  if (!trimmed.startsWith('[') || !trimmed.endsWith(']')) return []

  const inner = trimmed.slice(1, -1).trim()
  if (!inner) return []

  return inner
    .split(',')
    .map(part => stripYamlScalar(part))
    .map(part => part.trim())
    .filter(Boolean)
}

function parseCommandFrontmatterStringArray(
  frontmatterLines: string[],
  frontmatterFields: Map<string, CommandFrontmatterField>,
  key: string,
): string[] {
  const rawValue = frontmatterFields.get(key)?.rawValue
  if (rawValue) {
    const inlineArray = parseInlineStringArray(rawValue)
    if (inlineArray.length > 0) return inlineArray
    if (rawValue.trim()) return [stripYamlScalar(rawValue)]
  }

  const lineIndex = frontmatterLines.findIndex((line) => new RegExp(`^${key}:\\s*$`, 'i').test(line.trim()))
  if (lineIndex === -1) return []

  const values: string[] = []
  for (let index = lineIndex + 1; index < frontmatterLines.length; index += 1) {
    const itemMatch = /^\s*-\s+(.+)$/.exec(frontmatterLines[index])
    if (!itemMatch?.[1]) break
    const value = stripYamlScalar(itemMatch[1]).trim()
    if (value) values.push(value)
  }

  return values
}

function inferCommandSkillLinks(body: string): string[] {
  const skills = new Set<string>()
  for (const match of body.matchAll(/Use the `([^`]+)` skill\./g)) {
    const skill = match[1]?.trim()
    if (skill) skills.add(skill)
  }
  return [...skills]
}

function walkMarkdownFiles(dir: string): string[] {
  const entries = readdirSync(dir)
  const files: string[] = []

  for (const entry of entries) {
    const fullPath = resolve(dir, entry)
    const stat = statSync(fullPath)
    if (stat.isDirectory()) {
      files.push(...walkMarkdownFiles(fullPath))
      continue
    }
    if (stat.isFile() && entry.endsWith('.md')) {
      files.push(fullPath)
    }
  }

  return files
}

export function readCanonicalCommandFiles(commandsDir: string | undefined): ParsedCommandMarkdownFile[] {
  if (!commandsDir || !existsSync(commandsDir)) return []

  return walkMarkdownFiles(commandsDir)
    .sort((a, b) => a.localeCompare(b))
    .map((filePath) => {
      const content = readFileSync(filePath, 'utf-8')
      const { frontmatterLines, body } = splitMarkdownFrontmatter(content)
      const frontmatterFields = parseFrontmatterFields(frontmatterLines)
      const relativeStem = relative(commandsDir, filePath)
        .replace(/\\/g, '/')
        .replace(/\.md$/i, '')
      const commandId = relativeStem.replace(/\//g, '-').toLowerCase()
      const title = parseCommandFrontmatterString(frontmatterFields, 'title') ?? firstHeading(body) ?? commandId
      const skills = [
        ...new Set([
          ...parseCommandFrontmatterStringArray(frontmatterLines, frontmatterFields, 'skills'),
          ...(() => {
            const skill = parseCommandFrontmatterString(frontmatterFields, 'skill')
            return skill ? [skill] : []
          })(),
          ...inferCommandSkillLinks(body),
        ]),
      ]

      return {
        filePath,
        relativeStem,
        commandId,
        frontmatterLines,
        frontmatterFields,
        title,
        description: parseCommandFrontmatterDescription(frontmatterLines),
        whenToUse: parseCommandFrontmatterString(frontmatterFields, 'when_to_use'),
        argumentHint: parseCommandFrontmatterString(frontmatterFields, 'argument-hint'),
        arguments: parseCommandFrontmatterStringArray(frontmatterLines, frontmatterFields, 'arguments'),
        examples: parseCommandFrontmatterStringArray(frontmatterLines, frontmatterFields, 'examples'),
        ...(skills[0] ? { skill: skills[0] } : {}),
        skills,
        agent: parseCommandFrontmatterString(frontmatterFields, 'agent'),
        subtask: parseCommandFrontmatterBoolean(frontmatterFields, 'subtask'),
        model: parseCommandFrontmatterString(frontmatterFields, 'model'),
        context: parseCommandFrontmatterString(frontmatterFields, 'context'),
        body: body.trim(),
      }
    })
}

export function getCanonicalCommandMetadata(command: ParsedCommandMarkdownFile): CanonicalCommandMetadata {
  return {
    commandId: command.commandId,
    title: command.title,
    ...(command.description ? { description: command.description } : {}),
    ...(command.whenToUse ? { whenToUse: command.whenToUse } : {}),
    ...(command.argumentHint ? { argumentHint: command.argumentHint } : {}),
    ...(command.arguments.length > 0 ? { arguments: [...command.arguments] } : { arguments: [] }),
    ...(command.examples.length > 0 ? { examples: [...command.examples] } : { examples: [] }),
    ...(command.skill ? { skill: command.skill } : {}),
    skills: [...command.skills],
    ...(command.agent ? { agent: command.agent } : {}),
    ...(typeof command.subtask === 'boolean' ? { subtask: command.subtask } : {}),
    ...(command.model ? { model: command.model } : {}),
    ...(command.context ? { context: command.context } : {}),
    template: command.body,
  }
}
