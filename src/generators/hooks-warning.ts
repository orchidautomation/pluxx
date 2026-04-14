import type { HookEntry, TargetPlatform } from '../schema'

const MATCHER_PASSTHROUGH_PLATFORMS = new Set<TargetPlatform>([
  'claude-code',
  'cursor',
  'github-copilot',
  'openhands',
])

const FAIL_CLOSED_PASSTHROUGH_PLATFORMS = new Set<TargetPlatform>([
  'cursor',
])

const LOOP_LIMIT_PASSTHROUGH_PLATFORMS = new Set<TargetPlatform>([
  'cursor',
])

export function warnDroppedHookFields(
  platform: TargetPlatform,
  event: string,
  entries: HookEntry[],
): void {
  const hasPromptHooks = entries.some(entry => entry.type === 'prompt')
  const hasMatcher = entries.some(entry => entry.matcher !== undefined)
  const hasFailClosed = entries.some(entry => entry.failClosed !== undefined)
  const hasLoopLimit = entries.some(entry => entry.loop_limit !== undefined)

  if (hasPromptHooks) {
    console.warn(
      `[pluxx] ${platform} generator dropped unsupported prompt-based hook for event "${event}".`
    )
  }

  if (hasMatcher && !MATCHER_PASSTHROUGH_PLATFORMS.has(platform)) {
    console.warn(
      `[pluxx] ${platform} generator dropped unsupported hook field "matcher" for event "${event}".`
    )
  }

  if (hasFailClosed && !FAIL_CLOSED_PASSTHROUGH_PLATFORMS.has(platform)) {
    console.warn(
      `[pluxx] ${platform} generator dropped unsupported hook field "failClosed" for event "${event}".`
    )
  }

  if (hasLoopLimit && !LOOP_LIMIT_PASSTHROUGH_PLATFORMS.has(platform)) {
    console.warn(
      `[pluxx] ${platform} generator dropped unsupported hook field "loop_limit" for event "${event}".`
    )
  }
}
