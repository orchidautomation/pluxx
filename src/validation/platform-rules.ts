export interface PlatformRules {
  skill: {
    maxDescriptionLength: number | null
    maxDescriptionLengthHard: number | null
    nameFormat: RegExp
    nameMaxLength: number
    nameMustMatchDir: boolean
    supportedFrontmatter: string[]
    requiredFrontmatter: string[]
    recommendedFrontmatter?: string[]
  }
  hooks: {
    supportedEvents: string[]
    eventCasing: 'PascalCase' | 'camelCase'
    supportedFields: string[]
    supportedTypes?: string[]
  }
  mcp: {
    authFormats: string[]
    transportTypes: string[]
  }
  pluginManifest?: {
    requiredFields: string[]
    optionalFields: string[]
    nameFormat: RegExp
    maxFieldLengths: Record<string, number | null>
  }
  pluginValidate?: {
    checks: string[]
    warnings: string[]
  }
}

export const platformRules: Record<string, PlatformRules> = {
  'claude-code': {
    skill: {
      maxDescriptionLength: 250,
      // The docs describe truncation in listings, not rejection at parse time.
      maxDescriptionLengthHard: null,
      nameFormat: /^[a-z0-9-]+$/,
      nameMaxLength: 64,
      nameMustMatchDir: false,
      supportedFrontmatter: [
        'name',
        'description',
        'argument-hint',
        'disable-model-invocation',
        'user-invocable',
        'allowed-tools',
        'model',
        'effort',
        'context',
        'agent',
        'hooks',
        'paths',
        'shell',
      ],
      requiredFrontmatter: [],
      recommendedFrontmatter: ['description'],
    },
    hooks: {
      eventCasing: 'PascalCase',
      supportedEvents: [
        'SessionStart',
        'InstructionsLoaded',
        'UserPromptSubmit',
        'PreToolUse',
        'PermissionRequest',
        'PermissionDenied',
        'PostToolUse',
        'PostToolUseFailure',
        'Notification',
        'SubagentStart',
        'SubagentStop',
        'TaskCreated',
        'TaskCompleted',
        'Stop',
        'StopFailure',
        'TeammateIdle',
        'ConfigChange',
        'CwdChanged',
        'FileChanged',
        'WorktreeCreate',
        'WorktreeRemove',
        'PreCompact',
        'PostCompact',
        'Elicitation',
        'ElicitationResult',
        'SessionEnd',
      ],
      supportedFields: [
        'matcher',
        'hooks',
        'type',
        'if',
        'timeout',
        'shell',
        'command',
        'async',
        'url',
        'headers',
        'allowedEnvVars',
        'prompt',
        'model',
      ],
      supportedTypes: ['command', 'http', 'prompt', 'agent'],
    },
    mcp: {
      authFormats: [
        'Authorization bearer token in headers',
        'Custom header name + value template in headers',
        'OAuth (remote MCP server flow)',
      ],
      transportTypes: ['stdio', 'sse', 'http', 'streamable-http'],
    },
    pluginManifest: {
      requiredFields: ['name'],
      optionalFields: [
        'version',
        'description',
        'author',
        'homepage',
        'repository',
        'license',
        'keywords',
        'commands',
        'agents',
        'skills',
        'hooks',
        'mcpServers',
        'outputStyles',
        'lspServers',
        'userConfig',
        'channels',
      ],
      nameFormat: /^[a-z0-9-]+$/,
      maxFieldLengths: {
        name: null,
        description: null,
        version: null,
      },
    },
    pluginValidate: {
      checks: [
        'plugin.json syntax and schema',
        'skill frontmatter syntax and schema',
        'agent frontmatter syntax and schema',
        'command frontmatter syntax and schema',
        'hooks/hooks.json syntax and schema',
        'marketplace.json syntax and schema when validating a marketplace',
      ],
      warnings: [
        'marketplace has no plugins defined',
        'marketplace metadata.description missing',
        'plugin name not kebab-case',
      ],
    },
  },
}
