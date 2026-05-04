import { z } from 'zod'
import { PERMISSION_SELECTOR_KINDS, parsePermissionRule } from './permissions'

// ── MCP Server Auth ──────────────────────────────────────────────

const McpAuthNoneSchema = z.object({
  type: z.literal('none'),
}).strict()

const McpAuthBearerSchema = z.object({
  type: z.literal('bearer'),
  envVar: z.string(),
  headerName: z.string().default('Authorization'),
  headerTemplate: z.string().default('Bearer ${value}'),
}).strict()

const McpAuthHeaderSchema = z.object({
  type: z.literal('header'),
  envVar: z.string(),
  headerName: z.string(),
  headerTemplate: z.string().default('Bearer ${value}'),
}).strict()

const McpAuthPlatformSchema = z.object({
  type: z.literal('platform'),
  mode: z.enum(['oauth']).default('oauth'),
}).strict()

export const McpAuthSchema = z.preprocess(
  (value) => {
    if (value && typeof value === 'object' && !('type' in (value as Record<string, unknown>))) {
      return { ...(value as Record<string, unknown>), type: 'bearer' }
    }
    return value
  },
  z.discriminatedUnion('type', [McpAuthNoneSchema, McpAuthBearerSchema, McpAuthHeaderSchema, McpAuthPlatformSchema])
)

const McpServerHttpSchema = z.object({
  transport: z.literal('http'),
  url: z.string().url(),
  command: z.never().optional(),
  args: z.array(z.string()).optional(),
  env: z.record(z.string(), z.string()).optional(),
  auth: McpAuthSchema.optional(),
}).strict()

const McpServerSseSchema = z.object({
  transport: z.literal('sse'),
  url: z.string().url(),
  command: z.never().optional(),
  args: z.array(z.string()).optional(),
  env: z.record(z.string(), z.string()).optional(),
  auth: McpAuthSchema.optional(),
}).strict()

const McpServerStdioSchema = z.object({
  transport: z.literal('stdio'),
  command: z.string(),
  url: z.never().optional(),
  args: z.array(z.string()).optional(),
  env: z.record(z.string(), z.string()).optional(),
  auth: McpAuthSchema.optional(),
}).strict()

export const McpServerSchema = z.preprocess(
  (value) => {
    if (value && typeof value === 'object' && !('transport' in (value as Record<string, unknown>))) {
      return { ...(value as Record<string, unknown>), transport: 'http' }
    }
    return value
  },
  z.discriminatedUnion('transport', [McpServerHttpSchema, McpServerSseSchema, McpServerStdioSchema])
)

// ── Hooks ────────────────────────────────────────────────────────

export const HookEntrySchema = z.object({
  type: z.enum(['command', 'http', 'mcp_tool', 'prompt', 'agent']).default('command'),
  command: z.string().optional(),
  prompt: z.string().optional(),
  model: z.string().optional(),
  url: z.string().url().optional(),
  headers: z.record(z.string(), z.string()).optional(),
  allowedEnvVars: z.array(z.string()).optional(),
  server: z.string().optional(),
  tool: z.string().optional(),
  input: z.record(z.string(), z.unknown()).optional(),
  if: z.string().optional(),
  async: z.boolean().optional(),
  asyncRewake: z.boolean().optional(),
  shell: z.enum(['bash', 'powershell']).optional(),
  timeout: z.number().optional(),
  matcher: z.union([z.string(), z.record(z.string(), z.unknown())]).optional(),
  failClosed: z.boolean().optional(),
  loop_limit: z.number().nullable().optional(),
}).superRefine((entry, ctx) => {
  if (entry.type === 'command' && !entry.command) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['command'],
      message: 'Command hooks require a command.',
    })
  }

  if (entry.type === 'http' && !entry.url) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['url'],
      message: 'HTTP hooks require a url.',
    })
  }

  if (entry.type === 'mcp_tool') {
    if (!entry.server) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['server'],
        message: 'MCP tool hooks require a server.',
      })
    }
    if (!entry.tool) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['tool'],
        message: 'MCP tool hooks require a tool.',
      })
    }
  }

  if ((entry.type === 'prompt' || entry.type === 'agent') && !entry.prompt) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['prompt'],
      message: `${entry.type === 'agent' ? 'Agent' : 'Prompt'} hooks require a prompt.`,
    })
  }
})

