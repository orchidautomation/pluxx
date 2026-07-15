import { describe, expect, it } from 'bun:test'
import {
  DistributionAdjunctSourceSchema,
  DistributionAdjunctHostSchema,
  DistributionAdjunctOwnerSchema,
  compileDistributionAdjunctInventory,
  computeDistributionAdjunctInventoryDigest,
  getDistributionAdjunctOutcome,
} from '../src/distribution-adjuncts'
import { getPluginCompilerBuckets, PLUXX_COMPILER_BUCKETS, PluginConfigSchema } from '../src/schema'
import { CORE_FOUR_INSTALL_DISCOVERY_CAPABILITIES } from '../src/distribution-lifecycle'
import { distributionAdjunctFixtures } from '../test-fixtures/distribution-adjunct-fixtures'

const provenance = {
  fixture: 'compound-engineering',
  plugin: 'compound-engineering',
  version: '3.19.0',
  revision: 'f871e4b4308f5a175b38ccada51d80dd67bab4fc',
  digest: 'a'.repeat(64),
}

function bindDigest<T extends { provenance: { digest: string }; items: readonly unknown[] }>(input: T): T {
  return {
    ...input,
    provenance: { ...input.provenance, digest: computeDistributionAdjunctInventoryDigest(input.items) },
  }
}

