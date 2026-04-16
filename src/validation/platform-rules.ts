import type { TargetPlatform } from '../schema'

type RuleLevel = 'required' | 'supported' | 'fallback' | 'optional' | 'unknown'

export interface PlatformRuleSource {
  label: string
  url: string
}

export type PlatformLimitKind = 'hard' | 'advisory' | 'display'

export interface PlatformLimitPolicy {
  kind: PlatformLimitKind
  notes?: string
}

export interface PlatformLimits {
  skillDescriptionMax: number | null
  skillDescriptionDisplayMax: number | null
  skillListingBudgetMax: number | null
  skillNameMax: number
  skillNameMustMatchDir: boolean
  manifestPromptMax: number | null
  manifestPromptCountMax: number | null
  manifestPathPrefix: string | null
  instructionsMaxBytes: number | null
  hooksFeatureFlag: string | null
  rulesMaxLines: number | null
}

export interface PlatformLimitPolicies {
  skillDescriptionMax: PlatformLimitPolicy | null
  skillDescriptionDisplayMax: PlatformLimitPolicy | null
  skillListingBudgetMax: PlatformLimitPolicy | null
  skillNameMax: PlatformLimitPolicy
  skillNameMustMatchDir: PlatformLimitPolicy
  manifestPromptMax: PlatformLimitPolicy | null
  manifestPromptCountMax: PlatformLimitPolicy | null
  manifestPathPrefix: PlatformLimitPolicy | null
  instructionsMaxBytes: PlatformLimitPolicy | null
  hooksFeatureFlag: PlatformLimitPolicy | null
  rulesMaxLines: PlatformLimitPolicy | null
}

export interface PlatformRules {
  platform: TargetPlatform
  summary: string
  limits: PlatformLimits
  limitPolicies: PlatformLimitPolicies
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
  skillListingBudgetMax: null,
  skillNameMax: 64,
  skillNameMustMatchDir: false,
  manifestPromptMax: null,
  manifestPromptCountMax: null,
  manifestPathPrefix: null,
  instructionsMaxBytes: null,
  hooksFeatureFlag: null,
  rulesMaxLines: null,
}

