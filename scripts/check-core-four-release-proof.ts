import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { resolve } from 'path'
import { fileURLToPath } from 'url'
import { dirname } from 'path'
import { validateCoreFourReleaseProof } from '../src/core-four-release-proof'
import { renderCompatibilityMatrixMarkdown, renderCompatibilityMatrixMdx } from '../src/compatibility/matrix'
import { replaceGeneratedCoreFourPrimitiveSection } from '../src/compatibility/core-four-primitives'
import { summarizeOrchestrationRuntimeReceipts } from '../src/orchestration-runtime-proof'
import { stableStringify } from '../src/stable-json'
import { distributionAdjunctFixtures } from '../test-fixtures/distribution-adjunct-fixtures'
import { createHash } from 'crypto'
import { spawn } from 'child_process'
import { OrchestrationSchema } from '../src/orchestration'
import { detectDistributionAdjuncts } from '../src/cli/migrate-adjuncts'
import { getDistributionAdjunctOutcome } from '../src/distribution-adjuncts'
import {
  ceOrchestrationFixture,
  hyperframesOrchestrationFixture,
  superpowersOrchestrationFixture,
} from '../test-fixtures/orchestration-fixtures'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
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

function loadCheckedReceipts(): unknown[] {
  return FIXTURES.flatMap(fixture => PLATFORMS.map(platform => JSON.parse(readFileSync(resolve(
    ROOT,
    'tests/fixtures/orchestration-runtime-receipts',
    fixture,
    `${platform}.json`,
  ), 'utf-8'))))
}

function assertCompatibilityCurrent(receipts: unknown[]): void {
  const compatibility = readFileSync(resolve(ROOT, 'docs/compatibility.md'), 'utf-8')
  if (compatibility !== renderCompatibilityMatrixMarkdown()) throw new Error('docs/compatibility.md is stale against current compiler registries.')
  const siteCompatibility = readFileSync(resolve(ROOT, 'site/how-it-works/compatibility-limits.mdx'), 'utf-8')
  if (siteCompatibility !== renderCompatibilityMatrixMdx()) throw new Error('Public compatibility output is stale against current compiler registries.')
  const proofSummary = summarizeOrchestrationRuntimeReceipts(receipts)
  for (const relativePath of ['docs/core-four-primitive-matrix.md', 'site/overview/core-four-primitive-matrix.mdx']) {
    const current = readFileSync(resolve(ROOT, relativePath), 'utf-8')
    if (replaceGeneratedCoreFourPrimitiveSection(current, proofSummary) !== current) {
      throw new Error(`${relativePath} is stale against current compiler registries and receipts.`)
    }
  }
}

