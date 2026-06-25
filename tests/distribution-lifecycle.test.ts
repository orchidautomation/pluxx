import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import {
  CORE_FOUR_INSTALL_DISCOVERY_CAPABILITIES,
  getHostInstallDiscoveryCapability,
  getInstallFollowupNote,
  getPublishReloadInstruction,
  getVerifyInstallStaleAction,
  replaceGeneratedHostInstallDiscoverySection,
} from '../src/distribution-lifecycle'

const ROOT = resolve(import.meta.dir, '..')

describe('distribution lifecycle capabilities', () => {
  it('centralizes install, reload, cache, discovery, and brand truth for the core four', () => {
    expect(CORE_FOUR_INSTALL_DISCOVERY_CAPABILITIES.map((capability) => capability.platform)).toEqual([
      'claude-code',
      'cursor',
      'codex',
      'opencode',
    ])

    expect(getHostInstallDiscoveryCapability('claude-code').localInstallPath).toContain('~/.claude/plugins/cache/')
    expect(getHostInstallDiscoveryCapability('cursor').brandListingSupport).toContain('homepage and logo')
    expect(getHostInstallDiscoveryCapability('codex').cacheSemantics).toContain('stale cache contents')
    expect(getHostInstallDiscoveryCapability('codex').discoverySurface).toContain('plugin detail page')
    expect(getHostInstallDiscoveryCapability('opencode').localInstallPath).toContain('synced skills')
  })

  it('keeps existing CLI reload and stale-cache helpers backed by the registry', () => {
    expect(getInstallFollowupNote('claude-code')).toBe(
      getHostInstallDiscoveryCapability('claude-code').installFollowupNote,
    )
    expect(getPublishReloadInstruction('codex')).toBe(
      getHostInstallDiscoveryCapability('codex').publishReloadInstruction,
    )
    expect(getVerifyInstallStaleAction('codex')).toBe(
      getHostInstallDiscoveryCapability('codex').verifyStaleAction,
    )
    expect(getInstallFollowupNote('gemini-cli')).toBeUndefined()
    expect(getPublishReloadInstruction('gemini-cli')).toBeUndefined()
  })

  it('keeps the lifecycle doc capability table generated from the registry', () => {
    const checkedIn = readFileSync(resolve(ROOT, 'docs/core-four-install-update-lifecycle.md'), 'utf-8')

    expect(checkedIn).toBe(replaceGeneratedHostInstallDiscoverySection(checkedIn))
  })
})
