export const CURSOR_SUPPORTED_HOOK_EVENTS = [
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

export const CURSOR_LOOP_LIMIT_HOOK_EVENTS = ['stop', 'subagentStop'] as const

const PASCAL_CASE_HOOK_ALIASES: Record<string, string> = {
  beforeSubmitPrompt: 'UserPromptSubmit',
}

export function mapHookEventToPascalCase(event: string): string {
  return PASCAL_CASE_HOOK_ALIASES[event]
    ?? event.charAt(0).toUpperCase() + event.slice(1)
}
