import { existsSync, readdirSync, readFileSync, statSync } from 'fs'
import { relative, resolve } from 'path'
import {
  LineCounter,
  isMap,
  isScalar,
  isSeq,
  parseDocument,
  stringify,
  type Node,
} from 'yaml'

export interface SkillMetadataSource {
  line: number
  column: number
  endLine: number
  endColumn: number
}

export type SkillMetadataNodeKind = 'scalar' | 'sequence' | 'mapping' | 'null'

export interface SkillFrontmatterNode {
  key: string
  value: unknown
  rawValue: string
  kind: SkillMetadataNodeKind
  source: SkillMetadataSource
}

export interface SkillFrontmatterDiagnostic {
  code: 'skill-frontmatter-yaml' | 'skill-frontmatter-shape'
  message: string
  key?: string
  source?: SkillMetadataSource
}

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
  frontmatterNodes: Map<string, SkillFrontmatterNode>
  frontmatterDiagnostics: SkillFrontmatterDiagnostic[]
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

export interface CanonicalSkillMetadata {
  dirName: string
  title: string
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
  body: string
  supportPaths: string[]
  helperScripts: string[]
  examplePaths: string[]
  referencePaths: string[]
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
    if (lines[index] === '---') {
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

const STRING_FIELDS = new Set([
  'name',
  'description',
  'when_to_use',
  'argument-hint',
  'model',
  'effort',
  'context',
  'agent',
  'shell',
])
const BOOLEAN_FIELDS = new Set(['disable-model-invocation', 'user-invocable'])
const STRING_ARRAY_FIELDS = new Set(['arguments', 'allowed-tools', 'paths'])

function nodeKind(node: Node | null | undefined): SkillMetadataNodeKind {
  if (!node) return 'null'
  if (isScalar(node)) return 'scalar'
  if (isSeq(node)) return 'sequence'
  if (isMap(node)) return 'mapping'
  return 'null'
}

function nodeSource(node: Node | null | undefined, lineCounter: LineCounter): SkillMetadataSource {
  const range = node?.range ?? [0, 0, 0]
  const start = lineCounter.linePos(range[0])
  const end = lineCounter.linePos(range[1])
  return {
    line: start.line + 1,
    column: start.col,
    endLine: end.line + 1,
    endColumn: end.col,
  }
}

function displayValue(value: unknown): string {
  if (typeof value === 'string') return value
  if (value === null || value === undefined) return ''
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  return JSON.stringify(value)
}

function isQuotedScalar(rawValue: string): boolean {
  const trimmed = rawValue.trim()
  return (trimmed.startsWith('"') && trimmed.endsWith('"'))
    || (trimmed.startsWith("'") && trimmed.endsWith("'"))
}

function isValidSkillFieldShape(key: string, value: unknown): boolean {
  if (STRING_FIELDS.has(key)) return typeof value === 'string'
  if (BOOLEAN_FIELDS.has(key)) return typeof value === 'boolean'
  if (STRING_ARRAY_FIELDS.has(key)) {
    const stringArray = Array.isArray(value) && value.every(item => typeof item === 'string')
    return stringArray || (key === 'allowed-tools' && typeof value === 'string')
  }
  if (key === 'hooks') return value !== null && typeof value === 'object'
  return true
}

function parseYamlFrontmatter(frontmatterLines: string[]): {
  valid: boolean
  fields: Map<string, SkillFrontmatterField>
  nodes: Map<string, SkillFrontmatterNode>
  diagnostics: SkillFrontmatterDiagnostic[]
} {
  const source = frontmatterLines.join('\n')
  const lineCounter = new LineCounter()
  const document = parseDocument(source, {
    lineCounter,
    prettyErrors: false,
    strict: true,
    uniqueKeys: true,
  })
  const parseMessages = [...document.errors, ...document.warnings]
  const diagnostics: SkillFrontmatterDiagnostic[] = parseMessages.map((error) => {
    const start = error.linePos?.[0]
    return {
      code: 'skill-frontmatter-yaml',
      message: error.message,
      ...(start
        ? {
            source: {
              line: start.line + 1,
              column: start.col,
              endLine: (error.linePos?.[1]?.line ?? start.line) + 1,
              endColumn: error.linePos?.[1]?.col ?? start.col,
            },
          }
        : {}),
    }
  })
  const fields = new Map<string, SkillFrontmatterField>()
  const nodes = new Map<string, SkillFrontmatterNode>()

  if (parseMessages.length > 0 || !isMap(document.contents)) {
    if (parseMessages.length === 0) {
      diagnostics.push({
        code: 'skill-frontmatter-yaml',
        message: 'Skill frontmatter must be a top-level YAML mapping.',
        source: nodeSource(document.contents, lineCounter),
      })
    }
    return { valid: false, fields, nodes, diagnostics }
  }

  let values: Record<string, unknown>
  try {
    values = document.toJS({ maxAliasCount: 0 }) as Record<string, unknown>
  } catch (error) {
    diagnostics.push({
      code: 'skill-frontmatter-yaml',
      message: error instanceof Error ? error.message : 'Skill frontmatter could not be converted safely.',
      source: nodeSource(document.contents, lineCounter),
    })
    return { valid: false, fields, nodes, diagnostics }
  }
  for (const pair of document.contents.items) {
    if (!isScalar(pair.key) || typeof pair.key.value !== 'string') {
      diagnostics.push({
        code: 'skill-frontmatter-yaml',
        message: 'Skill frontmatter keys must be strings.',
        source: nodeSource(pair.key, lineCounter),
      })
      continue
    }

    const key = pair.key.value
    const value = values[key]
    const valueNode = pair.value as Node | null
    const sourceRange = nodeSource(valueNode ?? pair.key, lineCounter)
    const range = valueNode?.range
    const rawValue = range ? source.slice(range[0], range[1]) : ''
    const kind = nodeKind(valueNode)
    nodes.set(key, { key, value, rawValue, kind, source: sourceRange })
    fields.set(key, {
      key,
      value: displayValue(value),
      rawValue,
      quoted: kind === 'scalar' && isQuotedScalar(rawValue),
    })

    if (!isValidSkillFieldShape(key, value)) {
      diagnostics.push({
        code: 'skill-frontmatter-shape',
        key,
        message: `Skill frontmatter field "${key}" uses unsupported YAML ${kind} metadata.`,
        source: sourceRange,
      })
    }
  }

  return { valid: true, fields, nodes, diagnostics }
}

function parseStringField(nodes: Map<string, SkillFrontmatterNode>, key: string): string | undefined {
  const value = nodes.get(key)?.value
  return typeof value === 'string' ? value : undefined
}

function parseBooleanField(nodes: Map<string, SkillFrontmatterNode>, key: string): boolean | undefined {
  const value = nodes.get(key)?.value
  return typeof value === 'boolean' ? value : undefined
}

function parseStringArrayField(nodes: Map<string, SkillFrontmatterNode>, key: string): string[] {
  const value = nodes.get(key)?.value
  return Array.isArray(value) && value.every(item => typeof item === 'string') ? value : []
}

function parseAllowedTools(nodes: Map<string, SkillFrontmatterNode>): string[] {
  const node = nodes.get('allowed-tools')
  const value = node?.value
  if (Array.isArray(value) && value.every(item => typeof item === 'string')) return value
  if (typeof value === 'string') {
    if (node && isQuotedScalar(node.rawValue)) return [value]
    return value.split(',').map(item => item.trim()).filter(Boolean)
  }
  return []
}

export function parseSkillMarkdown(content: string): ParsedSkillMarkdown {
  const {
    hasValidFrontmatter,
    frontmatterLines,
    body,
  } = splitMarkdownFrontmatter(content)
  const yaml = hasValidFrontmatter
    ? parseYamlFrontmatter(frontmatterLines)
    : {
        valid: false,
        fields: new Map<string, SkillFrontmatterField>(),
        nodes: new Map<string, SkillFrontmatterNode>(),
        diagnostics: [] as SkillFrontmatterDiagnostic[],
      }
  const frontmatterFields = yaml.fields
  const frontmatterNodes = yaml.nodes

  return {
    hasValidFrontmatter: hasValidFrontmatter && yaml.valid,
    frontmatterLines,
    frontmatterFields,
    frontmatterNodes,
    frontmatterDiagnostics: yaml.diagnostics,
    body,
    name: parseStringField(frontmatterNodes, 'name'),
    description: parseStringField(frontmatterNodes, 'description'),
    whenToUse: parseStringField(frontmatterNodes, 'when_to_use'),
    argumentHint: parseStringField(frontmatterNodes, 'argument-hint'),
    arguments: parseStringArrayField(frontmatterNodes, 'arguments'),
    disableModelInvocation: parseBooleanField(frontmatterNodes, 'disable-model-invocation'),
    userInvocable: parseBooleanField(frontmatterNodes, 'user-invocable'),
    allowedTools: parseAllowedTools(frontmatterNodes),
    model: parseStringField(frontmatterNodes, 'model'),
    effort: parseStringField(frontmatterNodes, 'effort'),
    context: parseStringField(frontmatterNodes, 'context'),
    agent: parseStringField(frontmatterNodes, 'agent'),
    hooks: frontmatterNodes.get('hooks')?.value,
    paths: parseStringArrayField(frontmatterNodes, 'paths'),
    shell: parseStringField(frontmatterNodes, 'shell'),
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

function yamlScalar(value: string | boolean): string {
  return typeof value === 'boolean' ? String(value) : stringify(value).trimEnd()
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function findTopLevelFieldRange(lines: string[], key: string): { start: number; end: number } | null {
  const keyPattern = new RegExp(`^${escapeRegExp(key)}\\s*:`)
  const start = lines.findIndex(line => keyPattern.test(line))
  if (start === -1) return null
  let end = start + 1
  while (end < lines.length && !/^[A-Za-z0-9_-]+\s*:/.test(lines[end])) end += 1
  return { start, end }
}

export function rewriteSkillFrontmatter(
  content: string,
  options: { set?: Record<string, string | boolean>; remove?: string[] },
  parsedInput?: ParsedSkillMarkdown,
): string {
  const parsed = parsedInput ?? parseSkillMarkdown(content)
  if (!parsed.hasValidFrontmatter) return content

  const rewritten = [...parsed.frontmatterLines]
  for (const key of options.remove ?? []) {
    if (!parsed.frontmatterNodes.has(key)) continue
    const range = findTopLevelFieldRange(rewritten, key)
    if (!range) continue
    rewritten.splice(range.start, range.end - range.start)
  }

  for (const [key, value] of Object.entries(options.set ?? {})) {
    const range = findTopLevelFieldRange(rewritten, key)
    const line = `${key}: ${yamlScalar(value)}`
    if (!range) rewritten.push(line)
    else rewritten.splice(range.start, range.end - range.start, line)
  }

  return serializeSkillMarkdown(rewritten, parsed.body)
}

function walkSupportFiles(dir: string): string[] {
  const entries = readdirSync(dir, { withFileTypes: true })
  const files: string[] = []

  for (const entry of entries) {
    const fullPath = resolve(dir, entry.name)
    if (entry.isDirectory()) {
      files.push(...walkSupportFiles(fullPath))
      continue
    }
    if (entry.isFile()) {
      files.push(fullPath)
    }
  }

  return files
}

export function getCanonicalSkillMetadata(skill: ParsedSkillMarkdownFile): CanonicalSkillMetadata {
  const skillDir = resolve(skill.filePath, '..')
  const supportPaths = walkSupportFiles(skillDir)
    .filter((fullPath) => fullPath !== skill.filePath)
    .map((fullPath) => relative(skillDir, fullPath).replace(/\\/g, '/'))
    .sort((a, b) => a.localeCompare(b))

  return {
    dirName: skill.dirName,
    title: skill.firstHeading ?? skill.name ?? skill.dirName,
    ...(skill.description ? { description: skill.description } : {}),
    ...(skill.whenToUse ? { whenToUse: skill.whenToUse } : {}),
    ...(skill.argumentHint ? { argumentHint: skill.argumentHint } : {}),
    arguments: [...skill.arguments],
    ...(typeof skill.disableModelInvocation === 'boolean' ? { disableModelInvocation: skill.disableModelInvocation } : {}),
    ...(typeof skill.userInvocable === 'boolean' ? { userInvocable: skill.userInvocable } : {}),
    allowedTools: [...skill.allowedTools],
    ...(skill.model ? { model: skill.model } : {}),
    ...(skill.effort ? { effort: skill.effort } : {}),
    ...(skill.context ? { context: skill.context } : {}),
    ...(skill.agent ? { agent: skill.agent } : {}),
    ...(skill.hooks !== undefined ? { hooks: skill.hooks } : {}),
    paths: [...skill.paths],
    ...(skill.shell ? { shell: skill.shell } : {}),
    body: skill.body,
    supportPaths,
    helperScripts: supportPaths.filter((path) => path.startsWith('scripts/')),
    examplePaths: supportPaths.filter((path) => path.startsWith('examples/')),
    referencePaths: supportPaths.filter((path) => !path.startsWith('examples/') && !path.startsWith('scripts/')),
  }
}
