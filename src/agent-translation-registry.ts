import type { CanonicalAgentMetadata } from './agents'

export type AgentTranslationPlatform = 'claude-code' | 'cursor' | 'codex' | 'opencode'

type PrimitiveTranslationMode = 'preserve' | 'translate' | 'degrade' | 'drop'

export interface AgentPrimitiveCapability {
  mode: PrimitiveTranslationMode
  nativeSurfaces: string[]
  notes?: string
}

interface AgentFieldDescriptor {
  key: string
  present: (metadata: CanonicalAgentMetadata) => boolean
}

interface AgentTranslationProfile {
  degradedFields: AgentFieldDescriptor[]
  guidanceSurfaces: readonly string[]
  message: (fields: string[]) => string
}

const HAS_BOOLEAN = (value: boolean | undefined): boolean => typeof value === 'boolean'

const CODEX_AGENT_CAPABILITY_NOTE = 'Codex custom agents and subagents are real native surfaces, but they are not packaged the same way as Claude or Cursor plugin agents. Local May 13, 2026 headless probes now prove explicit invocation, built-in-name override, project-local precedence, and discovered `.agents/skills` inheritance. The same maintained headless suite also showed two config-depth caveats: a parent `[[skills.config]] enabled = false` entry did not disable a discovered project skill, and an agent-local `[[skills.config]]` entry did not preload an undiscovered `skills/` path. The maintained `bun scripts/probe-codex-mcp-runtime.ts --json` headless probe now also shows a more precise MCP approval split: default project-scoped and user-scoped root MCP both emit a real `mcp_tool_call` item but fail it with `user cancelled MCP tool call` before any server-side `tools/call`, while the default inline-agent path reaches startup plus `tools/list` and then falls back to `MCP_PROOF_MARKER_MISSING`. The same maintained suite now also proves five approved allow-paths: explicit `[mcp_servers.<id>.tools.<tool>] approval_mode = "approve"` works for project-scoped root MCP, user-scoped root MCP, agent-local inline `mcp_servers`, and custom agents that inherit an approved project-scoped or user-scoped root MCP server. All three approved custom-agent MCP paths still avoid a root `mcp_tool_call` item in the parent `codex exec --json` stream and instead surface child `agents_states` moving through `pending_init` to `completed`; project-scoped servers still do not appear in `codex mcp list`, and user-scoped servers do appear there. The maintained `bun scripts/probe-codex-agents-interactive-runtime.ts --json` trusted interactive probe also showed the same `sandbox_mode = "read-only"` child agent still wrote to the workspace there too, so these fields are not yet uniformly trustworthy runtime boundaries.'

const AGENT_PRIMITIVE_CAPABILITIES: Record<AgentTranslationPlatform, AgentPrimitiveCapability> = {
  'claude-code': {
    mode: 'preserve',
    nativeSurfaces: ['agents/*.md'],
    notes: 'Claude plugin agents are a first-class native surface with rich frontmatter.',
  },
  cursor: {
    mode: 'translate',
    nativeSurfaces: ['agents/', '.cursor/agents/', '~/.cursor/agents/'],
    notes: 'Cursor specialization and tool access often live more naturally in subagents than in skills.',
  },
  codex: {
    mode: 'translate',
    nativeSurfaces: ['.codex/agents/*.toml', '~/.codex/agents/*.toml', 'subagent workflows'],
    notes: CODEX_AGENT_CAPABILITY_NOTE,
  },
  opencode: {
    mode: 'preserve',
    nativeSurfaces: ['agents/*.md', 'config agent definitions'],
    notes: 'OpenCode agents are first-class native surfaces. Prefer permission-first agent config for new builds; legacy tools remains compatibility input, not the preferred emitted shape.',
  },
}

