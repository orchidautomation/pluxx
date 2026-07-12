export type CoreFourTranslationPlatform = 'claude-code' | 'cursor' | 'codex' | 'opencode'
export type FieldTranslationPrimitive = 'skills' | 'hooks'
export type FieldTranslationMode = 'preserve' | 'translate' | 'degrade' | 'drop'

export interface FieldTranslationOutcome {
  mode: FieldTranslationMode
  nativeSurfaces: string[]
  notes: string
}

export interface FieldTranslationEntry {
  primitive: FieldTranslationPrimitive
  field: string
  canonicalIntent: string
  platforms: Record<CoreFourTranslationPlatform, FieldTranslationOutcome>
}

export interface DerivedPrimitiveCapability {
  mode: FieldTranslationMode
  nativeSurfaces: string[]
  notes: string
}

export const CORE_FOUR_TRANSLATION_PLATFORMS = ['claude-code', 'cursor', 'codex', 'opencode'] as const satisfies readonly CoreFourTranslationPlatform[]
const CORE_FOUR_TRANSLATION_PLATFORM_SET = new Set<string>(CORE_FOUR_TRANSLATION_PLATFORMS)

export function isCoreFourTranslationPlatform(value: string): value is CoreFourTranslationPlatform {
  return CORE_FOUR_TRANSLATION_PLATFORM_SET.has(value)
}

const skillSurface = ['skills/<skill>/SKILL.md']
const compatibilitySkillSurface = ['skills/<skill>/SKILL.md compatibility metadata']

function outcome(mode: FieldTranslationMode, nativeSurfaces: string[], notes: string): FieldTranslationOutcome {
  return { mode, nativeSurfaces, notes }
}

function skillEntry(field: string, canonicalIntent: string, platforms: FieldTranslationEntry['platforms']): FieldTranslationEntry {
  return { primitive: 'skills', field, canonicalIntent, platforms }
}

function sharedSkillIdentity(field: string, canonicalIntent: string): FieldTranslationEntry {
  return skillEntry(field, canonicalIntent, {
    'claude-code': outcome('preserve', skillSurface, `Claude preserves skill ${field} in native skill frontmatter.`),
    cursor: outcome('preserve', skillSurface, `Cursor preserves skill ${field} in shared Agent Skills frontmatter.`),
    codex: outcome('preserve', skillSurface, `Codex preserves skill ${field} in shared Agent Skills frontmatter.`),
    opencode: outcome('preserve', skillSurface, `OpenCode preserves skill ${field} in shared Agent Skills frontmatter.`),
  })
}

const SKILL_FIELD_TRANSLATIONS: FieldTranslationEntry[] = [
  sharedSkillIdentity('name', 'Stable skill identity.'),
  sharedSkillIdentity('description', 'Skill discovery summary.'),
  sharedSkillIdentity('license', 'Skill licensing metadata.'),
  sharedSkillIdentity('compatibility', 'Agent Skills compatibility metadata.'),
  sharedSkillIdentity('metadata', 'Extensible Agent Skills metadata.'),
  sharedSkillIdentity('disable-model-invocation', 'Model invocation control.'),
  skillEntry('when_to_use', 'Host discovery guidance.', {
    'claude-code': outcome('preserve', skillSurface, 'Claude preserves `when_to_use` as native discovery frontmatter.'),
    cursor: outcome('degrade', compatibilitySkillSurface, 'Cursor keeps `when_to_use` for round-tripping without a documented native discovery field.'),
    codex: outcome('degrade', [...compatibilitySkillSurface, 'AGENTS.md', '.codex/commands.generated.json'], 'Codex keeps `when_to_use` as compatibility metadata and routing guidance.'),
    opencode: outcome('degrade', [...compatibilitySkillSurface, 'commands', 'plugin runtime guidance'], 'OpenCode keeps `when_to_use` as compatibility metadata and runtime guidance.'),
  }),
  ...['argument-hint', 'arguments', 'user-invocable', 'paths', 'shell'].map(field => skillEntry(field, `Claude-oriented skill ${field} intent.`, {
    'claude-code': outcome('preserve', skillSurface, `Claude preserves skill \`${field}\` in native skill frontmatter.`),
    cursor: outcome('degrade', compatibilitySkillSurface, `Cursor retains \`${field}\` only as compatibility metadata.`),
    codex: outcome('degrade', compatibilitySkillSurface, `Codex retains \`${field}\` only as compatibility metadata.`),
    opencode: outcome('degrade', compatibilitySkillSurface, `OpenCode retains \`${field}\` only as compatibility metadata.`),
  })),
  ...['allowed-tools', 'model', 'effort'].map(field => skillEntry(field, `Skill-local ${field} control intent.`, {
    'claude-code': outcome('preserve', skillSurface, `Claude preserves skill \`${field}\` in native skill frontmatter.`),
    cursor: outcome('degrade', compatibilitySkillSurface, `Cursor retains \`${field}\` as compatibility metadata; the skill generator does not promote it into host controls.`),
    codex: outcome('degrade', [...compatibilitySkillSurface, '.codex/skills.generated.json'], `Codex retains \`${field}\` in source metadata and the generated skill companion; the skill generator does not promote it into host controls.`),
    opencode: outcome('degrade', [...compatibilitySkillSurface, 'skills.generated.json'], `OpenCode retains \`${field}\` in source metadata and the generated skill companion; the skill generator does not promote it into host controls.`),
  })),
  ...['context', 'agent'].map(field => skillEntry(field, `Skill delegation ${field} intent.`, {
    'claude-code': outcome('preserve', skillSurface, `Claude preserves skill \`${field}\` in native skill frontmatter.`),
    cursor: outcome('degrade', compatibilitySkillSurface, `Cursor retains skill \`${field}\` as compatibility metadata without generating a subagent mapping.`),
    codex: outcome('degrade', [...compatibilitySkillSurface, '.codex/skills.generated.json'], `Codex retains skill \`${field}\` in metadata and the skill companion without generating a custom-agent mapping.`),
    opencode: outcome('degrade', [...compatibilitySkillSurface, 'skills.generated.json'], `OpenCode retains skill \`${field}\` in metadata and the skill companion without generating an agent mapping.`),
  })),
  skillEntry('hooks', 'Skill-scoped hook behavior.', {
    'claude-code': outcome('preserve', ['skill frontmatter hooks'], 'Claude preserves supported skill-scoped hooks at their native attachment point.'),
    cursor: outcome('degrade', ['hooks/hooks.json'], 'Cursor can retain hook behavior, but skill-local attachment is lost.'),
    codex: outcome('degrade', ['hooks/hooks.json'], 'Codex can retain supported command-hook behavior, but skill-local attachment is lost.'),
    opencode: outcome('degrade', compatibilitySkillSurface, 'OpenCode retains skill hook metadata without generating runtime event logic from it.'),
  }),
]

