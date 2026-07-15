import { describe, it, expect } from 'bun:test'
import {
  CORE_FOUR_PLATFORMS,
  CORE_FOUR_PRIMITIVE_CAPABILITIES,
  PLATFORM_VALIDATION_RULES,
  PLATFORM_LIMITS,
  PLATFORM_LIMIT_POLICIES,
  getCoreFourPrimitiveCapabilities,
  getCoreFourCompilerBucketCapability,
  getPlatformRules,
} from '../src/validation/platform-rules'
import { HOST_MAPPED_COMPILER_BUCKETS } from '../src/schema'
import { getAgentPrimitiveCapability } from '../src/agent-translation-registry'
import { getCommandPrimitiveCapability } from '../src/command-translation-registry'
import { derivePrimitiveCapability, getFieldTranslationEntries } from '../src/field-translation-registry'

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

  it('tracks the current official Codex hook event set and plugin hook gate', () => {
    const rules = getPlatformRules('codex')

    expect(rules.hooks.eventNames).toEqual([
      'SessionStart',
      'SubagentStart',
      'PreToolUse',
      'PermissionRequest',
      'PostToolUse',
      'PreCompact',
      'PostCompact',
      'UserPromptSubmit',
      'SubagentStop',
      'Stop',
    ])
    expect(PLATFORM_LIMITS.codex.hooksFeatureFlag).toBe('hooks')
    expect(PLATFORM_LIMIT_POLICIES.codex.hooksFeatureFlag?.notes).toContain('enabled-plugin')
    expect(rules.hooks.notes).toContain('user review')
  })
})

describe('CORE_FOUR_PRIMITIVE_CAPABILITIES', () => {
  it('covers the four primary platforms', () => {
    expect(Object.keys(CORE_FOUR_PRIMITIVE_CAPABILITIES)).toEqual([...CORE_FOUR_PLATFORMS])
  })

  it('covers every implemented host-mapped compiler bucket for each primary platform', () => {
    for (const platform of CORE_FOUR_PLATFORMS) {
      expect(Object.keys(CORE_FOUR_PRIMITIVE_CAPABILITIES[platform].buckets)).toEqual([...HOST_MAPPED_COMPILER_BUCKETS])
    }
  })

  it('derives orchestration from the complete Phase 2 registry', () => {
    for (const platform of CORE_FOUR_PLATFORMS) {
      const lookup = getCoreFourCompilerBucketCapability(platform, 'orchestration')
      expect(lookup.status).toBe('mapped')
      if (lookup.status === 'mapped') expect(lookup.capability.mode).toBe('degrade')
    }
  })

  it('captures the current codex command degradation truth', () => {
    expect(CORE_FOUR_PRIMITIVE_CAPABILITIES.codex.buckets.commands.mode).toBe('degrade')
    expect(CORE_FOUR_PRIMITIVE_CAPABILITIES.codex.buckets.commands.nativeSurfaces).toEqual([
      'skills/',
      'AGENTS.md',
      '.codex/commands.generated.json',
    ])
  })

  it('derives command capability truth from the command translation registry', () => {
    for (const platform of CORE_FOUR_PLATFORMS) {
      expect(CORE_FOUR_PRIMITIVE_CAPABILITIES[platform].buckets.commands).toEqual(
        getCommandPrimitiveCapability(platform),
      )
    }
  })

  it('captures cursor agent translation through subagents', () => {
    expect(CORE_FOUR_PRIMITIVE_CAPABILITIES.cursor.buckets.agents.mode).toBe('translate')
    expect(CORE_FOUR_PRIMITIVE_CAPABILITIES.cursor.buckets.agents.nativeSurfaces).toContain('.cursor/agents/')
  })

  it('derives agent capability truth from the agent translation registry', () => {
    for (const platform of CORE_FOUR_PLATFORMS) {
      expect(CORE_FOUR_PRIMITIVE_CAPABILITIES[platform].buckets.agents).toEqual(
        getAgentPrimitiveCapability(platform),
      )
    }
  })

  it('derives skill and hook capability truth from audited field outcomes', () => {
    for (const platform of CORE_FOUR_PLATFORMS) {
      expect(CORE_FOUR_PRIMITIVE_CAPABILITIES[platform].buckets.skills).toEqual(
        derivePrimitiveCapability('skills', platform),
      )
      expect(CORE_FOUR_PRIMITIVE_CAPABILITIES[platform].buckets.hooks).toEqual(
        derivePrimitiveCapability('hooks', platform),
      )
    }

    expect(CORE_FOUR_PRIMITIVE_CAPABILITIES['claude-code'].buckets.skills.mode).toBe('preserve')
    expect(CORE_FOUR_PRIMITIVE_CAPABILITIES.cursor.buckets.skills.mode).toBe('degrade')
    expect(CORE_FOUR_PRIMITIVE_CAPABILITIES['claude-code'].buckets.hooks.mode).toBe('degrade')
    expect(CORE_FOUR_PRIMITIVE_CAPABILITIES.cursor.buckets.hooks.mode).toBe('degrade')
  })

  it('never labels a field-derived primitive preserve when an audited field is weaker', () => {
    for (const primitive of ['skills', 'hooks'] as const) {
      const entries = getFieldTranslationEntries(primitive)
      for (const platform of CORE_FOUR_PLATFORMS) {
        const capability = derivePrimitiveCapability(primitive, platform)
        const weakerFields = entries.filter(entry => entry.platforms[platform].mode !== 'preserve')
        if (capability.mode === 'preserve') {
          expect(weakerFields).toEqual([])
        } else {
          expect(weakerFields.length).toBeGreaterThan(0)
        }
      }
    }
  })

  it('getCoreFourPrimitiveCapabilities returns the requested platform', () => {
    const capabilities = getCoreFourPrimitiveCapabilities('opencode')
    expect(capabilities.platform).toBe('opencode')
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

  it('codex keeps a conservative 1024-character description guideline', () => {
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

  it('codex keeps conservative prompt listing heuristics', () => {
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

  it('classifies Codex description and prompt limits as advisory heuristics', () => {
    expect(PLATFORM_LIMIT_POLICIES['codex'].skillDescriptionMax?.kind).toBe('advisory')
    expect(PLATFORM_LIMIT_POLICIES['codex'].skillNameMustMatchDir.kind).toBe('advisory')
    expect(PLATFORM_LIMIT_POLICIES['codex'].manifestPromptCountMax?.kind).toBe('advisory')
    expect(PLATFORM_LIMIT_POLICIES['codex'].manifestPromptMax?.kind).toBe('advisory')
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