describe('distribution adjunct source contract', () => {
  it('derives owner and host enums from canonical compiler registries', () => {
    expect(DistributionAdjunctOwnerSchema.options).toEqual(PLUXX_COMPILER_BUCKETS)
    expect(DistributionAdjunctHostSchema.options).toEqual(
      CORE_FOUR_INSTALL_DISCOVERY_CAPABILITIES.map(capability => capability.platform),
    )
  })

  it('freezes the exact pinned three-fixture inventory without secondary hosts', () => {
    expect(distributionAdjunctFixtures.map(fixture => [
      fixture.provenance.fixture,
      fixture.provenance.revision,
      fixture.items.length,
    ])).toEqual([
      ['compound-engineering', 'f871e4b4308f5a175b38ccada51d80dd67bab4fc', 12],
      ['hyperframes', '6933e8acda57268da9a40e0adf3d99c85059d2b5', 15],
      ['superpowers', 'd884ae04edebef577e82ff7c4e143debd0bbec99', 17],
    ])
    expect(distributionAdjunctFixtures.flatMap(fixture => fixture.items)).toHaveLength(44)
    expect(new Set(distributionAdjunctFixtures.flatMap(fixture => fixture.items.map(item => item.kind)))).toEqual(new Set([
      'identity-manifest',
      'registration-catalog',
      'lifecycle-entrypoint',
      'helper-payload',
      'host-native-extension',
      'source-only-evidence',
    ]))
    expect(distributionAdjunctFixtures.flatMap(fixture => fixture.items)
      .every(item => ['shared', 'source-only', 'claude-code', 'cursor', 'codex', 'opencode'].includes(item.sourcePlatform))).toBe(true)
  })

  it('normalizes an exact, provenance-bound inventory deterministically', () => {
    const input = {
      provenance,
      items: [
        {
          id: 'opencode-loader',
          kind: 'lifecycle-entrypoint',
          source: '.opencode/plugins/compound-engineering.js',
          target: '.opencode/plugins/compound-engineering.js',
          sourcePlatform: 'opencode',
          canonicalOwner: 'distribution',
          digest: 'b'.repeat(64),
          executable: false,
        },
        {
          id: 'claude-manifest',
          kind: 'identity-manifest',
          source: '.claude-plugin/plugin.json',
          target: '.claude-plugin/plugin.json',
          sourcePlatform: 'claude-code',
          canonicalOwner: 'distribution',
          digest: 'c'.repeat(64),
          executable: false,
        },
      ],
    }

    const first = compileDistributionAdjunctInventory(bindDigest(input))
    const second = compileDistributionAdjunctInventory(bindDigest({ ...input, items: [...input.items].reverse() }))
    expect(second).toEqual(first)
    expect(first.items.map(item => item.id)).toEqual(['claude-manifest', 'opencode-loader'])
  })

  it('refuses path escapes, duplicate identities, and duplicate owned targets', () => {
    expect(() => DistributionAdjunctSourceSchema.parse({
      provenance,
      items: [{
        id: 'escape',
        kind: 'helper-payload',
        source: '../private.json',
        target: 'support/private.json',
        sourcePlatform: 'shared',
        canonicalOwner: 'runtime',
        digest: 'd'.repeat(64),
      }],
    })).toThrow()

    expect(() => compileDistributionAdjunctInventory({
      provenance,
      items: [
        {
          id: 'same', kind: 'identity-manifest', source: 'a.json', target: 'a.json',
          sourcePlatform: 'claude-code', canonicalOwner: 'distribution', digest: 'a'.repeat(64),
        },
        {
          id: 'same', kind: 'identity-manifest', source: 'b.json', target: 'b.json',
          sourcePlatform: 'cursor', canonicalOwner: 'distribution', digest: 'b'.repeat(64),
        },
      ],
    })).toThrow('Duplicate adjunct id')

    expect(() => compileDistributionAdjunctInventory({
      provenance,
      items: [
        {
          id: 'one', kind: 'identity-manifest', source: 'a.json', target: 'plugin.json',
          sourcePlatform: 'claude-code', canonicalOwner: 'distribution', digest: 'a'.repeat(64),
        },
        {
          id: 'two', kind: 'registration-catalog', source: 'b.json', target: 'plugin.json',
          sourcePlatform: 'claude-code', canonicalOwner: 'distribution', digest: 'b'.repeat(64),
        },
      ],
    })).toThrow('Unowned adjunct target collision')

    expect(() => compileDistributionAdjunctInventory({
      provenance,
      items: [
        {
          id: 'shared', kind: 'helper-payload', source: 'shared.js', target: 'support/tool.js',
          sourcePlatform: 'shared', canonicalOwner: 'runtime', digest: 'a'.repeat(64),
        },
        {
          id: 'native', kind: 'lifecycle-entrypoint', source: 'native.js', target: 'support/tool.js',
          sourcePlatform: 'codex', canonicalOwner: 'runtime', digest: 'b'.repeat(64),
        },
      ],
    })).toThrow('Unowned adjunct target collision')
  })

  it('derives preserve translate degrade and drop from the existing host registry', () => {
    const native = {
      id: 'claude-manifest', kind: 'identity-manifest', source: 'plugin.json', target: 'plugin.json',
      sourcePlatform: 'claude-code', canonicalOwner: 'distribution', digest: 'a'.repeat(64),
    } as const
    const helper = {
      id: 'shared-helper', kind: 'helper-payload', source: 'helpers/tool', target: 'helpers/tool',
      sourcePlatform: 'shared', canonicalOwner: 'runtime', digest: 'b'.repeat(64), executable: true,
    } as const
    const external = {
      id: 'external-openai-metadata', kind: 'host-native-extension',
      source: 'skills/*/agents/openai.yaml', target: 'skills/*/agents/openai.yaml',
      sourcePlatform: 'codex', canonicalOwner: 'distribution', availability: 'external-unavailable',
    } as const
    const sourceOnly = {
      id: 'release-workflow', kind: 'source-only-evidence', source: '.github/workflows/release.yml',
      target: '.github/workflows/release.yml', sourcePlatform: 'source-only',
      canonicalOwner: 'distribution', digest: 'c'.repeat(64),
    } as const

    expect(getDistributionAdjunctOutcome('claude-code', native).mode).toBe('preserve')
    expect(getDistributionAdjunctOutcome('cursor', native).mode).toBe('translate')
    expect(getDistributionAdjunctOutcome('codex', external).mode).toBe('degrade')
    expect(getDistributionAdjunctOutcome('opencode', sourceOnly).mode).toBe('drop')
    expect(getDistributionAdjunctOutcome('opencode', helper).mode).toBe('preserve')
  })

  it('keeps secondary hosts out of the adjunct contract', () => {
    expect(() => DistributionAdjunctSourceSchema.parse({
      provenance,
      items: [{
        id: 'pi-extension', kind: 'host-native-extension', source: '.pi/extensions/plugin.ts',
        target: '.pi/extensions/plugin.ts', sourcePlatform: 'pi', canonicalOwner: 'distribution',
        digest: 'e'.repeat(64),
      }],
    })).toThrow()
  })

  it('rejects unknown nested provenance fields instead of stripping them', () => {
    expect(() => DistributionAdjunctSourceSchema.parse({
      provenance: { ...provenance, unknownIdentityField: 'not-owned' },
      items: [],
    })).toThrow()
  })

  it('keeps adjuncts inside the existing distribution compiler bucket', () => {
    const adjuncts = compileDistributionAdjunctInventory(bindDigest({
      provenance,
      items: [{
        id: 'claude-manifest', kind: 'identity-manifest', source: 'plugin.json', target: 'plugin.json',
        sourcePlatform: 'claude-code', canonicalOwner: 'distribution', digest: 'a'.repeat(64),
      }],
    }))
    const config = PluginConfigSchema.parse({
      name: 'compound-engineering',
      version: '3.19.0',
      description: 'Fixture',
      author: { name: 'Every' },
      distribution: { adjuncts },
    })

    expect(getPluginCompilerBuckets(config).distribution.adjuncts).toEqual(adjuncts)
  })
})
