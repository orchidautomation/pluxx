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
  kind: 'hooks-feature' | 'mcp-approval'
  status: 'added' | 'already-present' | 'skipped'
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

export function renderCodexCompanionApplyLines(
  result: CodexCompanionApplyResult,
  options: { dryRun: boolean },
): string[] {
  const lines = [
    `${options.dryRun ? 'Dry run: ' : ''}${result.changed ? 'Codex companion apply changes planned' : 'Codex companion apply already up to date'}: ${result.configPath}`,
    ...result.actions.map((action) => `  [${action.status}] ${action.detail}`),
    'Lifecycle: generated Codex companions stay in the installed bundle; `pluxx codex apply` only merges active-config prerequisites.',
    '  Hooks: applying `[features].hooks = true` enables the known prerequisite for plugin-bundled hooks, but runtime firing still depends on plugin state, trust, review, and current Codex behavior.',
    '  MCP approvals: `.codex/config.generated.toml` can be merged into active config for the live-proven per-tool approval path, while `.codex/permissions.generated.json` remains the broader advisory mirror.',
  ]

  if (result.changed && options.dryRun) {
    lines.push('Next: run without --dry-run to write the active config changes, then refresh/restart Codex and rerun `pluxx verify-install --target codex`.')
  } else if (result.changed) {
    lines.push('Applied. Refresh/restart Codex, then rerun `pluxx verify-install --target codex`.')
  } else {
    lines.push('Next: if you still need runtime confirmation, refresh/restart Codex and rerun `pluxx verify-install --target codex`.')
  }

  return lines
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
    if (codexBundleDeclaresHooks(consumerRoot)) {
      const hookMerge = ensureCodexHooksFeature(configText)
      configText = hookMerge.text
      changed ||= hookMerge.changed
      actions.push({
        kind: 'hooks-feature',
        status: hookMerge.changed ? 'added' : 'already-present',
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
        status: approvalMerge.changed ? 'added' : 'already-present',
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
