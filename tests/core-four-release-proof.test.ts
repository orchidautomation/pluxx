import { describe, expect, it } from 'bun:test'
import { createHash } from 'crypto'
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { resolve } from 'path'
import { validateCoreFourReleaseProof, validateReleaseOwnershipPreimage } from '../src/core-four-release-proof'
import { hashInstallBundle, readInstallOwnership, transactionalInstall } from '../src/install-ownership'
import { stableStringify } from '../src/stable-json'
import { computeDistributionAdjunctInventoryDigest } from '../src/distribution-adjuncts'
import { distributionAdjunctFixtures } from '../test-fixtures/distribution-adjunct-fixtures'
import { OrchestrationSchema } from '../src/orchestration'
import {
  ceOrchestrationFixture,
  hyperframesOrchestrationFixture,
  superpowersOrchestrationFixture,
} from '../test-fixtures/orchestration-fixtures'

const ROOT = resolve(import.meta.dir, '..')
const FIXTURES = ['compound-engineering', 'hyperframes', 'superpowers'] as const
const PLATFORMS = ['claude-code', 'cursor', 'codex', 'opencode'] as const
const ORCHESTRATION_EXPECTATIONS = [
  ['compound-engineering', ceOrchestrationFixture],
  ['hyperframes', hyperframesOrchestrationFixture],
  ['superpowers', superpowersOrchestrationFixture],
].map(([fixture, orchestration]) => ({
  fixture: fixture as string,
  digest: createHash('sha256').update(JSON.stringify(OrchestrationSchema.parse(orchestration))).digest('hex'),
}))

function loadReceipts(): Record<string, any>[] {
  return FIXTURES.flatMap(fixture => PLATFORMS.map(platform => JSON.parse(readFileSync(resolve(
    ROOT,
    'tests/fixtures/orchestration-runtime-receipts',
    fixture,
    `${platform}.json`,
  ), 'utf-8'))))
}

function redigest(receipt: Record<string, any>): void {
  const { receiptDigest: _receiptDigest, ...withoutDigest } = receipt
  receipt.receiptDigest = createHash('sha256').update(stableStringify(withoutDigest)).digest('hex')
}

