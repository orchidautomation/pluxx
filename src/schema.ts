import { z } from 'zod'

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
  env: z.record(z.string()).optional(),
  auth: McpAuthSchema.optional(),
}).strict()

const McpServerSseSchema = z.object({
  transport: z.literal('sse'),
  url: z.string().url(),
  command: z.never().optional(),
  args: z.array(z.string()).optional(),
  env: z.record(z.string()).optional(),
  auth: McpAuthSchema.optional(),
}).strict()

const McpServerStdioSchema = z.object({
  transport: z.literal('stdio'),
  command: z.string(),
  url: z.never().optional(),
  args: z.array(z.string()).optional(),
  env: z.record(z.string()).optional(),
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
  type: z.enum(['command', 'prompt']).default('command'),
  command: z.string().optional(),
  prompt: z.string().optional(),
  model: z.string().optional(),
  timeout: z.number().optional(),
  matcher: z.union([z.string(), z.record(z.unknown())]).optional(),
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

  if (entry.type === 'prompt' && !entry.prompt) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['prompt'],
      message: 'Prompt hooks require a prompt.',
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

// ── Platform Overrides ───────────────────────────────────────────

export const ClaudeCodeOverridesSchema = z.object({
  skillDefaults: z.record(z.unknown()).optional(),
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
  interface: z.record(z.unknown()).optional(),
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

  // Plugin components (paths relative to config file)
  skills: z.string().default('./skills/'),
  commands: z.string().optional(),
  agents: z.string().optional(),
  instructions: z.string().optional(),

  // MCP servers
  mcp: z.record(McpServerSchema).optional(),

  // Hooks
  hooks: HooksSchema.optional(),

  // Scripts (copied to all targets)
  scripts: z.string().optional(),

  // Assets (copied to all targets)
  assets: z.string().optional(),

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
export type Brand = z.infer<typeof BrandSchema>
export type UserConfigEntry = z.infer<typeof UserConfigEntrySchema>
