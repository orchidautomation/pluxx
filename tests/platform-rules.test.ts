import { describe, expect, it } from 'bun:test'
import {
  getPlatformRule,
  isCopilotManifestClaudeCompatible,
  PLATFORM_RULES,
} from '../src/validation/platform-rules'

describe('platform rules', () => {
  it('has rule entries for claude-code, github-copilot, and warp', () => {
    expect(PLATFORM_RULES['claude-code']).toBeDefined()
    expect(PLATFORM_RULES['github-copilot']).toBeDefined()
    expect(PLATFORM_RULES.warp).toBeDefined()
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

  it('codifies warp skills and rules file conventions', () => {
    const warp = getPlatformRule('warp')

    expect(warp.skills.discoveryOrder).toContain('.agents/skills/ (recommended)')
    expect(warp.skills.discoveryOrder).toContain('.warp/skills/')

    const fieldNames = warp.skills.frontmatter.map(field => field.name)
    expect(fieldNames).toEqual(['name', 'description'])
  })

  it('codifies warp MCP and hooks support boundaries', () => {
    const warp = getPlatformRule('warp')

    expect(warp.mcp.supported).toBe(true)
    expect(warp.mcp.configLookupOrder).toContain('~/.codex/config.toml (file-based MCP servers)')

    expect(warp.hooks.supported).toBe(false)
    expect(warp.hooks.defaultFiles).toEqual([])
  })
})
