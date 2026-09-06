import type { CoreFourPlatform } from './validation/platform-rules'
import { renderCodexPluginDiagnostic, type CodexPluginDiagnostic } from './codex-plugin-collisions'

export const INSTALL_RESULT_SCHEMA = 'pluxx.install-results.v1' as const
export const INSTALL_SELECTION_MODES = ['aggregate', 'explicit'] as const
export type InstallSelectionMode = typeof INSTALL_SELECTION_MODES[number]
export const INSTALL_RESULT_STATES = ['installed', 'updated', 'unchanged', 'skipped', 'failed'] as const
export type InstallResultState = typeof INSTALL_RESULT_STATES[number]

export interface InstallPlanTarget {
  target: CoreFourPlatform
  detected: boolean
  selected: boolean
  reason?: string
}

export interface InstallPlan {
  schema: typeof INSTALL_RESULT_SCHEMA
  selectionMode: InstallSelectionMode
  targets: InstallPlanTarget[]
}

export interface InstallTargetResult {
  diagnostics?: CodexPluginDiagnostic[]
  target: CoreFourPlatform
  state: InstallResultState
  reason?: string
  action?: string
  error?: string
}

export interface InstallResultsEnvelope {
  schema: typeof INSTALL_RESULT_SCHEMA
  plugin: { name: string; version: string }
  selectionMode: InstallSelectionMode
  plan: InstallPlanTarget[]
  results: InstallTargetResult[]
}

export function buildInstallPlan(
  detected: readonly CoreFourPlatform[],
  explicit: readonly CoreFourPlatform[] | undefined,
): InstallPlan {
  const detectedSet = new Set(detected)
  const selectionMode: InstallSelectionMode = explicit ? 'explicit' : 'aggregate'
  const requested = explicit ? [...new Set(explicit)] : undefined
  const targets = (requested ?? (['claude-code', 'cursor', 'codex', 'opencode'] as CoreFourPlatform[]))
    .map((target) => ({
      target,
      detected: detectedSet.has(target),
      selected: true,
      ...(!explicit && !detectedSet.has(target) ? { reason: 'host-not-detected' } : {}),
    }))
  return { schema: INSTALL_RESULT_SCHEMA, selectionMode, targets }
}

export function validateInstallResultsEnvelope(value: unknown): value is InstallResultsEnvelope {
  if (!value || typeof value !== 'object') return false
  const envelope = value as Partial<InstallResultsEnvelope>
  if (envelope.schema !== INSTALL_RESULT_SCHEMA || !envelope.plugin || typeof envelope.plugin.name !== 'string' || typeof envelope.plugin.version !== 'string') return false
  if (envelope.selectionMode !== 'aggregate' && envelope.selectionMode !== 'explicit') return false
  if (!Array.isArray(envelope.plan) || !Array.isArray(envelope.results)) return false
  const coreTargets = new Set<CoreFourPlatform>(['claude-code', 'cursor', 'codex', 'opencode'])
  if (!envelope.plan.every((entry) => entry
    && coreTargets.has(entry.target)
    && typeof entry.detected === 'boolean'
    && typeof entry.selected === 'boolean')) return false
  const targets = new Set(envelope.plan.map((entry) => entry.target))
  if (targets.size !== envelope.plan.length || envelope.results.length !== envelope.plan.length) return false
  const resultTargets = new Set<CoreFourPlatform>()
  const valid = envelope.results.every((result) => {
    if (!result || typeof result.target !== 'string' || !targets.has(result.target)) return false
    if (resultTargets.has(result.target)) return false
    resultTargets.add(result.target)
    if (!INSTALL_RESULT_STATES.includes(result.state as InstallResultState)) return false
    if (result.state === 'skipped' && !result.reason?.trim()) return false
    if (result.state === 'failed' && (!result.error || !result.action)) return false
    if (result.diagnostics !== undefined && (result.state !== 'failed' || result.target !== 'codex'
      || !Array.isArray(result.diagnostics) || result.diagnostics.length !== 1
      || !result.diagnostics.every(validateCodexDiagnostic))) return false
    return true
  })
  return valid && resultTargets.size === targets.size
}

export function renderInstallResultsHuman(envelope: InstallResultsEnvelope): string[] {
  return envelope.results.map((result) => {
    const detail = result.state === 'skipped' ? ` (${result.reason})` : result.state === 'failed' ? ` — ${result.error}` : ''
    return `${result.target}: ${result.state}${detail}${result.diagnostics?.length ? '\n' + result.diagnostics.map(renderCodexPluginDiagnostic).join('\n') : ''}`
  })
}

export function validateCodexDiagnostic(value: unknown): value is CodexPluginDiagnostic {
  if (!value || typeof value !== 'object' || Buffer.byteLength(JSON.stringify(value), 'utf8') > 16384) return false
  const d = value as CodexPluginDiagnostic
  const identity = (row: any) => row && typeof row.selector === 'string' && /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}@[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(row.selector)
    && (row.version === null || (typeof row.version === 'string' && /^[A-Za-z0-9][A-Za-z0-9._+-]{0,127}$/.test(row.version)))
    && /^(local|remote|git|git-subdir|npm):sha256:[a-f0-9]{64}$/.test(row.sourceIdentity)
  if (!['same-name-cross-marketplace', 'codex-plugin-inventory-unavailable'].includes(d.code)
    || typeof d.error !== 'string' || !d.error || d.error.length > 512 || typeof d.action !== 'string' || !d.action || d.action.length > 1024
    || !Array.isArray(d.conflicts) || d.conflicts.length > 20 || !d.conflicts.every(identity)
    || !Number.isSafeInteger(d.totalConflicts) || d.totalConflicts < 0 || d.omittedConflicts !== d.totalConflicts - d.conflicts.length || d.omittedConflicts < 0) return false
  if (d.code === 'same-name-cross-marketplace') return identity(d.requested) && d.conflicts.length > 0
    && ['enabled', 'disabled', 'absent'].includes(d.requestedRegistration!)
    && d.conflicts.every(row => row.selector !== d.requested!.selector && row.selector.split('@')[0] === d.requested!.selector.split('@')[0])
    && new Set(d.conflicts.map(row => row.selector)).size === d.conflicts.length
  return d.totalConflicts === 0 && d.requested === undefined
}
