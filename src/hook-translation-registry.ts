import type { TargetPlatform } from './schema'

export type HookFieldName = 'prompt' | 'matcher' | 'failClosed' | 'loop_limit'
export type HookFieldTranslationMode = 'preserve' | 'drop'

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
      prompt: { mode: 'drop' },
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