describe('frozen core-four release proof', () => {
  it('accepts exactly 44 pinned rows and the 12-case Phase 3 ceiling', () => {
    expect(validateCoreFourReleaseProof({
      receipts: loadReceipts(),
      sources: distributionAdjunctFixtures,
      orchestrationExpectations: ORCHESTRATION_EXPECTATIONS,
    })).toEqual({
      sourceFixtureCount: 3,
      sourceInventoryCount: 44,
      receiptCount: 12,
      adjunctInventoryCount: 176,
      fieldOutcomeCount: 324,
      degradedOutcomeCount: 324,
      generatedProven: 12,
      installedProven: 12,
      discoveryEnvironmentUnavailable: 12,
      activationUnsupported: 12,
      behavioralEnvironmentUnavailable: 12,
      ownershipBound: 12,
    })
  })

  it('rejects missing, duplicate, stale, and secondary-host portfolio rows', () => {
    const receipts = loadReceipts()
    expect(() => validateCoreFourReleaseProof({ receipts: receipts.slice(1), sources: distributionAdjunctFixtures, orchestrationExpectations: ORCHESTRATION_EXPECTATIONS }))
      .toThrow('exactly 12')
    expect(() => validateCoreFourReleaseProof({ receipts: [...receipts.slice(0, 11), receipts[0]], sources: distributionAdjunctFixtures, orchestrationExpectations: ORCHESTRATION_EXPECTATIONS }))
      .toThrow('unique fixture/host')

    const secondary = structuredClone(receipts[0])
    secondary.host.platform = 'gemini-cli'
    redigest(secondary)
    expect(() => validateCoreFourReleaseProof({ receipts: [secondary, ...receipts.slice(1)], sources: distributionAdjunctFixtures, orchestrationExpectations: ORCHESTRATION_EXPECTATIONS }))
      .toThrow(/host|identity/)
  })

  it('rejects a self-consistent receipt that promotes the frozen evidence ceiling', () => {
    const receipts = loadReceipts()
    const promoted = structuredClone(receipts[0])
    promoted.evidence.discovered.status = 'proven'
    redigest(promoted)
    expect(() => validateCoreFourReleaseProof({ receipts: [promoted, ...receipts.slice(1)], sources: distributionAdjunctFixtures, orchestrationExpectations: ORCHESTRATION_EXPECTATIONS }))
      .toThrow('discovery environment-unavailable 12/12')

    const registrationPromoted = structuredClone(receipts[2])
    registrationPromoted.evidence.discovered.evidenceIds.push('codex-marketplace-sha256')
    redigest(registrationPromoted)
    expect(() => validateCoreFourReleaseProof({
      receipts: [...receipts.slice(0, 2), registrationPromoted, ...receipts.slice(3)],
      sources: distributionAdjunctFixtures,
      orchestrationExpectations: ORCHESTRATION_EXPECTATIONS,
    })).toThrow('Generated registration evidence cannot satisfy the discovered stage')
  })

  it('rejects pinned source inventory revision, count, digest, or mode drift', () => {
    const receipts = loadReceipts()
    const staleRevision = structuredClone(distributionAdjunctFixtures)
    staleRevision[0].provenance.revision = '0'.repeat(40)
    expect(() => validateCoreFourReleaseProof({ receipts, sources: staleRevision, orchestrationExpectations: ORCHESTRATION_EXPECTATIONS })).toThrow('pinned revision')

    const missing = structuredClone(distributionAdjunctFixtures)
    missing[2].items.pop()
    expect(() => validateCoreFourReleaseProof({ receipts, sources: missing, orchestrationExpectations: ORCHESTRATION_EXPECTATIONS })).toThrow(/digest|exactly 44/)

    const staleMode = structuredClone(distributionAdjunctFixtures)
    staleMode[2].items.find((item: { executable: boolean }) => item.executable)!.executable = false
    staleMode[2].provenance.digest = computeDistributionAdjunctInventoryDigest(staleMode[2].items)
    expect(() => validateCoreFourReleaseProof({ receipts, sources: staleMode, orchestrationExpectations: ORCHESTRATION_EXPECTATIONS })).toThrow('independently pinned inventory digest')

    const wrongIdentity = structuredClone(distributionAdjunctFixtures)
    wrongIdentity[1].provenance.version = '0.7.58'
    expect(() => validateCoreFourReleaseProof({ receipts, sources: wrongIdentity, orchestrationExpectations: ORCHESTRATION_EXPECTATIONS })).toThrow('pinned plugin/version identity')
  })
})

