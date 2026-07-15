import { createHash } from 'crypto'
import { afterEach, describe, expect, it } from 'bun:test'
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from 'fs'
import { tmpdir } from 'os'
import { dirname, resolve } from 'path'
import {
  computeDistributionAdjunctInventoryDigest,
  publishDistributionAdjuncts,
  validateDistributionAdjunctReceipt,
} from '../src/distribution-adjuncts'
import { stableStringify } from '../src/stable-json'

const roots: string[] = []
const sha256 = (value: string | Buffer) => createHash('sha256').update(value).digest('hex')

function bindDigest<T extends { provenance: { digest: string }; items: readonly unknown[] }>(input: T): T {
  return {
    ...input,
    provenance: { ...input.provenance, digest: computeDistributionAdjunctInventoryDigest(input.items) },
  }
}

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true })
})

function makeRoot(): string {
  const root = mkdtempSync(resolve(tmpdir(), 'pluxx-adjunct-generation-'))
  roots.push(root)
  return root
}

describe('distribution adjunct publication', () => {
  it('preserves native manifest guards and portable helper modes transactionally', () => {
    const root = makeRoot()
    const outDir = resolve(root, 'dist/codex')
    const manifestSource = JSON.stringify({
      name: 'superpowers', version: '6.1.1', hooks: {}, interface: { displayName: 'Superpowers' },
    }, null, 2) + '\n'
    const helper = '#!/usr/bin/env bash\necho helper\n'
    const manifestPath = resolve(root, '.codex-plugin/plugin.json')
    const helperPath = resolve(root, 'skills/subagent-driven-development/scripts/task-brief')
    mkdirSync(dirname(manifestPath), { recursive: true })
    mkdirSync(dirname(helperPath), { recursive: true })
    mkdirSync(resolve(outDir, '.codex-plugin'), { recursive: true })
    writeFileSync(manifestPath, manifestSource)
    writeFileSync(helperPath, helper)
    chmodSync(helperPath, 0o755)
    writeFileSync(resolve(outDir, '.codex-plugin/plugin.json'), JSON.stringify({
      name: 'superpowers', version: '6.1.1', skills: './skills/',
    }, null, 2) + '\n')

    const receipt = publishDistributionAdjuncts(bindDigest({
      provenance: {
        fixture: 'superpowers', plugin: 'superpowers', version: '6.1.1',
        revision: 'd884ae04edebef577e82ff7c4e143debd0bbec99', digest: 'a'.repeat(64),
      },
      items: [
        {
          id: 'codex-manifest', kind: 'identity-manifest', source: '.codex-plugin/plugin.json',
          target: '.codex-plugin/plugin.json', sourcePlatform: 'codex', canonicalOwner: 'distribution',
          digest: sha256(manifestSource),
        },
        {
          id: 'task-brief-helper', kind: 'helper-payload',
          source: 'skills/subagent-driven-development/scripts/task-brief',
          target: 'skills/subagent-driven-development/scripts/task-brief', sourcePlatform: 'shared',
          canonicalOwner: 'runtime', digest: sha256(helper), executable: true,
        },
      ],
    }), 'codex', root, outDir)

    const manifest = JSON.parse(readFileSync(resolve(outDir, '.codex-plugin/plugin.json'), 'utf-8'))
    expect(manifest).toMatchObject({ name: 'superpowers', version: '6.1.1', hooks: {}, skills: './skills/' })
    expect(statSync(resolve(outDir, 'skills/subagent-driven-development/scripts/task-brief')).mode & 0o111).not.toBe(0)
    expect(receipt.identity).toMatchObject({ fixture: 'superpowers', plugin: 'superpowers', version: '6.1.1' })
    expect(receipt.inventory).toHaveLength(2)
    expect(receipt.ownedOutputs.map(output => output.path)).toEqual([
      '.codex-plugin/plugin.json',
      'skills/subagent-driven-development/scripts/task-brief',
    ])
    expect(receipt.ownedOutputs.every(output => /^[a-f0-9]{64}$/.test(output.digest))).toBe(true)
    expect(receipt.compilerOutputDigest).toMatch(/^[a-f0-9]{64}$/)
    expect(JSON.parse(readFileSync(resolve(outDir, 'distribution/adjuncts.receipt.json'), 'utf-8'))).toEqual(receipt)
    expect(receipt.ownedOutputs[1]?.digest).toBe(sha256(helper))
  })

  it('validates every input before changing the output tree', () => {
    const root = makeRoot()
    const outDir = resolve(root, 'dist/codex')
    mkdirSync(outDir, { recursive: true })
    writeFileSync(resolve(outDir, 'sentinel.txt'), 'before\n')
    writeFileSync(resolve(root, 'payload.txt'), 'payload\n')

    expect(() => publishDistributionAdjuncts(bindDigest({
      provenance: {
        fixture: 'fixture', plugin: 'fixture', version: '1.0.0', revision: 'pinned', digest: 'a'.repeat(64),
      },
      items: [{
        id: 'bad-digest', kind: 'helper-payload', source: 'payload.txt', target: 'support/payload.txt',
        sourcePlatform: 'shared', canonicalOwner: 'runtime', digest: 'b'.repeat(64),
      }],
    }), 'codex', root, outDir)).toThrow('digest')

    expect(readFileSync(resolve(outDir, 'sentinel.txt'), 'utf-8')).toBe('before\n')
    expect(() => readFileSync(resolve(outDir, 'support/payload.txt'))).toThrow()
  })

  it('rejects inventory tampering even when enclosing receipt hashes are recomputed', () => {
    const root = makeRoot()
    const outDir = resolve(root, 'dist/codex')
    mkdirSync(outDir, { recursive: true })
    const source = bindDigest({
      provenance: {
        fixture: 'fixture', plugin: 'fixture', version: '1.0.0', revision: 'pinned', digest: 'a'.repeat(64),
      },
      items: [{
        id: 'source-only', kind: 'source-only-evidence' as const, source: 'release.yml', target: 'release.yml',
        sourcePlatform: 'source-only' as const, canonicalOwner: 'distribution' as const, digest: sha256('source\n'),
        availability: 'source-inspected' as const,
      }],
    })
    const receipt = publishDistributionAdjuncts(source, 'codex', root, outDir)
    const tampered = structuredClone(receipt)
    tampered.inventory[0]!.digest = 'f'.repeat(64)
    const { receiptDigest: _oldDigest, ...withoutDigest } = tampered
    tampered.receiptDigest = sha256(stableStringify(withoutDigest))

    expect(() => validateDistributionAdjunctReceipt(tampered)).toThrow('inventory digest mismatch')
  })

  it('refuses divergent manifest fields without partial output', () => {
    const root = makeRoot()
    const outDir = resolve(root, 'dist/codex')
    const source = JSON.stringify({ name: 'fixture', version: '1.0.0', nativePolicy: {} }, null, 2) + '\n'
    mkdirSync(resolve(root, 'native'), { recursive: true })
    mkdirSync(resolve(outDir, 'native'), { recursive: true })
    writeFileSync(resolve(root, 'native/manifest.json'), source)
    writeFileSync(resolve(outDir, 'native/manifest.json'), JSON.stringify({
      name: 'fixture', version: '1.0.0', nativePolicy: { enabled: true },
    }, null, 2) + '\n')

    expect(() => publishDistributionAdjuncts(bindDigest({
      provenance: {
        fixture: 'fixture', plugin: 'fixture', version: '1.0.0', revision: 'pinned', digest: 'a'.repeat(64),
      },
      items: [{
        id: 'native-manifest', kind: 'identity-manifest', source: 'native/manifest.json',
        target: 'native/manifest.json', sourcePlatform: 'codex', canonicalOwner: 'distribution',
        digest: sha256(source),
      }],
    }), 'codex', root, outDir)).toThrow('Ambiguous manifest field nativePolicy')

    expect(JSON.parse(readFileSync(resolve(outDir, 'native/manifest.json'), 'utf-8')).nativePolicy)
      .toEqual({ enabled: true })
  })

  it('refuses required unavailable metadata and divergent unowned collisions', () => {
    const root = makeRoot()
    const outDir = resolve(root, 'dist/codex')
    mkdirSync(resolve(outDir, 'assets'), { recursive: true })
    writeFileSync(resolve(root, 'logo.svg'), '<svg/>\n')
    writeFileSync(resolve(outDir, 'assets/logo.svg'), 'private\n')

    expect(() => publishDistributionAdjuncts(bindDigest({
      provenance: {
        fixture: 'fixture', plugin: 'fixture', version: '1.0.0', revision: 'pinned', digest: 'a'.repeat(64),
      },
      items: [{
        id: 'external-openai-metadata', kind: 'host-native-extension',
        source: 'skills/*/agents/openai.yaml', target: 'skills/*/agents/openai.yaml', sourcePlatform: 'codex',
        canonicalOwner: 'distribution', availability: 'external-unavailable', requiredForPublication: true,
      }],
    }), 'codex', root, outDir)).toThrow('unavailable')

    expect(() => publishDistributionAdjuncts(bindDigest({
      provenance: {
        fixture: 'fixture', plugin: 'fixture', version: '1.0.0', revision: 'pinned', digest: 'a'.repeat(64),
      },
      items: [{
        id: 'missing-shared-helper', kind: 'helper-payload', source: 'support/helper', target: 'support/helper',
        sourcePlatform: 'shared', canonicalOwner: 'runtime', availability: 'external-unavailable',
        requiredForPublication: true,
      }],
    }), 'codex', root, outDir)).toThrow('unavailable')

    expect(() => publishDistributionAdjuncts(bindDigest({
      provenance: {
        fixture: 'fixture', plugin: 'fixture', version: '1.0.0', revision: 'pinned', digest: 'a'.repeat(64),
      },
      items: [{
        id: 'logo', kind: 'helper-payload', source: 'logo.svg', target: 'assets/logo.svg',
        sourcePlatform: 'shared', canonicalOwner: 'runtime', digest: sha256('<svg/>\n'),
      }],
    }), 'codex', root, outDir)).toThrow('already compiler-owned')
  })

  it('refuses reserved, symlinked, and already compiler-owned targets', () => {
    const root = makeRoot()
    const external = makeRoot()
    const outDir = resolve(root, 'dist/codex')
    mkdirSync(outDir, { recursive: true })
    writeFileSync(resolve(root, 'payload.txt'), 'same\n')
    writeFileSync(resolve(outDir, 'owned.txt'), 'same\n')

    const source = (id: string, sourcePath: string, target: string) => bindDigest({
      provenance: {
        fixture: 'fixture', plugin: 'fixture', version: '1.0.0', revision: 'pinned', digest: 'a'.repeat(64),
      },
      items: [{
        id, kind: 'helper-payload' as const, source: sourcePath, target,
        sourcePlatform: 'shared' as const, canonicalOwner: 'runtime' as const, digest: sha256('same\n'),
      }],
    })

    expect(() => publishDistributionAdjuncts(
      source('reserved', 'payload.txt', 'distribution/adjuncts.receipt.json'),
      'codex', root, outDir,
    )).toThrow('reserved')
    expect(() => publishDistributionAdjuncts(
      source('already-owned', 'payload.txt', 'owned.txt'),
      'codex', root, outDir,
    )).toThrow('already compiler-owned')

    writeFileSync(resolve(external, 'payload.txt'), 'same\n')
    symlinkSync(external, resolve(root, 'linked-support'))
    expect(() => publishDistributionAdjuncts(
      source('symlinked-source', 'linked-support/payload.txt', 'support/payload.txt'),
      'codex', root, outDir,
    )).toThrow('symbolic-link')
    symlinkSync(resolve(external, 'payload.txt'), resolve(outDir, 'linked-target.txt'))
    expect(() => publishDistributionAdjuncts(
      source('symlinked-target', 'payload.txt', 'linked-target.txt'),
      'codex', root, outDir,
    )).toThrow('symbolic-link')
    expect(existsSync(resolve(outDir, 'distribution/adjuncts.receipt.json'))).toBe(false)
  })

  it('requires exact executable-mode parity in both directions', () => {
    const root = makeRoot()
    const outDir = resolve(root, 'dist/codex')
    mkdirSync(outDir, { recursive: true })
    writeFileSync(resolve(root, 'unexpected-executable'), '#!/bin/sh\n')
    chmodSync(resolve(root, 'unexpected-executable'), 0o755)
    const source = bindDigest({
      provenance: {
        fixture: 'fixture', plugin: 'fixture', version: '1.0.0', revision: 'pinned', digest: 'a'.repeat(64),
      },
      items: [{
        id: 'unexpected-executable', kind: 'helper-payload' as const,
        source: 'unexpected-executable', target: 'support/unexpected-executable',
        sourcePlatform: 'shared' as const, canonicalOwner: 'runtime' as const,
        digest: sha256('#!/bin/sh\n'), executable: false,
      }],
    })

    expect(() => publishDistributionAdjuncts(source, 'codex', root, outDir)).toThrow('exact source mode')
    expect(existsSync(resolve(outDir, 'distribution/adjuncts.receipt.json'))).toBe(false)
  })

  it('rolls payloads and receipt back as one transaction', () => {
    const root = makeRoot()
    const outDir = resolve(root, 'dist/codex')
    mkdirSync(outDir, { recursive: true })
    writeFileSync(resolve(root, 'payload.txt'), 'payload\n')
    const source = bindDigest({
      provenance: {
        fixture: 'fixture', plugin: 'fixture', version: '1.0.0', revision: 'pinned', digest: 'a'.repeat(64),
      },
      items: [{
        id: 'payload', kind: 'helper-payload' as const, source: 'payload.txt', target: 'support/payload.txt',
        sourcePlatform: 'shared' as const, canonicalOwner: 'runtime' as const, digest: sha256('payload\n'),
      }],
    })

    expect(() => publishDistributionAdjuncts(source, 'codex', root, outDir, undefined, {
      injectFailure(phase, detail) {
        if (phase === 'entry-applied' && detail === 'distribution/adjuncts.receipt.json') {
          throw new Error('injected receipt persistence failure')
        }
      },
    })).toThrow('Atomic mutation failed')
    expect(existsSync(resolve(outDir, 'support/payload.txt'))).toBe(false)
    expect(existsSync(resolve(outDir, 'distribution/adjuncts.receipt.json'))).toBe(false)
  })
})
