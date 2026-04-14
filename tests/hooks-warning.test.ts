import { describe, expect, it } from 'bun:test'
import { warnDroppedHookFields } from '../src/generators/hooks-warning'
import type { HookEntry, TargetPlatform } from '../src/schema'

function captureWarnings(run: () => void): string[] {
  const originalWarn = console.warn
  const warnings: string[] = []
  const mockedWarn: typeof console.warn = (...args) => {
    warnings.push(args.map(String).join(' '))
  }

  console.warn = mockedWarn
  try {
    run()
  } finally {
    console.warn = originalWarn
  }

  return warnings
}

describe('warnDroppedHookFields', () => {
  const matcherEntries: HookEntry[] = [{
    command: '${PLUGIN_ROOT}/scripts/confirm-mutation.sh',
    matcher: 'mcp__linear-mcp__create_attachment',
  }]

  it('does not warn about matcher for platforms that preserve it', () => {
    const platforms: TargetPlatform[] = [
      'claude-code',
      'cursor',
      'github-copilot',
      'openhands',
    ]

    for (const platform of platforms) {
      const warnings = captureWarnings(() => {
        warnDroppedHookFields(platform, 'preToolUse', matcherEntries)
      })

      expect(warnings.some(message => message.includes('"matcher"'))).toBe(false)
    }
  })

  it('continues warning about matcher for platforms that drop it', () => {
    const platforms: TargetPlatform[] = [
      'codex',
      'gemini-cli',
      'amp',
    ]

    for (const platform of platforms) {
      const warnings = captureWarnings(() => {
        warnDroppedHookFields(platform, 'preToolUse', matcherEntries)
      })

      expect(
        warnings.some(message =>
          message.includes(
            `${platform} generator dropped unsupported hook field "matcher" for event "preToolUse".`
          )
        )
      ).toBe(true)
    }
  })
})
