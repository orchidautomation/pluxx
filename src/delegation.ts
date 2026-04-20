import type { AgentFrontmatterMap } from './agents'

export interface PortableDelegationProfile {
  mode?: string
  hidden: boolean
  editPolicy?: string
  bashPolicy?: string
  taskPolicy?: string
}

export function getPortableDelegationProfile(frontmatter: AgentFrontmatterMap): PortableDelegationProfile {
  const permission = asMap(frontmatter.permission)
  const bash = asMap(permission?.bash)
  const task = asMap(permission?.task)

  return {
    mode: typeof frontmatter.mode === 'string' ? frontmatter.mode : undefined,
    hidden: frontmatter.hidden === true,
    editPolicy: typeof permission?.edit === 'string' ? permission.edit : undefined,
    bashPolicy: typeof bash?.['*'] === 'string' ? bash['*'] : undefined,
    taskPolicy: typeof task?.['*'] === 'string' ? task['*'] : undefined,
  }
}

export function buildDelegationBehaviorNotes(frontmatter: AgentFrontmatterMap): string[] {
  const profile = getPortableDelegationProfile(frontmatter)
  const notes: string[] = []

  if (profile.mode === 'subagent' || profile.hidden) {
    notes.push('This specialist is intended primarily for delegated use rather than as the default top-level worker.')
  }

  if (profile.editPolicy === 'deny') {
    notes.push('Stay read-only unless the parent task explicitly asks for file edits.')
  }

  if (profile.bashPolicy === 'deny') {
    notes.push('Avoid shell commands unless the parent task explicitly requires them.')
  } else if (profile.bashPolicy === 'ask') {
    notes.push('Use shell commands sparingly and only when they are clearly necessary to complete the task.')
  }

  if (profile.taskPolicy === 'deny') {
    notes.push('Do not delegate further subtasks unless the parent task explicitly asks for additional specialist work.')
  } else if (profile.taskPolicy === 'ask') {
    notes.push('Only delegate further subtasks when the work clearly benefits from another specialist.')
  }

  return notes
}

function asMap(value: unknown): AgentFrontmatterMap | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined
  return value as AgentFrontmatterMap
}