const NULL_LIMIT_POLICIES: PlatformLimitPolicies = {
  skillDescriptionMax: null,
  skillDescriptionDisplayMax: null,
  skillListingBudgetMax: null,
  skillNameMax: { kind: 'hard' },
  skillNameMustMatchDir: { kind: 'hard' },
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
    skillDescriptionMax: 1536,
    skillDescriptionDisplayMax: 250,
    skillListingBudgetMax: 8000,
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
    skillDescriptionMax: 1024,
    skillNameMustMatchDir: true,
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

export const PLATFORM_LIMIT_POLICIES: Record<TargetPlatform, PlatformLimitPolicies> = {
  'claude-code': {
    ...NULL_LIMIT_POLICIES,
    skillDescriptionMax: {
      kind: 'hard',
      notes: 'Claude skills listing caps description + when_to_use combined at 1,536 characters.',
    },
    skillDescriptionDisplayMax: {
      kind: 'display',
      notes: 'Claude surfaces commonly truncate long listing text around 250 characters.',
    },
    skillListingBudgetMax: {
      kind: 'advisory',
      notes: 'Pluxx warns at 8,000 aggregate characters to keep Claude listings readable and avoid crowded discovery surfaces.',
    },
  },
  'codex': {
    ...NULL_LIMIT_POLICIES,
    skillDescriptionMax: { kind: 'hard' },
    skillNameMustMatchDir: { kind: 'hard' },
    manifestPromptMax: { kind: 'hard' },
    manifestPromptCountMax: { kind: 'hard' },
    manifestPathPrefix: { kind: 'hard' },
    instructionsMaxBytes: {
      kind: 'hard',
      notes: 'Codex AGENTS.md/project docs truncate at 32 KiB.',
    },
    hooksFeatureFlag: {
      kind: 'hard',
      notes: 'Hook support depends on the Codex hooks feature flag/runtime support.',
    },
  },
  'cursor': {
    ...NULL_LIMIT_POLICIES,
    skillNameMustMatchDir: { kind: 'hard' },
    rulesMaxLines: {
      kind: 'advisory',
      notes: 'Cursor docs treat 500 lines as practical guidance rather than a documented hard cap.',
    },
  },
  'opencode': {
    ...NULL_LIMIT_POLICIES,
    skillDescriptionMax: { kind: 'hard' },
    skillNameMustMatchDir: { kind: 'hard' },
  },
  'github-copilot': {
    ...NULL_LIMIT_POLICIES,
    skillDescriptionDisplayMax: { kind: 'display' },
  },
  'openhands': {
    ...NULL_LIMIT_POLICIES,
  },
  'warp': {
    ...NULL_LIMIT_POLICIES,
  },
  'gemini-cli': {
    ...NULL_LIMIT_POLICIES,
    skillNameMustMatchDir: { kind: 'hard' },
  },
  'roo-code': {
    ...NULL_LIMIT_POLICIES,
  },
  'cline': {
    ...NULL_LIMIT_POLICIES,
    skillDescriptionMax: { kind: 'hard' },
    skillNameMustMatchDir: { kind: 'hard' },
  },
  'amp': {
    ...NULL_LIMIT_POLICIES,
  },
}

type ResearchTarget = Extract<
  TargetPlatform,
  | 'claude-code'
  | 'cursor'
  | 'codex'
  | 'opencode'
  | 'openhands'
  | 'warp'
  | 'gemini-cli'
  | 'roo-code'
  | 'cline'
  | 'amp'
>

export const PLATFORM_VALIDATION_RULES: Record<ResearchTarget, PlatformRules> = {
  'claude-code': {
    platform: 'claude-code',
    summary: 'Claude Code plugins use an optional manifest at .claude-plugin/plugin.json with auto-discovery for skills, commands, agents, hooks, MCP, and output styles.',
    limits: PLATFORM_LIMITS['claude-code'],
    limitPolicies: PLATFORM_LIMIT_POLICIES['claude-code'],
    skillDiscoveryDirs: [
      { path: 'skills/', level: 'supported' },
    ],
    frontmatter: {
      standard: [...STANDARD_SKILL_FRONTMATTER],
      additional: [],
    },
    manifest: {
      files: ['.claude-plugin/plugin.json'],
      required: false,
      notes: 'The manifest is optional; if present, name is the only required field.',
    },
    mcp: {
      files: ['.mcp.json'],
      rootKey: 'mcpServers',
      transports: ['stdio', 'http', 'sse'],
      auth: ['headers', 'env interpolation'],
      notes: 'Claude Code supports either inline MCP config in plugin.json or a separate .mcp.json file.',
    },
    hooks: {
      supported: true,
      files: ['hooks/hooks.json'],
      eventNames: [],
      notes: 'Hook configs can be stored in hooks/hooks.json or inlined in plugin.json.',
    },
    instructions: {
      files: ['CLAUDE.md'],
      format: 'markdown',
    },
    sources: [
      { label: 'Claude Code plugins reference', url: 'https://code.claude.com/docs/en/plugins-reference' },
      { label: 'Claude Code hooks docs', url: 'https://code.claude.com/docs/en/hooks' },
      { label: 'Claude Code skills docs', url: 'https://code.claude.com/docs/en/skills' },
    ],
  },
  'cursor': {
    platform: 'cursor',
    summary: 'Cursor plugins use .cursor-plugin/plugin.json plus auto-discovered rules, skills, agents, commands, hooks, and mcp.json at the plugin root; Cursor subagents are a related but separate surface under .cursor/agents and ~/.cursor/agents.',
    limits: PLATFORM_LIMITS['cursor'],
    limitPolicies: PLATFORM_LIMIT_POLICIES['cursor'],
    skillDiscoveryDirs: [
      { path: 'skills/', level: 'supported' },
      { path: 'SKILL.md', level: 'fallback', notes: 'Used when no skills directory or manifest skill path is present.' },
    ],
    frontmatter: {
      standard: [...STANDARD_SKILL_FRONTMATTER],
      additional: [],
    },
    manifest: {
      files: ['.cursor-plugin/plugin.json'],
      required: true,
      notes: 'Cursor documents plugin.json as the required plugin manifest.',
    },
    mcp: {
      files: ['mcp.json'],
      rootKey: 'mcpServers',
      transports: ['stdio', 'http', 'sse'],
      auth: ['headers', 'env interpolation'],
    },
    hooks: {
      supported: true,
      files: ['hooks/hooks.json'],
      eventNames: [],
      notes: 'Cursor plugin hooks live under hooks/hooks.json; project hooks also exist separately in .cursor/hooks.json.',
    },
    instructions: {
      files: ['rules/', 'AGENTS.md'],
      format: 'mdc + markdown',
      notes: 'rules/ is the plugin-native instruction surface. AGENTS.md remains useful as shared repo guidance. Cursor subagents use markdown files under .cursor/agents or ~/.cursor/agents (with .claude/.codex compatibility paths).',
    },
    sources: [
      { label: 'Cursor plugins reference', url: 'https://cursor.com/docs/reference/plugins' },
      { label: 'Cursor plugins overview', url: 'https://cursor.com/docs/plugins' },
      { label: 'Cursor hooks docs', url: 'https://cursor.com/docs/hooks' },
      { label: 'Cursor skills docs', url: 'https://cursor.com/docs/skills' },
      { label: 'Cursor rules docs', url: 'https://cursor.com/docs/rules' },
      { label: 'Cursor MCP docs', url: 'https://cursor.com/docs/mcp' },
      { label: 'Cursor CLI headless docs', url: 'https://cursor.com/docs/cli/headless' },
      { label: 'Cursor CLI parameters', url: 'https://cursor.com/docs/cli/reference/parameters' },
      { label: 'Cursor CLI authentication', url: 'https://cursor.com/docs/cli/reference/authentication' },
      { label: 'Cursor subagents docs', url: 'https://cursor.com/docs/subagents' },
    ],
  },
  'codex': {
    platform: 'codex',
    summary: 'Codex plugins use .codex-plugin/plugin.json with skills, .mcp.json, optional app mappings, and AGENTS.md; current docs separate plugin packaging from hooks configuration and do not document plugin-provided slash commands.',
    limits: PLATFORM_LIMITS['codex'],
    limitPolicies: PLATFORM_LIMIT_POLICIES['codex'],
    skillDiscoveryDirs: [
      { path: 'skills/', level: 'supported' },
    ],
    frontmatter: {
      standard: [...STANDARD_SKILL_FRONTMATTER],
      additional: [],
    },
    manifest: {
      files: ['.codex-plugin/plugin.json'],
      required: true,
      notes: 'The build plugins guide documents plugin.json, skills/, .mcp.json, .app.json, and assets/ as the standard plugin structure.',
    },
    mcp: {
      files: ['.mcp.json'],
      rootKey: 'mcpServers',
      transports: ['stdio', 'http', 'sse'],
      auth: ['bearer_token_env_var', 'env_http_headers', 'http_headers', 'platform-managed auth'],
      notes: 'The current build guide documents mcpServers as a path to .mcp.json in the plugin bundle.',
    },
    hooks: {
      supported: true,
      files: ['.codex/hooks.json', '~/.codex/hooks.json'],
      eventNames: [],
      notes: 'Codex documents hooks in project/user config, but the current plugin build guide does not document plugin-packaged hooks.',
    },
    instructions: {
      files: ['AGENTS.md'],
      format: 'markdown',
    },
    sources: [
      { label: 'Codex build plugins docs', url: 'https://developers.openai.com/codex/plugins/build' },
      { label: 'Codex hooks docs', url: 'https://developers.openai.com/codex/hooks' },
      { label: 'Codex skills docs', url: 'https://developers.openai.com/codex/skills' },
      { label: 'Codex MCP docs', url: 'https://developers.openai.com/codex/mcp' },
      { label: 'Codex AGENTS.md guide', url: 'https://developers.openai.com/codex/guides/agents-md' },
    ],
  },
  'opencode': {
    platform: 'opencode',
    summary: 'OpenCode plugins are code-first TypeScript or JavaScript modules that register skills, commands, MCP servers, and hook handlers programmatically.',
    limits: PLATFORM_LIMITS['opencode'],
    limitPolicies: PLATFORM_LIMIT_POLICIES['opencode'],
    skillDiscoveryDirs: [
      { path: 'skills/', level: 'supported' },
    ],
    frontmatter: {
      standard: [...STANDARD_SKILL_FRONTMATTER],
      additional: [],
    },
    manifest: {
      files: ['package.json', 'index.ts'],
      required: true,
      notes: 'OpenCode plugins are loaded as local modules or npm packages rather than a JSON manifest-only bundle.',
    },
    mcp: {
      files: ['index.ts'],
      transports: ['local', 'remote'],
      auth: ['headers', 'programmatic env interpolation', 'OAuth'],
      notes: 'OpenCode plugin code mutates Config["mcp"] programmatically; the underlying platform config supports local and remote servers.',
    },
    hooks: {
      supported: true,
      files: ['index.ts'],
      eventNames: [],
      notes: 'OpenCode hooks are plugin event handlers implemented in code, not a separate hooks.json file.',
    },
    instructions: {
      files: ['index.ts'],
      format: 'typescript',
      notes: 'Plugins inject instructions into the runtime system prompt from code.',
    },
    sources: [
      { label: 'OpenCode plugins docs', url: 'https://opencode.ai/docs/plugins/' },
      { label: 'OpenCode skills docs', url: 'https://opencode.ai/docs/skills/' },
      { label: 'OpenCode MCP servers docs', url: 'https://opencode.ai/docs/mcp-servers/' },
    ],
  },
  'openhands': {
    platform: 'openhands',
    summary: 'OpenHands plugins use a Claude-style manifest at .plugin/plugin.json and support skills, hooks, and MCP.',
    limits: PLATFORM_LIMITS['openhands'],
    limitPolicies: PLATFORM_LIMIT_POLICIES['openhands'],
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
    limitPolicies: PLATFORM_LIMIT_POLICIES['warp'],
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
    limitPolicies: PLATFORM_LIMIT_POLICIES['gemini-cli'],
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
    limitPolicies: PLATFORM_LIMIT_POLICIES['roo-code'],
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
    limitPolicies: PLATFORM_LIMIT_POLICIES['cline'],
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
    limitPolicies: PLATFORM_LIMIT_POLICIES['amp'],
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
