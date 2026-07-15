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
  activationRequirement: OrchestrationActivationRequirementSchema,
  enforcement: OrchestrationEnforcementSchema,
  childEnvironmentOutcome: OrchestrationChildEnvironmentOutcomeSchema,
  evidenceTier: ProofTierSchema,
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

// Phase 1 intentionally declares no host outcomes. Phase 2 owns population.
export const ORCHESTRATION_CAPABILITY_REGISTRY = defineOrchestrationCapabilityRegistry([])

export function getOrchestrationCapabilityOutcome(
  registry: OrchestrationCapabilityRegistry,
  field: OrchestrationCapabilityField,
  platform: TargetPlatformType,
): OrchestrationCapabilityLookup {
  const outcome = registry.find((row) => row.field === field && row.platform === platform)
  return outcome ? { status: 'mapped', outcome } : { status: 'unmapped' }
}
