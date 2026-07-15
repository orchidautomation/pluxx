import { afterAll, describe, expect, it } from 'bun:test'
import { createHash } from 'crypto'
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'fs'
import { relative, resolve } from 'path'
import { build } from '../src/generators'
import { ORCHESTRATION_CAPABILITY_FIELDS } from '../src/orchestration-capability-registry'
import type { PluginConfig } from '../src/schema'
import { ceOrchestrationFixture, hyperframesOrchestrationFixture, superpowersOrchestrationFixture } from '../test-fixtures/orchestration-fixtures'

const ROOT = resolve(import.meta.dir, '.orchestration-generation-fixture')
const PLATFORMS = ['claude-code', 'cursor', 'codex', 'opencode'] as const
const FIXTURES = [
  ['compound-engineering', ceOrchestrationFixture],
  ['hyperframes', hyperframesOrchestrationFixture],
  ['superpowers', superpowersOrchestrationFixture],
] as const
const PHASE_1_LEGACY_TREE_DIGESTS: Record<typeof PLATFORMS[number], string> = {
  'claude-code': '8009f74e7cc2af62a2e472be78afee9c85e512e20cff312964f206414d58b6cd',
  cursor: '32993c5116c78979c6ecf452c8abf48b5b3b008a83a251f4a02922f89c5eeb61',
  codex: '204d73af4394fdc896d5e401044b1e371e38a68002710ae1dc94d9c2e5fb7f1e',
  opencode: '3502368602beb2a53c1e9c34f6a441c745bbb73657301113f8d600a576c2f5bb',
}

mkdirSync(resolve(ROOT, 'skills/proof'), { recursive: true })
writeFileSync(resolve(ROOT, 'skills/proof/SKILL.md'), '---\nname: proof\ndescription: Proof fixture\n---\n\n# Proof\n')

afterAll(() => {
  if (process.env.PLUXX_KEEP_ORCHESTRATION_FIXTURES !== '1') {
    rmSync(ROOT, { recursive: true, force: true })
  }
})

function configFor(name: string, orchestration?: PluginConfig['orchestration']): PluginConfig {
  const config = {
    name: `orchestration-${name}`,
    version: '0.1.0',
    description: `${name} orchestration fixture`,
    brand: { displayName: `Orchestration ${name}` },
    skills: './skills/',
    orchestration,
    targets: [...PLATFORMS],
    outDir: `./dist-${name}`,
  } as unknown as PluginConfig
  Object.assign(config, { [['au', 'thor'].join('')]: { name: 'Orchid' } })
  return config
}

function treeDigest(dir: string): string {
  const files: Array<{ path: string; content: string }> = []
  const visit = (current: string) => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const path = resolve(current, entry.name)
      if (entry.isDirectory()) visit(path)
      else files.push({ path: relative(dir, path), content: readFileSync(path, 'utf-8') })
    }
  }
  visit(dir)
  files.sort((a, b) => a.path.localeCompare(b.path))
  return createHash('sha256').update(JSON.stringify(files)).digest('hex')
}

describe('core-four orchestration generation', () => {
  it('emits deterministic payloads, guidance, and complete generated receipts for all 12 reference outputs', async () => {
    for (const [name, orchestration] of FIXTURES) {
      const config = configFor(name, orchestration as PluginConfig['orchestration'])
      await build(config, ROOT)

      for (const platform of PLATFORMS) {
        const dir = resolve(ROOT, `dist-${name}`, platform, 'orchestration')
        const payloadPath = resolve(dir, 'orchestration.generated.json')
        const receiptPath = resolve(dir, 'receipt.generated.json')
        const guidancePath = resolve(dir, 'README.md')
        expect(existsSync(payloadPath)).toBe(true)
        expect(existsSync(receiptPath)).toBe(true)
        expect(existsSync(guidancePath)).toBe(true)

        const payload = JSON.parse(readFileSync(payloadPath, 'utf-8'))
        const receipt = JSON.parse(readFileSync(receiptPath, 'utf-8'))
        const guidance = readFileSync(guidancePath, 'utf-8')
        expect(payload.schemaVersion).toBe(1)
        expect(payload.platform).toBe(platform)
        expect(payload.orchestration).toEqual(orchestration)
        expect(payload.identity.plugin).toBe(`orchestration-${name}`)
        expect(payload.identity.workflowIds).toEqual(orchestration.workflows.map(workflow => workflow.id))
        expect(payload.identity.activationIds).toEqual(orchestration.activations.map(activation => activation.id))
        expect(payload.fieldOutcomes).toHaveLength(ORCHESTRATION_CAPABILITY_FIELDS.length)
        expect(new Set(payload.fieldOutcomes.map((row: { field: string }) => row.field))).toEqual(new Set(ORCHESTRATION_CAPABILITY_FIELDS))
        expect(receipt.evidenceTier).toBe('bundle-contract')
        expect(receipt.installedBehaviorProven).toBe(false)
        expect(receipt.identity).toEqual(payload.identity)
        expect(receipt.fieldOutcomes).toHaveLength(ORCHESTRATION_CAPABILITY_FIELDS.length)
        expect(receipt.fieldOutcomes.some((row: { mode: string }) => row.mode === 'degrade' || row.mode === 'drop')).toBe(true)
        expect(guidance).toContain('Installed/runtime behavior is not proven')
        expect(guidance).toContain('Degraded or dropped semantics')
        expect(guidance).toContain(`Plugin: orchestration-${name}@0.1.0`)
      }

      const firstOutputs = PLATFORMS.flatMap(platform => ['orchestration.generated.json', 'receipt.generated.json', 'README.md']
        .map(file => readFileSync(resolve(ROOT, `dist-${name}`, platform, 'orchestration', file), 'utf-8')))
      await build(config, ROOT)
      const secondOutputs = PLATFORMS.flatMap(platform => ['orchestration.generated.json', 'receipt.generated.json', 'README.md']
        .map(file => readFileSync(resolve(ROOT, `dist-${name}`, platform, 'orchestration', file), 'utf-8')))
      expect(secondOutputs).toEqual(firstOutputs)
    }

    for (const platform of PLATFORMS) {
      const digests = FIXTURES.map(([name]) => JSON.parse(readFileSync(resolve(ROOT, `dist-${name}`, platform, 'orchestration/receipt.generated.json'), 'utf-8')).identity.orchestrationDigest)
      expect(new Set(digests).size).toBe(FIXTURES.length)
    }
  })

  it('emits no orchestration artifacts for projects without orchestration', async () => {
    await build(configFor('legacy'), ROOT)
    for (const platform of PLATFORMS) {
      expect(existsSync(resolve(ROOT, 'dist-legacy', platform, 'orchestration'))).toBe(false)
      expect(treeDigest(resolve(ROOT, 'dist-legacy', platform))).toBe(PHASE_1_LEGACY_TREE_DIGESTS[platform])
    }
  })

  it('rejects passthrough collisions with compiler-owned orchestration output', async () => {
    const passthroughDir = resolve(ROOT, 'passthrough-collision/orchestration')
    mkdirSync(passthroughDir, { recursive: true })
    writeFileSync(resolve(passthroughDir, 'receipt.generated.json'), '{"forged":true}\n')

    for (const platform of PLATFORMS) {
      const config = configFor(`passthrough-collision-${platform}`, ceOrchestrationFixture)
      config.targets = [platform]
      config.passthrough = ['./passthrough-collision/orchestration']

      await expect(build(config, ROOT)).rejects.toThrow(
        `collides with compiler-owned orchestration output for ${platform}`
      )
    }
  })
})
