import type { TargetPlatform } from './schema'

export type HookFieldName = 'prompt' | 'matcher' | 'failClosed' | 'loop_limit'
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
  fields: Record<HookFieldName, HookFieldCapability>
}

const HOOK_PLATFORM_REGISTRY: Partial<Record<TargetPlatform, HookPlatformRegistry>> = {
  'claude-code': {
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
    fields: {
      prompt: { mode: 'preserve' },
      matcher: { mode: 'preserve' },
      failClosed: { mode: 'preserve' },
      loop_limit: { mode: 'preserve', supportedEvents: ['stop', 'subagentStop'] },
    },
  },
  codex: {
    supportedEvents: ['SessionStart', 'PreToolUse', 'PermissionRequest', 'PostToolUse', 'UserPromptSubmit', 'Stop'],
    unsupportedEventReason: 'Codex currently documents only SessionStart, PreToolUse, PermissionRequest, PostToolUse, UserPromptSubmit, and Stop for hook configuration.',
    fields: {
      prompt: { mode: 'drop' },
      matcher: { mode: 'preserve' },
      failClosed: { mode: 'preserve' },
      loop_limit: { mode: 'drop' },
    },
  },
  opencode: {
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

export function getUnsupportedHookEventReason(platform: TargetPlatform): string | null {
  return HOOK_PLATFORM_REGISTRY[platform]?.unsupportedEventReason ?? null
}

export function isHookEventSupported(platform: TargetPlatform, event: string): boolean {
  const supportedEvents = getSupportedHookEvents(platform)
  if (supportedEvents.length === 0) return true
  return supportedEvents.includes(event)
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

  if (platform === 'codex' && field === 'loop_limit') {
    return {
      code: 'codex-hook-loop-limit-drop',
      message: 'Codex hook companions currently drop `loop_limit`. Only command, matcher, timeout, and failClosed survive there today.',
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
