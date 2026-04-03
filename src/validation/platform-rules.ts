import type { TargetPlatform } from '../schema'

type RuleLevel = 'required' | 'supported' | 'fallback' | 'optional' | 'unknown'

export interface PlatformRuleSource {
  label: string
  url: string
}

export interface PlatformLimits {
  skillDescriptionMax: number | null
  skillDescriptionDisplayMax: number | null
  skillNameMax: number
  skillNameMustMatchDir: boolean
  manifestPromptMax: number | null
  manifestPromptCountMax: number | null
  manifestPathPrefix: string | null
  instructionsMaxBytes: number | null
  hooksFeatureFlag: string | null
  rulesMaxLines: number | null
}

export interface PlatformRules {
  platform: TargetPlatform
  summary: string
  limits: PlatformLimits
  skillDiscoveryDirs: {
    path: string
    level: RuleLevel
    notes?: string
  }[]
  frontmatter: {
    standard: string[]
    additional: string[]
    notes?: string
  }
  manifest: {
    files: string[]
    required: boolean
    notes?: string
  }
  mcp: {
    files: string[]
    rootKey?: string
    transports: string[]
    auth: string[]
    notes?: string
  }
  hooks: {
    supported: boolean
    files: string[]
    eventNames: string[]
    notes?: string
  }
  instructions: {
    files: string[]
    format: string
    notes?: string
  }
  sources: PlatformRuleSource[]
}

const STANDARD_SKILL_FRONTMATTER = [
  'name',
  'description',
  'license',
  'compatibility',
  'metadata',
  'disable-model-invocation',
] as const

const NULL_LIMITS: PlatformLimits = {
  skillDescriptionMax: null,
  skillDescriptionDisplayMax: null,
  skillNameMax: 64,
  skillNameMustMatchDir: false,
  manifestPromptMax: null,
  manifestPromptCountMax: null,
  manifestPathPrefix: null,
  instructionsMaxBytes: null,
  hooksFeatureFlag: null,
  rulesMaxLines: null,
}

export const PLATFORM_LIMITS: Record<TargetPlatform, PlatformLimits> = {
  'claude-code': {
    ...NULL_LIMITS,
    skillDescriptionDisplayMax: 250,
  },
  'codex': {
    ...NULL_LIMITS,
    skillDescriptionMax: 1024,
    skillNameMustMatchDir: true,
    manifestPromptMax: 128,
    manifestPromptCountMax: 3,
    manifestPathPrefix: './',
    instructionsMaxBytes: 32768,
    hooksFeatureFlag: 'codex_hooks',
  },
  'cursor': {
    ...NULL_LIMITS,
    skillNameMustMatchDir: true,
    rulesMaxLines: 500,
  },
  'opencode': {
    ...NULL_LIMITS,
  },
  'github-copilot': {
    ...NULL_LIMITS,
    skillDescriptionDisplayMax: 250,
  },
  'openhands': {
    ...NULL_LIMITS,
  },
  'warp': {
    ...NULL_LIMITS,
  },
  'gemini-cli': {
    ...NULL_LIMITS,
    skillNameMustMatchDir: true,
  },
  'roo-code': {
    ...NULL_LIMITS,
  },
  'cline': {
    ...NULL_LIMITS,
    skillDescriptionMax: 1024,
    skillNameMustMatchDir: true,
  },
  'amp': {
    ...NULL_LIMITS,
  },
}

type ResearchTarget = Extract<
  TargetPlatform,
  'openhands' | 'warp' | 'gemini-cli' | 'roo-code' | 'cline' | 'amp'
>

