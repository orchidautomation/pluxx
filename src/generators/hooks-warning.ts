import type { HookEntry, TargetPlatform } from '../schema'

export function warnDroppedHookFields(
  platform: TargetPlatform,
  event: string,
  entries: HookEntry[],
): void {
  const hasMatcher = entries.some(entry => entry.matcher !== undefined)
  const hasFailClosed = entries.some(entry => entry.failClosed !== undefined)

  if (hasMatcher) {
    console.warn(
      `[plugahh] ${platform} generator dropped unsupported hook field "matcher" for event "${event}".`
    )
  }

  if (hasFailClosed) {
    console.warn(
      `[plugahh] ${platform} generator dropped unsupported hook field "failClosed" for event "${event}".`
    )
  }
}
