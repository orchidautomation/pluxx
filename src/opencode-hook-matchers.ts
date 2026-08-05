export const OPENCODE_TOOL_MATCHER_ALIASES: Record<string, string[]> = {
  apply_patch: ['ApplyPatch', 'MultiEdit'],
  bash: ['Bash', 'Shell'],
  edit: ['Edit'],
  glob: ['Glob'],
  grep: ['Grep'],
  list: ['List'],
  read: ['Read'],
  write: ['Create', 'Write'],
}

export const OPENCODE_HOOK_MATCHER_RUNTIME_CONTRACT_VERSION = 1

export const OPENCODE_EDIT_TOOL_IDS = ['apply_patch', 'edit', 'write'] as const

const OPENCODE_EDIT_MATCHER_NAMES = new Set(
  OPENCODE_EDIT_TOOL_IDS.flatMap(tool => [tool, ...OPENCODE_TOOL_MATCHER_ALIASES[tool]]),
)

export function isOpenCodeEditOnlyMatcher(matcher: unknown): boolean {
  if (typeof matcher !== 'string') return false

  const alternatives = matcher.split('|').map(value => value.trim())
  return alternatives.length > 0
    && alternatives.every(value => value.length > 0 && OPENCODE_EDIT_MATCHER_NAMES.has(value))
}

export function normalizeOpenCodeToolMatcher(
  matcher: string | Record<string, unknown>,
): string | Record<string, unknown> {
  if (!isOpenCodeEditOnlyMatcher(matcher)) return matcher
  return (matcher as string).split('|').map(value => value.trim()).join('|')
}

export function isValidOpenCodeStringMatcher(matcher: string): boolean {
  if (matcher === '' || matcher === '*') return true
  try {
    new RegExp(`^(?:${matcher})$`)
    return true
  } catch {
    return false
  }
}