function hookEntry(field: string, canonicalIntent: string, platforms: FieldTranslationEntry['platforms']): FieldTranslationEntry {
  return { primitive: 'hooks', field, canonicalIntent, platforms }
}

const HOOK_FIELD_TRANSLATIONS: FieldTranslationEntry[] = [
  hookEntry('event', 'Hook lifecycle event binding.', {
    'claude-code': outcome('preserve', ['hooks/hooks.json', 'settings hooks', 'frontmatter hooks'], 'Claude preserves the canonical event set across native hook surfaces.'),
    cursor: outcome('degrade', ['hooks/hooks.json', '.cursor/hooks.json'], 'Cursor preserves documented events and drops unsupported canonical events.'),
    codex: outcome('degrade', ['hooks/hooks.json', '.codex/hooks.json'], 'Codex translates documented events and drops unsupported canonical events.'),
    opencode: outcome('translate', ['plugin JS/TS event handlers'], 'OpenCode maps canonical events into code-first runtime handlers.'),
  }),
  hookEntry('command', 'Command hook execution.', {
    'claude-code': outcome('preserve', ['hooks/hooks.json'], 'Claude preserves command-hook entries.'),
    cursor: outcome('preserve', ['hooks/hooks.json'], 'Cursor preserves command-hook entries.'),
    codex: outcome('translate', ['hooks/hooks.json', 'generated command wrappers'], 'Codex translates commands into nested matcher groups and plugin-root-safe wrappers.'),
    opencode: outcome('translate', ['plugin JS/TS event handlers'], 'OpenCode translates commands into runtime event handlers.'),
  }),
  hookEntry('prompt', 'Prompt hook execution.', {
    'claude-code': outcome('degrade', ['hooks/hooks.json', 'frontmatter hooks'], 'Claude preserves prompt hooks only on documented prompt-capable events.'),
    cursor: outcome('preserve', ['hooks/hooks.json'], 'Cursor preserves prompt-hook entries.'),
    codex: outcome('drop', [], 'Codex generation currently drops prompt-hook entries.'),
    opencode: outcome('drop', [], 'The current OpenCode runtime wrapper drops prompt-hook entries.'),
  }),
  ...['http', 'mcp_tool', 'agent'].map(field => hookEntry(field, `${field} hook execution.`, {
    'claude-code': outcome('preserve', ['hooks/hooks.json'], `Claude preserves ${field} hook entries.`),
    cursor: outcome('drop', [], `Cursor does not document ${field} hook entries.`),
    codex: outcome('drop', [], `Codex generation currently drops ${field} hook entries.`),
    opencode: outcome('drop', [], `The current OpenCode runtime wrapper drops ${field} hook entries.`),
  })),
  hookEntry('matcher', 'Hook matcher scoping.', {
    'claude-code': outcome('preserve', ['hooks/hooks.json'], 'Claude preserves hook matchers.'),
    cursor: outcome('preserve', ['hooks/hooks.json'], 'Cursor preserves hook matchers.'),
    codex: outcome('degrade', ['hooks/hooks.json'], 'Codex preserves matchers only on documented matcher-capable events.'),
    opencode: outcome('translate', ['plugin runtime event filters'], 'OpenCode translates matcher intent into runtime filtering.'),
  }),
  hookEntry('failClosed', 'Hook failure policy.', {
    'claude-code': outcome('drop', [], 'Claude generation currently drops `failClosed`.'),
    cursor: outcome('preserve', ['hooks/hooks.json'], 'Cursor preserves `failClosed`.'),
    codex: outcome('drop', [], 'Codex generation currently drops `failClosed`.'),
    opencode: outcome('preserve', ['plugin runtime event handlers'], 'OpenCode preserves failure policy in runtime handlers.'),
  }),
  hookEntry('loop_limit', 'Recursive hook protection.', {
    'claude-code': outcome('drop', [], 'Claude generation currently drops `loop_limit`.'),
    cursor: outcome('degrade', ['hooks/hooks.json'], 'Cursor preserves `loop_limit` only on supported stop events.'),
    codex: outcome('drop', [], 'Codex generation currently drops `loop_limit`.'),
    opencode: outcome('drop', [], 'The current OpenCode runtime wrapper drops `loop_limit`.'),
  }),
  hookEntry('timeout', 'Hook execution timeout.', {
    'claude-code': outcome('preserve', ['hooks/hooks.json'], 'Claude preserves hook timeout.'),
    cursor: outcome('preserve', ['hooks/hooks.json'], 'Cursor preserves hook timeout.'),
    codex: outcome('translate', ['hooks/hooks.json'], 'Codex translates timeout into nested command-hook entries.'),
    opencode: outcome('translate', ['plugin runtime event handlers'], 'OpenCode translates timeout through runtime control flow.'),
  }),
]

