import { createHash } from 'crypto'
import { z } from 'zod'
import {
  ORCHESTRATION_CAPABILITY_FIELDS,
  ORCHESTRATION_CAPABILITY_REGISTRY,
  OrchestrationCapabilityOutcomeSchema,
  type OrchestrationCapabilityField,
  type OrchestrationCapabilityOutcome,
  type OrchestrationTranslationMode,
} from './orchestration-capability-registry'
import type { CoreFourPlatform } from './validation/platform-rules'

export const OrchestrationProofStatusSchema = z.enum([
  'proven',
  'unsupported',
  'environment-unavailable',
  'failed',
])
export const OrchestrationProofStageSchema = z.enum([
  'generated',
  'installed',
  'discovered',
  'activated',
  'behavioral',
])

export type OrchestrationProofStatus = z.infer<typeof OrchestrationProofStatusSchema>
export type OrchestrationProofStage = z.infer<typeof OrchestrationProofStageSchema>

export interface OrchestrationFieldEvidence {
  status: OrchestrationProofStatus
  stage: OrchestrationProofStage
  mechanism: string
  resultingMode: OrchestrationTranslationMode
  evidenceIds: string[]
}

export interface OrchestrationProofFact {
  id: string
  kind: 'assertion' | 'path' | 'sha256' | 'version'
  value: string
}

interface GeneratedReceiptInput {
  schemaVersion: number
  kind: string
  platform: CoreFourPlatform
  evidenceTier: string
  installedBehaviorProven: boolean
  identity: {
    plugin: string
    version: string
    orchestrationDigest: string
    workflowIds: string[]
    activationIds: string[]
  }
  fieldInventory: string[]
  fieldOutcomes: OrchestrationCapabilityOutcome[]
}

const GeneratedReceiptInputSchema = z.object({
  schemaVersion: z.literal(1),
  kind: z.literal('pluxx-orchestration-generation-receipt'),
  platform: z.enum(['claude-code', 'cursor', 'codex', 'opencode']),
  evidenceTier: z.literal('bundle-contract'),
  installedBehaviorProven: z.literal(false),
  identity: z.object({
    plugin: z.string().min(1),
    version: z.string().min(1),
    orchestrationDigest: z.string().regex(/^[a-f0-9]{64}$/),
    workflowIds: z.array(z.string().min(1)),
    activationIds: z.array(z.string().min(1)),
  }),
  fieldInventory: z.array(z.string()),
  fieldOutcomes: z.array(OrchestrationCapabilityOutcomeSchema),
}).passthrough()

const OrchestrationProofFactSchema = z.object({
  id: z.string().min(1),
  kind: z.enum(['assertion', 'path', 'sha256', 'version']),
  value: z.string().min(1),
}).superRefine((fact, context) => {
  if (fact.kind === 'sha256' && !/^[a-f0-9]{64}$/.test(fact.value)) {
    context.addIssue({ code: 'custom', message: 'sha256 facts require a 64-character lowercase hexadecimal value.' })
  }
})

const OrchestrationFieldEvidenceSchema = z.object({
  status: OrchestrationProofStatusSchema,
  stage: OrchestrationProofStageSchema,
  mechanism: z.string().min(1),
  resultingMode: z.enum(['preserve', 'translate', 'degrade', 'drop']),
  evidenceIds: z.array(z.string().min(1)),
})

interface StageEvidence {
  status: OrchestrationProofStatus
  evidenceIds: string[]
}

const StageEvidenceSchema = z.object({
  status: OrchestrationProofStatusSchema,
  evidenceIds: z.array(z.string().min(1)).min(1),
})

export interface BuildOrchestrationRuntimeReceiptInput {
  fixture: string
  generatedReceipt: GeneratedReceiptInput
  host: {
    platform: CoreFourPlatform
    version: {
      status: OrchestrationProofStatus
      value: string | null
      detail: string
    }
    probe: { name: string; version: string; command: string }
  }
  evidence: Record<OrchestrationProofStage, StageEvidence>
  facts: OrchestrationProofFact[]
  installedPath: string
  fieldEvidence: Partial<Record<OrchestrationCapabilityField, OrchestrationFieldEvidence>>
}

