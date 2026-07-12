import type { TargetPlatform } from './schema'
import { CODEX_SUPPORTED_HOOK_EVENTS, CURSOR_SUPPORTED_HOOK_EVENTS } from './hook-events'
import { getFieldTranslationOutcome, isCoreFourTranslationPlatform, type FieldTranslationMode } from './field-translation-registry'

export type HookFieldName = 'prompt' | 'matcher' | 'failClosed' | 'loop_limit'
export type HookEntryType = 'command' | 'http' | 'mcp_tool' | 'prompt' | 'agent'
export type HookFieldTranslationMode = FieldTranslationMode

interface HookTranslationIssueDescriptor {
  code: string
  message: string
}

interface HookFieldCapability {
  mode: HookFieldTranslationMode
  supportedEvents?: readonly string[]
}

interface HookPlatformRegistry {
  supportedEvents?: readonly string[]
  unsupportedEventReason?: string
  supportedTypes?: readonly HookEntryType[]
  fieldEvents?: Partial<Record<HookFieldName, readonly string[]>>
}

const HOOK_PLATFORM_REGISTRY: Partial<Record<TargetPlatform, HookPlatformRegistry>> = {
  'claude-code': {
    supportedTypes: ['command', 'http', 'mcp_tool', 'prompt', 'agent'],
    fieldEvents: {
      prompt: [
          'PermissionRequest',
          'PostToolBatch',
          'PostToolUse',
          'PostToolUseFailure',
          'PreToolUse',
          'Stop',
          'SubagentStop',
          'TaskCompleted',
          'TaskCreated',
          'UserPromptExpansion',
          'UserPromptSubmit',
      ],
    },
  },
  cursor: {
    supportedTypes: ['command', 'prompt'],
    supportedEvents: CURSOR_SUPPORTED_HOOK_EVENTS,
    unsupportedEventReason: `Cursor currently documents only ${CURSOR_SUPPORTED_HOOK_EVENTS.join(', ')} for hook configuration.`,
    fieldEvents: {
      loop_limit: ['stop', 'subagentStop'],
    },
  },
  codex: {
    supportedTypes: ['command'],
    supportedEvents: CODEX_SUPPORTED_HOOK_EVENTS,
    unsupportedEventReason: `Codex currently documents only ${CODEX_SUPPORTED_HOOK_EVENTS.join(', ')} for hook configuration.`,
    fieldEvents: {
      matcher: [CODEX_SUPPORTED_HOOK_EVENTS[0], 'PreToolUse', 'PermissionRequest', 'PostToolUse'],
    },
  },
  opencode: {
    supportedTypes: ['command'],
  },
}

export function getSupportedHookEvents(platform: TargetPlatform): readonly string[] {
  return HOOK_PLATFORM_REGISTRY[platform]?.supportedEvents ?? []
}

export function getSupportedHookTypes(platform: TargetPlatform): readonly HookEntryType[] {
  return HOOK_PLATFORM_REGISTRY[platform]?.supportedTypes ?? []
}

export function getUnsupportedHookEventReason(platform: TargetPlatform): string | null {
  return HOOK_PLATFORM_REGISTRY[platform]?.unsupportedEventReason ?? null
}

export function isHookEventSupported(platform: TargetPlatform, event: string): boolean {
  const supportedEvents = getSupportedHookEvents(platform)
  if (supportedEvents.length === 0) return true
  return supportedEvents.includes(event)
}

export function isHookTypeSupported(platform: TargetPlatform, type: HookEntryType): boolean {
  const supportedTypes = getSupportedHookTypes(platform)
  if (supportedTypes.length === 0) return true
  return supportedTypes.includes(type)
}

export function getHookFieldCapability(
  platform: TargetPlatform,
  field: HookFieldName,
): HookFieldCapability {
  if (!isCoreFourTranslationPlatform(platform)) {
    if (field === 'matcher' && (platform === 'github-copilot' || platform === 'openhands')) {
      return { mode: 'preserve' }
    }
    return { mode: 'drop' }
  }
  const outcome = getFieldTranslationOutcome(
    'hooks',
    field,
    platform,
  )
  return {
    mode: outcome?.mode ?? 'drop',
    ...(HOOK_PLATFORM_REGISTRY[platform]?.fieldEvents?.[field]
      ? { supportedEvents: HOOK_PLATFORM_REGISTRY[platform]?.fieldEvents?.[field] }
      : {}),
  }
}

