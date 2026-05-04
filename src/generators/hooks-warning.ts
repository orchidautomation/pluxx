import type { HookEntry, TargetPlatform } from '../schema'
import { isHookFieldPreserved } from '../hook-translation-registry'

export function warnDroppedHookFields(
  platform: TargetPlatform,
  event: string,
  entries: HookEntry[],
): void {
  const hasPromptHooks = entries.some(entry => entry.type === 'prompt')
  const hasMatcher = entries.some(entry => entry.matcher !== undefined)
  const hasFailClosed = entries.some(entry => entry.failClosed !== undefined)
  const hasLoopLimit = entries.some(entry => entry.loop_limit !== undefined)

  if (hasPromptHooks && !isHookFieldPreserved(platform, 'prompt', event)) {
    console.warn(
      `[pluxx] ${platform} generator dropped unsupported prompt-based hook for event "${event}".`
    )
  }

  if (hasMatcher && !isHookFieldPreserved(platform, 'matcher', event)) {
    console.warn(
      `[pluxx] ${platform} generator dropped unsupported hook field "matcher" for event "${event}".`
    )
  }

  if (hasFailClosed && !isHookFieldPreserved(platform, 'failClosed', event)) {
    console.warn(
      `[pluxx] ${platform} generator dropped unsupported hook field "failClosed" for event "${event}".`
    )
  }

  if (hasLoopLimit && !isHookFieldPreserved(platform, 'loop_limit', event)) {
    console.warn(
      `[pluxx] ${platform} generator dropped unsupported hook field "loop_limit" for event "${event}".`
    )
  }
}
