import { describe, expect, it } from 'bun:test'
import { mkdtempSync, readFileSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { resolve } from 'path'
import {
  findCanonicalDocProblems,
  materializeProofReceipt,
  ProofManifestSchema,
  ProofReceiptSpecSchema,
  upsertProofReceipt,
  validateProofManifest,
  type ProofManifest,
} from '../src/proof-freshness'

const CURRENT_SHA = '561385059b8544c52ee7329063bb0574be394280'
const ROOT = resolve(import.meta.dir, '..')
const PACKAGE_VERSION = JSON.parse(readFileSync(resolve(ROOT, 'package.json'), 'utf8')).version as string

function currentManifest(): ProofManifest {
  return {
    schemaVersion: 1,
    canonicalVersion: '0.1.31',
    expectedTag: 'v0.1.31',
    releaseState: 'released',
    policy: {
      environmentReceiptMaxAgeDays: 30,
    },
    claims: [
      {
        id: 'release-bundle-contract',
        summary: 'Maintained examples build across the core four.',
        tier: 'bundle-contract',
        freshness: 'current',
        evidencePath: 'tests/release-smoke.test.ts',
        receiptId: 'v0.1.31-repo-baseline',
      },
      {
        id: 'may-real-host-run',
        summary: 'Historical real-host behavior remains available for context.',
        tier: 'real-host-behavior',
        freshness: 'historical',
        evidencePath: 'docs/pluxx-self-hosted-core-four-proof.md',
        receiptId: 'v0.1.28-real-host-history',
      },
    ],
    receipts: [
      {
        id: 'v0.1.31-repo-baseline',
        tier: 'bundle-contract',
        freshness: 'current',
        commitSha: CURRENT_SHA,
        packageVersion: '0.1.31',
        timestamp: '2026-07-12T12:00:00.000Z',
        commands: [{ command: 'bun test tests/release-smoke.test.ts', outcome: 'passed' }],
        targets: [
          {
            target: 'core-four',
            hostVersion: null,
            installedPath: null,
            sha256: null,
            outcome: 'passed',
            unavailableReason: 'Bundle-contract proof does not execute a real host.',
          },
        ],
      },
      {
        id: 'v0.1.28-real-host-history',
        tier: 'real-host-behavior',
        freshness: 'historical',
        commitSha: '7cbe896250cc728b6eb7328fb3fa9770022e4ef8',
        packageVersion: '0.1.28',
        timestamp: '2026-05-12T12:00:00.000Z',
        commands: [{ command: 'historical host walkthrough', outcome: 'passed' }],
        targets: [
          {
            target: 'codex',
            hostVersion: null,
            installedPath: null,
            sha256: null,
            outcome: 'passed',
            unavailableReason: 'The historical walkthrough did not capture these receipt fields.',
          },
        ],
      },
    ],
  }
}

describe('proof freshness manifest', () => {
  it('regenerates a receipt into a manifest through the CLI', async () => {
    const directory = mkdtempSync(resolve(tmpdir(), 'pluxx-proof-receipt-'))
    const manifestPath = resolve(directory, 'manifest.json')
    const specPath = resolve(directory, 'spec.json')
    writeFileSync(manifestPath, `${JSON.stringify(currentManifest(), null, 2)}\n`)
    writeFileSync(specPath, JSON.stringify({
      id: 'cli-generated',
      tier: 'bundle-contract',
      freshness: 'current',
      commands: [{ command: 'npm run build', outcome: 'passed' }],
      targets: [{
        target: 'repository',
        hostVersion: null,
        installedPath: null,
        sha256: null,
        outcome: 'passed',
      }],
    }))

    const process = Bun.spawn([
      'node',
      '--import',
      'tsx',
      resolve(ROOT, 'scripts/generate-proof-receipt.ts'),
      '--spec',
      specPath,
      '--manifest',
      manifestPath,
    ], { cwd: ROOT, stdout: 'pipe', stderr: 'pipe' })
    const exitCode = await process.exited
    expect(await new Response(process.stderr).text()).toBe('')
    expect(exitCode).toBe(0)

    const updated = ProofManifestSchema.parse(JSON.parse(readFileSync(manifestPath, 'utf8')))
    expect(updated.receipts.find((receipt) => receipt.id === 'cli-generated')).toMatchObject({
      packageVersion: PACKAGE_VERSION,
      tier: 'bundle-contract',
      freshness: 'current',
    })
  })

  it('materializes and replaces reproducible receipts from reviewable specs', () => {
    const manifest = currentManifest()
    const receipt = materializeProofReceipt({
      id: 'v0.1.31-repo-baseline',
      tier: 'unit',
      freshness: 'current',
      commands: [{ command: 'npm test', outcome: 'passed' }],
      targets: [{
        target: 'repository',
        hostVersion: null,
        installedPath: null,
        sha256: null,
        outcome: 'passed',
      }],
    }, {
      commitSha: CURRENT_SHA,
      packageVersion: '0.1.31',
      timestamp: '2026-07-12T12:00:00.000Z',
    })

    const updated = upsertProofReceipt(manifest, receipt)
    expect(updated.receipts).toHaveLength(2)
    expect(updated.receipts[0]).toEqual(receipt)
  })

  it('accepts version-aligned reproducible proof and explicitly historical host proof', () => {
    const problems = validateProofManifest(currentManifest(), {
      packageVersion: '0.1.31',
      expectedTagExists: true,
      now: new Date('2026-07-12T13:00:00.000Z'),
      isCommitReachable: () => true,
    })

    expect(problems).toEqual([])
  })

  it('rejects current claims backed by a stale package version', () => {
    const manifest = currentManifest()
    manifest.receipts[0]!.packageVersion = '0.1.28'

    expect(validateProofManifest(manifest, {
      packageVersion: '0.1.31',
      expectedTagExists: true,
      now: new Date('2026-07-12T13:00:00.000Z'),
      isCommitReachable: () => true,
    })).toContain('Current receipt v0.1.31-repo-baseline uses package 0.1.28; expected 0.1.31.')
  })

  it('expires installed-runtime and real-host receipts after 30 days', () => {
    const manifest = currentManifest()
    manifest.claims[0]!.tier = 'installed-runtime'
    manifest.receipts[0]!.tier = 'installed-runtime'
    manifest.receipts[0]!.timestamp = '2026-06-01T12:00:00.000Z'

    expect(validateProofManifest(manifest, {
      packageVersion: '0.1.31',
      expectedTagExists: true,
      now: new Date('2026-07-12T13:00:00.000Z'),
      isCommitReachable: () => true,
    })).toContain('Current receipt v0.1.31-repo-baseline is older than the 30-day environment-proof window.')
  })

  it('requires real-host receipts to capture host, install, and hash evidence or explain absence', () => {
    const manifest = currentManifest()
    const target = manifest.receipts[1]!.targets[0]!
    target.unavailableReason = null

    expect(validateProofManifest(manifest, {
      packageVersion: '0.1.31',
      expectedTagExists: true,
      now: new Date('2026-07-12T13:00:00.000Z'),
      isCommitReachable: () => true,
    })).toContain('Receipt v0.1.28-real-host-history target codex must capture hostVersion, installedPath, and sha256 or explain why they are unavailable.')
  })

  it('does not let current environment proof replace evidence with an explanation', () => {
    const manifest = currentManifest()
    manifest.claims[0]!.tier = 'real-host-behavior'
    manifest.receipts[0]!.tier = 'real-host-behavior'
    manifest.receipts[0]!.targets[0]!.unavailableReason = 'Host details were not captured.'

    expect(validateProofManifest(manifest, {
      packageVersion: '0.1.31',
      expectedTagExists: true,
      now: new Date('2026-07-12T13:00:00.000Z'),
      isCommitReachable: () => true,
    })).toContain('Current receipt v0.1.31-repo-baseline target core-four must capture hostVersion, installedPath, and sha256.')
  })

  it('rejects current claims backed by failed or not-run outcomes', () => {
    const manifest = currentManifest()
    manifest.receipts[0]!.commands[0]!.outcome = 'failed'
    manifest.receipts[0]!.targets[0]!.outcome = 'not-run'

    const problems = validateProofManifest(manifest, {
      packageVersion: '0.1.31',
      expectedTagExists: true,
      now: new Date('2026-07-12T13:00:00.000Z'),
      isCommitReachable: () => true,
    })
    expect(problems).toContain('Current receipt v0.1.31-repo-baseline has a non-passing command outcome.')
    expect(problems).toContain('Current receipt v0.1.31-repo-baseline has a non-passing target outcome.')
  })

  it('rejects current receipts from unreachable commits or future timestamps', () => {
    const manifest = currentManifest()
    manifest.receipts[0]!.timestamp = '2026-07-13T13:00:00.000Z'

    const problems = validateProofManifest(manifest, {
      packageVersion: '0.1.31',
      expectedTagExists: true,
      now: new Date('2026-07-12T13:00:00.000Z'),
      isCommitReachable: () => false,
    })
    expect(problems).toContain(`Current receipt v0.1.31-repo-baseline commit ${CURRENT_SHA} is not reachable from the current branch.`)
    expect(problems).toContain('Receipt v0.1.31-repo-baseline timestamp is in the future.')
  })

  it('rejects misspelled freshness, outcomes, and malformed arrays at JSON boundaries', () => {
    expect(ProofManifestSchema.safeParse({ ...currentManifest(), claims: {} }).success).toBe(false)
    expect(ProofManifestSchema.safeParse({
      ...currentManifest(),
      receipts: [{ ...currentManifest().receipts[0], freshness: 'stale' }],
    }).success).toBe(false)
    expect(ProofReceiptSpecSchema.safeParse({
      id: 'bad',
      tier: 'unit',
      freshness: 'current',
      commands: [{ command: 'npm test', outcome: 'green' }],
      targets: [],
    }).success).toBe(false)
  })

  it('requires released and release-prep state to match tag availability', () => {
    const manifest = currentManifest()
    expect(validateProofManifest(manifest, {
      packageVersion: '0.1.31',
      expectedTagExists: false,
      now: new Date('2026-07-12T13:00:00.000Z'),
      isCommitReachable: () => true,
    })).toContain('Manifest releaseState is released but tag v0.1.31 does not exist; use release-prep.')
  })
})

describe('canonical proof/version docs', () => {
  it('rejects obsolete release-prep and current-version claims', () => {
    const problems = findCanonicalDocProblems({
      'docs/todo/queue.md': 'The repo is preparing @orchid-labs/pluxx@0.1.28.',
      'docs/proof-and-install.md': 'The current released package is v0.1.28.',
    }, '0.1.31')

    expect(problems).toHaveLength(2)
    expect(problems[0]).toContain('docs/todo/queue.md:1')
    expect(problems[1]).toContain('docs/proof-and-install.md:1')
  })

  it('allows old versions when the line is explicitly historical', () => {
    expect(findCanonicalDocProblems({
      'docs/pluxx-self-hosted-core-four-proof.md': 'Historical proof: v0.1.28 observed on 2026-05-12.',
    }, '0.1.31')).toEqual([])
  })
})
