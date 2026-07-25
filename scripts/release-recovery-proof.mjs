#!/usr/bin/env node

import { execFileSync } from 'child_process'
import { createHash } from 'crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { basename, dirname, resolve } from 'path'

const MANIFEST_PATH = 'docs/proof-manifest.json'
const PACKAGE_NAME = '@orchid-labs/pluxx'
const GIT_TIMEOUT_MS = 30_000
const VALIDATION_TIMEOUT_MS = 20 * 60_000
const PRE_PROOF_VALIDATIONS = [
  { command: 'npm run build', executable: 'npm', args: () => ['run', 'build'] },
  { command: 'npm run typecheck', executable: 'npm', args: () => ['run', 'typecheck'] },
  { command: 'npm test', executable: 'npm', args: () => ['test'] },
  {
    command: 'node scripts/run-npm-pack.mjs --dry-run',
    executable: 'node',
    args: () => ['scripts/run-npm-pack.mjs', '--dry-run'],
  },
  {
    command: 'npm pack --pack-destination "${CANDIDATE_DIR}"',
    execute: (recovery) => packCandidate(recovery),
  },
  {
    command: 'node scripts/verify-node-package-runtime.mjs --package-file "${CANDIDATE_PATH}"',
    executable: 'node',
    args: (recovery) => [
      'scripts/verify-node-package-runtime.mjs',
      '--package-file',
      recovery.artifactPath,
    ],
  },
]
const PRE_PROOF_COMMANDS = PRE_PROOF_VALIDATIONS.map((validation) => validation.command)
const PROOF_VALIDATION = 'npm run proof:check'
const RECEIPT_COMMANDS_BY_TIER = new Map([
  ['bundle-contract', PRE_PROOF_COMMANDS],
  ['fake-home-install', ['npm test']],
])

function fail(message) {
  throw new Error(message)
}

function parseArgs(argv) {
  const [mode, ...rest] = argv
  if (!['prepare', 'finalize', 'verify'].includes(mode)) {
    fail('Usage: release-recovery-proof.mjs <prepare|finalize|verify> --release-root <path> --tag <vX.Y.Z> --trusted-main-commit <sha> --artifact <path> --receipt <path>')
  }

  const values = {}
  for (let index = 0; index < rest.length; index += 2) {
    const key = rest[index]
    const value = rest[index + 1]
    if (!key?.startsWith('--') || !value) fail(`Missing value for ${key ?? 'argument'}`)
    values[key.slice(2)] = value
  }

  for (const key of ['release-root', 'tag', 'trusted-main-commit', 'artifact', 'receipt']) {
    if (!values[key]) fail(`Missing required --${key}`)
  }
  if (!/^v\d+\.\d+\.\d+$/.test(values.tag)) fail(`Release tag ${values.tag} must use vX.Y.Z format`)
  if (!/^[a-f0-9]{40}$/.test(values['trusted-main-commit'])) fail('Trusted main commit must be a full Git SHA')

  return {
    mode,
    releaseRoot: resolve(values['release-root']),
    tag: values.tag,
    trustedMainCommit: values['trusted-main-commit'],
    artifactPath: resolve(values.artifact),
    receiptPath: resolve(values.receipt),
  }
}

function git(root, ...args) {
  return execFileSync('git', args, { cwd: root, encoding: 'utf-8', timeout: GIT_TIMEOUT_MS }).trim()
}

function gitFile(root, path) {
  return execFileSync('git', ['show', `HEAD:${path}`], {
    cwd: root,
    encoding: 'utf-8',
    timeout: GIT_TIMEOUT_MS,
  })
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex')
}

function artifactDigests(path) {
  if (!existsSync(path)) fail(`Release artifact does not exist: ${path}`)
  const content = readFileSync(path)
  return {
    sha256: sha256(content),
    integrity: `sha512-${createHash('sha512').update(content).digest('base64')}`,
  }
}

function readPackedPackage(path) {
  try {
    const content = execFileSync('tar', ['-xOf', path, 'package/package.json'], {
      encoding: 'utf-8',
      timeout: GIT_TIMEOUT_MS,
    })
    return JSON.parse(content)
  } catch {
    fail(`Release artifact does not contain a readable package/package.json: ${path}`)
  }
}

