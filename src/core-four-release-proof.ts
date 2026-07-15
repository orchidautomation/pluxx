import { createHash } from 'crypto'
import { existsSync, lstatSync, readFileSync, readlinkSync, realpathSync } from 'fs'
import { dirname, relative, resolve } from 'path'
import {
  compileDistributionAdjunctInventory,
  type DistributionAdjunctSource,
} from './distribution-adjuncts'
import {
  summarizeOrchestrationRuntimeReceipts,
  type OrchestrationRuntimeReceipt,
} from './orchestration-runtime-proof'
import {
  collectInstallEntries,
  hashInstallBundle,
  listInstallOwnershipDrift,
  type InstallOwnership,
} from './install-ownership'

const CORE_FOUR = ['claude-code', 'cursor', 'codex', 'opencode'] as const
const PINNED_FIXTURES = {
  'compound-engineering': {
    plugin: 'compound-engineering',
    version: '3.19.0',
    revision: 'f871e4b4308f5a175b38ccada51d80dd67bab4fc',
    digest: '4c82f2038ca4fd09a7b19473d3b890e2d0b10b1e6c9c19f1971c64b5ec33a1d5',
    itemCount: 12,
  },
  hyperframes: {
    plugin: 'hyperframes',
    version: '0.7.57',
    revision: '6933e8acda57268da9a40e0adf3d99c85059d2b5',
    digest: '24b7f88fdbafe069b5e895ffc5a54aa88ea1e4d4b54dacfbf25ad028cd3f2635',
    itemCount: 15,
  },
  superpowers: {
    plugin: 'superpowers',
    version: '6.1.1',
    revision: 'd884ae04edebef577e82ff7c4e143debd0bbec99',
    digest: '05366194b55a6d1bbd61fb9dd3327ec5a55b026a80bf779edb815e26494cbed8',
    itemCount: 17,
  },
} as const

export interface CoreFourReleaseProofSummary {
  sourceFixtureCount: number
  sourceInventoryCount: number
  receiptCount: number
  adjunctInventoryCount: number
  fieldOutcomeCount: number
  degradedOutcomeCount: number
  generatedProven: number
  installedProven: number
  discoveryEnvironmentUnavailable: number
  activationUnsupported: number
  behavioralEnvironmentUnavailable: number
  ownershipBound: number
}

