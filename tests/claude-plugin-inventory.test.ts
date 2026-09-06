import { describe, expect, it } from 'vitest'
import { selectClaudePlugin } from '../src/claude-plugin-inventory'
const row = (id = 'probe@development', extra = {}) => ({ id, version: '1.0.0', scope: 'user', enabled: true, installPath: '/fixture/cache/probe', ...extra })
describe('Claude exact source identity', () => {
  it('accepts both development and explicitly selected release identities', () => {
    for (const id of ['probe@development', 'probe@release']) expect(selectClaudePlugin([row(id)], { name: 'probe', selector: id, version: '1.0.0' }).ok).toBe(true)
  })
  it('cannot substitute a foreign matching cache identity', () => {
    expect(selectClaudePlugin([row('probe@foreign')], { name: 'probe', selector: 'probe@requested' }).code).toBe('claude-plugin-source-missing')
  })
  it('requires a selector for different registered sources', () => {
    expect(selectClaudePlugin([row(), row('probe@release')], { name: 'probe' }).code).toBe('claude-plugin-source-ambiguous')
  })
  it('separates disabled installation from activation intent', () => {
    expect(selectClaudePlugin([row(undefined, { enabled: false })], { name: 'probe' }).ok).toBe(true)
    expect(selectClaudePlugin([row(undefined, { enabled: false })], { name: 'probe', requireEnabled: true }).code).toBe('claude-plugin-disabled')
  })
  it('does not guess scope precedence', () => {
    expect(selectClaudePlugin([row(), row(undefined, { scope: 'project' })], { name: 'probe' }).code).toBe('claude-plugin-inventory-unavailable')
  })
  it('rejects incomplete inventory and version mismatch', () => {
    expect(selectClaudePlugin([{ id: 'probe@release' }], { name: 'probe' }).code).toBe('claude-plugin-inventory-unavailable')
    expect(selectClaudePlugin([row()], { name: 'probe', version: '2.0.0' }).code).toBe('claude-plugin-version-mismatch')
  })
  it('deduplicates identical records without treating unrelated names as conflicts', () => {
    expect(selectClaudePlugin([row(), row(), row('other@release')], { name: 'probe' }).ok).toBe(true)
  })
})

describe('bounded provider failures', () => {
  it('never turns malformed or failed provider output into clean inventory', async () => {
    const { verifyClaudePlugin } = await import('../src/claude-plugin-inventory')
    for (const value of [{ status: 1, stdout: '' }, { status: 0, stdout: '{broken' }, { status: null, stdout: '' }]) {
      expect(verifyClaudePlugin({ name: 'probe' }, { runCommand: () => value }).code).toBe('claude-plugin-inventory-unavailable')
    }
  })
})