describe('release ownership preimages', () => {
  it('accepts exact symlink-root and copied-install preimages', () => {
    for (const kind of ['symlink', 'copy'] as const) {
      const root = mkdtempSync(resolve(tmpdir(), `pluxx-release-preimage-${kind}-`))
      const home = resolve(root, 'home')
      const source = resolve(root, 'source')
      const install = resolve(home, '.cursor/plugins/local/fixture')
      const previousHome = process.env.HOME
      process.env.HOME = home
      try {
        mkdirSync(resolve(source, 'distribution'), { recursive: true })
        writeFileSync(resolve(source, 'distribution/adjuncts.receipt.json'), 'receipt\n')
        writeFileSync(resolve(source, 'run-hook'), '#!/bin/sh\nexit 0\n', { mode: 0o755 })
        transactionalInstall({ pluginName: 'fixture', platform: 'cursor', sourcePath: source, installPath: install, kind })
        const ownership = readInstallOwnership('fixture', 'cursor', install)!

        expect(validateReleaseOwnershipPreimage({
          ownership,
          expectedInstallPath: install,
          expectedSourceRoot: source,
          expectedBundleDigest: hashInstallBundle(source),
          receiptPath: 'distribution/adjuncts.receipt.json',
          receiptDigest: createHash('sha256').update('receipt\n').digest('hex'),
        })).toEqual({ kind, ownedSurfaceCount: kind === 'copy' ? 2 : 1 })
      } finally {
        if (previousHome === undefined) delete process.env.HOME
        else process.env.HOME = previousHome
        rmSync(root, { recursive: true, force: true })
      }
    }
  })

  it('rejects content, collision, missing, stale mode, nested link, path, retarget, and dangling preimages', () => {
    const root = mkdtempSync(resolve(tmpdir(), 'pluxx-release-preimage-negative-'))
    const home = resolve(root, 'home')
    const source = resolve(root, 'source')
    const install = resolve(home, '.cursor/plugins/local/fixture')
    const previousHome = process.env.HOME
    process.env.HOME = home
    try {
    mkdirSync(resolve(source, 'distribution'), { recursive: true })
    writeFileSync(resolve(source, 'distribution/adjuncts.receipt.json'), 'receipt\n')
    writeFileSync(resolve(source, 'run-hook'), '#!/bin/sh\nexit 0\n', { mode: 0o755 })
    const bundleDigest = hashInstallBundle(source)
    const receiptDigest = createHash('sha256').update('receipt\n').digest('hex')
    const input = (ownership: NonNullable<ReturnType<typeof readInstallOwnership>>) => ({
      ownership,
      expectedInstallPath: install,
      expectedSourceRoot: source,
      expectedBundleDigest: bundleDigest,
      receiptPath: 'distribution/adjuncts.receipt.json',
      receiptDigest,
    })

    transactionalInstall({ pluginName: 'fixture', platform: 'cursor', sourcePath: source, installPath: install, kind: 'copy' })
    const copy = readInstallOwnership('fixture', 'cursor', install)!
    expect(() => validateReleaseOwnershipPreimage({ ...input(copy), receiptPath: '../outside.json' }))
      .toThrow('escapes the installed root')
    expect(() => validateReleaseOwnershipPreimage(input({ ...copy, symlinkTarget: source })))
      .toThrow('cannot contain a symlink target')
    writeFileSync(resolve(install, 'run-hook'), 'tampered\n')
    expect(() => validateReleaseOwnershipPreimage(input(copy))).toThrow(/modified|digest/)
    writeFileSync(resolve(install, 'run-hook'), '#!/bin/sh\nexit 0\n')
    chmodSync(resolve(install, 'run-hook'), 0o644)
    expect(() => validateReleaseOwnershipPreimage(input(copy))).toThrow('mode was modified')
    chmodSync(resolve(install, 'run-hook'), 0o755)
    writeFileSync(resolve(install, 'collision'), 'extra\n')
    expect(() => validateReleaseOwnershipPreimage(input(copy))).toThrow('unowned file')
    rmSync(resolve(install, 'collision'))
    rmSync(resolve(install, 'distribution/adjuncts.receipt.json'))
    expect(() => validateReleaseOwnershipPreimage(input(copy))).toThrow(/missing/)

    const nestedSource = resolve(root, 'nested-source')
    mkdirSync(nestedSource)
    symlinkSync(source, resolve(nestedSource, 'linked-source'))
    expect(() => validateReleaseOwnershipPreimage({
      ...input(copy),
      expectedSourceRoot: nestedSource,
      expectedBundleDigest: hashInstallBundle(nestedSource),
    })).toThrow('cannot contain nested symbolic links')

    rmSync(install, { recursive: true, force: true })
    transactionalInstall({ pluginName: 'fixture', platform: 'cursor', sourcePath: source, installPath: install, kind: 'symlink' })
    const linked = readInstallOwnership('fixture', 'cursor', install)!
    expect(() => validateReleaseOwnershipPreimage(input({ ...linked, entries: copy.entries })))
      .toThrow('cannot contain copied ownership entries')
    rmSync(install)
    const other = resolve(root, 'other')
    mkdirSync(other)
    symlinkSync(other, install)
    expect(() => validateReleaseOwnershipPreimage(input(linked))).toThrow('target does not match')
    rmSync(install)
    symlinkSync(resolve(root, 'missing'), install)
    expect(() => validateReleaseOwnershipPreimage(input(linked))).toThrow(/dangling|target/)
    } finally {
      if (previousHome === undefined) delete process.env.HOME
      else process.env.HOME = previousHome
      rmSync(root, { recursive: true, force: true })
    }
  })
})