export interface OrchestrationRuntimeReceipt {
  schemaVersion: 1
  kind: 'pluxx-orchestration-runtime-receipt'
  proofTier: 'fake-home-install'
  identity: GeneratedReceiptInput['identity'] & { fixture: string }
  host: BuildOrchestrationRuntimeReceiptInput['host']
  installedPath: string
  evidence: Record<OrchestrationProofStage, StageEvidence>
  facts: OrchestrationProofFact[]
  fieldOutcomes: Array<{
    field: OrchestrationCapabilityField
    declared: OrchestrationCapabilityOutcome
    effective: OrchestrationCapabilityOutcome
    evidence: OrchestrationFieldEvidence
  }>
  installedBehaviorProven: boolean
  receiptDigest: string
}

export interface OrchestrationRuntimeProofSummary {
  receiptCount: number
  generatedProven: number
  installedProven: number
  discoveryProven: number
  discoveryEnvironmentUnavailable: number
  activationUnsupported: number
  behavioralEnvironmentUnavailable: number
  fieldOutcomeCount: number
  degradedOutcomeCount: number
}

export interface ExpectedOrchestrationRuntimeFixture {
  fixture: string
  plugin: string
  version: string
  orchestrationDigest: string
}

const PRIVATE_KEY_PATTERN = /^(?:api[-_]?(?:key|token)s?|access[-_]?tokens?|refresh[-_]?tokens?|tokens?|cookies?|authorization|secrets?|passwords?|credentials?|raw[-_]?transcripts?|session[-_]?(?:data|cookies?))$/i
const PRIVATE_VALUE_PATTERNS = [
  /authorization\s*:\s*bearer\s+\S+/i,
  /cookie\s*:\s*\S+/i,
  /\bsk-[A-Za-z0-9_-]{8,}\b/,
]

export function assertOrchestrationProofPrivacySafe(value: unknown, path = '$'): void {
  if (typeof value === 'string') {
    if (PRIVATE_VALUE_PATTERNS.some(pattern => pattern.test(value))) {
      throw new Error(`Refusing private proof material at ${path}.`)
    }
    return
  }
  if (Array.isArray(value)) {
    value.forEach((entry, index) => assertOrchestrationProofPrivacySafe(entry, `${path}[${index}]`))
    return
  }
  if (!value || typeof value !== 'object') return
  for (const [key, entry] of Object.entries(value)) {
    if (PRIVATE_KEY_PATTERN.test(key)) {
      throw new Error(`Refusing private proof material at ${path}.${key}.`)
    }
    assertOrchestrationProofPrivacySafe(entry, `${path}.${key}`)
  }
}

export function resolveOrchestrationOutcomeWithEvidence(
  declared: OrchestrationCapabilityOutcome,
  evidence: OrchestrationFieldEvidence,
  stages: Record<OrchestrationProofStage, StageEvidence>,
): OrchestrationCapabilityOutcome {
  if (evidence.mechanism !== declared.mechanism) {
    throw new Error(`Evidence mechanism ${evidence.mechanism} does not match declared mechanism ${declared.mechanism}.`)
  }
  if (evidence.status !== 'proven') {
    if (evidence.resultingMode !== declared.mode) {
      throw new Error(`Unproven evidence for ${declared.field} must retain declared mode ${declared.mode}.`)
    }
    return declared
  }
  if (evidence.stage !== 'behavioral') {
    throw new Error(`Promoting ${declared.field} requires behavioral evidence.`)
  }
  if (stages.generated.status !== 'proven' || stages.installed.status !== 'proven'
    || stages.behavioral.status !== 'proven') {
    throw new Error(`Promoting ${declared.field} requires proven generated, installed, and behavioral stages.`)
  }
  if (evidence.evidenceIds.length === 0) {
    throw new Error(`Promoting ${declared.field} requires exact evidence identifiers.`)
  }
  return {
    ...declared,
    mode: evidence.resultingMode,
  }
}

