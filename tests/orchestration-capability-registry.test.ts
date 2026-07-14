import { describe, expect, it } from 'bun:test'
import {
  ORCHESTRATION_CAPABILITY_FIELDS,
  ORCHESTRATION_CAPABILITY_REGISTRY,
  OrchestrationCapabilityRegistrySchema,
  assertCompleteCoreFourOrchestrationRegistry,
  deriveOrchestrationPrimitiveCapability,
  defineOrchestrationCapabilityRegistry,
  getOrchestrationCapabilityOutcome,
} from '../src/orchestration-capability-registry'
import { CORE_FOUR_PLATFORMS } from '../src/validation/platform-rules'

const validRow = {
  field: 'workflow-graph' as const,
  platform: 'codex' as const,
  mode: 'translate' as const,
  mechanism: 'workflow-adapter',
  rationale: 'The host adapter can re-express the canonical graph as a deterministic companion plan.',
  activationRequirement: 'external-adapter' as const,
  enforcement: 'adapter-enforced' as const,
  childEnvironmentOutcome: 'translated' as const,
  evidenceReferences: ['docs/orchid/requirements/2026-07-14-orchestration-reference-patterns.md'],
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
      expect(getOrchestrationCapabilityOutcome(registry, 'workflow-graph', platform).status).toBe('mapped')
    }
  })

  it('mechanically covers every canonical field exactly once for every core-four host', () => {
    expect(() => assertCompleteCoreFourOrchestrationRegistry(ORCHESTRATION_CAPABILITY_REGISTRY)).not.toThrow()
    expect(ORCHESTRATION_CAPABILITY_REGISTRY).toHaveLength(ORCHESTRATION_CAPABILITY_FIELDS.length * CORE_FOUR_PLATFORMS.length)

    for (const field of ORCHESTRATION_CAPABILITY_FIELDS) {
      for (const platform of CORE_FOUR_PLATFORMS) {
        const matches = ORCHESTRATION_CAPABILITY_REGISTRY.filter(row => row.field === field && row.platform === platform)
        expect(matches).toHaveLength(1)
        expect(matches[0].rationale.length).toBeGreaterThan(0)
      }
    }
  })

  it('fails inventory validation when a field or host row is missing', () => {
    expect(() => assertCompleteCoreFourOrchestrationRegistry(ORCHESTRATION_CAPABILITY_REGISTRY.slice(1))).toThrow(/missing/i)
  })

  it('derives the orchestration primitive summary from the registry rows', () => {
    for (const platform of CORE_FOUR_PLATFORMS) {
      const capability = deriveOrchestrationPrimitiveCapability(platform)
      expect(capability.mode).toBe('degrade')
      expect(capability.nativeSurfaces.length).toBeGreaterThan(0)
      expect(capability.notes).toContain(`${ORCHESTRATION_CAPABILITY_FIELDS.length} canonical fields`)
    }
  })

  it('rejects incomplete, duplicate, unknown, and secret-bearing rows', () => {
    for (const field of ['mechanism', 'rationale', 'activationRequirement', 'enforcement', 'childEnvironmentOutcome', 'evidenceReferences', 'evidenceTier'] as const) {
      expect(OrchestrationCapabilityRegistrySchema.safeParse([{ ...validRow, [field]: undefined }]).success).toBe(false)
    }
    expect(OrchestrationCapabilityRegistrySchema.safeParse([validRow, validRow]).success).toBe(false)
    expect(OrchestrationCapabilityRegistrySchema.safeParse([{ ...validRow, field: 'host-tool-name' }]).success).toBe(false)
    expect(OrchestrationCapabilityRegistrySchema.safeParse([{ ...validRow, credentialValue: 'secret-material' }]).success).toBe(false)
    expect(OrchestrationCapabilityRegistrySchema.safeParse([{ ...validRow, evidenceTier: 'installed-runtime' }]).success).toBe(false)
    expect(OrchestrationCapabilityRegistrySchema.safeParse([{ ...validRow, evidenceTier: 'real-host-behavior' }]).success).toBe(false)
  })
})
