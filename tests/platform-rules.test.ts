import { describe, it, expect } from 'bun:test'
import {
  PLATFORM_VALIDATION_RULES,
  PLATFORM_LIMITS,
  PLATFORM_LIMIT_POLICIES,
  getPlatformRules,
} from '../src/validation/platform-rules'

describe('PLATFORM_VALIDATION_RULES', () => {
  it('has entries for all researched platforms', () => {
    const platforms = Object.keys(PLATFORM_VALIDATION_RULES)
    expect(platforms.length).toBeGreaterThanOrEqual(10)
    expect(platforms).toContain('claude-code')
    expect(platforms).toContain('cursor')
    expect(platforms).toContain('codex')
    expect(platforms).toContain('opencode')
  })

  it('each entry has required fields', () => {
    for (const [, rules] of Object.entries(PLATFORM_VALIDATION_RULES)) {
      expect(rules.platform).toBeTruthy()
      expect(rules.sources.length).toBeGreaterThan(0)
      expect(rules.skillDiscoveryDirs.length).toBeGreaterThan(0)
    }
  })

  it('getPlatformRules returns correct platform', () => {
    const rules = getPlatformRules('claude-code')
    expect(rules.platform).toBe('claude-code')
  })
})

describe('PLATFORM_LIMITS', () => {
  it('has entries for all 11 target platforms', () => {
    const platforms = Object.keys(PLATFORM_LIMITS)
    expect(platforms.length).toBe(11)
    expect(platforms).toContain('claude-code')
    expect(platforms).toContain('codex')
    expect(platforms).toContain('cursor')
    expect(platforms).toContain('opencode')
  })

  it('codex has hard description limit of 1024', () => {
    expect(PLATFORM_LIMITS['codex'].skillDescriptionMax).toBe(1024)
  })

  it('claude-code has display truncation at 250', () => {
    expect(PLATFORM_LIMITS['claude-code'].skillDescriptionDisplayMax).toBe(250)
  })

  it('catalogs the primary-target caps we enforce most aggressively', () => {
    expect(PLATFORM_LIMITS['claude-code'].skillDescriptionMax).toBe(1536)
    expect(PLATFORM_LIMITS['claude-code'].skillListingBudgetMax).toBe(8000)
    expect(PLATFORM_LIMITS['opencode'].skillDescriptionMax).toBe(1024)
    expect(PLATFORM_LIMITS['codex'].instructionsMaxBytes).toBe(32768)
    expect(PLATFORM_LIMITS['cursor'].rulesMaxLines).toBe(500)
  })

  it('codex has max 3 prompts of 128 chars', () => {
    expect(PLATFORM_LIMITS['codex'].manifestPromptCountMax).toBe(3)
    expect(PLATFORM_LIMITS['codex'].manifestPromptMax).toBe(128)
  })

  it('cursor and cline require name to match directory', () => {
    expect(PLATFORM_LIMITS['cursor'].skillNameMustMatchDir).toBe(true)
    expect(PLATFORM_LIMITS['cline'].skillNameMustMatchDir).toBe(true)
  })
})

describe('PLATFORM_LIMIT_POLICIES', () => {
  it('classifies Codex AGENTS.md byte cap as hard', () => {
    expect(PLATFORM_LIMIT_POLICIES['codex'].instructionsMaxBytes?.kind).toBe('hard')
  })

  it('classifies Cursor rule line guidance as advisory', () => {
    expect(PLATFORM_LIMIT_POLICIES['cursor'].rulesMaxLines?.kind).toBe('advisory')
  })

  it('classifies Claude listing truncation as display-only', () => {
    expect(PLATFORM_LIMIT_POLICIES['claude-code'].skillDescriptionDisplayMax?.kind).toBe('display')
  })

  it('classifies Claude aggregate skill listing budget as advisory', () => {
    expect(PLATFORM_LIMIT_POLICIES['claude-code'].skillListingBudgetMax?.kind).toBe('advisory')
  })
})
