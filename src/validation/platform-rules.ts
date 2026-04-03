export type ManifestFieldType =
  | 'string'
  | 'string[]'
  | 'boolean'
  | 'object'
  | 'string|string[]'
  | 'string|object'

export interface ManifestFieldRule {
  name: string
  required: boolean
  type: ManifestFieldType
  notes?: string
}

export interface SkillFrontmatterRule {
  name: string
  required: boolean
  type: 'string' | 'boolean' | 'object' | 'string|string[]'
  notes?: string
}

export interface PlatformRule {
  platform: 'claude-code' | 'github-copilot' | 'openhands'
  sourceUrls: string[]
  notes: string[]
  manifest: {
    requiredFileName: string
    requiredFields: ManifestFieldRule[]
    optionalMetadataFields: ManifestFieldRule[]
    componentPathFields: ManifestFieldRule[]
    fileLookupOrder: string[]
  }
  skills: {
    frontmatter: SkillFrontmatterRule[]
    discoveryOrder: string[]
  }
  mcp: {
    supported: boolean
    manifestField: string
    configLookupOrder: string[]
  }
  hooks: {
    supported: boolean
    manifestField: string
    form: 'path-or-inline'
    defaultFiles: string[]
  }
}

const CLAUDE_CODE_RULES: PlatformRule = {
  platform: 'claude-code',
  sourceUrls: [
    'https://code.claude.com/docs/en/plugins-reference',
    'https://code.claude.com/docs/en/plugins',
  ],
  notes: [
    'plugin.json is optional for Claude Code if default component locations are used.',
    'Default plugin manifest location is .claude-plugin/plugin.json.',
  ],
  manifest: {
    requiredFileName: 'plugin.json',
    requiredFields: [
      {
        name: 'name',
        required: true,
        type: 'string',
        notes: 'Required only when plugin.json is present.',
      },
    ],
    optionalMetadataFields: [
      { name: 'version', required: false, type: 'string' },
      { name: 'description', required: false, type: 'string' },
      { name: 'author', required: false, type: 'object' },
      { name: 'homepage', required: false, type: 'string' },
      { name: 'repository', required: false, type: 'string' },
      { name: 'license', required: false, type: 'string' },
      { name: 'keywords', required: false, type: 'string[]' },
    ],
    componentPathFields: [
      { name: 'commands', required: false, type: 'string|string[]' },
      { name: 'agents', required: false, type: 'string|string[]' },
      { name: 'skills', required: false, type: 'string|string[]' },
      { name: 'hooks', required: false, type: 'string|object' },
      { name: 'mcpServers', required: false, type: 'string|object' },
      { name: 'outputStyles', required: false, type: 'string|string[]' },
      { name: 'lspServers', required: false, type: 'string|object' },
      { name: 'userConfig', required: false, type: 'object' },
      { name: 'channels', required: false, type: 'object' },
    ],
    fileLookupOrder: ['.claude-plugin/plugin.json'],
  },
  skills: {
    frontmatter: [
      { name: 'name', required: true, type: 'string' },
      { name: 'description', required: true, type: 'string' },
    ],
    discoveryOrder: [
      'skills/ (plugin root default)',
      'commands/ (legacy skill location)',
    ],
  },
  mcp: {
    supported: true,
    manifestField: 'mcpServers',
    configLookupOrder: ['.mcp.json'],
  },
  hooks: {
    supported: true,
    manifestField: 'hooks',
    form: 'path-or-inline',
    defaultFiles: ['hooks/hooks.json'],
  },
}

const GITHUB_COPILOT_RULES: PlatformRule = {
  platform: 'github-copilot',
  sourceUrls: [
    'https://docs.github.com/en/copilot/reference/copilot-cli-reference/cli-plugin-reference',
    'https://docs.github.com/en/copilot/reference/cli-command-reference',
    'https://docs.github.com/en/copilot/how-tos/copilot-cli/customize-copilot/plugins-creating',
  ],
  notes: [
    'Copilot CLI plugin schema is Claude-compatible in core fields but adds Copilot-specific conventions and fields.',
    'Copilot CLI supports plugin.json in multiple locations and defaults to plugin root conventions.',
  ],
  manifest: {
    requiredFileName: 'plugin.json',
    requiredFields: [
      {
        name: 'name',
        required: true,
        type: 'string',
        notes: 'Kebab-case, max 64 characters.',
      },
    ],
    optionalMetadataFields: [
      { name: 'description', required: false, type: 'string' },
      { name: 'version', required: false, type: 'string' },
      { name: 'author', required: false, type: 'object' },
      { name: 'homepage', required: false, type: 'string' },
      { name: 'repository', required: false, type: 'string' },
      { name: 'license', required: false, type: 'string' },
      { name: 'keywords', required: false, type: 'string[]' },
      { name: 'category', required: false, type: 'string' },
      { name: 'tags', required: false, type: 'string[]' },
    ],
    componentPathFields: [
      { name: 'agents', required: false, type: 'string|string[]' },
      { name: 'skills', required: false, type: 'string|string[]' },
      { name: 'commands', required: false, type: 'string|string[]' },
      { name: 'hooks', required: false, type: 'string|object' },
      { name: 'mcpServers', required: false, type: 'string|object' },
      { name: 'lspServers', required: false, type: 'string|object' },
    ],
    fileLookupOrder: [
      '.plugin/plugin.json',
      'plugin.json',
      '.github/plugin/plugin.json',
      '.claude-plugin/plugin.json',
    ],
  },
  skills: {
    frontmatter: [
      {
        name: 'name',
        required: true,
        type: 'string',
        notes: 'Letters, numbers, hyphens only. Max 64 chars.',
      },
      {
        name: 'description',
        required: true,
        type: 'string',
        notes: 'Max 1024 chars.',
      },
      {
        name: 'allowed-tools',
        required: false,
        type: 'string|string[]',
      },
      {
        name: 'user-invocable',
        required: false,
        type: 'boolean',
      },
      {
        name: 'disable-model-invocation',
        required: false,
        type: 'boolean',
      },
    ],
    discoveryOrder: [
      '.github/skills/',
      '.agents/skills/',
      '.claude/skills/',
      'parent .github/.agents/.claude skill dirs (monorepo inheritance)',
      '~/.copilot/skills/',
      '~/.agents/skills/',
      '~/.claude/skills/',
      'plugin-defined skill dirs',
      'COPILOT_SKILLS_DIRS',
    ],
  },
  mcp: {
    supported: true,
    manifestField: 'mcpServers',
    configLookupOrder: [
      '.mcp.json',
      '.vscode/mcp.json',
      '.devcontainer/devcontainer.json',
      '.github/mcp.json',
    ],
  },
  hooks: {
    supported: true,
    manifestField: 'hooks',
    form: 'path-or-inline',
    defaultFiles: ['hooks.json', 'hooks/hooks.json'],
  },
}

