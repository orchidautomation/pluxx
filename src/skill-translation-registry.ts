import {
  getFieldTranslationOutcome,
  getPresentFieldTranslationOutcomes,
  type CoreFourTranslationPlatform,
  type FieldTranslationOutcome,
} from './field-translation-registry'

type SkillTranslationPlatform = Exclude<CoreFourTranslationPlatform, 'claude-code'>

interface SkillFieldTranslationRegistryEntry {
  code: string
  message: string
}

export function getSkillFieldTranslationOutcome(
  platform: CoreFourTranslationPlatform,
  key: string,
): FieldTranslationOutcome | undefined {
  return getFieldTranslationOutcome('skills', key, platform)
}

export function getPresentSkillFieldTranslations(
  platform: CoreFourTranslationPlatform,
  keys: Iterable<string>,
): Array<{ field: string; outcome: FieldTranslationOutcome }> {
  const present = [...keys]
  const modeled = getPresentFieldTranslationOutcomes('skills', platform, present)
  const modeledFields = new Set(modeled.map(item => item.field))
  const unsupported = present
    .filter(field => !modeledFields.has(field))
    .sort((a, b) => a.localeCompare(b))
    .map(field => ({
      field,
      outcome: {
        mode: 'degrade' as const,
        nativeSurfaces: ['skills/<skill>/SKILL.md compatibility metadata'],
        notes: `Unmodeled skill field \`${field}\` is retained for round-tripping but remains unsupported and review-required on ${platform}.`,
      },
    }))
  return [...modeled, ...unsupported]
}

export function getSkillTranslationSummary(
  platform: CoreFourTranslationPlatform,
  keys: Iterable<string>,
): Array<{ field: string; mode: FieldTranslationOutcome['mode']; nativeSurfaces: string[] }> {
  return getPresentSkillFieldTranslations(platform, keys).map(({ field, outcome }) => ({
    field,
    mode: outcome.mode,
    nativeSurfaces: outcome.nativeSurfaces,
  }))
}

export function getSkillFrontmatterTranslationIssue(
  platform: SkillTranslationPlatform,
  key: string,
  supportedFields: string[],
): SkillFieldTranslationRegistryEntry {
  const modeled = getSkillFieldTranslationOutcome(platform, key)

  if (platform === 'cursor') {
    return {
      code: 'cursor-skill-frontmatter-unsupported',
      message: modeled
        ? `Skill frontmatter field "${key}" is ${modeled.mode} on Cursor. ${modeled.notes} Supported native fields: ${supportedFields.join(', ')}`
        : `Skill frontmatter field "${key}" is unsupported metadata on Cursor and remains review-required. Supported native fields: ${supportedFields.join(', ')}`,
    }
  }

  if (platform === 'codex') {
    return {
      code: 'codex-skill-frontmatter-translation',
      message: modeled
        ? `Skill frontmatter field "${key}" is ${modeled.mode} on Codex. ${modeled.notes}`
        : `Skill frontmatter field "${key}" is not part of documented Codex skill frontmatter. Pluxx preserves the source metadata for round-tripping, but the field remains unsupported and review-required.`,
    }
  }

  return {
    code: 'opencode-skill-frontmatter-translation',
    message: modeled
      ? `Skill frontmatter field "${key}" is ${modeled.mode} on OpenCode. ${modeled.notes}`
      : `Skill frontmatter field "${key}" is not part of documented OpenCode skill frontmatter. Pluxx preserves the source metadata for round-tripping, but the field remains unsupported and review-required.`,
  }
}