function trackedChanges(root) {
  return git(root, 'status', '--porcelain', '--untracked-files=no')
}

function requireClean(root) {
  const status = trackedChanges(root)
  if (status) fail(`Release checkout has tracked changes:\n${status}`)
}

function inspectRelease(root, tag) {
  const packagePath = resolve(root, 'package.json')
  const manifestPath = resolve(root, MANIFEST_PATH)
  if (!existsSync(packagePath)) fail(`Release checkout is missing package.json: ${root}`)
  if (!existsSync(manifestPath)) fail(`Release checkout is missing ${MANIFEST_PATH}: ${root}`)

  const packageJson = JSON.parse(readFileSync(packagePath, 'utf-8'))
  const head = git(root, 'rev-parse', 'HEAD^{commit}')
  let tagCommit
  try {
    tagCommit = git(root, 'rev-parse', `refs/tags/${tag}^{commit}`)
  } catch {
    fail(`Release tag ${tag} does not exist in the release checkout`)
  }
  if (head !== tagCommit) fail(`Release checkout ${head} does not match ${tag} commit ${tagCommit}`)
  if (packageJson.name !== PACKAGE_NAME) fail(`Release package is ${String(packageJson.name)}; expected ${PACKAGE_NAME}`)
  if (packageJson.version !== tag.slice(1)) {
    fail(`Release tag ${tag} does not match package version ${String(packageJson.version)}`)
  }

  return {
    head,
    tree: git(root, 'rev-parse', 'HEAD^{tree}'),
    packageName: packageJson.name,
    packageVersion: packageJson.version,
    manifestPath,
  }
}

function requireArtifactIdentity(path, expected) {
  const packed = readPackedPackage(path)
  if (packed.name !== expected.packageName) {
    fail(`Packed artifact is ${String(packed.name)}; expected ${expected.packageName}`)
  }
  if (packed.version !== expected.packageVersion) {
    fail(`Packed artifact version is ${String(packed.version)}; expected ${expected.packageVersion}`)
  }
}

function readManifest(path) {
  const manifest = JSON.parse(readFileSync(path, 'utf-8'))
  if (manifest.schemaVersion !== 1) fail(`Unsupported proof manifest schema ${String(manifest.schemaVersion)}`)
  if (!Array.isArray(manifest.claims) || !Array.isArray(manifest.receipts)) {
    fail('Proof manifest must contain claims and receipts arrays')
  }
  return manifest
}

function currentReceipts(manifest, release) {
  if (manifest.canonicalVersion !== release.packageVersion) {
    fail(`Proof manifest version ${String(manifest.canonicalVersion)} does not match ${release.packageVersion}`)
  }
  if (manifest.expectedTag !== `v${release.packageVersion}`) {
    fail(`Proof manifest tag ${String(manifest.expectedTag)} does not match v${release.packageVersion}`)
  }

  const receipts = manifest.receipts.filter((receipt) => receipt.freshness === 'current')
  if (receipts.length === 0) fail('Proof manifest has no current receipts to revalidate')
  const receiptIds = new Set(receipts.map((receipt) => receipt.id))
  for (const receipt of receipts) {
    if (receipt.packageVersion !== release.packageVersion) {
      fail(`Current receipt ${String(receipt.id)} uses package ${String(receipt.packageVersion)}; expected ${release.packageVersion}`)
    }
  }
  for (const claim of manifest.claims.filter((candidate) => candidate.freshness === 'current')) {
    if (!receiptIds.has(claim.receiptId)) {
      fail(`Current claim ${String(claim.id)} does not resolve to a current receipt`)
    }
  }
  return receipts
}

function expectedValidations(proofOutcome) {
  return [
    ...PRE_PROOF_COMMANDS.map((command) => ({ command, outcome: 'passed' })),
    { command: PROOF_VALIDATION, outcome: proofOutcome },
  ]
}

