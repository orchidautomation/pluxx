import { resolve } from 'path'
import type { TargetPlatform } from './schema'

const HOST_PLUGIN_ROOT_VARS = ['CLAUDE_PLUGIN_ROOT', 'CURSOR_PLUGIN_ROOT', 'PLUGIN_ROOT'] as const

export type HostPluginRootVar = typeof HOST_PLUGIN_ROOT_VARS[number]

export function normalizePluginOwnedStdioPathForPlatform(
  value: string,
  platform: TargetPlatform,
): string {
  const normalized = value.replace(/\\/g, '/')
  const rootRef = parsePluginRootReference(normalized)

  if (rootRef) {
    if (platform === 'claude-code') {
      return `\${CLAUDE_PLUGIN_ROOT}/${rootRef.suffix}`
    }
    return `./${rootRef.suffix}`
  }

  if (normalized.startsWith('./')) {
    return platform === 'claude-code'
      ? `\${CLAUDE_PLUGIN_ROOT}/${normalized.slice(2)}`
      : normalized
  }

  if (normalized.startsWith('../')) {
    return platform === 'claude-code'
      ? `\${CLAUDE_PLUGIN_ROOT}/${normalized}`
      : normalized
  }

  return value
}

export function findHostPluginRootVars(value: string): HostPluginRootVar[] {
  const matches = value.match(/\$\{(?:CLAUDE_PLUGIN_ROOT|CURSOR_PLUGIN_ROOT|PLUGIN_ROOT)\}/g) ?? []
  return [...new Set(matches.map((match) => match.slice(2, -1) as HostPluginRootVar))]
}

export function findLeakedPluginRootVars(
  platform: TargetPlatform,
  values: string[],
): HostPluginRootVar[] {
  const leaks = new Set<HostPluginRootVar>()

  for (const value of values) {
    for (const pluginRootVar of findHostPluginRootVars(value)) {
      if (platform === 'claude-code') {
        if (pluginRootVar !== 'CLAUDE_PLUGIN_ROOT') {
          leaks.add(pluginRootVar)
        }
        continue
      }

      leaks.add(pluginRootVar)
    }
  }

  return [...leaks]
}

export function materializeInstalledPluginOwnedStdioPathForPlatform(
  value: string,
  platform: TargetPlatform,
  pluginDir: string,
): string {
  if (platform !== 'codex') {
    return normalizePluginOwnedStdioPathForPlatform(value, platform)
  }

  const normalized = value.replace(/\\/g, '/')
  const rootRef = parsePluginRootReference(normalized)

  if (rootRef) {
    return resolve(pluginDir, rootRef.suffix)
  }

  if (normalized.startsWith('./') || normalized.startsWith('../')) {
    return resolve(pluginDir, normalized)
  }

  return value
}

function parsePluginRootReference(value: string): { rootVar: HostPluginRootVar; suffix: string } | null {
  const match = value.match(/^\$\{(CLAUDE_PLUGIN_ROOT|CURSOR_PLUGIN_ROOT|PLUGIN_ROOT)\}[\\/](.+)$/)
  if (!match) return null

  return {
    rootVar: match[1] as HostPluginRootVar,
    suffix: match[2],
  }
}
