import {
  ORCHESTRATION_CAPABILITY_FIELDS,
  ORCHESTRATION_CAPABILITY_REGISTRY,
  type OrchestrationCapabilityOutcome,
} from '../orchestration-capability-registry'
import type { Orchestration } from '../orchestration'
import type { CoreFourPlatform } from '../validation/platform-rules'

export interface GeneratedOrchestrationArtifacts {
  payload: Record<string, unknown>
  receipt: Record<string, unknown>
  guidance: string
}

export function buildGeneratedOrchestrationArtifacts(
  platform: CoreFourPlatform,
  orchestration: Orchestration,
  source: { name: string; version: string },
): GeneratedOrchestrationArtifacts {
  const fieldOutcomes = ORCHESTRATION_CAPABILITY_REGISTRY
    .filter(row => row.platform === platform)
    .map(row => ({ ...row }))

  if (fieldOutcomes.length !== ORCHESTRATION_CAPABILITY_FIELDS.length) {
    throw new Error(`Incomplete orchestration generation inventory for ${platform}.`)
  }

  const weakerOutcomes = fieldOutcomes.filter(row => row.mode === 'degrade' || row.mode === 'drop')
  const orchestrationDigest = createHash('sha256').update(JSON.stringify(orchestration)).digest('hex')
  const identity = {
    plugin: source.name,
    version: source.version,
    orchestrationDigest,
    workflowIds: orchestration.workflows.map(workflow => workflow.id),
    activationIds: orchestration.activations.map(activation => activation.id),
  }
  const payload = {
    schemaVersion: 1,
    platform,
    evidenceTier: 'bundle-contract',
    installedBehaviorProven: false,
    identity,
    orchestration,
    hostGuidance: fieldOutcomes,
    fieldOutcomes,
  }
  const receipt = {
    schemaVersion: 1,
    kind: 'pluxx-orchestration-generation-receipt',
    platform,
    evidenceTier: 'bundle-contract',
    installedBehaviorProven: false,
    identity,
    fieldInventory: [...ORCHESTRATION_CAPABILITY_FIELDS],
    fieldOutcomes,
    summary: summarize(fieldOutcomes),
    residualRisk: 'Generated payload existence does not prove installed or runtime behavior; Phase 3 must execute the reference workflows on installed hosts.',
  }

  return { payload, receipt, guidance: renderGuidance(platform, identity, fieldOutcomes, weakerOutcomes) }
}

function summarize(rows: OrchestrationCapabilityOutcome[]): Record<string, number> {
  return {
    preserve: rows.filter(row => row.mode === 'preserve').length,
    translate: rows.filter(row => row.mode === 'translate').length,
    degrade: rows.filter(row => row.mode === 'degrade').length,
    drop: rows.filter(row => row.mode === 'drop').length,
  }
}

function renderGuidance(
  platform: CoreFourPlatform,
  identity: { plugin: string; version: string; orchestrationDigest: string; workflowIds: string[]; activationIds: string[] },
  rows: OrchestrationCapabilityOutcome[],
  weakerRows: OrchestrationCapabilityOutcome[],
): string {
  const lines = [
    '# Generated orchestration guidance',
    '',
    `Target: ${platform}`,
    `Plugin: ${identity.plugin}@${identity.version}`,
    `Workflows: ${identity.workflowIds.join(', ')}`,
    `Activations: ${identity.activationIds.join(', ')}`,
    `Canonical digest: ${identity.orchestrationDigest}`,
    '',
    'Installed/runtime behavior is not proven by this artifact. This bundle contains source-inspected mappings and deterministic generated-payload evidence only; Phase 3 owns installed execution.',
    '',
    '## Field outcomes',
    '',
    '| Field | Result | Mechanism | Enforcement | Rationale |',
    '|---|---|---|---|---|',
    ...rows.map(row => `| ${row.field} | ${row.mode} | ${row.mechanism} | ${row.enforcement} | ${row.rationale} |`),
    '',
    '## Degraded or dropped semantics',
    '',
    ...(weakerRows.length > 0
      ? weakerRows.map(row => `- ${row.field}: ${row.mode} via ${row.mechanism}. ${row.rationale}`)
      : ['- None.']),
    '',
  ]
  return lines.join('\n')
}
import { createHash } from 'crypto'
