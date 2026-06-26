import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { homedir } from 'os'
import { dirname, resolve } from 'path'
import {
  parseCodexApprovedMcpToolsFromToml,
  type CodexMcpApprovalEntry,
} from '../codex-permissions-companion'
import { RECOMMENDED_CODEX_HOOKS_FEATURE_FLAG } from '../codex-hooks-feature'
import { parseTomlValue, splitTomlList, stripTomlComment } from '../toml-lite'

export interface CodexCompanionApplyOptions {
  consumerRoot: string
  configPath?: string
  projectRoot?: string
  userConfig?: boolean
  includeHooks?: boolean
  includeMcpApprovals?: boolean
  dryRun?: boolean
}

export interface CodexCompanionApplyAction {
  kind: 'hooks-feature' | 'mcp-approval' | 'hooks-companion' | 'readiness-companion' | 'permissions-companion'
  status: 'applied' | 'already-present' | 'skipped' | 'unsafe' | 'unsupported'
  detail: string
}

export interface CodexCompanionApplyResult {
  ok: boolean
  dryRun: boolean
  consumerRoot: string
  configPath: string
  changed: boolean
  actions: CodexCompanionApplyAction[]
}

interface MergeResult {
  text: string
  changed: boolean
  addedCount?: number
  updatedCount?: number
}

interface InternalCodexCompanionApplyResult extends CodexCompanionApplyResult {
  nextText?: string
}

export function resolveCodexApplyConfigPath(options: Pick<CodexCompanionApplyOptions, 'configPath' | 'projectRoot' | 'userConfig'>): string {
  if (options.configPath) return resolve(options.configPath)
  if (options.userConfig) {
    const homeDir = process.env.HOME?.trim() || homedir()
    const codexHome = process.env.CODEX_HOME?.trim() || resolve(homeDir, '.codex')
    return resolve(codexHome, 'config.toml')
  }
  return resolve(options.projectRoot ?? process.cwd(), '.codex/config.toml')
}

export function planCodexCompanionApply(options: CodexCompanionApplyOptions): CodexCompanionApplyResult {
  return stripInternalApplyResult(buildCodexCompanionApplyPlan(options))
}

function buildCodexCompanionApplyPlan(options: CodexCompanionApplyOptions): InternalCodexCompanionApplyResult {
  const consumerRoot = resolve(options.consumerRoot)
  const configPath = resolveCodexApplyConfigPath(options)
  const includeHooks = options.includeHooks ?? true
  const includeMcpApprovals = options.includeMcpApprovals ?? true
  const actions: CodexCompanionApplyAction[] = []
  const manifestPath = resolve(consumerRoot, '.codex-plugin/plugin.json')
  const companionPath = resolve(consumerRoot, '.codex/config.generated.toml')

  if (!existsSync(manifestPath) && !existsSync(companionPath)) {
    throw new Error(`No Codex plugin manifest or generated config companion found under ${consumerRoot}.`)
  }

  let configText = existsSync(configPath) ? readFileSync(configPath, 'utf-8') : ''
  let changed = false

  if (includeHooks) {
    const hookInspection = inspectCodexHookCompanions(consumerRoot)
    actions.push(...hookInspection.actions)

    if (hookInspection.declaresHooks) {
      const hookMerge = ensureCodexHooksFeature(configText)
      configText = hookMerge.text
      changed ||= hookMerge.changed
      actions.push({
        kind: 'hooks-feature',
        status: hookMerge.changed ? 'applied' : 'already-present',
        detail: hookMerge.changed
          ? `Added [features].${RECOMMENDED_CODEX_HOOKS_FEATURE_FLAG} = true for plugin-bundled Codex hooks.`
          : `[features].${RECOMMENDED_CODEX_HOOKS_FEATURE_FLAG} = true is already present.`,
      })
    } else {
      actions.push({
        kind: 'hooks-feature',
        status: 'skipped',
        detail: 'Installed Codex bundle does not declare plugin-bundled hooks.',
      })
    }
  }

  if (includeMcpApprovals) {
    actions.push(...inspectCodexPermissionsCompanion(consumerRoot))

    if (!existsSync(companionPath)) {
      actions.push({
        kind: 'mcp-approval',
        status: 'skipped',
        detail: 'No .codex/config.generated.toml companion was found in the installed Codex bundle.',
      })
    } else {
      const approvals = parseCodexApprovedMcpToolsFromToml(readFileSync(companionPath, 'utf-8'))
      const approvalMerge = ensureCodexMcpApprovals(configText, approvals)
      configText = approvalMerge.text
      changed ||= approvalMerge.changed
      actions.push({
        kind: 'mcp-approval',
        status: approvalMerge.changed ? 'applied' : 'already-present',
        detail: approvalMerge.changed
          ? `Applied ${approvalMerge.addedCount ?? 0} generated MCP approval stanza(s) and updated ${approvalMerge.updatedCount ?? 0} existing stanza(s) from .codex/config.generated.toml.`
          : 'Generated MCP approval stanzas are already present in active Codex config.',
      })
    }
  }

  return {
    ok: true,
    dryRun: options.dryRun ?? false,
    consumerRoot,
    configPath,
    changed,
    actions,
    ...(changed ? { nextText: configText } : {}),
  }
}