export function validateReleaseOwnershipPreimage(input: {
  ownership: InstallOwnership
  expectedInstallPath: string
  expectedSourceRoot: string
  expectedBundleDigest: string
  receiptPath: string
  receiptDigest: string
}): { kind: 'copy' | 'symlink'; ownedSurfaceCount: number } {
  const installPath = resolve(input.expectedInstallPath)
  const sourceRoot = resolve(input.expectedSourceRoot)
  if (resolve(input.ownership.installPath) !== installPath) {
    throw new Error('Release ownership install path does not match the expected preimage.')
  }
  if (input.ownership.kind !== 'copy' && input.ownership.kind !== 'symlink') {
    throw new Error(`Release ownership preimage requires copy or symlink kind, got ${input.ownership.kind}.`)
  }
  if (!/^[a-f0-9]{64}$/.test(input.expectedBundleDigest) || !/^[a-f0-9]{64}$/.test(input.receiptDigest)) {
    throw new Error('Release ownership preimage requires exact SHA-256 bindings.')
  }
  if (!existsSync(sourceRoot) || !lstatSync(sourceRoot).isDirectory() || lstatSync(sourceRoot).isSymbolicLink()) {
    throw new Error('Release ownership source root must be an existing regular directory.')
  }
  const sourceEntries = collectInstallEntries(sourceRoot)
  if (sourceEntries.some(entry => entry.kind === 'symlink')) {
    throw new Error('Release ownership source root cannot contain nested symbolic links.')
  }
  if (hashInstallBundle(sourceRoot) !== input.expectedBundleDigest) {
    throw new Error('Release ownership source bundle digest is stale.')
  }

  let installDetails: ReturnType<typeof lstatSync>
  try {
    installDetails = lstatSync(installPath)
  } catch {
    throw new Error('Release ownership installed path is missing or dangling.')
  }
  if (input.ownership.kind === 'symlink') {
    if (input.ownership.entries.length !== 0) {
      throw new Error('Release ownership symlink preimage cannot contain copied ownership entries.')
    }
    if (!installDetails.isSymbolicLink()) throw new Error('Release ownership symlink preimage changed kind.')
    const rawTarget = readlinkSync(installPath)
    const resolvedTarget = resolve(dirname(installPath), rawTarget)
    if (resolvedTarget !== sourceRoot || rawTarget !== input.ownership.symlinkTarget) {
      throw new Error('Release ownership symlink target does not match the expected generated root.')
    }
    if (!existsSync(resolvedTarget)) throw new Error('Release ownership symlink target is dangling.')
    if (realpathSync(resolvedTarget) !== realpathSync(sourceRoot)) {
      throw new Error('Release ownership symlink target resolves outside the expected generated root.')
    }
  } else {
    if (input.ownership.symlinkTarget !== undefined) {
      throw new Error('Release ownership copied preimage cannot contain a symlink target.')
    }
    if (!installDetails.isDirectory() || installDetails.isSymbolicLink()) {
      throw new Error('Release ownership copied preimage changed kind.')
    }
    const entryPaths = input.ownership.entries.map(entry => entry.path)
    if (new Set(entryPaths).size !== entryPaths.length) {
      throw new Error('Release ownership copied preimage contains duplicate owned paths.')
    }
    if (input.ownership.entries.some(entry => entry.kind === 'symlink')) {
      throw new Error('Release ownership copied preimage cannot contain nested symbolic links.')
    }
    const drift = listInstallOwnershipDrift(input.ownership)
    if (drift.length > 0) throw new Error(`Release ownership copied preimage drift: ${drift.join('; ')}`)
    if (hashInstallBundle(installPath) !== input.expectedBundleDigest) {
      throw new Error('Release ownership copied preimage bundle digest does not match its source.')
    }
  }

  const receiptAbsolute = resolve(installPath, input.receiptPath)
  const receiptRelative = relative(installPath, receiptAbsolute).replace(/\\/g, '/')
  if (!receiptRelative || receiptRelative.startsWith('../') || receiptRelative.includes('/../')) {
    throw new Error('Release ownership receipt path escapes the installed root.')
  }
  if (!existsSync(receiptAbsolute) || lstatSync(receiptAbsolute).isSymbolicLink() || !lstatSync(receiptAbsolute).isFile()) {
    throw new Error('Release ownership receipt is missing or has an unsafe kind.')
  }
  const actualReceiptDigest = createHash('sha256').update(readFileSync(receiptAbsolute)).digest('hex')
  if (actualReceiptDigest !== input.receiptDigest) throw new Error('Release ownership receipt digest does not match.')
  return {
    kind: input.ownership.kind,
    ownedSurfaceCount: input.ownership.kind === 'copy' ? input.ownership.entries.length : 1,
  }
}