export function buildOrchestrationRuntimeReceipt(
  input: BuildOrchestrationRuntimeReceiptInput,
): OrchestrationRuntimeReceipt {
  assertOrchestrationProofPrivacySafe(input)
  if (!input.fixture.trim()) throw new Error('Runtime proof requires a fixture identity.')
  if (!input.installedPath.trim()) throw new Error('Runtime proof requires an installed path.')
  OrchestrationProofStatusSchema.parse(input.host.version.status)
  if (input.host.version.status === 'proven' && !input.host.version.value?.trim()) {
    throw new Error('A proven host version requires an exact value.')
  }
  const generatedReceipt = GeneratedReceiptInputSchema.parse(input.generatedReceipt) as GeneratedReceiptInput
  if (generatedReceipt.platform !== input.host.platform) {
    throw new Error(`Generated receipt platform ${generatedReceipt.platform} does not match host ${input.host.platform}.`)
  }
  if (generatedReceipt.fieldInventory.length !== ORCHESTRATION_CAPABILITY_FIELDS.length
    || generatedReceipt.fieldInventory.some((field, index) => field !== ORCHESTRATION_CAPABILITY_FIELDS[index])) {
    throw new Error('Runtime proof requires the canonical field inventory.')
  }
  if (generatedReceipt.fieldOutcomes.length !== ORCHESTRATION_CAPABILITY_FIELDS.length) {
    throw new Error(`Runtime proof requires exactly 27 field outcomes.`)
  }
  const parsedRows = generatedReceipt.fieldOutcomes.map(row => OrchestrationCapabilityOutcomeSchema.parse(row))
  const fields = parsedRows.map(row => row.field)
  if (new Set(fields).size !== ORCHESTRATION_CAPABILITY_FIELDS.length
    || ORCHESTRATION_CAPABILITY_FIELDS.some(field => !fields.includes(field))) {
    throw new Error(`Runtime proof requires exactly 27 unique canonical field outcomes.`)
  }

  const facts = input.facts.map(fact => OrchestrationProofFactSchema.parse(fact) as OrchestrationProofFact)
    .sort((a, b) => a.id.localeCompare(b.id))
  const factIds = new Set(facts.map(fact => fact.id))
  if (factIds.size !== facts.length) throw new Error('Runtime proof fact identifiers must be unique.')
  for (const [stageName, stageEvidence] of Object.entries(input.evidence)) {
    const parsedStageEvidence = StageEvidenceSchema.parse(stageEvidence)
    for (const evidenceId of parsedStageEvidence.evidenceIds) {
      if (!factIds.has(evidenceId)) throw new Error(`Unknown evidence identifier ${evidenceId} in ${stageName}.`)
    }
  }

  const fieldOutcomes = parsedRows
    .sort((a, b) => ORCHESTRATION_CAPABILITY_FIELDS.indexOf(a.field) - ORCHESTRATION_CAPABILITY_FIELDS.indexOf(b.field))
    .map((declared) => {
      const evidence = OrchestrationFieldEvidenceSchema.parse(
        input.fieldEvidence[declared.field] ?? defaultFieldEvidence(declared, input.evidence),
      ) as OrchestrationFieldEvidence
      const receiptStage = input.evidence[evidence.stage]
      if (evidence.status !== receiptStage.status) {
        throw new Error(`Evidence for ${declared.field} must match the ${evidence.stage} stage status.`)
      }
      for (const evidenceId of evidence.evidenceIds) {
        if (!factIds.has(evidenceId)) throw new Error(`Unknown evidence identifier ${evidenceId} for ${declared.field}.`)
        if (!receiptStage.evidenceIds.includes(evidenceId)) {
          throw new Error(`Evidence identifier ${evidenceId} for ${declared.field} is not registered for the ${evidence.stage} stage.`)
        }
      }
      return {
        field: declared.field,
        declared,
        effective: resolveOrchestrationOutcomeWithEvidence(declared, evidence, input.evidence),
        evidence: { ...evidence, evidenceIds: [...evidence.evidenceIds].sort() },
      }
    })

  const withoutDigest = {
    schemaVersion: 1 as const,
    kind: 'pluxx-orchestration-runtime-receipt' as const,
    proofTier: 'fake-home-install' as const,
    identity: { ...generatedReceipt.identity, fixture: input.fixture },
    host: input.host,
    installedPath: input.installedPath,
    evidence: normalizeStageEvidence(input.evidence),
    facts,
    fieldOutcomes,
    installedBehaviorProven: input.evidence.generated.status === 'proven'
      && input.evidence.installed.status === 'proven'
      && fieldOutcomes.every(row => row.evidence.status === 'proven'
        && row.evidence.stage === 'behavioral'),
  }
  const receiptDigest = createHash('sha256').update(stableStringify(withoutDigest)).digest('hex')
  return { ...withoutDigest, receiptDigest }
}

