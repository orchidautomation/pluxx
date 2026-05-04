type SkillTranslationPlatform = 'cursor' | 'codex' | 'opencode'

interface SkillFieldTranslationRegistryEntry {
  code: string
  message: string
}

const CODEX_SKILL_FIELD_TRANSLATIONS: Record<string, string> = {
  when_to_use: 'Pluxx currently keeps `when_to_use` as compatibility metadata in Codex skill files and may also surface the same discovery hint through command or routing guidance, because Codex does not document an equivalent skill discovery field.',
  'argument-hint': 'Pluxx currently translates `argument-hint` into Codex command or routing guidance rather than documented Codex skill frontmatter.',
  arguments: 'Pluxx currently translates skill `arguments` into Codex command or routing guidance rather than documented Codex skill frontmatter.',
  'user-invocable': 'Pluxx currently keeps `user-invocable` as compatibility metadata in Codex skill files because Codex does not document an equivalent skill visibility field.',
  'allowed-tools': 'Pluxx currently translates `allowed-tools` into Codex permission companions or external config rather than documented Codex skill frontmatter.',
  model: 'Pluxx currently translates skill `model` intent through Codex custom agents, routing guidance, or model overrides rather than documented Codex skill frontmatter.',
  effort: 'Pluxx currently translates skill `effort` intent through Codex custom-agent model reasoning controls or surrounding model guidance rather than documented Codex skill frontmatter.',
  context: 'Pluxx currently treats skill `context` as companion instruction intent because Codex does not document an equivalent skill frontmatter field.',
  agent: 'Pluxx currently translates skill `agent` intent through Codex custom agents or routing guidance rather than documented Codex skill frontmatter.',
  hooks: 'Pluxx currently translates skill-local `hooks` intent through bundled Codex hooks, where skill-local attachment is lost.',
  paths: 'Pluxx currently translates skill `paths` into surrounding instruction or routing context because Codex does not document an equivalent skill frontmatter field.',
  shell: 'Pluxx currently translates skill `shell` intent through command or runtime guidance because Codex does not document an equivalent skill frontmatter field.',
}

const OPENCODE_SKILL_FIELD_TRANSLATIONS: Record<string, string> = {
  when_to_use: 'Pluxx currently keeps `when_to_use` as compatibility metadata in OpenCode skill files and may also surface the same discovery hint through commands or neighboring runtime guidance, because OpenCode does not document an equivalent skill discovery field.',
  'argument-hint': 'Pluxx currently translates `argument-hint` into OpenCode commands or runtime command metadata rather than documented OpenCode skill frontmatter.',
  arguments: 'Pluxx currently translates skill `arguments` into OpenCode commands or runtime command metadata rather than documented OpenCode skill frontmatter.',
  'user-invocable': 'Pluxx currently keeps `user-invocable` as compatibility metadata in OpenCode skill files because OpenCode does not document an equivalent skill visibility field.',
  'allowed-tools': 'Pluxx currently translates `allowed-tools` into OpenCode permission config rather than documented OpenCode skill frontmatter.',
  model: 'Pluxx currently translates skill `model` intent through OpenCode agent/config model selection rather than documented OpenCode skill frontmatter.',
  effort: 'Pluxx currently translates skill `effort` intent through OpenCode model configuration or agent/runtime controls rather than documented OpenCode skill frontmatter.',
  context: 'Pluxx currently translates skill `context` through runtime instruction injection or neighboring config because OpenCode does not document an equivalent skill frontmatter field.',
  agent: 'Pluxx currently translates skill `agent` intent through OpenCode agents or runtime routing rather than documented OpenCode skill frontmatter.',
  hooks: 'Pluxx currently translates skill-local `hooks` intent through OpenCode runtime event handlers, where skill-local attachment is lost.',
  paths: 'Pluxx currently translates skill `paths` into runtime or instruction context because OpenCode does not document an equivalent skill frontmatter field.',
  shell: 'Pluxx currently translates skill `shell` intent through runtime code or command execution guidance because OpenCode does not document an equivalent skill frontmatter field.',
}

export function getSkillFrontmatterTranslationIssue(
  platform: SkillTranslationPlatform,
  key: string,
  supportedFields: string[],
): SkillFieldTranslationRegistryEntry {
  if (platform === 'cursor') {
    return {
      code: 'cursor-skill-frontmatter-unsupported',
      message: `Skill frontmatter field "${key}" is not supported by Cursor. Supported: ${supportedFields.join(', ')}`,
    }
  }

  if (platform === 'codex') {
    return {
      code: 'codex-skill-frontmatter-translation',
      message: CODEX_SKILL_FIELD_TRANSLATIONS[key]
        ?? `Skill frontmatter field "${key}" is not part of documented Codex skill frontmatter. Pluxx may need to translate that intent through AGENTS.md, .codex/agents/*.toml, permissions companions, or runtime config instead of preserving it on SKILL.md.`,
    }
  }

  return {
    code: 'opencode-skill-frontmatter-translation',
    message: OPENCODE_SKILL_FIELD_TRANSLATIONS[key]
      ?? `Skill frontmatter field "${key}" is not part of documented OpenCode skill frontmatter. Pluxx may need to translate that intent through commands, agents, opencode.json, or plugin runtime code instead of preserving it on SKILL.md.`,
  }
}