export const HooksSchema = z.object({
  sessionStart: z.array(HookEntrySchema).optional(),
  sessionEnd: z.array(HookEntrySchema).optional(),
  preToolUse: z.array(HookEntrySchema).optional(),
  postToolUse: z.array(HookEntrySchema).optional(),
  postToolUseFailure: z.array(HookEntrySchema).optional(),
  subagentStart: z.array(HookEntrySchema).optional(),
  subagentStop: z.array(HookEntrySchema).optional(),
  beforeShellExecution: z.array(HookEntrySchema).optional(),
  afterShellExecution: z.array(HookEntrySchema).optional(),
  beforeMCPExecution: z.array(HookEntrySchema).optional(),
  afterMCPExecution: z.array(HookEntrySchema).optional(),
  afterFileEdit: z.array(HookEntrySchema).optional(),
  beforeReadFile: z.array(HookEntrySchema).optional(),
  beforeSubmitPrompt: z.array(HookEntrySchema).optional(),
  preCompact: z.array(HookEntrySchema).optional(),
  stop: z.array(HookEntrySchema).optional(),
  afterAgentResponse: z.array(HookEntrySchema).optional(),
  afterAgentThought: z.array(HookEntrySchema).optional(),
  beforeTabFileRead: z.array(HookEntrySchema).optional(),
  afterTabFileEdit: z.array(HookEntrySchema).optional(),
}).catchall(z.array(HookEntrySchema))

// ── Runtime Readiness ────────────────────────────────────────────

export const RuntimeReadinessRefreshSchema = z.object({
  command: z.string(),
  timeoutMs: z.number().int().positive().default(10000),
  detached: z.boolean().default(true),
})

export const RuntimeReadinessDependencySchema = z.object({
  id: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Use lowercase kebab-case for readiness dependency ids'),
  kind: z.enum(['status-file']).default('status-file'),
  path: z.string(),
  format: z.enum(['json']).default('json'),
  statusField: z.string().default('status'),
  readyValues: z.array(z.string()).default(['succeeded']),
  pendingValues: z.array(z.string()).default(['running']),
  failedValues: z.array(z.string()).default(['failed']),
  refresh: RuntimeReadinessRefreshSchema,
  description: z.string().optional(),
}).superRefine((dependency, ctx) => {
  const ready = new Set(dependency.readyValues)
  const pending = new Set(dependency.pendingValues)
  const failed = new Set(dependency.failedValues)
  const overlap = [
    ...ready,
    ...pending,
  ].filter((value, index, values) =>
    values.indexOf(value) === index
    && ((ready.has(value) ? 1 : 0) + (pending.has(value) ? 1 : 0) + (failed.has(value) ? 1 : 0) > 1),
  )
  if (overlap.length > 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['readyValues'],
      message: `Readiness dependency values must not overlap across ready/pending/failed buckets: ${overlap.join(', ')}`,
    })
  }
})

export const RuntimeReadinessGateSchema = z.object({
  dependency: z.string(),
  applyTo: z.array(z.enum(['mcp-tools', 'skills', 'commands'])).nonempty().default(['mcp-tools']),
  tools: z.array(z.string()).nonempty().optional(),
  skills: z.array(z.string()).nonempty().optional(),
  commands: z.array(z.string()).nonempty().optional(),
  timeoutMs: z.number().int().positive().default(15000),
  pollMs: z.number().int().positive().default(500),
  onTimeout: z.enum(['continue', 'warn', 'fail']).default('warn'),
  message: z.string().optional(),
}).superRefine((gate, ctx) => {
  if (gate.tools && !gate.applyTo.includes('mcp-tools')) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['tools'],
      message: 'Runtime readiness gate.tools requires applyTo to include "mcp-tools".',
    })
  }

  if (gate.skills && !gate.applyTo.includes('skills')) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['skills'],
      message: 'Runtime readiness gate.skills requires applyTo to include "skills".',
    })
  }

  if (gate.commands && !gate.applyTo.includes('commands')) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['commands'],
      message: 'Runtime readiness gate.commands requires applyTo to include "commands".',
    })
  }
})

export const RuntimeReadinessSchema = z.object({
  dependencies: z.array(RuntimeReadinessDependencySchema).default([]),
  gates: z.array(RuntimeReadinessGateSchema).default([]),
}).superRefine((config, ctx) => {
  const seenDependencyIds = new Set<string>()
  for (const [index, dependency] of config.dependencies.entries()) {
    if (seenDependencyIds.has(dependency.id)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['dependencies', index, 'id'],
        message: `Runtime readiness dependency id "${dependency.id}" is duplicated.`,
      })
    }
    seenDependencyIds.add(dependency.id)
  }

  const dependencyIds = new Set(config.dependencies.map(dependency => dependency.id))
  for (const [index, gate] of config.gates.entries()) {
    if (!dependencyIds.has(gate.dependency)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['gates', index, 'dependency'],
        message: `Runtime readiness gate references unknown dependency "${gate.dependency}".`,
      })
    }
  }
})

