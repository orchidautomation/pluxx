import { describe, expect, it } from 'bun:test'
import {
  getPlatformRule,
  isCopilotManifestClaudeCompatible,
  PLATFORM_RULES,
} from '../src/validation/platform-rules'

describe('platform rules', () => {
  it('has rule entries for claude-code, github-copilot, and cline', () => {
    expect(PLATFORM_RULES['claude-code']).toBeDefined()
    expect(PLATFORM_RULES['github-copilot']).toBeDefined()
    expect(PLATFORM_RULES.cline).toBeDefined()
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

  it('codifies cline rules, hooks, and mcp locations', () => {
    const cline = getPlatformRule('cline')
    expect(cline.manifest.fileLookupOrder).toContain('.clinerules/')
    expect(cline.skills.discoveryOrder).toContain('.cline/skills/')
    expect(cline.hooks.form).toBe('script-directory')
    expect(cline.hooks.defaultFiles).toContain('.clinerules/hooks/')
    expect(cline.mcp.configLookupOrder).toContain('.cline/mcp.json')
    expect(cline.mcp.configLookupOrder).toContain('~/.cline/data/settings/cline_mcp_settings.json')
  })

  it('codifies cline ACP support', () => {
    const cline = getPlatformRule('cline')
    expect(cline.acp.supported).toBe(true)
    expect(cline.acp.launchCommand).toBe('cline --acp')
  })
})
