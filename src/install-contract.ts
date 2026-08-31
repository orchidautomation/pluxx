import type { CoreFourPlatform } from './validation/platform-rules'

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
    return true
  })
  return valid && resultTargets.size === targets.size
}

export function renderInstallResultsHuman(envelope: InstallResultsEnvelope): string[] {
  return envelope.results.map((result) => {
    const detail = result.state === 'skipped' ? ` (${result.reason})` : result.state === 'failed' ? ` — ${result.error}` : ''
    return `${result.target}: ${result.state}${detail}`
  })
}