export function applyCodexCompanion(options: CodexCompanionApplyOptions): CodexCompanionApplyResult {
  const planned = buildCodexCompanionApplyPlan(options)
  if (planned.changed && !options.dryRun && planned.nextText !== undefined) {
    mkdirSync(dirname(planned.configPath), { recursive: true })
    writeFileSync(planned.configPath, planned.nextText)
  }

  return stripInternalApplyResult(planned)
}

export function ensureCodexHooksFeature(source: string): MergeResult {
  if (readFeatureFlag(source) === true) return { text: source, changed: false }

  const lines = source.split(/\r?\n/)
  if (lines.length === 1 && lines[0] === '') lines.pop()

  let inFeaturesTable = false
  for (let index = 0; index < lines.length; index += 1) {
    const line = stripTomlComment(lines[index]).trim()
    const sectionMatch = line.match(/^\[(.+)\]$/)
    if (sectionMatch) {
      inFeaturesTable = sectionMatch[1].trim() === 'features'
      continue
    }

    const dottedMatch = line.match(/^features\.hooks\s*=\s*(.+)$/)
    if (dottedMatch) {
      lines[index] = `${lines[index].slice(0, lines[index].indexOf('='))}= true`
      return { text: finishToml(lines), changed: true }
    }

    const inlineMatch = line.match(/^features\s*=\s*(\{.+\})$/)
    if (inlineMatch) {
      const updated = mergeInlineFeatures(inlineMatch[1])
      if (updated) {
        lines[index] = `${lines[index].slice(0, lines[index].indexOf('='))}= ${updated}`
        return { text: finishToml(lines), changed: true }
      }
    }

    if (inFeaturesTable) {
      const tableMatch = line.match(/^hooks\s*=\s*(.+)$/)
      if (tableMatch) {
        lines[index] = `${lines[index].slice(0, lines[index].indexOf('='))}= true`
        return { text: finishToml(lines), changed: true }
      }
    }
  }

  const table = findTableRange(lines, 'features')
  if (table) {
    lines.splice(table.end, 0, `${RECOMMENDED_CODEX_HOOKS_FEATURE_FLAG} = true`)
    return { text: finishToml(lines), changed: true }
  }

  if (lines.length > 0 && lines[lines.length - 1].trim() !== '') lines.push('')
  lines.push('[features]', `${RECOMMENDED_CODEX_HOOKS_FEATURE_FLAG} = true`)
  return { text: finishToml(lines), changed: true }
}

export function ensureCodexMcpApprovals(source: string, approvals: CodexMcpApprovalEntry[]): MergeResult {
  if (approvals.length === 0) return { text: source, changed: false }

  const lines = source.split(/\r?\n/)
  if (lines.length === 1 && lines[0] === '') lines.pop()

  let updatedCount = 0
  const missing: CodexMcpApprovalEntry[] = []
  for (const entry of approvals) {
    const existing = updateExistingCodexMcpApproval(lines, entry)
    if (!existing.found) {
      missing.push(entry)
      continue
    }
    if (existing.changed) updatedCount += 1
  }

  if (missing.length === 0 && updatedCount === 0) {
    return { text: source, changed: false }
  }

  if (lines.length > 0 && lines[lines.length - 1].trim() !== '') lines.push('')

  if (missing.length > 0) {
    lines.push('# Applied by Pluxx from .codex/config.generated.toml.')
    for (const entry of missing) {
      lines.push('')
      lines.push(`[mcp_servers.${toQuotedTomlKey(entry.serverName)}.tools.${toQuotedTomlKey(entry.toolName)}]`)
      lines.push('approval_mode = "approve"')
    }
  }

  return { text: finishToml(lines), changed: true, addedCount: missing.length, updatedCount }
}

