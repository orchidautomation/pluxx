import { afterEach, describe, expect, it } from 'bun:test'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { resolve } from 'path'
import { ORCHESTRATION_CAPABILITY_FIELDS } from '../src/orchestration-capability-registry'

const ROOT = resolve(import.meta.dir, '..')
const FIXTURES = ['compound-engineering', 'hyperframes', 'superpowers'] as const
const PLATFORMS = ['claude-code', 'cursor', 'codex', 'opencode'] as const
const tempRoots: string[] = []

afterEach(() => {
  while (tempRoots.length > 0) rmSync(tempRoots.pop()!, { recursive: true, force: true })
})

async function runCase(
  fixture: typeof FIXTURES[number],
  platform: typeof PLATFORMS[number],
  run: number,
  installKind: 'symlink' | 'copy' = 'symlink',
) {
  const caseRoot = mkdtempSync(resolve(tmpdir(), `pluxx-orchestration-proof-${fixture}-${platform}-${run}-`))
  tempRoots.push(caseRoot)
  const outputPath = resolve(caseRoot, 'receipt.json')
  const home = resolve(caseRoot, 'home')
  mkdirSync(home, { recursive: true })
  mkdirSync(resolve(caseRoot, 'tmp'), { recursive: true })
  const proc = Bun.spawn([
    process.execPath,
    '--import',
    'tsx',
    resolve(ROOT, 'scripts/run-orchestration-runtime-proof.ts'),
    '--fixture', fixture,
    '--platform', platform,
    '--workspace', resolve(caseRoot, 'workspace'),
    '--output', outputPath,
    '--install-kind', installKind,
  ], {
    cwd: ROOT,
    env: {
      PATH: process.env.PATH ?? '',
      HOME: home,
      CODEX_HOME: resolve(home, '.codex'),
      XDG_CONFIG_HOME: resolve(home, '.config'),
      TMPDIR: resolve(caseRoot, 'tmp'),
      NO_COLOR: '1',
    },
    stdout: 'pipe',
    stderr: 'pipe',
  })
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ])
  expect(exitCode, `${fixture}/${platform}\nstdout:\n${stdout}\nstderr:\n${stderr}`).toBe(0)
  return JSON.parse(readFileSync(outputPath, 'utf-8'))
}

describe('isolated orchestration installed/runtime proof', () => {
  it('produces deterministic receipts for all 12 fixture/host cases in parallel-isolated homes', async () => {
    const cases = FIXTURES.flatMap(fixture => PLATFORMS.map(platform => ({ fixture, platform })))
    const first = await Promise.all(cases.map(({ fixture, platform }) => runCase(fixture, platform, 1)))
    const second = await Promise.all(cases.map(({ fixture, platform }) => runCase(fixture, platform, 2)))

    expect(first).toEqual(second)
    expect(first).toHaveLength(12)
    for (const [index, receipt] of first.entries()) {
      const expectedPath = resolve(
        ROOT,
        'tests/fixtures/orchestration-runtime-receipts',
        cases[index]!.fixture,
        `${cases[index]!.platform}.json`,
      )
      if (process.env.UPDATE_ORCHESTRATION_RUNTIME_RECEIPTS === '1') {
        writeFileSync(expectedPath, `${JSON.stringify(receipt, null, 2)}\n`)
      }
      const expectedReceipt = JSON.parse(readFileSync(expectedPath, 'utf-8'))
      expect(receipt).toEqual(expectedReceipt)
      expect(receipt.identity.fixture).toBe(cases[index]!.fixture)
      expect(receipt.host.platform).toBe(cases[index]!.platform)
      expect(receipt.evidence.generated.status).toBe('proven')
      expect(receipt.evidence.installed.status).toBe('proven')
      expect(receipt.proofTier).toBe('fake-home-install')
      expect(receipt.evidence.discovered.status).toBe('environment-unavailable')
      expect(receipt.evidence.discovered.evidenceIds).toEqual(['host-discovery-not-invoked'])
      if (cases[index]!.platform === 'codex') {
        expect(receipt.evidence.installed.evidenceIds).toContain('codex-marketplace-sha256')
      }
      if (cases[index]!.platform === 'opencode') {
        expect(receipt.evidence.installed.evidenceIds).toContain('opencode-entry-sha256')
      }
      expect(receipt.evidence.activated.status).toBe('unsupported')
      expect(receipt.evidence.behavioral.status).toBe('environment-unavailable')
      expect(receipt.fieldOutcomes).toHaveLength(ORCHESTRATION_CAPABILITY_FIELDS.length)
      expect(receipt.fieldOutcomes.every((row: { declared: { mode: string }; effective: { mode: string } }) =>
        row.declared.mode === 'degrade' && row.effective.mode === 'degrade')).toBe(true)
      expect(receipt.installedBehaviorProven).toBe(false)
    }
  }, 120_000)

  it('produces a deterministic copied-install ownership preimage without promoting host evidence', async () => {
    const first = await runCase('compound-engineering', 'codex', 1, 'copy')
    const second = await runCase('compound-engineering', 'codex', 2, 'copy')
    expect(first).toEqual(second)
    expect(first.adjuncts.installOwnership.ownershipKind).toBe('copy')
    expect(first.adjuncts.installOwnership.ownedSurfaceCount).toBeGreaterThan(1)
    expect(first.evidence.discovered.status).toBe('environment-unavailable')
    expect(first.evidence.activated.status).toBe('unsupported')
    expect(first.evidence.behavioral.status).toBe('environment-unavailable')
    expect(first.fieldOutcomes.every((row: { effective: { mode: string } }) => row.effective.mode === 'degrade')).toBe(true)
  }, 30_000)
})