const OPENHANDS_RULES: PlatformRule = {
  platform: 'openhands',
  sourceUrls: [
    'https://docs.openhands.dev/sdk/guides/plugins',
    'https://docs.openhands.dev/sdk/guides/skill',
    'https://docs.openhands.dev/openhands/usage/cli/mcp-servers',
  ],
  notes: [
    'OpenHands plugin format is documented as Claude Code-compatible, but manifest location is .plugin/plugin.json (not .claude-plugin/plugin.json).',
    'Unlike Claude Code, OpenHands docs mark plugin metadata as required.',
    'OpenHands supports the AgentSkills standard with optional keyword trigger frontmatter fields.',
  ],
  manifest: {
    requiredFileName: 'plugin.json',
    requiredFields: [
      { name: 'name', required: true, type: 'string' },
    ],
    optionalMetadataFields: [
      { name: 'version', required: false, type: 'string' },
      { name: 'description', required: false, type: 'string' },
      { name: 'author', required: false, type: 'object' },
      { name: 'homepage', required: false, type: 'string' },
      { name: 'repository', required: false, type: 'string' },
      { name: 'license', required: false, type: 'string' },
      { name: 'keywords', required: false, type: 'string[]' },
    ],
    componentPathFields: [
      { name: 'commands', required: false, type: 'string|string[]' },
      { name: 'agents', required: false, type: 'string|string[]' },
      { name: 'skills', required: false, type: 'string|string[]' },
      { name: 'hooks', required: false, type: 'string|object' },
      { name: 'mcpServers', required: false, type: 'string|object' },
      { name: 'outputStyles', required: false, type: 'string|string[]' },
      { name: 'lspServers', required: false, type: 'string|object' },
      { name: 'userConfig', required: false, type: 'object' },
      { name: 'channels', required: false, type: 'object' },
    ],
    fileLookupOrder: ['.plugin/plugin.json'],
  },
  skills: {
    frontmatter: [
      { name: 'name', required: true, type: 'string' },
      { name: 'description', required: true, type: 'string' },
      {
        name: 'trigger',
        required: false,
        type: 'object',
        notes: 'OpenHands supports keyword trigger objects in SKILL.md frontmatter.',
      },
      {
        name: 'triggers',
        required: false,
        type: 'object',
        notes: 'AgentSkills-style trigger metadata is supported for progressive disclosure + keyword activation.',
      },
    ],
    discoveryOrder: [
      'skills/ (plugin root default)',
      '.agents/skills/',
      '.openhands/skills/installed/',
      'AGENTS.md, CLAUDE.md, GEMINI.md at workspace root',
    ],
  },
  mcp: {
    supported: true,
    manifestField: 'mcpServers',
    configLookupOrder: ['.mcp.json', '~/.openhands/mcp.json'],
  },
  hooks: {
    supported: true,
    manifestField: 'hooks',
    form: 'path-or-inline',
    defaultFiles: ['hooks/hooks.json', '.openhands/hooks.json'],
  },
}

export const PLATFORM_RULES: Record<PlatformRule['platform'], PlatformRule> = {
  'claude-code': CLAUDE_CODE_RULES,
  'github-copilot': GITHUB_COPILOT_RULES,
  openhands: OPENHANDS_RULES,
}

export function getPlatformRule(platform: PlatformRule['platform']): PlatformRule {
  return PLATFORM_RULES[platform]
}

export function isCopilotManifestClaudeCompatible(): boolean {
  const copilotFields = new Set(
    getPlatformRule('github-copilot').manifest.componentPathFields.map(field => field.name)
  )

  const claudeFields = new Set(
    getPlatformRule('claude-code').manifest.componentPathFields.map(field => field.name)
  )

  for (const field of ['agents', 'skills', 'commands', 'hooks', 'mcpServers', 'lspServers']) {
    if (!copilotFields.has(field)) return false
    if (!claudeFields.has(field)) return false
  }

  return true
}