function codexBundleDeclaresHooks(rootDir: string): boolean {
  const manifestPath = resolve(rootDir, '.codex-plugin/plugin.json')
  if (!existsSync(manifestPath)) return false

  try {
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8')) as { hooks?: unknown }
    const hooksPath = typeof manifest.hooks === 'string' ? manifest.hooks : 'hooks/hooks.json'
    return existsSync(resolve(rootDir, hooksPath))
  } catch {
    return false
  }
}

interface CodexHooksCompanionPayload {
  model?: unknown
  hooks?: unknown
  unsupported?: unknown
}

interface CodexReadinessCompanionPayload {
  model?: unknown
  translatedHooks?: Record<string, unknown> | null
}

interface CodexPermissionsCompanionPayload {
  model?: unknown
  rules?: unknown
  skillPolicies?: unknown
}

function inspectCodexHookCompanions(rootDir: string): { declaresHooks: boolean; actions: CodexCompanionApplyAction[] } {
  const actions: CodexCompanionApplyAction[] = []
  const declaresHooks = codexBundleDeclaresHooks(rootDir)
  const hooksCompanionPath = resolve(rootDir, '.codex/hooks.generated.json')
  const readinessCompanionPath = resolve(rootDir, '.codex/readiness.generated.json')

  if (existsSync(hooksCompanionPath)) {
    const hooksCompanion = readJsonCompanion<CodexHooksCompanionPayload>(hooksCompanionPath, '.codex/hooks.generated.json')
    if (hooksCompanion.model !== 'pluxx.codex-hooks.v1') {
      actions.push({
        kind: 'hooks-companion',
        status: 'unsupported',
        detail: `Unsupported .codex/hooks.generated.json model ${renderCompanionModel(hooksCompanion.model)}. Review the companion manually before assuming its hook metadata still matches this Pluxx apply flow.`,
      })
    } else {
      const unsupportedEntries = Array.isArray(hooksCompanion.unsupported) ? hooksCompanion.unsupported : []
      if (unsupportedEntries.length > 0) {
        actions.push({
          kind: 'hooks-companion',
          status: 'unsupported',
          detail: `Generated Codex hooks companion records ${unsupportedEntries.length} unsupported translated hook entr${unsupportedEntries.length === 1 ? 'y' : 'ies'}. Review .codex/hooks.generated.json manually for dropped events, types, or fields that cannot be activated through Codex config apply.`,
        })
      }
    }
  }

  if (existsSync(readinessCompanionPath)) {
    const readinessCompanion = readJsonCompanion<CodexReadinessCompanionPayload>(readinessCompanionPath, '.codex/readiness.generated.json')
    if (readinessCompanion.model !== 'pluxx.readiness.v1') {
      actions.push({
        kind: 'readiness-companion',
        status: 'unsupported',
        detail: `Unsupported .codex/readiness.generated.json model ${renderCompanionModel(readinessCompanion.model)}. Review the readiness companion manually before relying on it.`,
      })
    } else {
      const translatedHooks = readinessCompanion.translatedHooks && typeof readinessCompanion.translatedHooks === 'object'
        ? Object.values(readinessCompanion.translatedHooks).filter((value) => typeof value === 'string' && value.trim() !== '')
        : []
      actions.push({
        kind: 'readiness-companion',
        status: 'skipped',
        detail: `Readiness companion remains advisory after apply${translatedHooks.length > 0 ? ` (${translatedHooks.length} translated readiness hook${translatedHooks.length === 1 ? '' : 's'} detected)` : ''}. Pluxx can apply the known hook feature prerequisite, but Codex trust, review, and runtime support still need manual verification.`,
      })
    }
  }

  return { declaresHooks, actions }
}