export function validateCoreFourReleaseProof(input: {
  receipts: unknown[]
  sources: readonly unknown[]
  orchestrationExpectations: readonly { fixture: string; digest: string }[]
}): CoreFourReleaseProofSummary {
  const sources = input.sources.map(source => compileDistributionAdjunctInventory(source))
  if (sources.length !== 3) throw new Error('Core-four release proof requires exactly 3 pinned source fixtures.')
  const sourceNames = new Set(sources.map(source => source.provenance.fixture))
  if (sourceNames.size !== sources.length) throw new Error('Core-four release proof requires unique source fixtures.')

  let sourceInventoryCount = 0
  for (const source of sources) {
    const pinned = PINNED_FIXTURES[source.provenance.fixture as keyof typeof PINNED_FIXTURES]
    if (!pinned) throw new Error(`Core-four release proof excludes source fixture ${source.provenance.fixture}.`)
    if (source.provenance.plugin !== pinned.plugin || source.provenance.version !== pinned.version) {
      throw new Error(`${source.provenance.fixture} does not match its pinned plugin/version identity.`)
    }
    if (source.provenance.revision !== pinned.revision) {
      throw new Error(`${source.provenance.fixture} does not match its pinned revision.`)
    }
    if (source.provenance.digest !== pinned.digest) {
      throw new Error(`${source.provenance.fixture} does not match its independently pinned inventory digest.`)
    }
    if (source.items.length !== pinned.itemCount) {
      throw new Error(`${source.provenance.fixture} pinned inventory requires exactly ${pinned.itemCount} rows.`)
    }
    sourceInventoryCount += source.items.length
  }
  if (sourceInventoryCount !== 44) throw new Error('Core-four release proof requires exactly 44 pinned source inventory rows.')

  if (input.receipts.length !== 12) throw new Error('Core-four release proof requires exactly 12 fixture/host receipts.')
  const orchestrationExpectations = new Map(input.orchestrationExpectations.map(row => [row.fixture, row.digest]))
  if (orchestrationExpectations.size !== 3) throw new Error('Core-four release proof requires exactly 3 orchestration expectations.')
  const expected = sources.map(source => {
    const orchestrationDigest = orchestrationExpectations.get(source.provenance.fixture)
    if (!orchestrationDigest || !/^[a-f0-9]{64}$/.test(orchestrationDigest)) {
      throw new Error(`${source.provenance.fixture} is missing its current orchestration digest.`)
    }
    return {
      fixture: source.provenance.fixture,
      plugin: `orchestration-${source.provenance.fixture}`,
      version: '0.1.0',
      orchestrationDigest,
      adjunctRevision: source.provenance.revision,
      adjunctDigest: source.provenance.digest,
    }
  })
  const summary = summarizeOrchestrationRuntimeReceipts(input.receipts, expected)
  const receipts = input.receipts as OrchestrationRuntimeReceipt[]
  const identities = new Set(receipts.map(receipt => `${receipt.identity.fixture}/${receipt.host.platform}`))
  const exactIdentities = new Set(Object.keys(PINNED_FIXTURES).flatMap(fixture =>
    CORE_FOUR.map(platform => `${fixture}/${platform}`),
  ))
  if (identities.size !== 12 || [...identities].some(identity => !exactIdentities.has(identity))) {
    throw new Error('Core-four release proof requires a unique fixture/host identity for all 12 cases.')
  }

  assertExactCeiling(summary, receipts)
  return {
    sourceFixtureCount: sources.length,
    sourceInventoryCount,
    receiptCount: summary.receiptCount,
    adjunctInventoryCount: summary.adjunctInventoryCount,
    fieldOutcomeCount: summary.fieldOutcomeCount,
    degradedOutcomeCount: summary.degradedOutcomeCount,
    generatedProven: summary.generatedProven,
    installedProven: summary.installedProven,
    discoveryEnvironmentUnavailable: summary.discoveryEnvironmentUnavailable,
    activationUnsupported: summary.activationUnsupported,
    behavioralEnvironmentUnavailable: summary.behavioralEnvironmentUnavailable,
    ownershipBound: summary.adjunctOwnershipProven,
  }
}

function assertExactCeiling(
  summary: ReturnType<typeof summarizeOrchestrationRuntimeReceipts>,
  receipts: OrchestrationRuntimeReceipt[],
): void {
  if (summary.generatedProven !== 12 || summary.installedProven !== 12) {
    throw new Error('Core-four release proof requires generated and installed proof 12/12.')
  }
  if (summary.discoveryEnvironmentUnavailable !== 12) {
    throw new Error('Core-four release proof requires discovery environment-unavailable 12/12.')
  }
  if (summary.activationUnsupported !== 12) {
    throw new Error('Core-four release proof requires activation unsupported 12/12.')
  }
  if (summary.behavioralEnvironmentUnavailable !== 12) {
    throw new Error('Core-four release proof requires behavior environment-unavailable 12/12.')
  }
  if (summary.fieldOutcomeCount !== 324 || summary.degradedOutcomeCount !== 324) {
    throw new Error('Core-four release proof requires all 324 orchestration outcomes degraded.')
  }
  if (summary.adjunctReceiptCount !== 12 || summary.adjunctInventoryCount !== 176
    || summary.adjunctOwnershipProven !== 12) {
    throw new Error('Core-four release proof requires all 12 adjunct and ownership bindings across 176 rows.')
  }
  for (const receipt of receipts) {
    if (receipt.installedBehaviorProven) throw new Error('Core-four release proof forbids installed behavior promotion.')
    const registrationIds = new Set<string>(receipt.facts
      .map(fact => fact.id)
      .filter(id => id === 'codex-marketplace-sha256' || id === 'opencode-entry-sha256'))
    for (const stage of ['discovered', 'activated', 'behavioral'] as const) {
      if (receipt.evidence[stage].evidenceIds.some(id => registrationIds.has(id))) {
        throw new Error(`Generated registration evidence cannot satisfy the ${stage} stage.`)
      }
    }
  }
}
