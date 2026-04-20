import { existsSync, readdirSync, readFileSync, statSync } from 'fs'
import { basename, resolve } from 'path'

export type AgentFrontmatterScalar = string | number | boolean
export type AgentFrontmatterValue = AgentFrontmatterScalar | AgentFrontmatterMap
export interface AgentFrontmatterMap {
  [key: string]: AgentFrontmatterValue
}

export interface ParsedAgentMarkdownFile {
  filePath: string
  fileStem: string
  name: string
  description?: string
  body: string
  frontmatter: AgentFrontmatterMap
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

function parseScalarValue(raw: string): AgentFrontmatterScalar {
  const trimmed = raw.trim()

  if (trimmed === 'true') return true
  if (trimmed === 'false') return false
  if (/^-?\d+(?:\.\d+)?$/.test(trimmed)) return Number(trimmed)

  if (trimmed.length >= 2) {
    if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
      return trimmed.slice(1, -1)
    }
  }

  return trimmed
}

function parseAgentFrontmatter(frontmatterLines: string[]): AgentFrontmatterMap {
  const root: AgentFrontmatterMap = {}
  const stack: Array<{ indent: number; target: AgentFrontmatterMap }> = [
    { indent: -1, target: root },
  ]

  for (const line of frontmatterLines) {
    if (!line.trim() || line.trim().startsWith('#')) continue

    const match = line.match(/^(\s*)(?:"([^"]+)"|'([^']+)'|([A-Za-z0-9_.-]+))\s*:\s*(.*)$/)
    if (!match) continue

    const indent = match[1].length
    const key = match[2] ?? match[3] ?? match[4]
    const rawValue = match[5].trim()

    while (stack.length > 1 && indent <= stack[stack.length - 1]!.indent) {
      stack.pop()
    }

    const parent = stack[stack.length - 1]!.target

    if (!rawValue) {
      const nested: AgentFrontmatterMap = {}
      parent[key] = nested
      stack.push({ indent, target: nested })
      continue
    }

    parent[key] = parseScalarValue(rawValue)
  }

  return root
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

export function parseCanonicalAgentFile(agentPath: string): ParsedAgentMarkdownFile {
  const content = readFileSync(agentPath, 'utf-8')
  const { frontmatterLines, body } = splitMarkdownFrontmatter(content)
  const frontmatter = parseAgentFrontmatter(frontmatterLines)
  const fileStem = basename(agentPath, '.md')
  const name = typeof frontmatter.name === 'string' && frontmatter.name
    ? frontmatter.name
    : fileStem
  const description = typeof frontmatter.description === 'string' && frontmatter.description
    ? frontmatter.description
    : firstHeading(body)

  return {
    filePath: agentPath,
    fileStem,
    name,
    description,
    body: body.trim(),
    frontmatter,
  }
}

export function readCanonicalAgentFiles(agentsDir: string | undefined): ParsedAgentMarkdownFile[] {
  if (!agentsDir || !existsSync(agentsDir)) return []

  return walkMarkdownFiles(agentsDir)
    .sort((a, b) => a.localeCompare(b))
    .map(parseCanonicalAgentFile)
}
