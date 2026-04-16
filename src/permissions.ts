export const PERMISSION_SELECTOR_KINDS = ['Bash', 'Edit', 'Read', 'MCP', 'Skill'] as const

export type PermissionRuleKind = typeof PERMISSION_SELECTOR_KINDS[number]
export type PermissionAction = 'allow' | 'ask' | 'deny'

export interface ParsedPermissionRule {
  action: PermissionAction
  raw: string
  kind: PermissionRuleKind
  pattern: string
}

const PERMISSION_RULE_REGEX = new RegExp(
  `^(${PERMISSION_SELECTOR_KINDS.join('|')})\\((.+)\\)$`,
)

export function parsePermissionRule(raw: string): Omit<ParsedPermissionRule, 'action'> | null {
  const trimmed = raw.trim()
  const match = trimmed.match(PERMISSION_RULE_REGEX)
  if (!match) return null

  const kind = match[1] as PermissionRuleKind
  const pattern = match[2].trim()
  if (!pattern) return null

  return {
    raw: trimmed,
    kind,
    pattern,
  }
}

export function collectPermissionRules(
  permissions: Partial<Record<PermissionAction, string[]>> | undefined,
): ParsedPermissionRule[] {
  if (!permissions) return []

  const actions: PermissionAction[] = ['allow', 'ask', 'deny']
  const rules: ParsedPermissionRule[] = []

  for (const action of actions) {
    for (const raw of permissions[action] ?? []) {
      const parsed = parsePermissionRule(raw)
      if (!parsed) continue
      rules.push({
        ...parsed,
        action,
      })
    }
  }

  return rules
}
