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

const CODEX_AGENT_INSTALL_NOTE = 'Codex plugins do not natively register plugin-local `.codex/agents/*.toml`. Pluxx treats generated agent TOML as install-managed companion state: install/apply syncs it into the active `CODEX_HOME/agents/<plugin>/`, verify checks that registration, and uninstall removes only unchanged Pluxx-owned files.'

const CODEX_AGENT_CAPABILITY_NOTE = 'Codex custom agents and subagents are real native surfaces, but they are not packaged the same way as Claude or Cursor plugin agents. Local May 13, 2026 headless probes prove explicit invocation, built-in-name override, project-local precedence, and discovered `.agents/skills` inheritance. The same maintained headless suite also showed two config-depth caveats: a parent `[[skills.config]] enabled = false` entry did not disable a discovered project skill, and an agent-local `[[skills.config]]` entry did not preload an undiscovered `skills/` path. The maintained `bun scripts/probe-codex-mcp-runtime.ts --json` headless probe was rerun on June 24, 2026: default project-scoped and user-scoped root MCP both emit a real `mcp_tool_call` item but fail with `user cancelled MCP tool call` before server-side `tools/call`; explicit `[mcp_servers.<id>.tools.<tool>] approval_mode = "approve"` unlocks project-scoped and user-scoped root MCP; custom agents that inherit those approved root MCP servers also reach `tools/call` and return `MCP_PROOF_MARKER_ALLOWED`. The June 24 run also shows that `mcp_servers = {}` in the child agent does not opt out of approved inherited root MCP for either project or user scope, while agent-local inline MCP and agent-local inline approval did not activate. Current custom-agent MCP success now surfaces a parent `mcp_tool_call` item in the `codex exec --json` stream, but `codex mcp list` still sees user-scoped servers and not project-scoped servers. The maintained `bun scripts/probe-codex-agents-interactive-runtime.ts --json` trusted interactive probe also showed the same `sandbox_mode = "read-only"` child agent still wrote to the workspace there too, so these fields are not yet uniformly trustworthy runtime boundaries.'

const AGENT_PRIMITIVE_CAPABILITIES: Record<AgentTranslationPlatform, AgentPrimitiveCapability> = {
  'claude-code': {
    mode: 'preserve',
    nativeSurfaces: ['agents/*.md'],
    notes: 'Claude plugin agents are a first-class native surface under plugin-root agents/. Plugin-shipped agents support a documented subset of agent frontmatter; unsupported fields such as color are omitted.',
  },
  cursor: {
    mode: 'translate',
    nativeSurfaces: ['agents/', '.cursor/agents/', '~/.cursor/agents/'],
    notes: 'Cursor plugin agents are a first-class native surface under plugin-root agents/. Pluxx emits native readonly and is_background fields when canonical intent maps cleanly, then uses generated notes for richer fields.',
  },
  codex: {
    mode: 'translate',
    nativeSurfaces: ['.codex/agents/*.toml', '~/.codex/agents/*.toml', 'subagent workflows'],
    notes: `${CODEX_AGENT_INSTALL_NOTE} ${CODEX_AGENT_CAPABILITY_NOTE}`,
  },
  opencode: {
    mode: 'preserve',
    nativeSurfaces: ['agents/*.md', 'config agent definitions'],
    notes: 'OpenCode agents are first-class native surfaces. Pluxx plugins register generated definitions through the plugin config hook. Prefer permission-first agent config and the native top_p key; legacy tools remains compatibility input.',
  },
}

const AGENT_TRANSLATION_PROFILES: Record<AgentTranslationPlatform, AgentTranslationProfile> = {
  'claude-code': {
    degradedFields: [
      { key: 'color', present: (metadata) => !!metadata.color },
    ],
    guidanceSurfaces: ['agents/*.md'],
    message: (fields) => `Agent fields ${fields.map((field) => `"${field}"`).join(', ')} are not supported in Claude plugin-shipped agent frontmatter and are omitted from the generated agent file.`,
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
      { key: 'isolation', present: (metadata) => !!metadata.isolation },
      { key: 'permission', present: (metadata) => !!metadata.permission },
      { key: 'tools', present: (metadata) => metadata.tools !== undefined },
    ],
    guidanceSurfaces: ['subagent framing', 'generated notes'],
    message: (fields) => `Agent fields ${fields.map((field) => `"${field}"`).join(', ')} are not fully preserved as first-class Cursor agent frontmatter today. Pluxx emits native readonly and is_background fields where the canonical intent maps cleanly, then translates the remaining intent through subagent framing and generated notes.`,
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
