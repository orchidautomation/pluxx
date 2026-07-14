import { z } from 'zod'
import { ProofTierSchema } from './proof-freshness'
import { TargetPlatform, type TargetPlatform as TargetPlatformType } from './schema'

export const ORCHESTRATION_CAPABILITY_FIELDS = [
  'activation-routing',
  'lifecycle-reentry',
  'workflow-graph',
  'role-binding',
  'generic-dispatch',
  'bounded-context',
  'artifact-flow',
  'state-flow',
  'ownership',
  'barrier',
  'wait',
  'gate',
  'completion',
  'repair',
  'resume',
  'synthesis',
  'cancellation',
  'fallback',
  'proof-requirements',
  'capability-requirements',
  'tool-requirements',
  'mcp-requirements',
  'permission-requirements',
  'sandbox-requirements',
  'credential-availability',
  'inheritance-override',
  'delegation-bounds',
] as const

export const OrchestrationCapabilityFieldSchema = z.enum(ORCHESTRATION_CAPABILITY_FIELDS)
export const OrchestrationTranslationModeSchema = z.enum(['preserve', 'translate', 'degrade', 'drop'])
export const OrchestrationActivationRequirementSchema = z.enum([
  'none',
  'manual-entry',
  'lifecycle-wiring',
  'external-adapter',
  'user-confirmation',
])
export const OrchestrationEnforcementSchema = z.enum([
  'native-enforced',
  'adapter-enforced',
  'prompt-guided',
  'not-enforced',
])
export const OrchestrationChildEnvironmentOutcomeSchema = z.enum([
  'preserved',
  'translated',
  'weakened',
  'unavailable',
  'not-applicable',
])

export const OrchestrationCapabilityOutcomeSchema = z.object({
  field: OrchestrationCapabilityFieldSchema,
  platform: TargetPlatform,
  mode: OrchestrationTranslationModeSchema,
  mechanism: z.string().min(1).max(128).regex(/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/, 'Use a named kebab-case mechanism.'),
  rationale: z.string().min(1).max(512),
  activationRequirement: OrchestrationActivationRequirementSchema,
  enforcement: OrchestrationEnforcementSchema,
  childEnvironmentOutcome: OrchestrationChildEnvironmentOutcomeSchema,
  evidenceReferences: z.array(z.string().min(1)).min(1),
  evidenceTier: ProofTierSchema.refine(
    tier => tier === 'unit' || tier === 'bundle-contract',
    'Phase 2 registry rows may claim only source-inspected or generated-payload evidence.',
  ),
}).strict()

export const OrchestrationCapabilityRegistrySchema = z.array(OrchestrationCapabilityOutcomeSchema).superRefine((rows, ctx) => {
  const seen = new Set<string>()
  rows.forEach((row, index) => {
    const key = `${row.field}:${row.platform}`
    if (seen.has(key)) ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: [index, 'field'],
      message: `Duplicate orchestration capability outcome for ${row.field} on ${row.platform}.`,
    })
    seen.add(key)
  })
})

export type OrchestrationCapabilityField = z.infer<typeof OrchestrationCapabilityFieldSchema>
export type OrchestrationTranslationMode = z.infer<typeof OrchestrationTranslationModeSchema>
export type OrchestrationActivationRequirement = z.infer<typeof OrchestrationActivationRequirementSchema>
export type OrchestrationEnforcement = z.infer<typeof OrchestrationEnforcementSchema>
export type OrchestrationChildEnvironmentOutcome = z.infer<typeof OrchestrationChildEnvironmentOutcomeSchema>
export type OrchestrationCapabilityOutcome = z.infer<typeof OrchestrationCapabilityOutcomeSchema>
export type OrchestrationCapabilityRegistry = z.infer<typeof OrchestrationCapabilityRegistrySchema>
export type OrchestrationCapabilityLookup =
  | { status: 'mapped'; outcome: OrchestrationCapabilityOutcome }
  | { status: 'unmapped' }

export function defineOrchestrationCapabilityRegistry(value: unknown): OrchestrationCapabilityRegistry {
  return OrchestrationCapabilityRegistrySchema.parse(value)
}

