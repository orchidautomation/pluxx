import { describe, expect, it } from 'bun:test'
import {
  getPlatformRule,
  isCopilotManifestClaudeCompatible,
  PLATFORM_RULES,
} from '../src/validation/platform-rules'

describe('platform rules', () => {
  it('has rule entries for claude-code, github-copilot, and roo-code', () => {
    expect(PLATFORM_RULES['claude-code']).toBeDefined()
    expect(PLATFORM_RULES['github-copilot']).toBeDefined()
    expect(PLATFORM_RULES['roo-code']).toBeDefined()
  })

  it('codifies copilot manifest lookup locations', () => {
    const copilot = getPlatformRule('github-copilot')
    expect(copilot.manifest.fileLookupOrder).toEqual([
      '.plugin/plugin.json',
      'plugin.json',
      '.github/plugin/plugin.json',
      '.claude-plugin/plugin.json',
    ])
  })

  it('codifies copilot skill discovery directories', () => {
    const copilot = getPlatformRule('github-copilot')
    expect(copilot.skills.discoveryOrder).toContain('.github/skills/')
    expect(copilot.skills.discoveryOrder).toContain('.agents/skills/')
    expect(copilot.skills.discoveryOrder).toContain('.claude/skills/')
    expect(copilot.skills.discoveryOrder).toContain('~/.copilot/skills/')
  })

  it('codifies copilot skill frontmatter fields', () => {
    const copilot = getPlatformRule('github-copilot')
    const names = copilot.skills.frontmatter.map(field => field.name)

    expect(names).toContain('name')
    expect(names).toContain('description')
    expect(names).toContain('allowed-tools')
    expect(names).toContain('user-invocable')
    expect(names).toContain('disable-model-invocation')
  })

  it('keeps core plugin component fields Claude-compatible', () => {
    expect(isCopilotManifestClaudeCompatible()).toBe(true)
  })

  it('codifies roo code MCP config locations', () => {
    const roo = getPlatformRule('roo-code')
    expect(roo.mcp.configLookupOrder).toEqual([
      '.roo/mcp.json (project)',
      'mcp_settings.json (global Roo settings)',
    ])
  })

  it('codifies roo skill discovery directories and mode-specific variants', () => {
    const roo = getPlatformRule('roo-code')
    expect(roo.skills.discoveryOrder).toContain('~/.agents/skills/ and ~/.agents/skills-{mode}/')
    expect(roo.skills.discoveryOrder).toContain('.agents/skills/ and .agents/skills-{mode}/')
    expect(roo.skills.discoveryOrder).toContain('~/.roo/skills/ and ~/.roo/skills-{mode}/')
    expect(roo.skills.discoveryOrder).toContain('.roo/skills/ and .roo/skills-{mode}/')
  })

  it('codifies roo frontmatter mode fields', () => {
    const roo = getPlatformRule('roo-code')
    const names = roo.skills.frontmatter.map(field => field.name)

    expect(names).toContain('name')
    expect(names).toContain('description')
    expect(names).toContain('modeSlugs')
    expect(names).toContain('mode')
  })
})