function runPreProofValidations(args) {
  for (const validation of PRE_PROOF_VALIDATIONS) {
    try {
      if (validation.execute) {
        validation.execute(args)
      } else {
        execFileSync(validation.executable, validation.args(args), {
          cwd: args.releaseRoot,
          stdio: 'inherit',
          timeout: VALIDATION_TIMEOUT_MS,
        })
      }
    } catch {
      fail(`Recovery validation failed: ${validation.command}`)
    }
  }
}

function packCandidate(args) {
  if (existsSync(args.artifactPath)) fail(`Recovery candidate already exists: ${args.artifactPath}`)
  const destination = dirname(args.artifactPath)
  mkdirSync(destination, { recursive: true })
  const output = execFileSync('npm', ['pack', '--pack-destination', destination], {
    cwd: args.releaseRoot,
    encoding: 'utf-8',
    stdio: ['ignore', 'pipe', 'inherit'],
    timeout: VALIDATION_TIMEOUT_MS,
  }).trim()
  const packedPath = resolve(destination, output.split(/\r?\n/).filter(Boolean).at(-1))
  if (packedPath !== args.artifactPath) {
    fail(`npm pack created ${packedPath}; expected ${args.artifactPath}`)
  }
}

function commandsForReceipt(receipt) {
  const commands = RECEIPT_COMMANDS_BY_TIER.get(receipt.tier)
  if (!commands) fail(`Recovery does not support current receipt ${String(receipt.id)}`)
  return commands.map((command) => ({ command, outcome: 'passed' }))
}

function prepare(args) {
  requireClean(args.releaseRoot)
  const release = inspectRelease(args.releaseRoot, args.tag)
  const originalText = readFileSync(release.manifestPath, 'utf-8')
  const manifest = readManifest(release.manifestPath)
  const receipts = currentReceipts(manifest, release)
  const receiptCommands = new Map(receipts.map((receipt) => [receipt.id, commandsForReceipt(receipt)]))
  runPreProofValidations(args)
  requireClean(args.releaseRoot)
  requireArtifactIdentity(args.artifactPath, release)
  const artifact = artifactDigests(args.artifactPath)
  const observedAt = new Date().toISOString()
  const currentIds = new Set(receipts.map((receipt) => receipt.id))

  const overlay = {
    ...manifest,
    receipts: manifest.receipts.map((receipt) => currentIds.has(receipt.id)
      ? {
          ...receipt,
          commitSha: release.head,
          packageVersion: release.packageVersion,
          timestamp: observedAt,
          commands: receiptCommands.get(receipt.id),
        }
      : receipt),
  }
  const overlayText = `${JSON.stringify(overlay, null, 2)}\n`
  const recoveryReceipt = {
    schemaVersion: 1,
    kind: 'pluxx-immutable-tag-recovery',
    status: 'awaiting-proof',
    releaseTag: args.tag,
    tagCommit: release.head,
    tagTree: release.tree,
    trustedMainCommit: args.trustedMainCommit,
    packageName: release.packageName,
    packageVersion: release.packageVersion,
    artifact: {
      file: basename(args.artifactPath),
      ...artifact,
    },
    manifest: {
      originalSha256: sha256(originalText),
      overlaySha256: sha256(overlayText),
      currentReceiptIds: [...currentIds].sort(),
    },
    validations: expectedValidations('pending'),
    createdAt: observedAt,
  }

  writeFileSync(release.manifestPath, overlayText)
  writeFileSync(args.receiptPath, `${JSON.stringify(recoveryReceipt, null, 2)}\n`)
  process.stdout.write(`${args.receiptPath}\n`)
}

function readReceipt(path) {
  if (!existsSync(path)) fail(`Recovery receipt does not exist: ${path}`)
  const receipt = JSON.parse(readFileSync(path, 'utf-8'))
  if (receipt.schemaVersion !== 1 || receipt.kind !== 'pluxx-immutable-tag-recovery') {
    fail('Recovery receipt has an unsupported schema')
  }
  return receipt
}