export const FIELD_TRANSLATION_REGISTRY: readonly FieldTranslationEntry[] = [
  ...SKILL_FIELD_TRANSLATIONS,
  ...HOOK_FIELD_TRANSLATIONS,
]

export function getFieldTranslationEntries(primitive: FieldTranslationPrimitive): FieldTranslationEntry[] {
  return FIELD_TRANSLATION_REGISTRY.filter(entry => entry.primitive === primitive)
}

export function getFieldTranslationEntry(primitive: FieldTranslationPrimitive, field: string): FieldTranslationEntry | undefined {
  return FIELD_TRANSLATION_REGISTRY.find(entry => entry.primitive === primitive && entry.field === field)
}

export function getFieldTranslationOutcome(
  primitive: FieldTranslationPrimitive,
  field: string,
  platform: CoreFourTranslationPlatform,
): FieldTranslationOutcome | undefined {
  return getFieldTranslationEntry(primitive, field)?.platforms[platform]
}

export function derivePrimitiveCapability(
  primitive: FieldTranslationPrimitive,
  platform: CoreFourTranslationPlatform,
): DerivedPrimitiveCapability {
  const entries = getFieldTranslationEntries(primitive)
  const outcomes = entries.map(entry => ({ field: entry.field, ...entry.platforms[platform] }))
  const modes = new Set(outcomes.map(item => item.mode))
  const mode: FieldTranslationMode = modes.size === 1 && modes.has('drop')
    ? 'drop'
    : modes.has('drop') || modes.has('degrade')
      ? 'degrade'
      : modes.has('translate')
        ? 'translate'
        : 'preserve'
  const nativeSurfaces = [...new Set(outcomes.flatMap(item => item.nativeSurfaces))]
  const weaker = outcomes.filter(item => item.mode !== 'preserve')
  const notes = weaker.length === 0
    ? `Derived from ${outcomes.length} audited ${primitive} fields; all preserve on ${platform}.`
    : `Derived from field outcomes. Weaker fields: ${weaker.map(item => `${item.field}=${item.mode}`).join(', ')}.`

  return { mode, nativeSurfaces, notes }
}

export function getPresentFieldTranslationOutcomes(
  primitive: FieldTranslationPrimitive,
  platform: CoreFourTranslationPlatform,
  fields: Iterable<string>,
): Array<{ field: string; outcome: FieldTranslationOutcome }> {
  const present = new Set(fields)
  return getFieldTranslationEntries(primitive)
    .filter(entry => present.has(entry.field))
    .map(entry => ({ field: entry.field, outcome: entry.platforms[platform] }))
}
