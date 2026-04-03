export const AGENT_SKILLS_RULES = {
  name: {
    maxLength: 64,
    pattern: /^[a-z0-9-]+$/,
  },
  description: {
    maxLength: 1024,
  },
} as const

export const CLAUDE_CODE_RULES = {
  description: {
    maxDisplayLength: 250,
  },
} as const

export const CODEX_RULES = {
  interface: {
    maxDefaultPrompts: 3,
    maxDefaultPromptLength: 128,
    // Codex skill metadata loader validates #RRGGBB.
    brandColorPattern: /^#[0-9a-fA-F]{6}$/,
    // Codex source currently treats capabilities as free-form strings.
    // This set reflects the documented marketplace vocabulary.
    knownCapabilities: ['Interactive', 'Read', 'Write'] as const,
  },
  manifestPaths: {
    requiredPrefix: './',
  },
  mcp: {
    serverNamePattern: /^[a-zA-Z0-9_-]+$/,
  },
  hooks: {
    supportedEvents: [
      'sessionStart',
      'preToolUse',
      'postToolUse',
      'beforeSubmitPrompt',
      'stop',
    ] as const,
    supportedEventPascalCase: [
      'SessionStart',
      'PreToolUse',
      'PostToolUse',
      'UserPromptSubmit',
      'Stop',
    ] as const,
    supportedHandlerTypes: ['command', 'prompt', 'agent'] as const,
  },
  marketplace: {
    installationPolicies: ['NOT_AVAILABLE', 'AVAILABLE', 'INSTALLED_BY_DEFAULT'] as const,
    authPolicies: ['ON_INSTALL', 'ON_USE'] as const,
    sourceTypes: ['local'] as const,
    products: ['CODEX', 'CHATGPT', 'ATLAS'] as const,
  },
} as const

export type KnownCodexCapability = typeof CODEX_RULES.interface.knownCapabilities[number]
