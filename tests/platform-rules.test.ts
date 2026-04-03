import { describe, expect, it } from 'bun:test'
import {
  getPlatformRule,
  isCopilotManifestClaudeCompatible,
  PLATFORM_RULES,
} from '../src/validation/platform-rules'

describe('platform rules', () => {
  it('has rule entries for claude-code, github-copilot, and openhands', () => {
    expect(PLATFORM_RULES['claude-code']).toBeDefined()
    expect(PLATFORM_RULES['github-copilot']).toBeDefined()
    expect(PLATFORM_RULES.openhands).toBeDefined()
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

  it('codifies openhands manifest location and required metadata', () => {
    const openhands = getPlatformRule('openhands')
    expect(openhands.manifest.fileLookupOrder).toEqual(['.plugin/plugin.json'])
    expect(openhands.manifest.requiredFileName).toBe('plugin.json')
    expect(openhands.manifest.requiredFields.map(field => field.name)).toContain('name')
  })

  it('codifies openhands skills, hooks, and mcp conventions', () => {
    const openhands = getPlatformRule('openhands')
    const frontmatter = openhands.skills.frontmatter.map(field => field.name)

    expect(frontmatter).toContain('name')
    expect(frontmatter).toContain('description')
    expect(frontmatter).toContain('trigger')
    expect(frontmatter).toContain('triggers')

    expect(openhands.hooks.defaultFiles).toContain('hooks/hooks.json')
    expect(openhands.mcp.configLookupOrder).toContain('.mcp.json')
  })
})