export function summarizeOrchestrationRuntimeReceipts(
  values: unknown[],
  expectedFixtures: ExpectedOrchestrationRuntimeFixture[] = [],
): OrchestrationRuntimeProofSummary {
  const receipts = values.map((value, index) => validateRuntimeReceipt(value, index))
  const identities = new Set(receipts.map(receipt => `${receipt.identity.fixture}/${receipt.host.platform}`))
  if (identities.size !== receipts.length) throw new Error('Runtime proof receipts require unique fixture/host identities.')
  if (expectedFixtures.length > 0) {
    const expectedByFixture = new Map(expectedFixtures.map(expected => [expected.fixture, expected]))
    const expectedIdentities = new Set(expectedFixtures.flatMap(expected =>
      ['claude-code', 'cursor', 'codex', 'opencode'].map(platform => `${expected.fixture}/${platform}`),
    ))
    if (receipts.length !== expectedIdentities.size
      || [...identities].some(identity => !expectedIdentities.has(identity))) {
      throw new Error('Runtime proof receipts do not match the expected fixture/host portfolio.')
    }
    for (const receipt of receipts) {
      const expected = expectedByFixture.get(receipt.identity.fixture)
      if (!expected || receipt.identity.plugin !== expected.plugin || receipt.identity.version !== expected.version
        || receipt.identity.orchestrationDigest !== expected.orchestrationDigest) {
        throw new Error(`Runtime proof receipt for ${receipt.identity.fixture}/${receipt.host.platform} is not source-fresh.`)
      }
    }
  }

  return {
    receiptCount: receipts.length,
    generatedProven: countStage(receipts, 'generated', 'proven'),
    installedProven: countStage(receipts, 'installed', 'proven'),
    discoveryProven: countStage(receipts, 'discovered', 'proven'),
    discoveryEnvironmentUnavailable: countStage(receipts, 'discovered', 'environment-unavailable'),
    activationUnsupported: countStage(receipts, 'activated', 'unsupported'),
    behavioralEnvironmentUnavailable: countStage(receipts, 'behavioral', 'environment-unavailable'),
    fieldOutcomeCount: receipts.reduce((total, receipt) => total + receipt.fieldOutcomes.length, 0),
    degradedOutcomeCount: receipts.reduce((total, receipt) => total
      + receipt.fieldOutcomes.filter(row => row.effective.mode === 'degrade').length, 0),
  }
}