function inspectCodexPermissionsCompanion(rootDir: string): CodexCompanionApplyAction[] {
  const permissionsCompanionPath = resolve(rootDir, '.codex/permissions.generated.json')
  if (!existsSync(permissionsCompanionPath)) return []

  const permissionsCompanion = readJsonCompanion<CodexPermissionsCompanionPayload>(
    permissionsCompanionPath,
    '.codex/permissions.generated.json',
  )
  if (permissionsCompanion.model !== 'pluxx.permissions.v1') {
    return [{
      kind: 'permissions-companion',
      status: 'unsupported',
      detail: `Unsupported .codex/permissions.generated.json model ${renderCompanionModel(permissionsCompanion.model)}. Review the permissions companion manually before assuming its advisory selectors still match this Pluxx apply flow.`,
    }]
  }

  const rules = Array.isArray(permissionsCompanion.rules) ? permissionsCompanion.rules : []
  const skillPolicies = Array.isArray(permissionsCompanion.skillPolicies) ? permissionsCompanion.skillPolicies : []
  const advisoryRules = rules.filter((rule) => isAdvisoryPermissionRule(rule))
  if (advisoryRules.length === 0 && skillPolicies.length === 0) return []

  const parts: string[] = []
  if (advisoryRules.length > 0) {
    parts.push(`${advisoryRules.length} advisory permission rule${advisoryRules.length === 1 ? '' : 's'}`)
  }
  if (skillPolicies.length > 0) {
    parts.push(`${skillPolicies.length} migrated skill polic${skillPolicies.length === 1 ? 'y' : 'ies'}`)
  }

  return [{
    kind: 'permissions-companion',
    status: 'unsupported',
    detail: `Generated Codex permissions companion still carries ${parts.join(' and ')} that cannot be auto-merged into active Codex config. Review .codex/permissions.generated.json manually after applying any materialized MCP approval stanzas.`,
  }]
}

function readJsonCompanion<T>(filePath: string, label: string): T {
  try {
    return JSON.parse(readFileSync(filePath, 'utf-8')) as T
  } catch (error) {
    throw new Error(`${label} is malformed: ${error instanceof Error ? error.message : String(error)}`)
  }
}

function renderCompanionModel(model: unknown): string {
  return typeof model === 'string' ? `"${model}"` : JSON.stringify(model)
}

function isAdvisoryPermissionRule(rule: unknown): boolean {
  if (!rule || typeof rule !== 'object') return true

  const action = (rule as { action?: unknown }).action
  const kind = (rule as { kind?: unknown }).kind
  const pattern = (rule as { pattern?: unknown }).pattern
  if (action !== 'allow' || kind !== 'MCP' || typeof pattern !== 'string') return true
  return pattern.includes('*')
}

function readFeatureFlag(source: string): boolean | undefined {
  let inFeaturesTable = false
  for (const rawLine of source.split(/\r?\n/)) {
    const line = stripTomlComment(rawLine).trim()
    if (!line) continue

    const sectionMatch = line.match(/^\[(.+)\]$/)
    if (sectionMatch) {
      inFeaturesTable = sectionMatch[1].trim() === 'features'
      continue
    }

    const dottedMatch = line.match(/^features\.hooks\s*=\s*(.+)$/)
    if (dottedMatch) return parseTomlValue(dottedMatch[1].trim()) === true

    const inlineMatch = line.match(/^features\s*=\s*(.+)$/)
    if (inlineMatch) {
      const parsed = parseTomlValue(inlineMatch[1].trim())
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return (parsed as Record<string, unknown>).hooks === true
      }
    }

    if (!inFeaturesTable) continue
    const tableMatch = line.match(/^hooks\s*=\s*(.+)$/)
    if (tableMatch) return parseTomlValue(tableMatch[1].trim()) === true
  }

  return undefined
}

function mergeInlineFeatures(value: string): string | null {
  const inner = value.slice(1, -1).trim()
  const parts = inner ? splitTomlList(inner).map((part) => part.trim()).filter(Boolean) : []
  let replaced = false
  const nextParts = parts.map((part) => {
    if (!/^hooks\s*=/.test(part)) return part
    replaced = true
    return 'hooks = true'
  })
  if (!replaced) nextParts.push('hooks = true')
  return `{ ${nextParts.join(', ')} }`
}

function findTableRange(lines: string[], tableName: string): { start: number; end: number } | null {
  let start = -1
  for (let index = 0; index < lines.length; index += 1) {
    const line = stripTomlComment(lines[index]).trim()
    const sectionMatch = line.match(/^\[(.+)\]$/)
    if (!sectionMatch) continue
    if (start < 0) {
      if (sectionMatch[1].trim() === tableName) start = index
      continue
    }
    return { start, end: index }
  }
  return start < 0 ? null : { start, end: lines.length }
}

function sameApprovalEntry(a: CodexMcpApprovalEntry, b: CodexMcpApprovalEntry): boolean {
  return a.serverName === b.serverName && a.toolName === b.toolName
}