const CORE_FOUR_ORCHESTRATION_PLATFORMS = ['claude-code', 'cursor', 'codex', 'opencode'] as const

type CoreFourOrchestrationPlatform = typeof CORE_FOUR_ORCHESTRATION_PLATFORMS[number]

const COMPANION_MECHANISMS: Record<OrchestrationCapabilityField, string> = {
  'activation-routing': 'activation-guidance',
  'lifecycle-reentry': 'lifecycle-guidance',
  'workflow-graph': 'workflow-graph-companion',
  'role-binding': 'role-binding-guidance',
  'generic-dispatch': 'dispatch-guidance',
  'bounded-context': 'bounded-context-companion',
  'artifact-flow': 'artifact-contract-companion',
  'state-flow': 'state-contract-companion',
  ownership: 'ownership-guidance',
  barrier: 'barrier-guidance',
  wait: 'wait-guidance',
  gate: 'gate-guidance',
  completion: 'completion-guidance',
  repair: 'repair-guidance',
  resume: 'resume-ledger-guidance',
  synthesis: 'synthesis-guidance',
  cancellation: 'cancellation-guidance',
  fallback: 'fallback-guidance',
  'proof-requirements': 'proof-receipt-companion',
  'capability-requirements': 'capability-guidance',
  'tool-requirements': 'tool-guidance',
  'mcp-requirements': 'mcp-guidance',
  'permission-requirements': 'permission-guidance',
  'sandbox-requirements': 'sandbox-guidance',
  'credential-availability': 'credential-availability-guidance',
  'inheritance-override': 'child-environment-guidance',
  'delegation-bounds': 'delegation-bounds-guidance',
}

const FIELD_RATIONALES: Record<OrchestrationCapabilityField, string> = {
  'activation-routing': 'Canonical intent routing does not contain the executable host entrypoint needed for native wiring.',
  'lifecycle-reentry': 'Lifecycle events are represented, but the IR does not contain an executable hook or extension adapter.',
  'workflow-graph': 'No core-four host consumes the canonical graph as a native declarative workflow.',
  'role-binding': 'Role references remain guidance because prompt assets cannot be projected into a runnable identity from this field alone.',
  'generic-dispatch': 'The hosts expose dispatch primitives, but invocation remains prompt-driven rather than generated enforcement.',
  'bounded-context': 'Packet limits are retained in the companion but are not enforced by a generated host boundary.',
  'artifact-flow': 'Artifact contracts are preserved as guidance without a native typed dataflow engine.',
  'state-flow': 'State contracts are preserved as guidance without a native state engine.',
  ownership: 'File ownership remains advisory because no generated host policy enforces exclusive paths.',
  barrier: 'Barrier semantics remain advisory because no generated host scheduler consumes them.',
  wait: 'Wait predicates are rendered as guidance rather than executable host conditions.',
  gate: 'Required gates are visible but not mechanically host-enforced.',
  completion: 'Completion predicates are visible but not mechanically host-enforced.',
  repair: 'Targeted repair policy is visible but not mechanically host-enforced.',
  resume: 'Resume and dedupe state require a durable runtime adapter that Phase 2 does not install.',
  synthesis: 'Synthesis ownership is prompt-guided rather than bound to a generated host primitive.',
  cancellation: 'Cancellation policy is prompt-guided rather than bound to a generated host primitive.',
  fallback: 'Fallback order is retained as guidance without an executable adapter.',
  'proof-requirements': 'Proof requirements are emitted into the receipt but not executed against an installed host.',
  'capability-requirements': 'Capability needs are listed without a generated host admission check.',
  'tool-requirements': 'Tool needs are listed without a generated host admission check.',
  'mcp-requirements': 'MCP needs are listed without changing the separately owned MCP configuration.',
  'permission-requirements': 'Permission needs are listed without widening or rewriting separately owned policy.',
  'sandbox-requirements': 'Sandbox minimums are listed without claiming host enforcement.',
  'credential-availability': 'Credential availability classes are listed without reading or embedding secret material.',
  'inheritance-override': 'Child-environment override intent is listed without claiming the host can enforce every dimension.',
  'delegation-bounds': 'Delegation and concurrency budgets are listed without claiming the host enforces all bounds.',
}