const AGENT_TRANSLATION_PROFILES: Record<AgentTranslationPlatform, AgentTranslationProfile> = {
  'claude-code': {
    degradedFields: [],
    guidanceSurfaces: ['agents/*.md'],
    message: () => '',
  },
  cursor: {
    degradedFields: [
      { key: 'mode', present: (metadata) => !!metadata.mode },
      { key: 'hidden', present: (metadata) => metadata.hidden },
      { key: 'model_reasoning_effort', present: (metadata) => !!metadata.modelReasoningEffort },
      { key: 'sandbox_mode', present: (metadata) => !!metadata.sandboxMode },
      { key: 'temperature', present: (metadata) => typeof metadata.temperature === 'number' },
      { key: 'steps', present: (metadata) => typeof metadata.steps === 'number' },
      { key: 'disable', present: (metadata) => HAS_BOOLEAN(metadata.disabled) },
      { key: 'color', present: (metadata) => !!metadata.color },
      { key: 'topP', present: (metadata) => typeof metadata.topP === 'number' },
      { key: 'skills', present: (metadata) => !!metadata.skills },
      { key: 'memory', present: (metadata) => !!metadata.memory },
      { key: 'background', present: (metadata) => HAS_BOOLEAN(metadata.background) },
      { key: 'isolation', present: (metadata) => !!metadata.isolation },
      { key: 'permission', present: (metadata) => !!metadata.permission },
      { key: 'tools', present: (metadata) => metadata.tools !== undefined },
    ],
    guidanceSurfaces: ['subagent framing', 'generated notes'],
    message: (fields) => `Agent fields ${fields.map((field) => `"${field}"`).join(', ')} are not preserved as first-class Cursor agent frontmatter today. Pluxx translates that intent through subagent framing and generated notes instead.`,
  },
  codex: {
    degradedFields: [
      { key: 'mode', present: (metadata) => !!metadata.mode },
      { key: 'hidden', present: (metadata) => metadata.hidden },
      { key: 'temperature', present: (metadata) => typeof metadata.temperature === 'number' },
      { key: 'steps', present: (metadata) => typeof metadata.steps === 'number' },
      { key: 'disable', present: (metadata) => HAS_BOOLEAN(metadata.disabled) },
      { key: 'color', present: (metadata) => !!metadata.color },
      { key: 'topP', present: (metadata) => typeof metadata.topP === 'number' },
      { key: 'skills', present: (metadata) => !!metadata.skills },
      { key: 'memory', present: (metadata) => !!metadata.memory },
      { key: 'background', present: (metadata) => HAS_BOOLEAN(metadata.background) },
      { key: 'isolation', present: (metadata) => !!metadata.isolation },
      { key: 'permission', present: (metadata) => !!metadata.permission },
      { key: 'tools', present: (metadata) => metadata.tools !== undefined },
    ],
    guidanceSurfaces: ['developer instructions', 'generated companion surfaces'],
    message: (fields) => `Agent fields ${fields.map((field) => `"${field}"`).join(', ')} are not native Codex TOML fields today. Pluxx keeps the specialist behavior, but translates that intent through developer instructions and companion surfaces instead.`,
  },
  opencode: {
    degradedFields: [
      { key: 'model_reasoning_effort', present: (metadata) => !!metadata.modelReasoningEffort },
      { key: 'sandbox_mode', present: (metadata) => !!metadata.sandboxMode },
      { key: 'skills', present: (metadata) => !!metadata.skills },
      { key: 'memory', present: (metadata) => !!metadata.memory },
      { key: 'background', present: (metadata) => HAS_BOOLEAN(metadata.background) },
      { key: 'isolation', present: (metadata) => !!metadata.isolation },
    ],
    guidanceSurfaces: ['agent config notes', 'runtime/developer guidance'],
    message: (fields) => `Agent fields ${fields.map((field) => `"${field}"`).join(', ')} are not native OpenCode agent config fields today. Pluxx keeps the specialist behavior, but translates that intent through agent config notes and surrounding runtime guidance instead.`,
  },
}

export function getAgentPrimitiveCapability(platform: AgentTranslationPlatform): AgentPrimitiveCapability {
  return AGENT_PRIMITIVE_CAPABILITIES[platform]
}

export function getTranslatedAgentFields(
  platform: AgentTranslationPlatform,
  metadata: CanonicalAgentMetadata,
): string[] {
  return AGENT_TRANSLATION_PROFILES[platform].degradedFields
    .filter((field) => field.present(metadata))
    .map((field) => field.key)
}

export function getAgentTranslationMessage(
  platform: AgentTranslationPlatform,
  fields: string[],
): string | null {
  if (fields.length === 0) return null
  return AGENT_TRANSLATION_PROFILES[platform].message(fields)
}

export function getAgentTranslationSurfaces(platform: AgentTranslationPlatform): readonly string[] {
  return AGENT_TRANSLATION_PROFILES[platform].guidanceSurfaces
}