function updateExistingCodexMcpApproval(
  lines: string[],
  expected: CodexMcpApprovalEntry,
): { found: boolean; changed: boolean } {
  for (let index = 0; index < lines.length; index += 1) {
    const line = stripTomlComment(lines[index]).trim()
    if (!line) continue

    const sectionMatch = line.match(/^\[(.+)\]$/)
    if (sectionMatch) {
      const section = parseCodexApprovalSection(sectionMatch[1].trim())
      if (!section || !sameApprovalEntry(section, expected)) continue

      const end = findNextTableIndex(lines, index + 1)
      for (let assignmentIndex = index + 1; assignmentIndex < end; assignmentIndex += 1) {
        const assignmentLine = stripTomlComment(lines[assignmentIndex]).trim()
        const assignmentMatch = assignmentLine.match(/^approval_mode\s*=\s*(.+)$/)
        if (!assignmentMatch) continue

        const approvalMode = parseTomlValue(assignmentMatch[1].trim())
        if (approvalMode === 'approve') {
          return { found: true, changed: false }
        }
        throw new Error(formatApprovalConflict(expected, approvalMode))
      }

      lines.splice(end, 0, 'approval_mode = "approve"')
      return { found: true, changed: true }
    }

    const assignmentMatch = line.match(/^([^=]+?)\s*=\s*(.+)$/)
    if (!assignmentMatch) continue
    const assignment = parseCodexApprovalAssignmentKey(assignmentMatch[1].trim())
    if (!assignment || !sameApprovalEntry(assignment, expected)) continue

    const approvalMode = parseTomlValue(assignmentMatch[2].trim())
    if (approvalMode === 'approve') {
      return { found: true, changed: false }
    }
    throw new Error(formatApprovalConflict(expected, approvalMode))
  }

  return { found: false, changed: false }
}

function findNextTableIndex(lines: string[], start: number): number {
  for (let index = start; index < lines.length; index += 1) {
    if (/^\[.+\]$/.test(stripTomlComment(lines[index]).trim())) return index
  }
  return lines.length
}

function parseCodexApprovalSection(sectionName: string): CodexMcpApprovalEntry | null {
  const tokens = splitTomlDottedPath(sectionName)
  if (tokens.length !== 4) return null
  if (tokens[0] !== 'mcp_servers' || tokens[2] !== 'tools') return null

  return {
    serverName: tokens[1],
    toolName: tokens[3],
  }
}

function parseCodexApprovalAssignmentKey(key: string): CodexMcpApprovalEntry | null {
  const tokens = splitTomlDottedPath(key)
  if (tokens.length !== 5) return null
  if (tokens[0] !== 'mcp_servers' || tokens[2] !== 'tools' || tokens[4] !== 'approval_mode') return null

  return {
    serverName: tokens[1],
    toolName: tokens[3],
  }
}

function formatApprovalConflict(entry: CodexMcpApprovalEntry, approvalMode: unknown): string {
  const renderedMode = typeof approvalMode === 'string' ? `"${approvalMode}"` : JSON.stringify(approvalMode)
  return `Codex MCP approval conflict for ${entry.serverName}.${entry.toolName}: active config already sets approval_mode = ${renderedMode}. Pluxx will not override an explicit local security decision; edit the active Codex config manually if you want approval_mode = "approve".`
}

function splitTomlDottedPath(value: string): string[] {
  const parts: string[] = []
  let current = ''
  let inString = false
  let quote = ''

  for (let index = 0; index < value.length; index += 1) {
    const char = value[index]
    if ((char === '"' || char === "'") && value[index - 1] !== '\\') {
      if (!inString) {
        inString = true
        quote = char
      } else if (quote === char) {
        inString = false
        quote = ''
      }
      current += char
      continue
    }

    if (!inString && char === '.') {
      const trimmed = current.trim()
      if (trimmed) parts.push(trimmed)
      current = ''
      continue
    }

    current += char
  }

  const trimmed = current.trim()
  if (trimmed) parts.push(trimmed)

  return parts.map((part) => {
    const parsed = parseTomlValue(part)
    return typeof parsed === 'string' ? parsed : part
  })
}

function finishToml(lines: string[]): string {
  return `${lines.join('\n').replace(/\s+$/u, '')}\n`
}

function toQuotedTomlKey(value: string): string {
  return JSON.stringify(value)
}

function stripInternalApplyResult(result: InternalCodexCompanionApplyResult): CodexCompanionApplyResult {
  const { nextText: _nextText, ...publicResult } = result
  return publicResult
}