function validateRuntimeReceipt(value: unknown, index: number): OrchestrationRuntimeReceipt {
  assertOrchestrationProofPrivacySafe(value, `$[${index}]`)
  if (!value || typeof value !== 'object') throw new Error(`Runtime proof receipt ${index} must be an object.`)
  const receipt = value as OrchestrationRuntimeReceipt
  if (receipt.schemaVersion !== 1 || receipt.kind !== 'pluxx-orchestration-runtime-receipt'
    || receipt.proofTier !== 'fake-home-install') {
    throw new Error(`Runtime proof receipt ${index} has an unsupported contract.`)
  }
  if (!receipt.identity?.fixture?.trim() || !receipt.identity.plugin?.trim() || !receipt.identity.version?.trim()
    || !/^[a-f0-9]{64}$/.test(receipt.identity.orchestrationDigest ?? '')) {
    throw new Error(`Runtime proof receipt ${index} has an invalid identity.`)
  }
  if (!['claude-code', 'cursor', 'codex', 'opencode'].includes(receipt.host?.platform ?? '')) {
    throw new Error(`Runtime proof receipt ${index} has an invalid host.`)
  }
  if (!receipt.host.probe?.name?.trim() || !receipt.host.probe.version?.trim() || !receipt.host.probe.command?.trim()) {
    throw new Error(`Runtime proof receipt ${index} has an invalid probe contract.`)
  }
  OrchestrationProofStatusSchema.parse(receipt.host.version?.status)
  if (receipt.host.version.status === 'proven' && !receipt.host.version.value?.trim()) {
    throw new Error(`Runtime proof receipt ${index} has no exact proven host version.`)
  }
  const facts = receipt.facts?.map(fact => OrchestrationProofFactSchema.parse(fact) as OrchestrationProofFact) ?? []
  const factIds = new Set(facts.map(fact => fact.id))
  if (factIds.size !== facts.length) throw new Error(`Runtime proof receipt ${index} has duplicate fact identifiers.`)
  for (const stage of OrchestrationProofStageSchema.options) {
    const stageEvidence = StageEvidenceSchema.parse(receipt.evidence?.[stage])
    for (const evidenceId of stageEvidence.evidenceIds) {
      if (!factIds.has(evidenceId)) throw new Error(`Runtime proof receipt ${index} references unknown evidence ${evidenceId}.`)
    }
  }
  if (receipt.fieldOutcomes?.length !== ORCHESTRATION_CAPABILITY_FIELDS.length) {
    throw new Error(`Runtime proof receipt ${index} requires exactly 27 field outcomes.`)
  }
  const fields = new Set<OrchestrationCapabilityField>()
  for (const row of receipt.fieldOutcomes) {
    const declared = OrchestrationCapabilityOutcomeSchema.parse(row.declared)
    const effective = OrchestrationCapabilityOutcomeSchema.parse(row.effective)
    const fieldEvidence = OrchestrationFieldEvidenceSchema.parse(row.evidence) as OrchestrationFieldEvidence
    if (row.field !== declared.field || effective.field !== declared.field
      || declared.platform !== receipt.host.platform || effective.platform !== receipt.host.platform) {
      throw new Error(`Runtime proof receipt ${index} has a field or platform mismatch.`)
    }
    fields.add(row.field)
    const currentDeclared = ORCHESTRATION_CAPABILITY_REGISTRY.find(candidate =>
      candidate.platform === receipt.host.platform && candidate.field === row.field)
    if (!currentDeclared || stableStringify(declared) !== stableStringify(currentDeclared)) {
      throw new Error(`Runtime proof receipt ${index} is stale against the compiler registry for ${row.field}.`)
    }
    const resolved = resolveOrchestrationOutcomeWithEvidence(currentDeclared, fieldEvidence, receipt.evidence)
    if (stableStringify(resolved) !== stableStringify(effective)) {
      throw new Error(`Runtime proof receipt ${index} has an unsubstantiated effective outcome for ${row.field}.`)
    }
    const stageEvidence = receipt.evidence[fieldEvidence.stage]
    if (fieldEvidence.status !== stageEvidence.status) {
      throw new Error(`Runtime proof receipt ${index} contradicts its ${fieldEvidence.stage} stage.`)
    }
    for (const evidenceId of fieldEvidence.evidenceIds) {
      if (!stageEvidence.evidenceIds.includes(evidenceId)) {
        throw new Error(`Runtime proof receipt ${index} uses evidence outside the ${fieldEvidence.stage} stage.`)
      }
    }
  }
  if (fields.size !== ORCHESTRATION_CAPABILITY_FIELDS.length) {
    throw new Error(`Runtime proof receipt ${index} requires unique canonical field outcomes.`)
  }
  const { receiptDigest, ...withoutDigest } = receipt
  const expectedDigest = createHash('sha256').update(stableStringify(withoutDigest)).digest('hex')
  if (receiptDigest !== expectedDigest) throw new Error(`Runtime proof receipt ${index} digest does not match its contents.`)
  const behaviorProven = receipt.evidence.generated.status === 'proven'
    && receipt.evidence.installed.status === 'proven'
    && receipt.fieldOutcomes.every(row => row.evidence.status === 'proven'
      && row.evidence.stage === 'behavioral')
  if (receipt.installedBehaviorProven !== behaviorProven) {
    throw new Error(`Runtime proof receipt ${index} has a contradictory behavior summary.`)
  }
  return receipt
}

function countStage(
  receipts: OrchestrationRuntimeReceipt[],
  stage: OrchestrationProofStage,
  status: OrchestrationProofStatus,
): number {
  return receipts.filter(receipt => receipt.evidence[stage].status === status).length
}

function defaultFieldEvidence(
  declared: OrchestrationCapabilityOutcome,
  evidence: Record<OrchestrationProofStage, StageEvidence>,
): OrchestrationFieldEvidence {
  const stage: OrchestrationProofStage = declared.field === 'activation-routing' || declared.field === 'lifecycle-reentry'
    ? 'activated'
    : 'behavioral'
  return {
    status: evidence[stage].status,
    stage,
    mechanism: declared.mechanism,
    resultingMode: declared.mode,
    evidenceIds: [...evidence[stage].evidenceIds],
  }
}

function normalizeStageEvidence(
  evidence: Record<OrchestrationProofStage, StageEvidence>,
): Record<OrchestrationProofStage, StageEvidence> {
  return Object.fromEntries(
    OrchestrationProofStageSchema.options.map(stage => [stage, {
      status: evidence[stage].status,
      evidenceIds: [...evidence[stage].evidenceIds].sort(),
    }]),
  ) as Record<OrchestrationProofStage, StageEvidence>
}

function stableStringify(value: unknown): string {
  return JSON.stringify(sortObject(value))
}

function sortObject(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortObject)
  if (!value || typeof value !== 'object') return value
  return Object.fromEntries(
    Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => [key, sortObject(entry)]),
  )
}