function assertMigrationCompatibilityCurrent(): void {
  const root = mkdtempSync(resolve(tmpdir(), 'pluxx-core-four-migration-gate-'))
  const write = (path: string, content: string, mode?: number): string => {
    const absolute = resolve(root, path)
    mkdirSync(dirname(absolute), { recursive: true })
    writeFileSync(absolute, content, mode === undefined ? undefined : { mode })
    return absolute
  }
  try {
    const detections = [
      { platform: 'claude-code' as const, manifestPath: write('.claude-plugin/plugin.json', '{"name":"migration-proof","version":"1.0.0"}\n') },
      { platform: 'cursor' as const, manifestPath: write('.cursor-plugin/plugin.json', '{"name":"migration-proof","version":"1.0.0"}\n') },
      { platform: 'codex' as const, manifestPath: write('.codex-plugin/plugin.json', '{"name":"migration-proof","version":"1.0.0"}\n') },
      { platform: 'opencode' as const, manifestPath: write('package.json', '{"name":"migration-proof","version":"1.0.0","main":"./.opencode/plugins/migration-proof.js"}\n') },
    ]
    write('.claude-plugin/marketplace.json', '{"plugins":[]}\n')
    write('.cursor-plugin/marketplace.json', '{"plugins":[]}\n')
    write('.agents/plugins/marketplace.json', '{"plugins":[]}\n')
    write('.compound-engineering/config.local.example.yaml', 'example: true\n')
    write('.opencode/plugins/migration-proof.js', 'export default {}\n', 0o755)
    const derive = () => detectDistributionAdjuncts(root, detections, { name: 'migration-proof', version: '1.0.0' })
    const first = derive()
    const second = derive()
    if (!first || stableStringify(first) !== stableStringify(second)
      || first.provenance.evidenceTier !== 'migrated-source-tree'
      || first.provenance.revision !== `source-tree:${first.provenance.digest}`) {
      throw new Error('Core-four migration compatibility is stale or non-deterministic.')
    }
    const expectedRows: Record<string, { digest: string; executable: boolean; modes: readonly string[] }> = {
      'claude-code-marketplace-catalog': { digest: '4bdeb7d6b25302ad97a240377a909ff52cbfdd4990ca1c12948828d2cfcd64d7', executable: false, modes: ['preserve', 'drop', 'drop', 'drop'] },
      'claude-code-plugin-manifest': { digest: '0dbde2cb34ce6feef4618510834234f825fd855e65addccf510d2a2f720358af', executable: false, modes: ['preserve', 'translate', 'translate', 'translate'] },
      'codex-agents-marketplace-catalog': { digest: '4bdeb7d6b25302ad97a240377a909ff52cbfdd4990ca1c12948828d2cfcd64d7', executable: false, modes: ['drop', 'drop', 'preserve', 'drop'] },
      'codex-plugin-manifest': { digest: '0dbde2cb34ce6feef4618510834234f825fd855e65addccf510d2a2f720358af', executable: false, modes: ['translate', 'translate', 'preserve', 'translate'] },
      'cursor-marketplace-catalog': { digest: '4bdeb7d6b25302ad97a240377a909ff52cbfdd4990ca1c12948828d2cfcd64d7', executable: false, modes: ['drop', 'preserve', 'drop', 'drop'] },
      'cursor-plugin-manifest': { digest: '0dbde2cb34ce6feef4618510834234f825fd855e65addccf510d2a2f720358af', executable: false, modes: ['translate', 'preserve', 'translate', 'translate'] },
      'local-config-schema': { digest: 'bac769bc4967a2962bd760cecca1cd23ee610ad03da4247abdf2b7249747642a', executable: false, modes: ['preserve', 'preserve', 'preserve', 'preserve'] },
      'opencode-package-identity': { digest: 'b7e0f97bc93021c969a26d0464a5649d1b3b847979aba44eb927b05939e858e5', executable: false, modes: ['translate', 'translate', 'translate', 'translate'] },
      'opencode-plugin-entrypoint': { digest: 'fc00d19bc94e10c24f07bd9be1c2bb24d4978856963c5a68745338ecbf131dfc', executable: true, modes: ['drop', 'drop', 'drop', 'preserve'] },
    }
    if (first.items.length !== Object.keys(expectedRows).length) {
      throw new Error('Core-four migration compatibility recovered an unexpected inventory count.')
    }
    for (const item of first.items) {
      const expected = expectedRows[item.id]
      if (!expected || item.digest !== expected.digest || item.executable !== expected.executable) {
        throw new Error(`Core-four migration compatibility drifted for ${item.id}.`)
      }
      const actualModes = PLATFORMS.map(platform => getDistributionAdjunctOutcome(platform, item).mode)
      if (stableStringify(actualModes) !== stableStringify(expected.modes)) {
        throw new Error(`Core-four migration registry outcomes drifted for ${item.id}.`)
      }
    }
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
}

async function runCase(
  fixture: typeof FIXTURES[number],
  platform: typeof PLATFORMS[number],
  installKind: 'symlink' | 'copy',
  pass: number,
): Promise<unknown> {
  const root = mkdtempSync(resolve(tmpdir(), `pluxx-core-four-gate-${fixture}-${platform}-${installKind}-${pass}-`))
  const home = resolve(root, 'home')
  const temporary = resolve(root, 'tmp')
  const output = resolve(root, 'receipt.json')
  mkdirSync(home, { recursive: true })
  mkdirSync(temporary, { recursive: true })
  try {
    const proc = spawn(process.execPath, [
      '--import',
      'tsx',
      resolve(ROOT, 'scripts/run-orchestration-runtime-proof.ts'),
      '--fixture', fixture,
      '--platform', platform,
      '--workspace', resolve(root, 'workspace'),
      '--output', output,
      '--install-kind', installKind,
    ], {
      cwd: ROOT,
      env: {
        PATH: process.env.PATH ?? '',
        HOME: home,
        CODEX_HOME: resolve(home, '.codex'),
        XDG_CONFIG_HOME: resolve(home, '.config'),
        TMPDIR: temporary,
        NO_COLOR: '1',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    let stdout = ''
    let stderr = ''
    proc.stdout.setEncoding('utf-8')
    proc.stderr.setEncoding('utf-8')
    proc.stdout.on('data', chunk => { stdout += chunk })
    proc.stderr.on('data', chunk => { stderr += chunk })
    const exitCode = await new Promise<number | null>((resolveExit, reject) => {
      proc.once('error', reject)
      proc.once('close', resolveExit)
    })
    if (exitCode !== 0) throw new Error(`${fixture}/${platform}/${installKind} replay failed: ${stderr || stdout}`)
    return JSON.parse(readFileSync(output, 'utf-8'))
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
}

async function replayPortfolio(kind: 'symlink' | 'copy', pass: number): Promise<unknown[]> {
  return Promise.all(FIXTURES.flatMap(fixture => PLATFORMS.map(platform => runCase(fixture, platform, kind, pass))))
}

const checked = loadCheckedReceipts()
const summary = validateCoreFourReleaseProof({ receipts: checked, sources: distributionAdjunctFixtures, orchestrationExpectations: ORCHESTRATION_EXPECTATIONS })
assertCompatibilityCurrent(checked)
assertMigrationCompatibilityCurrent()

let replay = 'skipped-by-explicit-test-flag'
if (!process.argv.includes('--skip-replay')) {
  const [symlinkFirst, symlinkSecond] = await Promise.all([replayPortfolio('symlink', 1), replayPortfolio('symlink', 2)])
  if (stableStringify(symlinkFirst) !== stableStringify(symlinkSecond)
    || stableStringify(symlinkFirst) !== stableStringify(checked)) {
    throw new Error('The two symlink-root 12-case replays do not match the checked receipt portfolio.')
  }
  validateCoreFourReleaseProof({ receipts: symlinkFirst, sources: distributionAdjunctFixtures, orchestrationExpectations: ORCHESTRATION_EXPECTATIONS })

  const [copyFirst, copySecond] = await Promise.all([replayPortfolio('copy', 1), replayPortfolio('copy', 2)])
  if (stableStringify(copyFirst) !== stableStringify(copySecond)) {
    throw new Error('The two copied-install 12-case replays are not deterministic.')
  }
  validateCoreFourReleaseProof({ receipts: copyFirst, sources: distributionAdjunctFixtures, orchestrationExpectations: ORCHESTRATION_EXPECTATIONS })
  replay = 'two-clean-12-case-symlink-and-copy-replays'
}

process.stdout.write(`${JSON.stringify({ ok: true, ...summary, migrationCompatibility: 'current-registry-derived', replay }, null, 2)}\n`)