function requireReceiptIdentity(receipt, args, release, artifact) {
  if (receipt.releaseTag !== args.tag) fail('Recovery receipt tag does not match the requested tag')
  if (receipt.tagCommit !== release.head) fail('Recovery receipt commit does not match the tag checkout')
  if (receipt.tagTree !== release.tree) fail('Recovery receipt tree does not match the tag checkout')
  if (receipt.trustedMainCommit !== args.trustedMainCommit) fail('Recovery receipt trusted-main commit does not match')
  if (receipt.packageName !== release.packageName || receipt.packageVersion !== release.packageVersion) {
    fail('Recovery receipt package identity does not match the tag checkout')
  }
  if (receipt.artifact?.sha256 !== artifact.sha256) fail('Artifact sha256 does not match the recovery receipt')
  if (receipt.artifact?.integrity !== artifact.integrity) fail('Artifact sha512 integrity does not match the recovery receipt')
}

function finalize(args) {
  const release = inspectRelease(args.releaseRoot, args.tag)
  const expectedStatus = `M ${MANIFEST_PATH}`
  const status = trackedChanges(args.releaseRoot)
  if (status !== expectedStatus) {
    fail(`Recovery proof must modify only ${MANIFEST_PATH}; observed:\n${status || '(clean)'}`)
  }

  const receipt = readReceipt(args.receiptPath)
  if (receipt.status !== 'awaiting-proof') fail(`Recovery receipt status is ${String(receipt.status)}; expected awaiting-proof`)
  const artifact = artifactDigests(args.artifactPath)
  requireArtifactIdentity(args.artifactPath, release)
  requireReceiptIdentity(receipt, args, release, artifact)

  const overlayText = readFileSync(release.manifestPath, 'utf-8')
  if (sha256(overlayText) !== receipt.manifest?.overlaySha256) fail('Proof manifest overlay does not match the recovery receipt')
  const overlay = readManifest(release.manifestPath)
  const receipts = currentReceipts(overlay, release)
  const expectedIds = [...receipt.manifest.currentReceiptIds].sort()
  if (JSON.stringify(receipts.map((item) => item.id).sort()) !== JSON.stringify(expectedIds)) {
    fail('Proof manifest current receipt set changed during recovery')
  }
  for (const item of receipts) {
    if (item.commitSha !== release.head) fail(`Current receipt ${item.id} is not bound to the tag commit`)
    if (item.commands.some((command) => command.outcome !== 'passed')) {
      fail(`Current receipt ${item.id} contains a non-passing validation`)
    }
  }

  try {
    execFileSync('npm', ['run', 'proof:check'], {
      cwd: args.releaseRoot,
      env: { ...process.env, PLUXX_RELEASE_TAG: args.tag },
      stdio: 'inherit',
      timeout: VALIDATION_TIMEOUT_MS,
    })
  } catch {
    fail(`Recovery proof check failed for ${args.tag}`)
  }

  const originalText = gitFile(args.releaseRoot, MANIFEST_PATH)
  if (sha256(originalText) !== receipt.manifest.originalSha256) {
    fail('Committed proof manifest does not match the recovery receipt baseline')
  }
  writeFileSync(release.manifestPath, originalText)
  requireClean(args.releaseRoot)

  const finalized = {
    ...receipt,
    status: 'verified',
    validations: expectedValidations('passed'),
    verifiedAt: new Date().toISOString(),
  }
  writeFileSync(args.receiptPath, `${JSON.stringify(finalized, null, 2)}\n`)
  process.stdout.write(`${args.receiptPath}\n`)
}

function verify(args) {
  requireClean(args.releaseRoot)
  const release = inspectRelease(args.releaseRoot, args.tag)
  const receipt = readReceipt(args.receiptPath)
  if (receipt.status !== 'verified') fail(`Recovery receipt status is ${String(receipt.status)}; expected verified`)
  const artifact = artifactDigests(args.artifactPath)
  requireReceiptIdentity(receipt, args, release, artifact)
  requireArtifactIdentity(args.artifactPath, release)
  if (JSON.stringify(receipt.validations) !== JSON.stringify(expectedValidations('passed'))) {
    fail('Recovery receipt validation set does not match the required passing commands')
  }
  process.stdout.write(`${receipt.artifact.integrity}\n`)
}

try {
  const args = parseArgs(process.argv.slice(2))
  if (args.mode === 'prepare') prepare(args)
  else if (args.mode === 'finalize') finalize(args)
  else verify(args)
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
  process.exit(1)
}
