import { describe, it, expect } from 'vitest'
import { createHash } from 'node:crypto'
import { detectCodexPluginCollisions } from '../src/codex-plugin-collisions'
import { validateInstallResultsEnvelope, renderInstallResultsHuman, type InstallResultsEnvelope } from '../src/install-contract'

describe('collision result compatibility', () => {
  const diagnostic = detectCodexPluginCollisions({ installed: [{ name: 'proof', pluginId: 'proof@other', marketplaceName: 'other',
    enabled: true, installed: true, version: '1.0.0', source: { source: 'local', path: '/synthetic' } }] },
  { name: 'proof', marketplace: 'requested', version: '1.0.0' }, text => createHash('sha256').update(text).digest('hex'))!
  const envelope: InstallResultsEnvelope = { schema: 'pluxx.install-results.v1', plugin: { name: 'proof', version: '1.0.0' }, selectionMode: 'explicit',
    plan: [{ target: 'codex', detected: true, selected: true }], results: [{ target: 'codex', state: 'failed', reason: diagnostic.code,
      error: diagnostic.error, action: diagnostic.action, diagnostics: [diagnostic] }] }
  it('preserves failed diagnostics with existing v1 states and renders both selectors', () => {
    expect(validateInstallResultsEnvelope(envelope)).toBe(true)
    const human = renderInstallResultsHuman(envelope).join('\n')
    expect(human).toContain('proof@requested')
    expect(human).toContain('proof@other')
    expect(human).toContain('native plugin manager')
    expect(validateInstallResultsEnvelope({ ...envelope, results: [{ target: 'codex', state: 'installed' }] })).toBe(true)
  })
  it('rejects success carrying collision diagnostics and forged identities', () => {
    expect(validateInstallResultsEnvelope({ ...envelope, results: [{ ...envelope.results[0], state: 'installed' }] })).toBe(false)
    expect(validateInstallResultsEnvelope({ ...envelope, results: [{ ...envelope.results[0], diagnostics: [{ ...diagnostic, conflicts: [diagnostic.requested] }] }] })).toBe(false)
  })
})
