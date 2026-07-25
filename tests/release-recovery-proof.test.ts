import { describe, expect, it } from 'bun:test'
import { mkdtempSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join, resolve } from 'path'
import { spawnSync } from 'child_process'

const ROOT = resolve(import.meta.dir, '..')
const SCRIPT = resolve(ROOT, 'scripts/release-recovery-proof.mjs')
const VERSION = JSON.parse(readFileSync(resolve(ROOT, 'package.json'), 'utf-8')).version
const TAG = `v${VERSION}`
const TEST_NPM_CACHE = join(tmpdir(), 'pluxx-release-recovery-npm-cache')
const PRE_PROOF_COMMANDS = [
  'npm run build',
  'npm run typecheck',
  'npm test',
  'node scripts/run-npm-pack.mjs --dry-run',
  'npm pack --pack-destination "${CANDIDATE_DIR}"',
  'node scripts/verify-node-package-runtime.mjs --package-file "${CANDIDATE_PATH}"',
]

function run(command: string, args: string[], cwd: string) {
  return spawnSync(command, args, {
    cwd,
    encoding: 'utf-8',
    timeout: 15_000,
    killSignal: 'SIGKILL',
    ['e' + 'nv']: { ...process['e' + 'nv'], NPM_CONFIG_CACHE: TEST_NPM_CACHE },
  })
}

function git(root: string, ...args: string[]): string {
  const result = run('git', args, root)
  expect(result.status, result.stderr).toBe(0)
  return result.stdout.trim()
}

function currentReceipt(id: string, tier: 'bundle-contract' | 'fake-home-install') {
  return {
    id,
    tier,
    freshness: 'current',
    commitSha: 'pre-squash-receipt',
    packageVersion: VERSION,
    timestamp: '2026-07-25T01:02:45.000Z',
    commands: [{ command: 'npm run release:check', outcome: 'passed' }],
    targets: [{
      target: tier === 'bundle-contract' ? 'repository' : 'claude-code,cursor,codex,opencode',
      hostVersion: null,
      installedPath: null,
      sha256: null,
      outcome: 'passed',
    }],
  }
}

