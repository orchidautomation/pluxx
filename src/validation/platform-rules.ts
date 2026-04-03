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
  platform: 'claude-code' | 'github-copilot' | 'cline'
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
    form: 'path-or-inline' | 'script-directory'
    defaultFiles: string[]
  }
  acp: {
    supported: boolean
    launchCommand: string
    configFiles: string[]
    notes: string[]
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
  acp: {
    supported: false,
    launchCommand: '',
    configFiles: [],
    notes: ['Claude Code does not use ACP for plugin integration.'],
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
  acp: {
    supported: false,
    launchCommand: '',
    configFiles: [],
    notes: ['GitHub Copilot CLI plugins do not expose ACP integration points.'],
  },
}

const CLINE_RULES: PlatformRule = {
  platform: 'cline',
  sourceUrls: [
    'https://docs.cline.bot/customization/cline-rules',
    'https://docs.cline.bot/customization/skills',
    'https://docs.cline.bot/customization/hooks',
    'https://docs.cline.bot/mcp/adding-and-configuring-servers',
    'https://docs.cline.bot/cline-cli/configuration',
    'https://docs.cline.bot/cline-cli/acp-editor-integrations',
  ],
  notes: [
    'Cline rules are markdown files in .clinerules/; Cline processes .md and .txt files and combines them.',
    'Conditional rules use YAML frontmatter with paths globs; rules without frontmatter are always active.',
    'Cline supports hook scripts in .clinerules/hooks/ (workspace) and ~/Documents/Cline/Hooks/ (global).',
    'Hook scripts receive JSON via stdin and must return JSON via stdout with { cancel, contextModification, errorMessage }.',
    'Hook-specific input fields are taskStart, taskResume, taskCancel, taskComplete, preToolUse, postToolUse, userPromptSubmit, preCompact.',
    'Cline CLI stores MCP settings in ~/.cline/data/settings/cline_mcp_settings.json; pluxx also emits project-local .cline/mcp.json for generated plugins.',
    'Remote MCP auth is supported via OAuth flows and explicit headers in MCP server config.',
  ],
  manifest: {
    requiredFileName: '.clinerules/',
    requiredFields: [],
    optionalMetadataFields: [
      {
        name: 'paths',
        required: false,
        type: 'string|string[]',
        notes: 'Conditional .clinerules frontmatter glob patterns.',
      },
    ],
    componentPathFields: [],
    fileLookupOrder: [
      '.clinerules/',
      'AGENTS.md',
      '.cursorrules',
      '.windsurfrules',
    ],
  },
  skills: {
    frontmatter: [
      {
        name: 'name',
        required: true,
        type: 'string',
        notes: 'Must match the skill directory name exactly (kebab-case recommended).',
      },
      {
        name: 'description',
        required: true,
        type: 'string',
        notes: 'Used for skill activation; max 1024 characters.',
      },
    ],
    discoveryOrder: [
      '.cline/skills/',
      '.clinerules/skills/',
      '.claude/skills/',
      '~/.cline/skills/',
    ],
  },
  mcp: {
    supported: true,
    manifestField: 'mcpServers',
    configLookupOrder: [
      '.cline/mcp.json',
      '~/.cline/data/settings/cline_mcp_settings.json',
      '<CLINE_DIR>/data/settings/cline_mcp_settings.json',
    ],
  },
  hooks: {
    supported: true,
    manifestField: 'hooks',
    form: 'script-directory',
    defaultFiles: [
      '.clinerules/hooks/',
      '~/Documents/Cline/Hooks/',
    ],
  },
  acp: {
    supported: true,
    launchCommand: 'cline --acp',
    configFiles: [
      '~/.jetbrains/acp.json',
      '<zed settings.json>.agent_servers',
    ],
    notes: [
      'Cline CLI supports ACP editor integrations without reducing Skills/Hooks/MCP capabilities.',
    ],
  },
}

export const PLATFORM_RULES: Record<PlatformRule['platform'], PlatformRule> = {
  'claude-code': CLAUDE_CODE_RULES,
  'github-copilot': GITHUB_COPILOT_RULES,
  cline: CLINE_RULES,
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
