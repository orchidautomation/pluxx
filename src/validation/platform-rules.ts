export const CURSOR_PLUGIN_NAME_REGEX = /^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/

export const CURSOR_SKILL_SUPPORTED_FRONTMATTER_FIELDS = [
  'name',
  'description',
  'license',
  'compatibility',
  'metadata',
  'disable-model-invocation',
] as const

export const CURSOR_RULE_SUPPORTED_FRONTMATTER_FIELDS = [
  'description',
  'globs',
  'alwaysApply',
] as const

export const CURSOR_HOOK_EVENTS = [
  'sessionStart',
  'sessionEnd',
  'preToolUse',
  'postToolUse',
  'postToolUseFailure',
  'subagentStart',
  'subagentStop',
  'beforeShellExecution',
  'afterShellExecution',
  'beforeMCPExecution',
  'afterMCPExecution',
  'beforeReadFile',
  'afterFileEdit',
  'beforeSubmitPrompt',
  'preCompact',
  'stop',
  'afterAgentResponse',
  'afterAgentThought',
  'beforeTabFileRead',
  'afterTabFileEdit',
] as const

const CURSOR_HOOK_EVENT_SET = new Set<string>(CURSOR_HOOK_EVENTS)

const CURSOR_MATCHER_SUPPORTED_EVENTS = new Set<string>([
  'preToolUse',
  'postToolUse',
  'postToolUseFailure',
  'subagentStart',
  'subagentStop',
  'beforeShellExecution',
  'afterShellExecution',
  'beforeMCPExecution',
  'afterMCPExecution',
  'beforeReadFile',
  'afterFileEdit',
  'beforeSubmitPrompt',
  'stop',
  'afterAgentResponse',
  'afterAgentThought',
])

const CURSOR_LOOP_LIMIT_SUPPORTED_EVENTS = new Set<string>([
  'stop',
  'subagentStop',
])

const CURSOR_SKILL_FRONTMATTER_SET = new Set<string>(CURSOR_SKILL_SUPPORTED_FRONTMATTER_FIELDS)
const CURSOR_RULE_FRONTMATTER_SET = new Set<string>(CURSOR_RULE_SUPPORTED_FRONTMATTER_FIELDS)

export function isValidCursorPluginName(name: string): boolean {
  return CURSOR_PLUGIN_NAME_REGEX.test(name)
}

export function isCursorHookEvent(event: string): boolean {
  return CURSOR_HOOK_EVENT_SET.has(event)
}

export function supportsCursorHookMatcher(event: string): boolean {
  return CURSOR_MATCHER_SUPPORTED_EVENTS.has(event)
}

export function supportsCursorHookLoopLimit(event: string): boolean {
  return CURSOR_LOOP_LIMIT_SUPPORTED_EVENTS.has(event)
}

export function isSupportedCursorSkillFrontmatterField(field: string): boolean {
  return CURSOR_SKILL_FRONTMATTER_SET.has(field)
}

export function isSupportedCursorRuleFrontmatterField(field: string): boolean {
  return CURSOR_RULE_FRONTMATTER_SET.has(field)
}
