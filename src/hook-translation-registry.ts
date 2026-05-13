import type { TargetPlatform } from './schema'
import { CURSOR_SUPPORTED_HOOK_EVENTS } from './hook-events'

export type HookFieldName = 'prompt' | 'matcher' | 'failClosed' | 'loop_limit'
export type HookEntryType = 'command' | 'http' | 'mcp_tool' | 'prompt' | 'agent'
export type HookFieldTranslationMode = 'preserve' | 'drop'

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
  fields: Record<HookFieldName, HookFieldCapability>
}

const HOOK_PLATFORM_REGISTRY: Partial<Record<TargetPlatform, HookPlatformRegistry>> = {
  'claude-code': {
    supportedTypes: ['command', 'http', 'mcp_tool', 'prompt', 'agent'],
    fields: {
      prompt: {
        mode: 'preserve',
        supportedEvents: [
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
      matcher: { mode: 'preserve' },
      failClosed: { mode: 'drop' },
      loop_limit: { mode: 'drop' },
    },
  },
  cursor: {
    supportedTypes: ['command', 'prompt'],
    supportedEvents: CURSOR_SUPPORTED_HOOK_EVENTS,
    unsupportedEventReason: `Cursor currently documents only ${CURSOR_SUPPORTED_HOOK_EVENTS.join(', ')} for hook configuration.`,
    fields: {
      prompt: { mode: 'preserve' },
      matcher: { mode: 'preserve' },
      failClosed: { mode: 'preserve' },
      loop_limit: { mode: 'preserve', supportedEvents: ['stop', 'subagentStop'] },
    },
  },
  codex: {
    supportedTypes: ['command'],
    supportedEvents: ['SessionStart', 'PreToolUse', 'PermissionRequest', 'PostToolUse', 'UserPromptSubmit', 'Stop'],
    unsupportedEventReason: 'Codex currently documents only SessionStart, PreToolUse, PermissionRequest, PostToolUse, UserPromptSubmit, and Stop for hook configuration.',
    fields: {
      prompt: { mode: 'drop' },
      matcher: {
        mode: 'preserve',
        supportedEvents: ['SessionStart', 'PreToolUse', 'PermissionRequest', 'PostToolUse'],
      },
      failClosed: { mode: 'drop' },
      loop_limit: { mode: 'drop' },
    },
  },
  opencode: {
    supportedTypes: ['command'],
    fields: {
      prompt: { mode: 'drop' },
      matcher: { mode: 'preserve' },
      failClosed: { mode: 'preserve' },
      loop_limit: { mode: 'drop' },
    },
  },
  'github-copilot': {
    fields: {
      prompt: { mode: 'drop' },
      matcher: { mode: 'preserve' },
      failClosed: { mode: 'drop' },
      loop_limit: { mode: 'drop' },
    },
  },
  openhands: {
    fields: {
      prompt: { mode: 'drop' },
      matcher: { mode: 'preserve' },
      failClosed: { mode: 'drop' },
      loop_limit: { mode: 'drop' },
    },
  },
  warp: {
    fields: {
      prompt: { mode: 'drop' },
      matcher: { mode: 'drop' },
      failClosed: { mode: 'drop' },
      loop_limit: { mode: 'drop' },
    },
  },
  'gemini-cli': {
    fields: {
      prompt: { mode: 'drop' },
      matcher: { mode: 'drop' },
      failClosed: { mode: 'drop' },
      loop_limit: { mode: 'drop' },
    },
  },
  'roo-code': {
    fields: {
      prompt: { mode: 'drop' },
      matcher: { mode: 'drop' },
      failClosed: { mode: 'drop' },
      loop_limit: { mode: 'drop' },
    },
  },
  cline: {
    fields: {
      prompt: { mode: 'drop' },
      matcher: { mode: 'drop' },
      failClosed: { mode: 'drop' },
      loop_limit: { mode: 'drop' },
    },
  },
  amp: {
    fields: {
      prompt: { mode: 'drop' },
      matcher: { mode: 'drop' },
      failClosed: { mode: 'drop' },
      loop_limit: { mode: 'drop' },
    },
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
  return HOOK_PLATFORM_REGISTRY[platform]?.fields[field] ?? { mode: 'drop' }
}

export function isHookFieldPreserved(
  platform: TargetPlatform,
  field: HookFieldName,
  event?: string,
): boolean {
  const capability = getHookFieldCapability(platform, field)
  if (capability.mode !== 'preserve') return false
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
    return {
      code: 'cursor-hook-type-unsupported',
      message: `Cursor does not document hook type "${type}". Pluxx currently preserves only command and prompt hooks on the Cursor hook surface.`,
    }
  }

  if (platform === 'codex') {
    return {
      code: 'codex-hook-type-drop',
      message: `Codex currently bundles only command-hook entries from Pluxx. ${type} hooks will be dropped from the generated Codex bundle.`,
    }
  }

  if (platform === 'opencode') {
    return {
      code: 'opencode-hook-type-drop',
      message: `The current OpenCode runtime wrapper only emits command hooks. ${type} hooks will be dropped from the generated OpenCode plugin.`,
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
      message: `Claude currently preserves prompt hooks only on ${supportedEvents.join(', ')}. Prompt hooks on ${event ?? 'other events'} will be dropped from generated Claude output.`,
    }
  }

  if (platform === 'codex') {
    return {
      code: 'codex-prompt-hook-drop',
      message: 'Codex currently receives only command-hook entries from Pluxx. Prompt hooks will be dropped from the generated Codex bundle.',
    }
  }

  if (platform === 'opencode') {
    return {
      code: 'opencode-prompt-hook-drop',
      message: 'The current OpenCode runtime wrapper only emits command hooks. Prompt hooks will be dropped from the generated OpenCode plugin.',
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
      message: 'Claude hook entries currently drop `failClosed` in generated output. Keep this behavior host-specific or verify the generated hook bundle carefully.',
    }
  }

  if (platform === 'claude-code' && field === 'loop_limit') {
    return {
      code: 'claude-hook-loop-limit-degrade',
      message: 'Claude outputs currently drop `loop_limit`. Recursive hook protection is not preserved there today.',
    }
  }

  if (platform === 'codex' && field === 'failClosed') {
    return {
      code: 'codex-hook-failclosed-drop',
      message: 'Codex hook bundles currently drop `failClosed`. Strict failure behavior is not preserved in generated Codex output today.',
    }
  }

  if (platform === 'codex' && field === 'loop_limit') {
    return {
      code: 'codex-hook-loop-limit-drop',
      message: 'Codex hook bundles currently drop `loop_limit`. Current Codex output keeps command handlers, event matcher groups, and timeout where documented.',
    }
  }

  if (platform === 'opencode' && field === 'loop_limit') {
    return {
      code: 'opencode-hook-loop-limit-drop',
      message: 'OpenCode runtime hooks currently drop `loop_limit`. Recursive hook protection is still Cursor-first in Pluxx.',
    }
  }

  return null
}
