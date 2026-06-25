import type { CanonicalCommandMetadata } from './commands'

export type CommandTranslationPlatform = 'claude-code' | 'cursor' | 'codex' | 'opencode'
type CommandDegradationPlatform = 'codex'

type PrimitiveTranslationMode = 'preserve' | 'translate' | 'degrade' | 'drop'

export interface CommandPrimitiveCapability {
  mode: PrimitiveTranslationMode
  nativeSurfaces: string[]
  notes?: string
}

interface CommandFieldDescriptor {
  label: string
  present: (metadata: CanonicalCommandMetadata) => boolean
}

const CODEX_COMMAND_FIELD_DESCRIPTORS: CommandFieldDescriptor[] = [
  { label: 'when_to_use', present: metadata => Boolean(metadata.whenToUse) },
  { label: 'argument-hint', present: metadata => Boolean(metadata.argumentHint) },
  { label: 'arguments', present: metadata => metadata.arguments.length > 0 },
  { label: 'examples', present: metadata => metadata.examples.length > 0 },
  { label: 'skill', present: metadata => Boolean(metadata.skill) },
  { label: 'skills', present: metadata => metadata.skills.length > 0 },
  { label: 'agent', present: metadata => Boolean(metadata.agent) },
  { label: 'subtask', present: metadata => typeof metadata.subtask === 'boolean' },
  { label: 'model', present: metadata => Boolean(metadata.model) },
  { label: 'context', present: metadata => Boolean(metadata.context) },
]

export const CODEX_COMMAND_GUIDANCE_SURFACES = ['skills/', 'AGENTS.md', '.codex/commands.generated.json'] as const
const CODEX_COMMAND_GUIDANCE_NOTE = 'Current Codex docs do not document plugin-packaged slash-command parity, so Pluxx keeps canonical command intent through routing guidance plus a generated companion mirror.'

const COMMAND_PRIMITIVE_CAPABILITIES: Record<CommandTranslationPlatform, CommandPrimitiveCapability> = {
  'claude-code': {
    mode: 'preserve',
    nativeSurfaces: ['commands/*.md', 'skills/<skill>/SKILL.md'],
    notes: 'Claude still supports command files, but the product is increasingly converging command workflows into skills.',
  },
  cursor: {
    mode: 'preserve',
    nativeSurfaces: ['commands/*', 'slash commands'],
  },
  codex: {
    mode: 'degrade',
    nativeSurfaces: [...CODEX_COMMAND_GUIDANCE_SURFACES],
    notes: CODEX_COMMAND_GUIDANCE_NOTE,
  },
  opencode: {
    mode: 'preserve',
    nativeSurfaces: ['commands/*.md', 'config command definitions'],
  },
}

export function getCodexCommandGuidanceNote(): string {
  return 'Codex does not currently document plugin-packaged slash-command parity. Pluxx keeps canonical command intent through AGENTS.md routing guidance and `.codex/commands.generated.json`.'
}

export function getCommandPrimitiveCapability(
  platform: CommandTranslationPlatform,
): CommandPrimitiveCapability {
  return COMMAND_PRIMITIVE_CAPABILITIES[platform]
}

export function getTranslatedCommandFields(
  platform: CommandDegradationPlatform,
  metadata: CanonicalCommandMetadata,
): string[] {
  if (platform !== 'codex') return []
  return CODEX_COMMAND_FIELD_DESCRIPTORS
    .filter((descriptor) => descriptor.present(metadata))
    .map((descriptor) => descriptor.label)
}

export function getCommandTranslationMessage(
  platform: CommandDegradationPlatform,
  degradedFields: string[],
): string | undefined {
  if (degradedFields.length === 0) return undefined

  if (platform === 'codex') {
    return `Command fields ${degradedFields.map((field) => `"${field}"`).join(', ')} are not native Codex plugin slash-command fields today. ${getCodexCommandGuidanceNote()}`
  }

  return undefined
}

export function buildCodexCommandRoutingEntry(metadata: CanonicalCommandMetadata): string[] {
  const distinctSkills = metadata.skills.filter((skillId, index, skills) => skills.indexOf(skillId) === index)
  const hasOnlyPrimarySkill = distinctSkills.length === 1 && distinctSkills[0] === metadata.skill
  const routingBits = [
    metadata.argumentHint ? `arguments: ${metadata.argumentHint}` : null,
    metadata.skill ? `skill: ${metadata.skill}` : null,
    distinctSkills.length > 0 && !hasOnlyPrimarySkill ? `skills: ${distinctSkills.join(', ')}` : null,
    metadata.agent ? `agent: ${metadata.agent}` : null,
    typeof metadata.subtask === 'boolean' ? `subtask: ${metadata.subtask ? 'yes' : 'no'}` : null,
    metadata.model ? `model: ${metadata.model}` : null,
  ].filter(Boolean)

  const lines = [
    `- \`/${metadata.commandId}\` - ${metadata.description ?? metadata.title}${routingBits.length > 0 ? ` (${routingBits.join('; ')})` : ''}`,
  ]

  if (metadata.whenToUse) {
    lines.push(`  - When to use: ${metadata.whenToUse}`)
  }
  if (metadata.examples.length > 0) {
    lines.push(`  - Examples: ${metadata.examples.map((example) => `\`${example}\``).join(', ')}`)
  }
  if (metadata.context) {
    lines.push(`  - Context hint: ${metadata.context}`)
  }

  return lines
}
