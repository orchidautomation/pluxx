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
  type: 'string' | 'boolean' | 'string|string[]'
  notes?: string
}

export interface PlatformRule {
  platform: 'claude-code' | 'github-copilot' | 'roo-code'
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

const ROO_CODE_RULES: PlatformRule = {
  platform: 'roo-code',
  sourceUrls: [
    'https://docs.roocode.com/basic-usage/using-mcp',
    'https://docs.roocode.com/features/custom-instructions',
    'https://docs.roocode.com/features/custom-rules',
    'https://docs.roocode.com/features/skills',
    'https://kilo.ai/docs/customize/skills',
  ],
  notes: [
    'Roo Code does not use a plugin manifest; conventions are file-system driven.',
    'Project MCP config is loaded from .roo/mcp.json with top-level mcpServers.',
    'Global MCP config is loaded from Roo settings mcp_settings.json.',
    'Rule loading prefers .roo/rules/ (and .roo/rules-{mode}/) before legacy .roorules files.',
    'Skill mode scoping is modeSlugs[] (preferred), legacy mode string, then directory fallback skills-{mode}/.',
  ],
  manifest: {
    requiredFileName: '(none)',
    requiredFields: [],
    optionalMetadataFields: [],
    componentPathFields: [],
    fileLookupOrder: [],
  },
  skills: {
    frontmatter: [
      { name: 'name', required: true, type: 'string' },
      {
        name: 'description',
        required: true,
        type: 'string',
        notes: '1-1024 chars after trimming.',
      },
      {
        name: 'modeSlugs',
        required: false,
        type: 'string|string[]',
        notes: 'Preferred mode-specific activation field (array of mode slugs).',
      },
      {
        name: 'mode',
        required: false,
        type: 'string',
        notes: 'Legacy single-mode fallback when modeSlugs is absent.',
      },
    ],
    discoveryOrder: [
      '~/.agents/skills/ and ~/.agents/skills-{mode}/',
      '.agents/skills/ and .agents/skills-{mode}/',
      '~/.roo/skills/ and ~/.roo/skills-{mode}/',
      '.roo/skills/ and .roo/skills-{mode}/',
    ],
  },
  mcp: {
    supported: true,
    manifestField: 'mcpServers',
    configLookupOrder: [
      '.roo/mcp.json (project)',
      'mcp_settings.json (global Roo settings)',
    ],
  },
  hooks: {
    supported: false,
    manifestField: '(none)',
    form: 'path-or-inline',
    defaultFiles: [],
  },
}

export const PLATFORM_RULES: Record<PlatformRule['platform'], PlatformRule> = {
  'claude-code': CLAUDE_CODE_RULES,
  'github-copilot': GITHUB_COPILOT_RULES,
  'roo-code': ROO_CODE_RULES,
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
