import { describe, expect, it } from 'bun:test'
import { PLATFORM_VALIDATION_RULES, getPlatformRules } from '../src/validation/platform-rules'

describe('PLATFORM_VALIDATION_RULES', () => {
  it('codifies all six researched platforms', () => {
    expect(Object.keys(PLATFORM_VALIDATION_RULES).sort()).toEqual([
      'amp',
      'cline',
      'gemini-cli',
      'openhands',
      'roo-code',
      'warp',
    ])
  })

  it('includes required manifest expectations for OpenHands and Gemini CLI', () => {
    const openhands = getPlatformRules('openhands')
    const gemini = getPlatformRules('gemini-cli')

    expect(openhands.manifest.required).toBe(true)
    expect(openhands.manifest.files).toContain('.plugin/plugin.json')

    expect(gemini.manifest.required).toBe(true)
    expect(gemini.manifest.files).toContain('gemini-extension.json')
  })

  it('captures MCP and rules paths for Roo Code and Cline', () => {
    const roo = getPlatformRules('roo-code')
    const cline = getPlatformRules('cline')

    expect(roo.mcp.files).toContain('.roo/mcp.json')
    expect(roo.instructions.files).toContain('.roo/rules/')

    expect(cline.mcp.files).toContain('.cline/mcp.json')
    expect(cline.instructions.files).toContain('.clinerules/')
  })

  it('tracks AGENTS/AGENT instruction conventions for Warp and AMP', () => {
    const warp = getPlatformRules('warp')
    const amp = getPlatformRules('amp')

    expect(warp.instructions.files).toContain('AGENTS.md')
    expect(warp.instructions.files).toContain('WARP.md')

    expect(amp.instructions.files).toContain('AGENTS.md')
    expect(amp.instructions.files).toContain('AGENT.md')
  })

  it('stores at least one documentation source per platform', () => {
    for (const rules of Object.values(PLATFORM_VALIDATION_RULES)) {
      expect(rules.sources.length).toBeGreaterThan(0)
      for (const source of rules.sources) {
        expect(source.url.startsWith('https://')).toBe(true)
      }
    }
  })
})