// ── Brand / Interface ────────────────────────────────────────────

export const BrandSchema = z.object({
  displayName: z.string(),
  shortDescription: z.string().optional(),
  longDescription: z.string().optional(),
  category: z.string().default('Productivity'),
  color: z.string().optional(),
  icon: z.string().optional(),
  logo: z.string().optional(),
  screenshots: z.array(z.string()).optional(),
  defaultPrompts: z.array(z.string()).optional(),
  websiteURL: z.string().url().optional(),
  privacyPolicyURL: z.string().url().optional(),
  termsOfServiceURL: z.string().url().optional(),
})

// ── Targets / User Config ───────────────────────────────────────

export const TargetPlatform = z.enum([
  'claude-code',
  'cursor',
  'codex',
  'opencode',
  'github-copilot',
  'openhands',
  'warp',
  'gemini-cli',
  'roo-code',
  'cline',
  'amp',
])
export type TargetPlatform = z.infer<typeof TargetPlatform>

const UserConfigValueSchema = z.union([z.string(), z.number(), z.boolean()])

export const UserConfigEntrySchema = z.object({
  key: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Use lowercase kebab-case for user config keys'),
  title: z.string(),
  description: z.string(),
  type: z.enum(['secret', 'string', 'number', 'boolean']).default('string'),
  required: z.boolean().default(true),
  envVar: z.string().optional(),
  defaultValue: UserConfigValueSchema.optional(),
  placeholder: z.string().optional(),
  targets: z.array(TargetPlatform).optional(),
}).superRefine((entry, ctx) => {
  if (entry.type === 'secret' && entry.defaultValue !== undefined) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['defaultValue'],
      message: 'Secret userConfig entries should not define a defaultValue.',
    })
  }

  if (entry.type === 'number' && entry.defaultValue !== undefined && typeof entry.defaultValue !== 'number') {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['defaultValue'],
      message: 'Number userConfig entries require a numeric defaultValue.',
    })
  }

  if (entry.type === 'boolean' && entry.defaultValue !== undefined && typeof entry.defaultValue !== 'boolean') {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['defaultValue'],
      message: 'Boolean userConfig entries require a boolean defaultValue.',
    })
  }
})

export const UserConfigSchema = z.array(UserConfigEntrySchema)

// ── Permissions ─────────────────────────────────────────────────

export const PermissionRuleSchema = z.string().superRefine((value, ctx) => {
  if (!parsePermissionRule(value)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `Permission rules must use the canonical DSL: ${PERMISSION_SELECTOR_KINDS.map(kind => `${kind}(...)`).join(', ')}`,
    })
  }
})

export const PermissionsSchema = z.object({
  allow: z.array(PermissionRuleSchema).optional(),
  ask: z.array(PermissionRuleSchema).optional(),
  deny: z.array(PermissionRuleSchema).optional(),
}).refine(
  permissions => (permissions.allow?.length ?? 0) + (permissions.ask?.length ?? 0) + (permissions.deny?.length ?? 0) > 0,
  {
    message: 'Permissions must declare at least one allow/ask/deny rule.',
  },
)

// ── Platform Overrides ───────────────────────────────────────────

export const ClaudeCodeOverridesSchema = z.object({
  skillDefaults: z.record(z.string(), z.unknown()).optional(),
  mcpAuth: z.enum(['inline', 'platform']).optional(),
}).catchall(z.unknown())

export const CursorOverridesSchema = z.object({
  mcpAuth: z.enum(['inline', 'platform']).optional(),
  rules: z.array(z.object({
    description: z.string(),
    globs: z.union([z.string(), z.array(z.string())]).optional(),
    alwaysApply: z.boolean().optional(),
    content: z.string().optional(),
  })).optional(),
}).catchall(z.unknown())

export const CodexOverridesSchema = z.object({
  interface: z.record(z.string(), z.unknown()).optional(),
}).catchall(z.unknown())

export const OpenCodeOverridesSchema = z.object({
  npmPackage: z.string().optional(),
}).catchall(z.unknown())

export const PlatformOverridesSchema = z.object({
  'claude-code': ClaudeCodeOverridesSchema.optional(),
  cursor: CursorOverridesSchema.optional(),
  codex: CodexOverridesSchema.optional(),
  opencode: OpenCodeOverridesSchema.optional(),
})

// ── Main Plugin Config ───────────────────────────────────────────

