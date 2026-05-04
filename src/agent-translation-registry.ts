import type { CanonicalAgentMetadata } from './agents'

export type AgentTranslationPlatform = 'cursor' | 'codex' | 'opencode'

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

const AGENT_TRANSLATION_PROFILES: Record<AgentTranslationPlatform, AgentTranslationProfile> = {
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
