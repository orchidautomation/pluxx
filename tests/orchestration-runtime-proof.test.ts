import { describe, expect, it } from 'bun:test'
import { createHash } from 'crypto'
import { mkdtempSync, readFileSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { resolve } from 'path'
import {
  assertOrchestrationProofPrivacySafe,
  buildOrchestrationRuntimeReceipt,
  resolveOrchestrationOutcomeWithEvidence,
} from '../src/orchestration-runtime-proof'
import { publishDistributionAdjuncts } from '../src/distribution-adjuncts'
import { getDistributionAdjunctFixture } from '../test-fixtures/distribution-adjunct-fixtures'
import {
  ORCHESTRATION_CAPABILITY_FIELDS,
  ORCHESTRATION_CAPABILITY_REGISTRY,
} from '../src/orchestration-capability-registry'

const declaredRows = ORCHESTRATION_CAPABILITY_REGISTRY.filter(row => row.platform === 'codex')

function stage(status: 'proven' | 'unsupported' | 'environment-unavailable' | 'failed', evidenceIds: string[]) {
  return { status, evidenceIds }
}

function buildInput() {
  return {
    fixture: 'compound-engineering',
    generatedReceipt: {
      schemaVersion: 1,
      kind: 'pluxx-orchestration-generation-receipt',
      platform: 'codex',
      evidenceTier: 'bundle-contract',
      installedBehaviorProven: false,
      identity: {
        plugin: 'orchestration-compound-engineering',
        version: '0.1.0',
        orchestrationDigest: 'a'.repeat(64),
        workflowIds: ['implement-approved-plan'],
        activationIds: ['implement-approved-plan'],
      },
      fieldInventory: [...ORCHESTRATION_CAPABILITY_FIELDS],
      fieldOutcomes: declaredRows,
    },
    host: {
      platform: 'codex' as const,
      version: {
        status: 'environment-unavailable' as const,
        value: null,
        detail: 'Native host CLI deliberately not invoked by the isolated fixture harness.',
      },
      probe: { name: 'pluxx-isolated-install-harness', version: '1', command: 'fixture-owned build/install/verify probe' },
    },
    evidence: {
      generated: stage('proven', ['generated-receipt-sha256']),
      installed: stage('proven', ['installed-tree-sha256']),
      discovered: stage('proven', ['installed-manifest', 'marketplace-registration']),
      activated: stage('unsupported', ['no-executable-orchestration-entrypoint']),
      behavioral: stage('environment-unavailable', ['native-host-not-invoked']),
    },
    facts: [
      { id: 'generated-receipt-sha256', kind: 'sha256', value: 'b'.repeat(64) },
      { id: 'installed-tree-sha256', kind: 'sha256', value: 'c'.repeat(64) },
      { id: 'installed-manifest', kind: 'assertion', value: '.codex-plugin/plugin.json matched the generated bundle' },
      { id: 'marketplace-registration', kind: 'assertion', value: '~/.agents/plugins/marketplace.json names the installed plugin path' },
      { id: 'no-executable-orchestration-entrypoint', kind: 'assertion', value: 'No generated host entrypoint consumes orchestration.generated.json' },
      { id: 'native-host-not-invoked', kind: 'assertion', value: 'User auth and live host state were excluded from this proof run' },
    ],
    installedPath: '~/.codex/plugins/orchestration-compound-engineering',
    fieldEvidence: {},
  }
}

describe('orchestration installed/runtime proof receipts', () => {
  it('emits deterministic 27-field receipts while retaining unproven degradation', () => {
    const input = buildInput()
    const first = buildOrchestrationRuntimeReceipt(input)
    const second = buildOrchestrationRuntimeReceipt({
      ...input,
      facts: [...input.facts].reverse(),
    })

    expect(second).toEqual(first)
    expect(first.identity.fixture).toBe('compound-engineering')
    expect(first.proofTier).toBe('fake-home-install')
    expect(first.identity.plugin).toBe('orchestration-compound-engineering')
    expect(first.host.platform).toBe('codex')
    expect(first.installedPath).toBe('~/.codex/plugins/orchestration-compound-engineering')
    expect(first.fieldOutcomes).toHaveLength(ORCHESTRATION_CAPABILITY_FIELDS.length)
    expect(first.fieldOutcomes.every(row => row.declared.mode === 'degrade')).toBe(true)
    expect(first.fieldOutcomes.every(row => row.effective.mode === 'degrade')).toBe(true)
    expect(first.installedBehaviorProven).toBe(false)
  })

  it('promotes only mechanism-matched behavioral proof', () => {
    const declared = declaredRows.find(row => row.field === 'generic-dispatch')!
    const provenStages = buildInput().evidence
    provenStages.behavioral.status = 'proven'
    const promoted = resolveOrchestrationOutcomeWithEvidence(declared, {
      status: 'proven',
      stage: 'behavioral',
      mechanism: declared.mechanism,
      resultingMode: 'translate',
      evidenceIds: ['dispatch-event', 'parent-wait', 'synthesis-output'],
    }, provenStages)
    expect(promoted.mode).toBe('translate')

    expect(() => resolveOrchestrationOutcomeWithEvidence(declared, {
      status: 'proven',
      stage: 'installed',
      mechanism: declared.mechanism,
      resultingMode: 'translate',
      evidenceIds: ['installed-tree-sha256'],
    }, provenStages)).toThrow('requires behavioral evidence')

    expect(resolveOrchestrationOutcomeWithEvidence(declared, {
      status: 'environment-unavailable',
      stage: 'behavioral',
      mechanism: declared.mechanism,
      resultingMode: 'degrade',
      evidenceIds: ['native-host-not-invoked'],
    }, buildInput().evidence)).toEqual(declared)

    expect(() => resolveOrchestrationOutcomeWithEvidence(declared, {
      status: 'proven',
      stage: 'behavioral',
      mechanism: 'different-mechanism',
      resultingMode: 'translate',
      evidenceIds: ['dispatch-event'],
    }, provenStages)).toThrow('does not match declared mechanism')
  })

  it('rejects custom proof that contradicts or escapes its receipt stage', () => {
    const input = buildInput()
    const declared = declaredRows.find(row => row.field === 'generic-dispatch')!
    input.fieldEvidence[declared.field] = {
      status: 'proven',
      stage: 'behavioral',
      mechanism: declared.mechanism,
      resultingMode: 'translate',
      evidenceIds: ['installed-tree-sha256'],
    }

    expect(() => buildOrchestrationRuntimeReceipt(input)).toThrow('must match the behavioral stage status')

    input.evidence.behavioral = stage('proven', ['native-host-not-invoked'])
    expect(() => buildOrchestrationRuntimeReceipt(input)).toThrow('is not registered for the behavioral stage')

    const mismatchedUnavailable = buildInput()
    const unavailableDeclared = declaredRows.find(row => row.field === 'generic-dispatch')!
    mismatchedUnavailable.fieldEvidence[unavailableDeclared.field] = {
      status: 'environment-unavailable',
      stage: 'behavioral',
      mechanism: 'different-mechanism',
      resultingMode: 'translate',
      evidenceIds: ['native-host-not-invoked'],
    }
    expect(() => buildOrchestrationRuntimeReceipt(mismatchedUnavailable)).toThrow('does not match declared mechanism')

    const failedInstall = buildInput()
    failedInstall.evidence.installed.status = 'failed'
    failedInstall.evidence.behavioral.status = 'proven'
    expect(() => buildOrchestrationRuntimeReceipt(failedInstall)).toThrow(
      'requires proven generated, installed, and behavioral stages',
    )
  })

  it('rejects generated-only promotion and incomplete field inventories', () => {
    const declared = declaredRows[0]!
    expect(() => resolveOrchestrationOutcomeWithEvidence(declared, {
      status: 'proven',
      stage: 'generated',
      mechanism: declared.mechanism,
      resultingMode: 'translate',
      evidenceIds: ['generated-receipt-sha256'],
    }, buildInput().evidence)).toThrow('requires behavioral evidence')

    const input = buildInput()
    input.generatedReceipt.fieldOutcomes = input.generatedReceipt.fieldOutcomes.slice(1)
    expect(() => buildOrchestrationRuntimeReceipt(input)).toThrow('exactly 27 field outcomes')

    const invalidInventory = buildInput()
    invalidInventory.generatedReceipt.fieldInventory = invalidInventory.generatedReceipt.fieldInventory.slice(1)
    expect(() => buildOrchestrationRuntimeReceipt(invalidInventory)).toThrow('canonical field inventory')

    const invalidIdentity = buildInput()
    invalidIdentity.generatedReceipt.identity.orchestrationDigest = 'not-a-digest'
    expect(() => buildOrchestrationRuntimeReceipt(invalidIdentity)).toThrow()
  })

  it('rejects secret, cookie, auth, and transcript material anywhere in proof input', () => {
    expect(() => assertOrchestrationProofPrivacySafe({ apiToken: 'fixture-secret' })).toThrow('private proof material')
    expect(() => assertOrchestrationProofPrivacySafe({ cookie: 'session=value' })).toThrow('private proof material')
    expect(() => assertOrchestrationProofPrivacySafe({ rawTranscript: 'private conversation' })).toThrow('private proof material')
    expect(() => assertOrchestrationProofPrivacySafe({ detail: 'Authorization: Bearer fixture-value' })).toThrow('private proof material')
    expect(() => assertOrchestrationProofPrivacySafe({ facts: [{ id: 'bad', kind: 'assertion', value: 'sk-fixture12345678' }] })).toThrow('private proof material')
    expect(() => assertOrchestrationProofPrivacySafe({ credentials: 'fixture-value' })).toThrow('private proof material')
  })

  it('rejects malformed exact facts and contradictory host versions', () => {
    const invalidFact = buildInput()
    invalidFact.facts[0]!.value = 'not-a-sha256'
    expect(() => buildOrchestrationRuntimeReceipt(invalidFact)).toThrow()

    const invalidHostVersion = buildInput()
    invalidHostVersion.host.version.status = 'proven'
    expect(() => buildOrchestrationRuntimeReceipt(invalidHostVersion)).toThrow('requires an exact value')

    const emptyStageEvidence = buildInput()
    emptyStageEvidence.evidence.generated.evidenceIds = []
    expect(() => buildOrchestrationRuntimeReceipt(emptyStageEvidence)).toThrow()
  })

  it('cross-binds adjunct ownership to the compiled identity and exact proof facts', () => {
    const root = mkdtempSync(resolve(tmpdir(), 'pluxx-adjunct-proof-binding-'))
    try {
      const outDir = resolve(root, 'dist/codex')
      const receipt = publishDistributionAdjuncts(
        getDistributionAdjunctFixture('compound-engineering'),
        'codex',
        root,
        outDir,
        { name: 'orchestration-compound-engineering', version: '0.1.0' },
      )
      const receiptDigest = createHash('sha256')
        .update(readFileSync(resolve(outDir, 'distribution/adjuncts.receipt.json')))
        .digest('hex')
      const input = buildInput()
      input.facts.push(
        { id: 'adjunct-receipt-sha256', kind: 'sha256', value: receiptDigest },
        { id: 'install-ownership-sha256', kind: 'sha256', value: 'd'.repeat(64) },
      )
      input.evidence.installed.evidenceIds.push('adjunct-receipt-sha256', 'install-ownership-sha256')
      const boundInput = {
        ...input,
        adjuncts: {
          receipt,
          installOwnership: {
            recordDigest: 'd'.repeat(64),
            ownershipKind: 'symlink' as const,
            ownedSurfaceCount: 1,
            receiptPath: 'distribution/adjuncts.receipt.json',
            receiptDigest,
          },
        },
      }
      expect(buildOrchestrationRuntimeReceipt(boundInput).adjuncts?.installOwnership.ownedSurfaceCount).toBe(1)

      expect(() => buildOrchestrationRuntimeReceipt({
        ...boundInput,
        adjuncts: {
          ...boundInput.adjuncts,
          installOwnership: { ...boundInput.adjuncts.installOwnership, receiptPath: 'other.json' },
        },
      })).toThrow('must bind distribution/adjuncts.receipt.json')
      expect(() => buildOrchestrationRuntimeReceipt({
        ...boundInput,
        adjuncts: {
          ...boundInput.adjuncts,
          installOwnership: { ...boundInput.adjuncts.installOwnership, recordDigest: 'e'.repeat(64) },
        },
      })).toThrow('record digest is not bound')
      expect(() => buildOrchestrationRuntimeReceipt({
        ...boundInput,
        adjuncts: {
          ...boundInput.adjuncts,
          installOwnership: { ...boundInput.adjuncts.installOwnership, receiptDigest: 'e'.repeat(64) },
        },
      })).toThrow('receipt digest is not bound')
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })
})