export const PluginConfigSchema = z.object({
  // Identity
  name: z.string().regex(/^[a-z0-9-]+$/, 'Must be lowercase with hyphens only'),
  version: z.string().default('0.1.0'),
  description: z.string(),
  author: z.object({
    name: z.string(),
    url: z.string().url().optional(),
    email: z.string().email().optional(),
  }),
  repository: z.string().optional(),
  license: z.string().default('MIT'),
  keywords: z.array(z.string()).optional(),

  // Brand
  brand: BrandSchema.optional(),
  userConfig: UserConfigSchema.optional(),
  permissions: PermissionsSchema.optional(),

  // Plugin components (paths relative to config file)
  skills: z.string().default('./skills/'),
  commands: z.string().optional(),
  agents: z.string().optional(),
  instructions: z.string().optional(),

  // MCP servers
  mcp: z.record(z.string(), McpServerSchema).optional(),

  // Runtime readiness gates
  readiness: RuntimeReadinessSchema.optional(),

  // Hooks
  hooks: HooksSchema.optional(),

  // Scripts (copied to all targets)
  scripts: z.string().optional(),

  // Assets (copied to all targets)
  assets: z.string().optional(),

  // Extra runtime directories copied to each target root as-is
  passthrough: z.array(z.string()).optional(),

  // Platform-specific overrides
  platforms: PlatformOverridesSchema.optional(),

  // Which platforms to generate
  targets: z.array(TargetPlatform).default(['claude-code', 'cursor', 'codex', 'opencode']),

  // Output directory
  outDir: z.string().default('./dist'),
})

export type PluginConfig = z.infer<typeof PluginConfigSchema>
export type McpServer = z.infer<typeof McpServerSchema>
export type McpAuth = z.infer<typeof McpAuthSchema>
export type HookEntry = z.infer<typeof HookEntrySchema>
export type RuntimeReadinessRefresh = z.infer<typeof RuntimeReadinessRefreshSchema>
export type RuntimeReadinessDependency = z.infer<typeof RuntimeReadinessDependencySchema>
export type RuntimeReadinessGate = z.infer<typeof RuntimeReadinessGateSchema>
export type RuntimeReadiness = z.infer<typeof RuntimeReadinessSchema>
export type Brand = z.infer<typeof BrandSchema>
export type UserConfigEntry = z.infer<typeof UserConfigEntrySchema>
export type PermissionRule = z.infer<typeof PermissionRuleSchema>
export type Permissions = z.infer<typeof PermissionsSchema>
export type Hooks = z.infer<typeof HooksSchema>

export const PLUXX_COMPILER_BUCKETS = [
  'instructions',
  'skills',
  'commands',
  'agents',
  'hooks',
  'permissions',
  'runtime',
  'distribution',
] as const

export type PluxxCompilerBucket = typeof PLUXX_COMPILER_BUCKETS[number]

export interface PluginInstructionsBucket {
  path?: string
}

export interface PluginSkillsBucket {
  path: string
}

export interface PluginCommandsBucket {
  path?: string
}

export interface PluginAgentsBucket {
  path?: string
}

export interface PluginHooksBucket {
  config?: Hooks
}

export interface PluginPermissionsBucket {
  rules?: Permissions
}

export interface PluginRuntimeBucket {
  mcp?: Record<string, McpServer>
  readiness?: RuntimeReadiness
  scriptsPath?: string
  assetsPath?: string
  passthroughPaths: string[]
  mcpSurface: PluginRuntimeMcpSubprimitive
  readinessSurface: PluginRuntimeReadinessSubprimitive
  payloadSurface: PluginRuntimePayloadSubprimitive
}

export interface PluginRuntimeMcpSubprimitive {
  servers?: Record<string, McpServer>
  hasRuntimeAuth: boolean
}

export interface PluginRuntimeReadinessSubprimitive {
  config?: RuntimeReadiness
}

export interface PluginRuntimePayloadSubprimitive {
  scriptsPath?: string
  assetsPath?: string
  passthroughPaths: string[]
}

export interface PluginDistributionBucket {
  identity: Pick<PluginConfig, 'name' | 'version' | 'description' | 'author' | 'repository' | 'license' | 'keywords'>
  brand?: Brand
  userConfig: UserConfigEntry[]
  targets: TargetPlatform[]
  outDir: string
  brandingSurface: PluginDistributionBrandingSubprimitive
  installSurface: PluginDistributionInstallSubprimitive
  outputSurface: PluginDistributionOutputSubprimitive
}

