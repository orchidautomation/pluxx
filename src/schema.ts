import { z } from 'zod'

// ── MCP Server Auth ──────────────────────────────────────────────

export const McpAuthSchema = z.object({
  type: z.enum(['bearer', 'header', 'none']).default('bearer'),
  envVar: z.string().optional(),
  headerName: z.string().default('Authorization'),
  headerTemplate: z.string().default('Bearer ${value}'),
})

export const McpServerSchema = z.object({
  url: z.string().url(),
  auth: McpAuthSchema.optional(),
  transport: z.enum(['http', 'sse', 'stdio']).default('http'),
  command: z.string().optional(),
  args: z.array(z.string()).optional(),
  env: z.record(z.string()).optional(),
})

// ── Hooks ────────────────────────────────────────────────────────

export const HookEntrySchema = z.object({
  command: z.string(),
  timeout: z.number().optional(),
  matcher: z.string().optional(),
  failClosed: z.boolean().optional(),
})

export const HooksSchema = z.object({
  sessionStart: z.array(HookEntrySchema).optional(),
  sessionEnd: z.array(HookEntrySchema).optional(),
  preToolUse: z.array(HookEntrySchema).optional(),
  postToolUse: z.array(HookEntrySchema).optional(),
  beforeShellExecution: z.array(HookEntrySchema).optional(),
  afterShellExecution: z.array(HookEntrySchema).optional(),
  beforeMCPExecution: z.array(HookEntrySchema).optional(),
  afterMCPExecution: z.array(HookEntrySchema).optional(),
  afterFileEdit: z.array(HookEntrySchema).optional(),
  beforeReadFile: z.array(HookEntrySchema).optional(),
  beforeSubmitPrompt: z.array(HookEntrySchema).optional(),
  stop: z.array(HookEntrySchema).optional(),
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

// ── Platform Overrides ───────────────────────────────────────────

export const ClaudeCodeOverridesSchema = z.object({
  skillDefaults: z.record(z.unknown()).optional(),
}).catchall(z.unknown())

export const CursorOverridesSchema = z.object({
  rules: z.array(z.object({
    description: z.string(),
    globs: z.string().optional(),
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

export const TargetPlatform = z.enum(['claude-code', 'cursor', 'codex', 'opencode'])
export type TargetPlatform = z.infer<typeof TargetPlatform>

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
