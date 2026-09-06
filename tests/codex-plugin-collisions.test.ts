import { describe, it, expect } from 'vitest'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { detectCodexPluginCollisions, inspectCodexPluginCollisions, renderCodexPluginDiagnostic } from '../src/codex-plugin-collisions'

const digest = (s: string) => createHash('sha256').update(s).digest('hex')
const requested = { name: 'proof', marketplace: 'personal', version: '1.0.0', sourcePath: '/synthetic/proof' }
const row = (marketplace = 'personal', version: string | null = '1.0.0', enabled = true, name = 'proof') => ({
  pluginId: `${name}@${marketplace}`, name, marketplaceName: marketplace, version, installed: true, enabled,
  source: { source: 'local', path: `/synthetic/${marketplace}/private-path-sentinel` },
})
const check = (...installed: unknown[]) => detectCodexPluginCollisions({ installed }, requested, digest)

describe('Codex enabled cross-marketplace names', () => {
  it('accepts the sanitized native 0.149.1 fixture', () => {
    const inventory = JSON.parse(readFileSync(new URL('../test-fixtures/codex-plugin-inventory/cli-0.149.1.json', import.meta.url), 'utf8'))
    expect(detectCodexPluginCollisions(inventory, { name: 'collision-proof', marketplace: 'requested', version: '1.0.0' }, digest))
      .toMatchObject({ code: 'same-name-cross-marketplace', requestedRegistration: 'enabled', totalConflicts: 1,
        conflicts: [{ selector: 'collision-proof@other', version: '1.0.0' }] })
  })
  it('keeps one selector, disabled conflicts and unrelated names clean', () => {
    expect(check(row())).toBeUndefined()
    expect(check(row(), row('other', '1.0.0', false), row('third', '1.0.0', true, 'unrelated'))).toBeUndefined()
  })
  it.each(['1.0.0', '0.9.0', null])('reports a collision independent of version %s', version => {
    const result = check(row(), row('other', version))!
    expect(result.code).toBe('same-name-cross-marketplace')
    expect(result.requested?.selector).toBe('proof@personal')
    expect(result.conflicts[0]).toMatchObject({ selector: 'proof@other', version })
    expect(result.requestedRegistration).toBe('enabled')
    expect(renderCodexPluginDiagnostic(result)).toContain('native plugin manager')
    expect(JSON.stringify(result)).not.toContain('private-path-sentinel')
  })
  it('does not hide a conflict when the requested selector is absent', () => {
    expect(check(row('other'))).toMatchObject({ code: 'same-name-cross-marketplace', requestedRegistration: 'absent' })
  })
  it('distinguishes an unregistered built bundle from ambiguous installed identity', () => {
    expect(detectCodexPluginCollisions({ installed: [] }, { name: 'proof' }, digest)).toBeUndefined()
    expect(detectCodexPluginCollisions({ installed: [] }, { name: 'proof', marketplace: '' }, digest)?.code).toBe('codex-plugin-inventory-unavailable')
    expect(detectCodexPluginCollisions({ installed: [row('other')] }, { name: 'proof' }, digest)?.code).toBe('codex-plugin-inventory-unavailable')
  })
  it('deduplicates exact repeats, sorts and bounds output after classification', () => {
    const rows = Array.from({ length: 24 }, (_, i) => row(`other-${i}`))
    const a = check(row(), ...rows, rows[0])!
    expect(a).toEqual(check(...rows.reverse(), row()))
    expect(a.conflicts).toHaveLength(20)
    expect(a.totalConflicts).toBe(24)
    expect(a.omittedConflicts).toBe(4)
    expect(Buffer.byteLength(JSON.stringify(a))).toBeLessThan(16384)
  })
  it.each([{}, { installed: null }, { installed: [{ ...row(), enabled: 'true' }] }, { installed: [{ ...row(), pluginId: 'forged@other' }] },
    { installed: [row(), row('personal', '2.0.0')] }])('fails closed for malformed inventory', inventory => {
    expect(detectCodexPluginCollisions(inventory, requested, digest)?.code).toBe('codex-plugin-inventory-unavailable')
  })
  it('bounds the reader and never exposes provider errors', () => {
    const calls: unknown[] = []
    const run = ((...args: unknown[]) => { calls.push(args); return { status: 1, stderr: 'secret-error', stdout: '' } }) as any
    const diagnostic = inspectCodexPluginCollisions(requested, { run })!
    expect(diagnostic.code).toBe('codex-plugin-inventory-unavailable')
    expect(JSON.stringify(diagnostic)).not.toContain('secret-error')
    expect(calls[0]).toMatchObject(['codex', ['plugin', 'list', '--json'], { timeout: 15000, maxBuffer: 2097152 }])
  })
})