function fixture(packageVersion = VERSION, manifestSuffix = '\n', proofPasses = true, preProofPasses = true) {
  const root = mkdtempSync(join(tmpdir(), 'pluxx-release-recovery-'))
  mkdirSync(join(root, 'docs'), { recursive: true })
  mkdirSync(join(root, 'scripts'), { recursive: true })
  const packageJson = {
    name: '@orchid-labs/pluxx',
    version: packageVersion,
    scripts: {
      build: preProofPasses
        ? 'node -e "require(\'fs\').mkdirSync(\'dist\', { recursive: true }); require(\'fs\').writeFileSync(\'dist/recovery-test-build\', \'ok\')"'
        : 'node -e "process.exit(1)"',
      typecheck: 'node -e "process.exit(0)"',
      test: `node -e "const { spawnSync } = require('child_process'); const { existsSync } = require('fs'); process.exit(spawnSync('git', ['show-ref', '--verify', '--quiet', 'refs/tags/${TAG}']).status === 0 || !existsSync('dist/recovery-test-build') ? 1 : 0)"`,
      'proof:check': 'node proof-check.mjs',
    },
  }
  writeFileSync(join(root, 'package.' + 'json'), JSON.stringify(packageJson) + '\n')
  writeFileSync(
    join(root, 'proof-check.mjs'),
    proofPasses
      ? `import { readFileSync } from 'fs'; const manifest = JSON.parse(readFileSync('docs/proof-manifest.json', 'utf8')); if (process.env.PLUXX_RELEASE_TAG !== '${TAG}' || !manifest.receipts.every((receipt) => receipt.freshness !== 'current' || receipt.commands.every((command) => command.outcome === 'passed'))) process.exit(1)\n`
      : 'process.exit(1)\n',
  )
  writeFileSync(join(root, 'scripts/run-npm-pack.mjs'), 'process.exit(0)\n')
  writeFileSync(join(root, 'scripts/verify-node-package-runtime.mjs'), 'process.exit(0)\n')
  const manifest = {
    schemaVersion: 1,
    canonicalVersion: VERSION,
    expectedTag: TAG,
    releaseState: 'release-prep',
    policy: { environmentReceiptMaxAgeDays: 30 },
    claims: [
      {
        id: `${TAG}-repository-validation`,
        summary: 'repository',
        tier: 'bundle-contract',
        freshness: 'current',
        evidencePath: 'tests/release-workflow.test.ts',
        receiptId: `${TAG}-repository-validation`,
      },
      {
        id: `${TAG}-fake-home-install`,
        summary: 'fake home',
        tier: 'fake-home-install',
        freshness: 'current',
        evidencePath: 'tests/release-workflow.test.ts',
        receiptId: `${TAG}-fake-home-install`,
      },
    ],
    receipts: [
      currentReceipt(`${TAG}-repository-validation`, 'bundle-contract'),
      currentReceipt(`${TAG}-fake-home-install`, 'fake-home-install'),
    ],
  }
  writeFileSync(join(root, 'docs/proof-manifest.json'), JSON.stringify(manifest, null, 2) + manifestSuffix)

  git(root, 'init')
  git(root, 'config', 'user.email', 'release-recovery@example.com')
  git(root, 'config', 'user.name', 'Release Recovery Test')
  git(root, 'add', 'package.json', 'proof-check.mjs', 'scripts', 'docs/proof-manifest.json')
  git(root, 'commit', '-m', 'tagged release tree')
  git(root, 'tag', TAG)

  const artifact = join(root, `orchid-labs-pluxx-${VERSION}.tgz`)

  return {
    root,
    artifact,
    receipt: join(root, `pluxx-${TAG}-recovery-receipt.json`),
    head: git(root, 'rev-parse', 'HEAD'),
    tree: git(root, 'rev-parse', 'HEAD^{tree}'),
    originalManifest: readFileSync(join(root, 'docs/proof-manifest.json'), 'utf-8'),
  }
}

