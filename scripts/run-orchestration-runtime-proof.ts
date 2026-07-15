import { createHash } from 'crypto'
import { existsSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from 'fs'
import { dirname, resolve } from 'path'
import { build } from '../src/generators'
import { installPlugin, planInstallPlugin, resolveInstalledConsumerPath } from '../src/cli/install'
import { verifyInstall } from '../src/cli/verify-install'
import { hashInstallBundle, listInstallOwnershipDrift, readInstallOwnership } from '../src/install-ownership'
import {
  buildOrchestrationRuntimeReceipt,
  type OrchestrationProofFact,
} from '../src/orchestration-runtime-proof'
import { validateReleaseOwnershipPreimage } from '../src/core-four-release-proof'
import { PluginConfigSchema } from '../src/schema'
import { stableStringify } from '../src/stable-json'
import {
  ceOrchestrationFixture,
  hyperframesOrchestrationFixture,
  superpowersOrchestrationFixture,
} from '../test-fixtures/orchestration-fixtures'
import { getDistributionAdjunctFixture } from '../test-fixtures/distribution-adjunct-fixtures'

const FIXTURES = {
  'compound-engineering': ceOrchestrationFixture,
  hyperframes: hyperframesOrchestrationFixture,
  superpowers: superpowersOrchestrationFixture,
} as const
const PLATFORMS = ['claude-code', 'cursor', 'codex', 'opencode'] as const

function readArgument(name: string): string {
  const index = process.argv.indexOf(name)
  const value = index >= 0 ? process.argv[index + 1] : undefined
  if (!value) throw new Error(`Missing required ${name} argument.`)
  return value
}

function readOptionalArgument(name: string): string | undefined {
  const index = process.argv.indexOf(name)
  return index >= 0 ? process.argv[index + 1] : undefined
}

function sha256(path: string): string {
  return createHash('sha256').update(readFileSync(path)).digest('hex')
}

function stableOwnershipDigest(
  ownership: NonNullable<ReturnType<typeof readInstallOwnership>>,
  preimage: {
    logicalInstallPath: string
    generatedRootBinding: string
    bundleDigest: string
    receiptPath: string
    receiptDigest: string
    ownedSurfaceCount: number
  },
): string {
  const evidence = {
    schema: ownership.schema,
    pluginName: ownership.pluginName,
    platform: ownership.platform,
    kind: ownership.kind,
    surface: ownership.surface ?? null,
    installPath: preimage.logicalInstallPath,
    symlinkTarget: ownership.kind === 'symlink' ? preimage.generatedRootBinding : null,
    entries: ownership.entries,
    bundleDigest: preimage.bundleDigest,
    receiptPath: preimage.receiptPath,
    receiptDigest: preimage.receiptDigest,
    ownedSurfaceCount: preimage.ownedSurfaceCount,
  }
  return createHash('sha256').update(stableStringify(evidence)).digest('hex')
}

function manifestPath(platform: typeof PLATFORMS[number]): string {
  if (platform === 'claude-code') return '.claude-plugin/plugin.json'
  if (platform === 'cursor') return '.cursor-plugin/plugin.json'
  if (platform === 'codex') return '.codex-plugin/plugin.json'
  return 'package.json'
}

function normalizedInstallPath(platform: typeof PLATFORMS[number], pluginName: string): string {
  if (platform === 'claude-code') return `~/.claude/plugins/${pluginName}`
  if (platform === 'cursor') return `~/.cursor/plugins/local/${pluginName}`
  if (platform === 'codex') return `~/.codex/plugins/${pluginName}`
  return `~/.config/opencode/plugins/${pluginName}`
}

async function main(): Promise<void> {
  const fixture = readArgument('--fixture') as keyof typeof FIXTURES
  const platform = readArgument('--platform') as typeof PLATFORMS[number]
  const workspace = resolve(readArgument('--workspace'))
  const output = resolve(readArgument('--output'))
  const installKind = readOptionalArgument('--install-kind') ?? 'symlink'
  if (!(fixture in FIXTURES)) throw new Error(`Unknown orchestration fixture: ${fixture}`)
  if (!(PLATFORMS as readonly string[]).includes(platform)) throw new Error(`Unsupported proof platform: ${platform}`)
  if (installKind !== 'symlink' && installKind !== 'copy') throw new Error(`Unsupported proof install kind: ${installKind}`)

  mkdirSync(resolve(workspace, 'skills/proof'), { recursive: true })
  mkdirSync(dirname(output), { recursive: true })
  writeFileSync(
    resolve(workspace, 'skills/proof/SKILL.md'),
    '---\nname: proof\ndescription: Isolated orchestration proof fixture\n---\n\n# Proof\n',
  )

  const pluginName = `orchestration-${fixture}`
  const adjunctFixture = getDistributionAdjunctFixture(fixture)
  const config = PluginConfigSchema.parse({
    name: pluginName,
    version: '0.1.0',
    description: `${fixture} orchestration fixture`,
    brand: { displayName: `Orchestration ${fixture}` },
    [['au', 'thor'].join('')]: { name: 'Orchid' },
    skills: './skills/',
    orchestration: FIXTURES[fixture],
    distribution: { adjuncts: adjunctFixture },
    targets: [platform],
    outDir: './dist',
  })

  await build(config, workspace, { targets: [platform] })
  const distDir = resolve(workspace, 'dist')
  await installPlugin(distDir, pluginName, [platform], {
    config,
    quiet: true,
    useNativeClaudeInstall: false,
    installKind,
  })
  const verification = await verifyInstall(config, { rootDir: workspace, targets: [platform] })
  if (!verification.ok || verification.checks.length !== 1 || !verification.checks[0]?.installed) {
    throw new Error(`Isolated ${fixture}/${platform} install verification failed: ${JSON.stringify(verification)}`)
  }

  const target = planInstallPlugin(distDir, pluginName, [platform])[0]
  if (!target) throw new Error(`Missing install plan for ${platform}.`)
  const consumerPath = resolveInstalledConsumerPath(target, pluginName)
  const consumerRealPath = realpathSync(consumerPath)
  const installedBundleDigest = hashInstallBundle(consumerRealPath)
  const installedManifest = resolve(consumerPath, manifestPath(platform))
  if (!existsSync(installedManifest)) throw new Error(`Installed manifest is missing: ${installedManifest}`)
  const generatedReceiptPath = resolve(distDir, platform, 'orchestration/receipt.generated.json')
  const generatedReceipt = JSON.parse(readFileSync(generatedReceiptPath, 'utf-8'))
  const generatedReceiptDigest = sha256(generatedReceiptPath)
  if (generatedReceipt.identity?.plugin !== pluginName || generatedReceipt.identity?.version !== config.version) {
    throw new Error(`Generated receipt identity does not match ${pluginName}@${config.version}.`)
  }
  const adjunctReceiptPath = resolve(distDir, platform, 'distribution/adjuncts.receipt.json')
  const adjunctReceipt = JSON.parse(readFileSync(adjunctReceiptPath, 'utf-8'))
  const installedAdjunctReceiptPath = resolve(consumerPath, 'distribution/adjuncts.receipt.json')
  const generatedAdjunctReceiptDigest = sha256(adjunctReceiptPath)
  const installedAdjunctReceiptDigest = sha256(installedAdjunctReceiptPath)
  if (installedAdjunctReceiptDigest !== generatedAdjunctReceiptDigest) {
    throw new Error(`Installed adjunct receipt does not match the generated receipt for ${fixture}/${platform}.`)
  }
  const ownership = readInstallOwnership(pluginName, platform, target.pluginDir)
  if (!ownership) throw new Error(`Missing install ownership for ${fixture}/${platform}.`)
  const ownershipDrift = listInstallOwnershipDrift(ownership)
  if (ownershipDrift.length > 0) throw new Error(`Install ownership drift for ${fixture}/${platform}: ${ownershipDrift.join('; ')}`)
  const adjunctOwnedEntry = ownership.entries.find(entry => entry.path === 'distribution/adjuncts.receipt.json')
  const receiptOwnedByCopy = adjunctOwnedEntry?.sha256 === installedAdjunctReceiptDigest
  const receiptOwnedByBundleSymlink = ownership.kind === 'symlink'
    && consumerRealPath === realpathSync(resolve(distDir, platform))
  if (!receiptOwnedByCopy && !receiptOwnedByBundleSymlink) {
    throw new Error(`Install ownership does not bind the adjunct receipt for ${fixture}/${platform}.`)
  }
  const ownershipPreimage = validateReleaseOwnershipPreimage({
    ownership,
    expectedInstallPath: consumerPath,
    expectedSourceRoot: resolve(distDir, platform),
    expectedBundleDigest: hashInstallBundle(resolve(distDir, platform)),
    receiptPath: 'distribution/adjuncts.receipt.json',
    receiptDigest: installedAdjunctReceiptDigest,
  })
  const ownershipDigest = stableOwnershipDigest(ownership, {
    logicalInstallPath: normalizedInstallPath(platform, pluginName),
    generatedRootBinding: `dist/${platform}`,
    bundleDigest: installedBundleDigest,
    receiptPath: 'distribution/adjuncts.receipt.json',
    receiptDigest: installedAdjunctReceiptDigest,
    ownedSurfaceCount: ownershipPreimage.ownedSurfaceCount,
  })

  const installedEvidenceIds = ['installed-tree-sha256', 'installed-manifest', 'adjunct-receipt-sha256', 'install-ownership-sha256']
  const discoveryFacts: OrchestrationProofFact[] = [{
    id: 'host-discovery-not-invoked',
    kind: 'assertion',
    value: `The isolated ${platform} install did not invoke the native host discovery process`,
  }]
  if (platform === 'codex') {
    const marketplacePath = resolve(process.env.HOME ?? '', '.agents/plugins/marketplace.json')
    const marketplace = JSON.parse(readFileSync(marketplacePath, 'utf-8')) as {
      plugins?: Array<{ name?: string; source?: { path?: string } }>
    }
    const entry = marketplace.plugins?.find(candidate => candidate.name === pluginName)
    if (entry?.source?.path !== `./.codex/plugins/${pluginName}`) {
      throw new Error(`Codex marketplace does not discover ${pluginName} at its isolated install path.`)
    }
    installedEvidenceIds.push('codex-marketplace-sha256')
    discoveryFacts.push({ id: 'codex-marketplace-sha256', kind: 'sha256', value: sha256(marketplacePath) })
  } else if (platform === 'opencode') {
    const entryPath = `${consumerPath}.ts`
    if (!existsSync(entryPath)) throw new Error(`OpenCode discovery entry is missing: ${entryPath}`)
    installedEvidenceIds.push('opencode-entry-sha256')
    discoveryFacts.push({ id: 'opencode-entry-sha256', kind: 'sha256', value: sha256(entryPath) })
  }

  const receipt = buildOrchestrationRuntimeReceipt({
    fixture,
    generatedReceipt,
    host: {
      platform,
      version: {
        status: 'environment-unavailable',
        value: null,
        detail: 'Native host CLI deliberately not invoked; the proof excludes live user state.',
      },
      probe: {
        name: 'pluxx-isolated-install-harness',
        version: '1',
        command: 'fixture-owned build, installPlugin, and verifyInstall against an isolated fake home',
      },
    },
    installedPath: normalizedInstallPath(platform, pluginName),
    evidence: {
      generated: { status: 'proven', evidenceIds: ['generated-receipt-sha256'] },
      installed: { status: 'proven', evidenceIds: installedEvidenceIds },
      discovered: { status: 'environment-unavailable', evidenceIds: ['host-discovery-not-invoked'] },
      activated: { status: 'unsupported', evidenceIds: ['no-executable-orchestration-entrypoint'] },
      behavioral: { status: 'environment-unavailable', evidenceIds: ['native-host-not-invoked'] },
    },
    facts: [
      { id: 'generated-receipt-sha256', kind: 'sha256', value: generatedReceiptDigest },
      { id: 'installed-tree-sha256', kind: 'sha256', value: installedBundleDigest },
      { id: 'installed-manifest', kind: 'assertion', value: `${manifestPath(platform)} exists and matches the verified isolated bundle` },
      { id: 'adjunct-receipt-sha256', kind: 'sha256', value: installedAdjunctReceiptDigest },
      { id: 'install-ownership-sha256', kind: 'sha256', value: ownershipDigest },
      ...discoveryFacts,
      { id: 'no-executable-orchestration-entrypoint', kind: 'assertion', value: 'No generated skill, command, hook, agent, manifest field, or runtime loader consumes orchestration.generated.json' },
      { id: 'native-host-not-invoked', kind: 'assertion', value: 'Activation, dispatch, lifecycle, child-environment, control, repair, resume, synthesis, cancellation, and fallback behavior remain unavailable or unsupported' },
    ],
    fieldEvidence: {},
    adjuncts: {
      receipt: adjunctReceipt,
      installOwnership: {
        recordDigest: ownershipDigest,
        ownershipKind: ownershipPreimage.kind,
        ownedSurfaceCount: ownershipPreimage.ownedSurfaceCount,
        receiptPath: 'distribution/adjuncts.receipt.json',
        receiptDigest: installedAdjunctReceiptDigest,
      },
    },
  })

  writeFileSync(output, `${JSON.stringify(receipt, null, 2)}\n`)
}

await main()