export const PLATFORM_VALIDATION_RULES: Record<ResearchTarget, PlatformRules> = {
  'openhands': {
    platform: 'openhands',
    summary: 'OpenHands plugins use a Claude-style manifest at .plugin/plugin.json and support skills, hooks, and MCP.',
    limits: PLATFORM_LIMITS['openhands'],
    skillDiscoveryDirs: [
      { path: '.openhands/skills/', level: 'supported' },
      { path: '.claude/skills/', level: 'supported' },
      { path: '.agents/skills/', level: 'supported' },
    ],
    frontmatter: {
      standard: [...STANDARD_SKILL_FRONTMATTER],
      additional: ['triggers'],
      notes: 'OpenHands skill docs mention support for trigger metadata in addition to Agent Skills frontmatter.',
    },
    manifest: {
      files: ['.plugin/plugin.json'],
      required: true,
      notes: 'OpenHands plugin docs require a manifest under .plugin.',
    },
    mcp: {
      files: ['.mcp.json'],
      rootKey: 'mcpServers',
      transports: ['stdio', 'http', 'sse'],
      auth: ['headers-based env interpolation'],
    },
    hooks: {
      supported: true,
      files: ['hooks/hooks.json'],
      eventNames: [],
      notes: 'OpenHands supports hook configuration via hooks/hooks.json; event names align with Claude-style hooks in current docs.',
    },
    instructions: {
      files: ['AGENTS.md'],
      format: 'markdown',
    },
    sources: [
      { label: 'OpenHands plugin guide', url: 'https://docs.openhands.dev/sdk/guides/plugins' },
      { label: 'OpenHands skill guide', url: 'https://docs.openhands.dev/sdk/guides/skill' },
    ],
  },
  'warp': {
    platform: 'warp',
    summary: 'Warp supports skills, rules, and MCP with AGENTS.md as the current rules anchor.',
    limits: PLATFORM_LIMITS['warp'],
    skillDiscoveryDirs: [
      { path: '.agents/skills/', level: 'supported' },
      { path: '.warp/skills/', level: 'supported' },
      { path: '.claude/skills/', level: 'supported', notes: 'Compatibility directory' },
      { path: '.codex/skills/', level: 'supported', notes: 'Compatibility directory' },
    ],
    frontmatter: {
      standard: [...STANDARD_SKILL_FRONTMATTER],
      additional: [],
    },
    manifest: {
      files: [],
      required: false,
      notes: 'Warp does not currently require a dedicated plugin manifest file.',
    },
    mcp: {
      files: ['mcp.json'],
      rootKey: 'mcpServers',
      transports: ['stdio', 'http', 'sse'],
      auth: ['headers', 'OAuth (remote server flows)'],
    },
    hooks: {
      supported: false,
      files: [],
      eventNames: [],
      notes: 'Warp docs reviewed for this ticket focus on skills, rules, and MCP; no standalone hooks schema found.',
    },
    instructions: {
      files: ['AGENTS.md', 'WARP.md'],
      format: 'markdown',
      notes: 'AGENTS.md is current; WARP.md is backward compatible.',
    },
    sources: [
      { label: 'Warp skills docs', url: 'https://docs.warp.dev/agent-platform/capabilities/skills' },
      { label: 'Warp MCP docs', url: 'https://docs.warp.dev/agent-platform/capabilities/mcp' },
      { label: 'Warp rules docs', url: 'https://docs.warp.dev/agent-platform/capabilities/rules' },
    ],
  },
  'gemini-cli': {
    platform: 'gemini-cli',
    summary: 'Gemini CLI uses gemini-extension.json, GEMINI.md instructions, and hook definitions in hooks/hooks.json.',
    limits: PLATFORM_LIMITS['gemini-cli'],
    skillDiscoveryDirs: [
      { path: 'skills/', level: 'supported' },
    ],
    frontmatter: {
      standard: [...STANDARD_SKILL_FRONTMATTER],
      additional: [],
    },
    manifest: {
      files: ['gemini-extension.json'],
      required: true,
      notes: 'Gemini extensions require a manifest file named gemini-extension.json.',
    },
    mcp: {
      files: ['gemini-extension.json'],
      rootKey: 'mcpServers',
      transports: ['stdio', 'http', 'sse'],
      auth: ['headers', 'env interpolation'],
    },
    hooks: {
      supported: true,
      files: ['hooks/hooks.json'],
      eventNames: [],
      notes: 'Gemini hook docs specify hooks/hooks.json; hook config is separate from gemini-extension.json.',
    },
    instructions: {
      files: ['GEMINI.md'],
      format: 'markdown',
    },
    sources: [
      { label: 'Gemini extensions docs', url: 'https://geminicli.com/docs/extensions/' },
      { label: 'Gemini extension reference', url: 'https://geminicli.com/docs/extensions/reference/' },
      { label: 'Gemini hooks docs', url: 'https://geminicli.com/docs/hooks/' },
    ],
  },
  'roo-code': {
    platform: 'roo-code',
    summary: 'Roo Code supports project and mode-specific rules, project-level MCP config, and custom modes metadata.',
    limits: PLATFORM_LIMITS['roo-code'],
    skillDiscoveryDirs: [
      { path: '.roo/skills/', level: 'supported' },
    ],
    frontmatter: {
      standard: [...STANDARD_SKILL_FRONTMATTER],
      additional: ['mode fields: slug, roleDefinition, whenToUse, customInstructions, groups'],
      notes: 'Additional fields apply to custom mode definitions, not SKILL.md frontmatter.',
    },
    manifest: {
      files: [],
      required: false,
      notes: 'Roo Code does not require a plugin manifest file.',
    },
    mcp: {
      files: ['.roo/mcp.json', 'mcp_settings.json'],
      rootKey: 'mcpServers',
      transports: ['stdio', 'http', 'sse', 'streamable-http'],
      auth: ['headers', 'OAuth', 'provider-specific env'],
    },
    hooks: {
      supported: false,
      files: [],
      eventNames: [],
      notes: 'No standalone hook event schema identified in Roo docs reviewed for this ticket.',
    },
    instructions: {
      files: ['.roo/rules/', '.roo/rules-{modeSlug}/', '.roorules', '.roorules-{modeSlug}'],
      format: 'markdown',
      notes: '.roo/rules/ and mode-specific rules are preferred over legacy .roorules files.',
    },
    sources: [
      { label: 'Roo custom instructions docs', url: 'https://docs.roocode.com/features/custom-instructions' },
      { label: 'Roo custom modes docs', url: 'https://docs.roocode.com/features/custom-modes' },
      { label: 'Roo MCP docs', url: 'https://docs.roocode.com/features/mcp/using-mcp-in-roo' },
      { label: 'Roo MCP transports docs', url: 'https://docs.roocode.com/features/mcp/server-transports' },
    ],
  },
  'cline': {
    platform: 'cline',
    summary: 'Cline supports layered rules, .cline/mcp.json, and conditional rules via frontmatter path globs.',
    limits: PLATFORM_LIMITS['cline'],
    skillDiscoveryDirs: [
      { path: '.cline/skills/', level: 'supported' },
      { path: '.agents/skills/', level: 'supported' },
    ],
    frontmatter: {
      standard: [...STANDARD_SKILL_FRONTMATTER],
      additional: ['paths (for conditional .clinerules entries)'],
      notes: 'The additional field applies to rule files, not SKILL.md.',
    },
    manifest: {
      files: [],
      required: false,
      notes: 'Cline does not require a dedicated plugin manifest file.',
    },
    mcp: {
      files: ['.cline/mcp.json'],
      rootKey: 'mcpServers',
      transports: ['stdio', 'http', 'sse'],
      auth: ['headers', 'env interpolation'],
      notes: 'Current Cline docs align with a Claude-style mcpServers object in project config.',
    },
    hooks: {
      supported: true,
      files: ['.clinerules/hooks/'],
      eventNames: [],
      notes: 'Hook scripts are documented under .clinerules/hooks/ conventions.',
    },
    instructions: {
      files: ['.clinerules/', 'AGENTS.md'],
      format: 'markdown',
      notes: '.clinerules supports both always-on and conditional rule files.',
    },
    sources: [
      { label: 'Cline rules docs', url: 'https://docs.cline.bot/customization/cline-rules' },
    ],
  },
  'amp': {
    platform: 'amp',
    summary: 'AMP uses AGENTS.md/AGENT.md for instruction hierarchy and .amp/settings.json for settings, hooks, and MCP.',
    limits: PLATFORM_LIMITS['amp'],
    skillDiscoveryDirs: [
      { path: '.agents/skills/', level: 'supported' },
      { path: '~/.config/amp/skills/', level: 'supported' },
    ],
    frontmatter: {
      standard: [...STANDARD_SKILL_FRONTMATTER],
      additional: [],
    },
    manifest: {
      files: [],
      required: false,
      notes: 'AMP does not require a standalone plugin manifest file.',
    },
    mcp: {
      files: ['.amp/settings.json', '~/.config/amp/settings.json'],
      rootKey: 'amp.mcpServers',
      transports: ['stdio', 'http'],
      auth: ['headers', 'env interpolation', 'OAuth via server support'],
    },
    hooks: {
      supported: true,
      files: ['.amp/settings.json'],
      eventNames: [],
      notes: 'AMP manual documents hooks within settings, but event naming/details are less explicit than other platforms.',
    },
    instructions: {
      files: ['AGENTS.md', 'AGENT.md'],
      format: 'markdown',
      notes: 'AMP prefers AGENTS.md and falls back to AGENT.md for compatibility.',
    },
    sources: [
      { label: 'AMP manual', url: 'https://ampcode.com/manual' },
    ],
  },
}

export function getPlatformRules(platform: ResearchTarget): PlatformRules {
  return PLATFORM_VALIDATION_RULES[platform]
}