const HOST_EVIDENCE: Record<CoreFourOrchestrationPlatform, string> = {
  'claude-code': 'https://docs.anthropic.com/en/docs/claude-code',
  cursor: 'https://docs.cursor.com/',
  codex: 'https://developers.openai.com/codex/',
  opencode: 'https://opencode.ai/docs/',
}

const CHILD_ENVIRONMENT_FIELDS = new Set<OrchestrationCapabilityField>([
  'capability-requirements', 'tool-requirements', 'mcp-requirements', 'permission-requirements',
  'sandbox-requirements', 'credential-availability', 'inheritance-override', 'delegation-bounds',
])

function buildRegistryRow(
  field: OrchestrationCapabilityField,
  platform: CoreFourOrchestrationPlatform,
): OrchestrationCapabilityOutcome {
  return {
    field,
    platform,
    mode: 'degrade',
    mechanism: `${platform}-${COMPANION_MECHANISMS[field]}`,
    rationale: `${FIELD_RATIONALES[field]} The ${platform} generator therefore emits deterministic companion guidance and no native-enforcement claim.`,
    activationRequirement: 'external-adapter',
    enforcement: 'prompt-guided',
    childEnvironmentOutcome: CHILD_ENVIRONMENT_FIELDS.has(field) ? 'weakened' : 'not-applicable',
    evidenceReferences: [
      HOST_EVIDENCE[platform],
      'docs/orchid/requirements/2026-07-14-orchestration-reference-patterns.md',
    ],
    evidenceTier: 'unit',
  }
}

export const ORCHESTRATION_CAPABILITY_REGISTRY = defineOrchestrationCapabilityRegistry(
  ORCHESTRATION_CAPABILITY_FIELDS.flatMap(field => CORE_FOUR_ORCHESTRATION_PLATFORMS.map(platform => buildRegistryRow(field, platform))),
)

export function assertCompleteCoreFourOrchestrationRegistry(registry: OrchestrationCapabilityRegistry): void {
  const expected = new Set(ORCHESTRATION_CAPABILITY_FIELDS.flatMap(field => CORE_FOUR_ORCHESTRATION_PLATFORMS.map(platform => `${field}:${platform}`)))
  const actual = new Set(registry.map(row => `${row.field}:${row.platform}`))
  const missing = [...expected].filter(key => !actual.has(key))
  const unexpected = [...actual].filter(key => !expected.has(key))
  if (missing.length > 0 || unexpected.length > 0 || registry.length !== expected.size) {
    throw new Error(`Incomplete core-four orchestration registry. Missing: ${missing.join(', ') || 'none'}. Unexpected: ${unexpected.join(', ') || 'none'}.`)
  }
}

assertCompleteCoreFourOrchestrationRegistry(ORCHESTRATION_CAPABILITY_REGISTRY)

export function deriveOrchestrationPrimitiveCapability(platform: CoreFourOrchestrationPlatform): {
  mode: OrchestrationTranslationMode
  nativeSurfaces: string[]
  notes: string
} {
  const rows = ORCHESTRATION_CAPABILITY_REGISTRY.filter(row => row.platform === platform)
  const modes = new Set(rows.map(row => row.mode))
  const mode: OrchestrationTranslationMode = modes.size === 1 && modes.has('drop')
    ? 'drop'
    : modes.has('drop') || modes.has('degrade')
      ? 'degrade'
      : modes.has('translate')
        ? 'translate'
        : 'preserve'
  return {
    mode,
    nativeSurfaces: [...new Set(rows.map(row => row.mechanism))],
    notes: `Derived from ${rows.length} canonical fields in the orchestration registry. Effective outcomes retain explicit degradation until mechanism-specific behavioral evidence validates an executable host path.`,
  }
}

export function getOrchestrationCapabilityOutcome(
  registry: OrchestrationCapabilityRegistry,
  field: OrchestrationCapabilityField,
  platform: TargetPlatformType,
): OrchestrationCapabilityLookup {
  const outcome = registry.find((row) => row.field === field && row.platform === platform)
  return outcome ? { status: 'mapped', outcome } : { status: 'unmapped' }
}
