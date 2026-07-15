import { describe, expect, it } from 'bun:test'
import {
  ORCHESTRATION_CAPABILITY_FIELDS,
  ORCHESTRATION_CAPABILITY_REGISTRY,
  OrchestrationCapabilityRegistrySchema,
  defineOrchestrationCapabilityRegistry,
  getOrchestrationCapabilityOutcome,
} from '../src/orchestration-capability-registry'
import { CORE_FOUR_PLATFORMS } from '../src/validation/platform-rules'

const validRow = {
  field: 'workflow-graph' as const,
  platform: 'codex' as const,
  mode: 'translate' as const,
  mechanism: 'workflow-adapter',
  activationRequirement: 'external-adapter' as const,
  enforcement: 'adapter-enforced' as const,
  childEnvironmentOutcome: 'translated' as const,
  evidenceTier: 'unit' as const,
}

describe('orchestration capability registry contract', () => {
  it('publishes stable host-neutral field identifiers', () => {
    expect(ORCHESTRATION_CAPABILITY_FIELDS).toContain('activation-routing')
    expect(ORCHESTRATION_CAPABILITY_FIELDS).toContain('credential-availability')
    expect(ORCHESTRATION_CAPABILITY_FIELDS).toContain('lifecycle-reentry')
  })

  it('accepts complete declared outcomes and returns them as mapped', () => {
    const registry = defineOrchestrationCapabilityRegistry([validRow])
    expect(getOrchestrationCapabilityOutcome(registry, 'workflow-graph', 'codex')).toEqual({ status: 'mapped', outcome: validRow })
  })

  it('keeps absent Phase 2 mappings explicitly unmapped', () => {
    const registry = ORCHESTRATION_CAPABILITY_REGISTRY
    for (const platform of CORE_FOUR_PLATFORMS) {
      expect(getOrchestrationCapabilityOutcome(registry, 'workflow-graph', platform)).toEqual({ status: 'unmapped' })
    }
  })

  it('rejects incomplete, duplicate, unknown, and secret-bearing rows', () => {
    for (const field of ['mechanism', 'activationRequirement', 'enforcement', 'childEnvironmentOutcome', 'evidenceTier'] as const) {
      expect(OrchestrationCapabilityRegistrySchema.safeParse([{ ...validRow, [field]: undefined }]).success).toBe(false)
    }
    expect(OrchestrationCapabilityRegistrySchema.safeParse([validRow, validRow]).success).toBe(false)
    expect(OrchestrationCapabilityRegistrySchema.safeParse([{ ...validRow, field: 'host-tool-name' }]).success).toBe(false)
    expect(OrchestrationCapabilityRegistrySchema.safeParse([{ ...validRow, credentialValue: 'secret-material' }]).success).toBe(false)
  })
})