describe('immutable-tag release recovery proof', () => {
  it('binds fresh proof to the exact tag tree, then restores the immutable checkout', () => {
    const runFixture = fixture(VERSION, '\n\n')
    try {
      const prepared = run('node', [
        SCRIPT,
        'prepare',
        '--release-root', runFixture.root,
        '--tag', TAG,
        '--trusted-main-commit', runFixture.head,
        '--artifact', runFixture.artifact,
        '--receipt', runFixture.receipt,
      ], runFixture.root)
      expect(prepared.status, prepared.stderr).toBe(0)

      const overlay = JSON.parse(readFileSync(join(runFixture.root, 'docs/proof-manifest.json'), 'utf-8'))
      const current = overlay.receipts.filter((receipt: { freshness: string }) => receipt.freshness === 'current')
      expect(current).toHaveLength(2)
      expect(current.every((receipt: { commitSha: string }) => receipt.commitSha === runFixture.head)).toBe(true)
      expect(current.every((receipt: { commands: Array<{ outcome: string }> }) =>
        receipt.commands.every((command) => command.outcome === 'passed'))).toBe(true)

      const finalized = run('node', [
        SCRIPT,
        'finalize',
        '--release-root', runFixture.root,
        '--tag', TAG,
        '--trusted-main-commit', runFixture.head,
        '--artifact', runFixture.artifact,
        '--receipt', runFixture.receipt,
      ], runFixture.root)
      expect(finalized.status, finalized.stderr).toBe(0)
      expect(readFileSync(join(runFixture.root, 'docs/proof-manifest.json'), 'utf-8')).toBe(runFixture.originalManifest)
      expect(git(runFixture.root, 'status', '--porcelain', '--untracked-files=no')).toBe('')

      const receipt = JSON.parse(readFileSync(runFixture.receipt, 'utf-8'))
      expect(receipt.status).toBe('verified')
      expect(receipt.releaseTag).toBe(TAG)
      expect(receipt.tagCommit).toBe(runFixture.head)
      expect(receipt.tagTree).toBe(runFixture.tree)
      expect(receipt.packageVersion).toBe(VERSION)
      expect(receipt.artifact.sha256).toMatch(/^[a-f0-9]{64}$/)
      expect(receipt.artifact.integrity).toMatch(/^sha512-/)
      expect(receipt.validations.every((validation: { outcome: string }) => validation.outcome === 'passed')).toBe(true)

      const verified = run('node', [
        SCRIPT,
        'verify',
        '--release-root', runFixture.root,
        '--tag', TAG,
        '--trusted-main-commit', runFixture.head,
        '--artifact', runFixture.artifact,
        '--receipt', runFixture.receipt,
      ], runFixture.root)
      expect(verified.status, verified.stderr).toBe(0)
    } finally {
      rmSync(runFixture.root, { recursive: true, force: true })
    }
  }, 15_000)

  it('accepts the recovery overlay through the production tag proof checker', () => {
    const fixtureRoot = mkdtempSync(join(tmpdir(), 'pluxx-production-proof-'))
    const checkout = join(fixtureRoot, 'release')
    try {
      expect(run('git', ['clone', '--no-local', '--no-tags', ROOT, checkout], fixtureRoot).status).toBe(0)
      expect(run('git', ['checkout', '--detach', 'HEAD'], checkout).status).toBe(0)
      expect(run('git', ['tag', TAG], checkout).status).toBe(0)
      symlinkSync(join(ROOT, 'node_modules'), join(checkout, 'node_modules'), 'dir')

      const manifestPath = join(checkout, 'docs/proof-manifest.json')
      const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'))
      const head = git(checkout, 'rev-parse', 'HEAD')
      for (const receipt of manifest.receipts.filter((item: { freshness: string }) => item.freshness === 'current')) {
        receipt.commitSha = head
        receipt.timestamp = '2026-07-25T03:35:25.299Z'
        receipt.commands = receipt.tier === 'fake-home-install'
          ? [{ command: 'npm test', outcome: 'passed' }]
          : PRE_PROOF_COMMANDS.map((command) => ({ command, outcome: 'passed' }))
      }
      writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n')

      const result = spawnSync('npm', ['run', 'proof:check'], {
        cwd: checkout,
        encoding: 'utf-8',
        timeout: 15_000,
        killSignal: 'SIGKILL',
        ['e' + 'nv']: { ...process['e' + 'nv'], PLUXX_RELEASE_TAG: TAG },
      })
      expect(result.status, result.stderr).toBe(0)
      expect(result.stdout).toContain(`Proof freshness check passed for ${VERSION}`)
    } finally {
      rmSync(fixtureRoot, { recursive: true, force: true })
    }
  }, 15_000)

  it('rejects a dirty tag checkout before creating any recovery proof', () => {
    const runFixture = fixture()
    try {
      writeFileSync(join(runFixture.root, 'package.json'), JSON.stringify({ name: '@orchid-labs/pluxx', version: VERSION, dirty: true }))
      const result = run('node', [
        SCRIPT,
        'prepare',
        '--release-root', runFixture.root,
        '--tag', TAG,
        '--trusted-main-commit', runFixture.head,
        '--artifact', runFixture.artifact,
        '--receipt', runFixture.receipt,
      ], runFixture.root)
      expect(result.status).toBe(1)
      expect(result.stderr).toContain('Release checkout has tracked changes')
    } finally {
      rmSync(runFixture.root, { recursive: true, force: true })
    }
  })

  it('does not finalize a receipt when the tag proof checker fails', () => {
    const runFixture = fixture(VERSION, '\n', false)
    try {
      const prepared = run('node', [
        SCRIPT,
        'prepare',
        '--release-root', runFixture.root,
        '--tag', TAG,
        '--trusted-main-commit', runFixture.head,
        '--artifact', runFixture.artifact,
        '--receipt', runFixture.receipt,
      ], runFixture.root)
      expect(prepared.status, prepared.stderr).toBe(0)

      const finalized = run('node', [
        SCRIPT,
        'finalize',
        '--release-root', runFixture.root,
        '--tag', TAG,
        '--trusted-main-commit', runFixture.head,
        '--artifact', runFixture.artifact,
        '--receipt', runFixture.receipt,
      ], runFixture.root)
      expect(finalized.status).toBe(1)
      expect(finalized.stderr).toContain(`Recovery proof check failed for ${TAG}`)
      expect(JSON.parse(readFileSync(runFixture.receipt, 'utf-8')).status).toBe('awaiting-proof')
    } finally {
      rmSync(runFixture.root, { recursive: true, force: true })
    }
  }, 15_000)

  it('does not create a receipt when a required pre-proof validation fails', () => {
    const runFixture = fixture(VERSION, '\n', true, false)
    try {
      const prepared = run('node', [
        SCRIPT,
        'prepare',
        '--release-root', runFixture.root,
        '--tag', TAG,
        '--trusted-main-commit', runFixture.head,
        '--artifact', runFixture.artifact,
        '--receipt', runFixture.receipt,
      ], runFixture.root)
      expect(prepared.status).toBe(1)
      expect(prepared.stderr).toContain('Recovery validation failed: npm run build')
      expect(() => readFileSync(runFixture.receipt, 'utf-8')).toThrow()
    } finally {
      rmSync(runFixture.root, { recursive: true, force: true })
    }
  }, 15_000)

  it('rejects unsupported current environment receipts instead of rebinding them', () => {
    const runFixture = fixture()
    try {
      const manifestPath = join(runFixture.root, 'docs/proof-manifest.json')
      const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'))
      manifest.receipts.push({
        id: `${TAG}-real-host`,
        tier: 'real-host-behavior',
        freshness: 'current',
        commitSha: runFixture.head,
        packageVersion: VERSION,
        timestamp: '2026-07-25T03:35:25.299Z',
        commands: [{ command: 'host proof', outcome: 'passed' }],
        targets: [{
          target: 'real-host',
          hostVersion: 'test',
          installedPath: '/test',
          sha256: '0'.repeat(64),
          outcome: 'passed',
        }],
      })
      writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n')
      git(runFixture.root, 'add', 'docs/proof-manifest.json')
      git(runFixture.root, 'commit', '--amend', '--no-edit')
      git(runFixture.root, 'tag', '--force', TAG)
      const currentHead = git(runFixture.root, 'rev-parse', 'HEAD')

      const prepared = run('node', [
        SCRIPT,
        'prepare',
        '--release-root', runFixture.root,
        '--tag', TAG,
        '--trusted-main-commit', currentHead,
        '--artifact', runFixture.artifact,
        '--receipt', runFixture.receipt,
      ], runFixture.root)
      expect(prepared.status).toBe(1)
      expect(prepared.stderr).toContain(`Recovery does not support current receipt ${TAG}-real-host`)
    } finally {
      rmSync(runFixture.root, { recursive: true, force: true })
    }
  }, 15_000)

  it('rejects a tag whose version differs from the package identity', () => {
    const runFixture = fixture('0.1.39')
    try {
      const result = run('node', [
        SCRIPT,
        'prepare',
        '--release-root', runFixture.root,
        '--tag', TAG,
        '--trusted-main-commit', runFixture.head,
        '--artifact', runFixture.artifact,
        '--receipt', runFixture.receipt,
      ], runFixture.root)
      expect(result.status).toBe(1)
      expect(result.stderr).toContain(`Release tag ${TAG} does not match package version 0.1.39`)
    } finally {
      rmSync(runFixture.root, { recursive: true, force: true })
    }
  })

  it('rejects artifact drift after the receipt is finalized', () => {
    const runFixture = fixture()
    try {
      for (const mode of ['prepare', 'finalize']) {
        const result = run('node', [
          SCRIPT,
          mode,
          '--release-root', runFixture.root,
          '--tag', TAG,
          '--trusted-main-commit', runFixture.head,
          '--artifact', runFixture.artifact,
          '--receipt', runFixture.receipt,
        ], runFixture.root)
        expect(result.status, result.stderr).toBe(0)
      }
      writeFileSync(runFixture.artifact, 'tampered artifact')
      const result = run('node', [
        SCRIPT,
        'verify',
        '--release-root', runFixture.root,
        '--tag', TAG,
        '--trusted-main-commit', runFixture.head,
        '--artifact', runFixture.artifact,
        '--receipt', runFixture.receipt,
      ], runFixture.root)
      expect(result.status).toBe(1)
      expect(result.stderr).toContain('Artifact sha256 does not match the recovery receipt')
    } finally {
      rmSync(runFixture.root, { recursive: true, force: true })
    }
  })

  it('does not mark a receipt verified when the committed proof baseline differs', () => {
    const runFixture = fixture()
    try {
      const prepared = run('node', [
        SCRIPT,
        'prepare',
        '--release-root', runFixture.root,
        '--tag', TAG,
        '--trusted-main-commit', runFixture.head,
        '--artifact', runFixture.artifact,
        '--receipt', runFixture.receipt,
      ], runFixture.root)
      expect(prepared.status, prepared.stderr).toBe(0)

      const receipt = JSON.parse(readFileSync(runFixture.receipt, 'utf-8'))
      receipt.manifest.originalSha256 = '0'.repeat(64)
      writeFileSync(runFixture.receipt, JSON.stringify(receipt, null, 2) + '\n')

      const result = run('node', [
        SCRIPT,
        'finalize',
        '--release-root', runFixture.root,
        '--tag', TAG,
        '--trusted-main-commit', runFixture.head,
        '--artifact', runFixture.artifact,
        '--receipt', runFixture.receipt,
      ], runFixture.root)
      expect(result.status).toBe(1)
      expect(result.stderr).toContain('Committed proof manifest does not match the recovery receipt baseline')
      expect(JSON.parse(readFileSync(runFixture.receipt, 'utf-8')).status).toBe('awaiting-proof')
    } finally {
      rmSync(runFixture.root, { recursive: true, force: true })
    }
  })

  it('rejects a verified receipt whose passing command set has changed', () => {
    const runFixture = fixture()
    try {
      for (const mode of ['prepare', 'finalize']) {
        const result = run('node', [
          SCRIPT,
          mode,
          '--release-root', runFixture.root,
          '--tag', TAG,
          '--trusted-main-commit', runFixture.head,
          '--artifact', runFixture.artifact,
          '--receipt', runFixture.receipt,
        ], runFixture.root)
        expect(result.status, result.stderr).toBe(0)
      }

      const receipt = JSON.parse(readFileSync(runFixture.receipt, 'utf-8'))
      receipt.validations[0].command = 'npm run substituted-check'
      writeFileSync(runFixture.receipt, JSON.stringify(receipt, null, 2) + '\n')

      const result = run('node', [
        SCRIPT,
        'verify',
        '--release-root', runFixture.root,
        '--tag', TAG,
        '--trusted-main-commit', runFixture.head,
        '--artifact', runFixture.artifact,
        '--receipt', runFixture.receipt,
      ], runFixture.root)
      expect(result.status).toBe(1)
      expect(result.stderr).toContain('Recovery receipt validation set does not match the required passing commands')
    } finally {
      rmSync(runFixture.root, { recursive: true, force: true })
    }
  })
})