export interface PluginDistributionBrandingSubprimitive {
  identity: Pick<PluginConfig, 'name' | 'version' | 'description' | 'author' | 'repository' | 'license' | 'keywords'>
  brand?: Brand
}

export interface PluginDistributionInstallSubprimitive {
  userConfig: UserConfigEntry[]
}

export interface PluginDistributionOutputSubprimitive {
  targets: TargetPlatform[]
  outDir: string
}

export interface PluginCompilerBuckets {
  instructions: PluginInstructionsBucket
  skills: PluginSkillsBucket
  commands: PluginCommandsBucket
  agents: PluginAgentsBucket
  hooks: PluginHooksBucket
  permissions: PluginPermissionsBucket
  runtime: PluginRuntimeBucket
  distribution: PluginDistributionBucket
}

export function getPluginCompilerBuckets(config: PluginConfig): PluginCompilerBuckets {
  const runtimeMcpSurface: PluginRuntimeMcpSubprimitive = {
    servers: config.mcp,
    hasRuntimeAuth: Object.values(config.mcp ?? {}).some((server) => server.auth?.type !== 'none' && server.auth !== undefined),
  }
  const runtimeReadinessSurface: PluginRuntimeReadinessSubprimitive = {
    config: config.readiness,
  }
  const runtimePayloadSurface: PluginRuntimePayloadSubprimitive = {
    scriptsPath: config.scripts,
    assetsPath: config.assets,
    passthroughPaths: config.passthrough ?? [],
  }
  const distributionBrandingSurface: PluginDistributionBrandingSubprimitive = {
    identity: {
      name: config.name,
      version: config.version,
      description: config.description,
      author: config.author,
      repository: config.repository,
      license: config.license,
      keywords: config.keywords,
    },
    brand: config.brand,
  }
  const distributionInstallSurface: PluginDistributionInstallSubprimitive = {
    userConfig: config.userConfig ?? [],
  }
  const distributionOutputSurface: PluginDistributionOutputSubprimitive = {
    targets: config.targets,
    outDir: config.outDir,
  }

  return {
    instructions: {
      path: config.instructions,
    },
    skills: {
      path: config.skills,
    },
    commands: {
      path: config.commands,
    },
    agents: {
      path: config.agents,
    },
    hooks: {
      config: config.hooks,
    },
    permissions: {
      rules: config.permissions,
    },
    runtime: {
      mcp: runtimeMcpSurface.servers,
      readiness: runtimeReadinessSurface.config,
      scriptsPath: runtimePayloadSurface.scriptsPath,
      assetsPath: runtimePayloadSurface.assetsPath,
      passthroughPaths: runtimePayloadSurface.passthroughPaths,
      mcpSurface: runtimeMcpSurface,
      readinessSurface: runtimeReadinessSurface,
      payloadSurface: runtimePayloadSurface,
    },
    distribution: {
      identity: distributionBrandingSurface.identity,
      brand: distributionBrandingSurface.brand,
      userConfig: distributionInstallSurface.userConfig,
      targets: distributionOutputSurface.targets,
      outDir: distributionOutputSurface.outDir,
      brandingSurface: distributionBrandingSurface,
      installSurface: distributionInstallSurface,
      outputSurface: distributionOutputSurface,
    },
  }
}

export function getConfiguredCompilerBuckets(config: PluginConfig): PluxxCompilerBucket[] {
  const buckets = getPluginCompilerBuckets(config)
  const configured: PluxxCompilerBucket[] = []

  if (buckets.instructions.path) configured.push('instructions')
  if (buckets.skills.path) configured.push('skills')
  if (buckets.commands.path) configured.push('commands')
  if (buckets.agents.path) configured.push('agents')
  if (buckets.hooks.config && Object.keys(buckets.hooks.config).length > 0) configured.push('hooks')

  const hasPermissions = Boolean(
    buckets.permissions.rules
    && ((buckets.permissions.rules.allow?.length ?? 0)
      + (buckets.permissions.rules.ask?.length ?? 0)
      + (buckets.permissions.rules.deny?.length ?? 0) > 0),
  )
  if (hasPermissions) configured.push('permissions')

  const hasRuntime = Boolean(
    (buckets.runtime.mcp && Object.keys(buckets.runtime.mcp).length > 0)
    || (buckets.runtime.readiness
      && (buckets.runtime.readiness.dependencies.length > 0
        || buckets.runtime.readiness.gates.length > 0))
    || buckets.runtime.scriptsPath
    || buckets.runtime.assetsPath
    || buckets.runtime.passthroughPaths.length > 0,
  )
  if (hasRuntime) configured.push('runtime')

  configured.push('distribution')

  return configured
}
