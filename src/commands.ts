import { existsSync, readdirSync, readFileSync, statSync } from 'fs'
import { relative, resolve } from 'path'

export interface ParsedCommandMarkdownFile {
  filePath: string
  relativeStem: string
  commandId: string
  title: string
  description?: string
  agent?: string
  subtask?: boolean
  model?: string
  body: string
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
  const trimmed = value.trim()
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"'))
    || (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1).trim()
  }
  return trimmed
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
  frontmatterLines: string[],
  key: string,
): string | undefined {
  const pattern = new RegExp(`^${key}:\\s*(.+)\\s*$`, 'i')
  for (const line of frontmatterLines) {
    const match = pattern.exec(line.trim())
    if (match?.[1]) {
      return stripYamlScalar(match[1])
    }
  }

  return undefined
}

function parseCommandFrontmatterBoolean(
  frontmatterLines: string[],
  key: string,
): boolean | undefined {
  const value = parseCommandFrontmatterString(frontmatterLines, key)
  if (!value) return undefined

  if (/^true$/i.test(value)) return true
  if (/^false$/i.test(value)) return false

  return undefined
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
      const relativeStem = relative(commandsDir, filePath)
        .replace(/\\/g, '/')
        .replace(/\.md$/i, '')
      const commandId = relativeStem.replace(/\//g, '-').toLowerCase()
      const title = firstHeading(body) ?? commandId

      return {
        filePath,
        relativeStem,
        commandId,
        title,
        description: parseCommandFrontmatterDescription(frontmatterLines),
        agent: parseCommandFrontmatterString(frontmatterLines, 'agent'),
        subtask: parseCommandFrontmatterBoolean(frontmatterLines, 'subtask'),
        model: parseCommandFrontmatterString(frontmatterLines, 'model'),
        body: body.trim(),
      }
    })
}