export function isHookFieldPreserved(
  platform: TargetPlatform,
  field: HookFieldName,
  event?: string,
): boolean {
  const capability = getHookFieldCapability(platform, field)
  if (capability.mode === 'drop' || capability.mode === 'translate') return false
  if (capability.supportedEvents && event) {
    return capability.supportedEvents.includes(event)
  }
  if (capability.supportedEvents) return false
  return true
}

export function getHookFieldSupportedEvents(
  platform: TargetPlatform,
  field: HookFieldName,
): readonly string[] {
  return getHookFieldCapability(platform, field).supportedEvents ?? []
}

export function getHookTypeTranslationIssue(
  platform: TargetPlatform,
  type: Exclude<HookEntryType, 'command'>,
): HookTranslationIssueDescriptor | null {
  if (platform === 'cursor') {
    const outcome = getFieldTranslationOutcome('hooks', type, 'cursor')
    return {
      code: 'cursor-hook-type-unsupported',
      message: `Cursor does not document ${type} hooks. ${outcome?.notes ?? 'The entry is unsupported.'}`,
    }
  }

  if (platform === 'codex') {
    const outcome = getFieldTranslationOutcome('hooks', type, 'codex')
    return {
      code: 'codex-hook-type-drop',
      message: `Codex currently bundles only command-hook entries from Pluxx. ${type} hooks are ${outcome?.mode ?? 'drop'}. ${outcome?.notes ?? ''}`,
    }
  }

  if (platform === 'opencode') {
    const outcome = getFieldTranslationOutcome('hooks', type, 'opencode')
    return {
      code: 'opencode-hook-type-drop',
      message: `The current OpenCode runtime wrapper only emits command hooks. ${type} hooks are ${outcome?.mode ?? 'drop'}. ${outcome?.notes ?? ''}`,
    }
  }

  return null
}

export function getPromptHookTranslationIssue(
  platform: TargetPlatform,
  event?: string,
): HookTranslationIssueDescriptor | null {
  if (platform === 'claude-code') {
    if (event && isHookFieldPreserved(platform, 'prompt', event)) return null
    const supportedEvents = getHookFieldSupportedEvents(platform, 'prompt')
    return {
      code: 'claude-prompt-hook-degrade',
      message: `${getFieldTranslationOutcome('hooks', 'prompt', 'claude-code')?.notes} Supported events: ${supportedEvents.join(', ')}. Prompt hooks on ${event ?? 'other events'} will be dropped.`,
    }
  }

  if (platform === 'codex') {
    return {
      code: 'codex-prompt-hook-drop',
      message: getFieldTranslationOutcome('hooks', 'prompt', 'codex')?.notes ?? 'Codex drops prompt hooks.',
    }
  }

  if (platform === 'opencode') {
    return {
      code: 'opencode-prompt-hook-drop',
      message: getFieldTranslationOutcome('hooks', 'prompt', 'opencode')?.notes ?? 'OpenCode drops prompt hooks.',
    }
  }

  return null
}

export function getHookFieldTranslationIssue(
  platform: TargetPlatform,
  field: Extract<HookFieldName, 'failClosed' | 'loop_limit'>,
): HookTranslationIssueDescriptor | null {
  if (platform === 'claude-code' && field === 'failClosed') {
    return {
      code: 'claude-hook-failclosed-degrade',
      message: getFieldTranslationOutcome('hooks', field, platform)?.notes ?? 'Claude drops `failClosed`.',
    }
  }

  if (platform === 'claude-code' && field === 'loop_limit') {
    return {
      code: 'claude-hook-loop-limit-degrade',
      message: getFieldTranslationOutcome('hooks', field, platform)?.notes ?? 'Claude drops `loop_limit`.',
    }
  }

  if (platform === 'codex' && field === 'failClosed') {
    return {
      code: 'codex-hook-failclosed-drop',
      message: getFieldTranslationOutcome('hooks', field, platform)?.notes ?? 'Codex drops `failClosed`.',
    }
  }

  if (platform === 'codex' && field === 'loop_limit') {
    return {
      code: 'codex-hook-loop-limit-drop',
      message: getFieldTranslationOutcome('hooks', field, platform)?.notes ?? 'Codex drops `loop_limit`.',
    }
  }

  if (platform === 'opencode' && field === 'loop_limit') {
    return {
      code: 'opencode-hook-loop-limit-drop',
      message: getFieldTranslationOutcome('hooks', field, platform)?.notes ?? 'OpenCode drops `loop_limit`.',
    }
  }

  return null
}
