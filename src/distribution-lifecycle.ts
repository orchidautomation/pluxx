import type { TargetPlatform } from './schema'

export type CoreFourTargetPlatform = Extract<TargetPlatform, 'claude-code' | 'cursor' | 'codex' | 'opencode'>

export interface HostInstallDiscoveryCapability {
  platform: CoreFourTargetPlatform
  label: string
  installMethod: string
  localInstallPath: string
  reloadBehavior: string
  cacheSemantics: string
  discoverySurface: string
  brandListingSupport: string
  installFollowupNote: string
  publishReloadInstruction: string
  verifyStaleAction?: string
}

export const CORE_FOUR_INSTALL_DISCOVERY_CAPABILITIES: readonly HostInstallDiscoveryCapability[] = [
  {
    platform: 'claude-code',
    label: 'Claude Code',
    installMethod: 'Native Claude plugin install from a generated local marketplace, or the generated release installer.',
    localInstallPath: '~/.claude/plugins/cache/pluxx-local-<plugin>/<plugin>/<version> after native install; legacy direct installs may still appear at ~/.claude/plugins/<plugin>.',
    reloadBehavior: 'Run /reload-plugins in the active Claude window.',
    cacheSemantics: 'Claude copies the selected marketplace plugin into a versioned plugin cache. Pluxx verifies that cache path rather than assuming the source bundle is live.',
    discoverySurface: 'Claude plugin marketplace/listing commands, the active plugin list, and plugin-native agents under the bundle root agents/ directory; use /agents after reload to confirm agent discovery.',
    brandListingSupport: 'No shared manifest-backed brand fields from Pluxx brand today; instructions, skills, commands, and assets still ship inside the bundle.',
    installFollowupNote: 'Claude Code note: if Claude is already open, run /reload-plugins to pick up the new install.',
    publishReloadInstruction: 'If Claude is already open, run /reload-plugins.',
  },
  {
    platform: 'cursor',
    label: 'Cursor',
    installMethod: 'Local plugin install or generated release installer that replaces the local bundle.',
    localInstallPath: '~/.cursor/plugins/local/<plugin>',
    reloadBehavior: 'Use Developer: Reload Window or restart Cursor.',
    cacheSemantics: 'Pluxx installs the local bundle path directly; no separate Pluxx-managed active cache is modeled.',
    discoverySurface: 'Cursor local plugin directory and host plugin UI; plugin-native agents are discovered from the bundle root agents/ directory after reload or restart.',
    brandListingSupport: 'Narrow shared-brand translation: homepage and logo can be emitted; richer listing copy is not a shared Cursor surface today.',
    installFollowupNote: 'Cursor note: if Cursor is already open, use Developer: Reload Window or restart Cursor to pick up the new install.',
    publishReloadInstruction: 'If Cursor is already open, use Developer: Reload Window or restart Cursor so the plugin is picked up.',
  },
  {
    platform: 'codex',
    label: 'Codex',
    installMethod: 'Local plugin install plus a local marketplace catalog entry, or the generated release installer.',
    localInstallPath: '~/.codex/plugins/<plugin> plus a local marketplace catalog entry; generated custom agents are registered under the active CODEX_HOME/agents/<plugin>/.',
    reloadBehavior: 'Use Plugins > Refresh when that UI action is available, otherwise restart Codex.',
    cacheSemantics: 'Codex may load a separate active cache under ~/.codex/plugins/cache/local-plugins/<plugin>/<version>. Pluxx clears local cache on install/uninstall, verifies custom-agent registrations, and detects stale cache contents.',
    discoverySurface: 'Codex Plugins view and plugin detail page. Plugin-bundled MCP servers may appear on the plugin detail page without appearing in the global MCP servers settings page. Custom agents are a project/user config surface, not a plugin-native registration surface.',
    brandListingSupport: 'Richest current shared-brand target: display name, descriptions, category, color, icon/logo, screenshots, default prompt, website, and policy links can be emitted into .codex-plugin/plugin.json interface metadata.',
    installFollowupNote: 'Codex note: Pluxx registers generated custom agents under the active CODEX_HOME/agents/<plugin>/ because plugin-local agent TOML is not a native plugin registration surface. If Codex is already open, use Plugins > Refresh if available or restart Codex. Plugin-bundled MCP servers may appear on the plugin detail page without appearing in the global MCP servers settings page.',
    publishReloadInstruction: 'If Codex is already open, use Plugins > Refresh if that action is available in your current UI, or restart Codex so the plugin is picked up.',
    verifyStaleAction: 'in Codex, use Plugins > Refresh if available, or restart Codex so the plugin cache reloads',
  },
  {
    platform: 'opencode',
    label: 'OpenCode',
    installMethod: 'Local plugin directory plus generated entry wrapper, generated release installer, or npm-backed wrapper package path.',
    localInstallPath: '~/.config/opencode/plugins/<plugin> plus ~/.config/opencode/plugins/<plugin>.ts and synced skills under ~/.config/opencode/skills/<plugin>-<skill>.',
    reloadBehavior: 'Restart or reload OpenCode.',
    cacheSemantics: 'Pluxx writes the local plugin wrapper and synced skill files directly; no separate Pluxx-managed active cache is modeled.',
    discoverySurface: 'OpenCode plugin loader, plugin wrapper file, config-hook-injected agent definitions, and synced skill namespace; invoke discovered specialists with @agent-name.',
    brandListingSupport: 'No shared manifest-backed brand fields from Pluxx brand today; OpenCode receives functional plugin module, instructions, skills, and package metadata.',
    installFollowupNote: 'OpenCode note: if OpenCode is already open, restart or reload it so the plugin is picked up.',
    publishReloadInstruction: 'If OpenCode is already open, restart or reload it so the plugin is picked up.',
  },
] as const

const CORE_FOUR_CAPABILITIES_BY_PLATFORM = Object.fromEntries(
  CORE_FOUR_INSTALL_DISCOVERY_CAPABILITIES.map((capability) => [capability.platform, capability]),
) as Record<CoreFourTargetPlatform, HostInstallDiscoveryCapability>

const CORE_FOUR_PLATFORMS = new Set<TargetPlatform>(
  CORE_FOUR_INSTALL_DISCOVERY_CAPABILITIES.map((capability) => capability.platform),
)

const VERIFY_STALE_ACTIONS: Partial<Record<TargetPlatform, string>> = {
  codex: CORE_FOUR_CAPABILITIES_BY_PLATFORM.codex.verifyStaleAction,
}

function isCoreFourTarget(target: TargetPlatform): target is CoreFourTargetPlatform {
  return CORE_FOUR_PLATFORMS.has(target)
}

export function getHostInstallDiscoveryCapability(target: CoreFourTargetPlatform): HostInstallDiscoveryCapability {
  return CORE_FOUR_CAPABILITIES_BY_PLATFORM[target]
}

export function getInstallFollowupNote(target: TargetPlatform): string | undefined {
  return isCoreFourTarget(target) ? getHostInstallDiscoveryCapability(target).installFollowupNote : undefined
}

export function getInstallFollowupNotes(targets: TargetPlatform[]): string[] {
  return targets
    .map(target => getInstallFollowupNote(target))
    .filter((note): note is string => Boolean(note))
}

export function getVerifyInstallStaleAction(target: TargetPlatform): string | undefined {
  return VERIFY_STALE_ACTIONS[target]
}

export function getPublishReloadInstruction(target: TargetPlatform): string | undefined {
  return isCoreFourTarget(target) ? getHostInstallDiscoveryCapability(target).publishReloadInstruction : undefined
}

export function renderHostInstallDiscoveryCapabilitiesMarkdown(): string {
  const lines = [
    '| Host | Install method | Local install path | Reload / update pickup | Cache semantics | Discovery surface | Brand / listing support |',
    '|---|---|---|---|---|---|---|',
  ]

  for (const capability of CORE_FOUR_INSTALL_DISCOVERY_CAPABILITIES) {
    lines.push([
      capability.label,
      capability.installMethod,
      capability.localInstallPath,
      capability.reloadBehavior,
      capability.cacheSemantics,
      capability.discoverySurface,
      capability.brandListingSupport,
    ].map(escapeMarkdownTableCell).join(' | ').replace(/^/, '| ').replace(/$/, ' |'))
  }

  return `${lines.join('\n')}\n`
}

export function replaceGeneratedHostInstallDiscoverySection(markdown: string): string {
  const start = '<!-- BEGIN GENERATED HOST INSTALL DISCOVERY CAPABILITIES -->'
  const end = '<!-- END GENERATED HOST INSTALL DISCOVERY CAPABILITIES -->'
  const startIndex = markdown.indexOf(start)
  const endIndex = markdown.indexOf(end)
  if (startIndex === -1 || endIndex === -1 || endIndex < startIndex) {
    throw new Error('Missing generated host install discovery capability markers')
  }

  const before = markdown.slice(0, startIndex + start.length)
  const after = markdown.slice(endIndex)
  return `${before}\n${renderHostInstallDiscoveryCapabilitiesMarkdown()}${after}`
}

function escapeMarkdownTableCell(value: string): string {
  return value.replace(/\|/g, '\\|')
}
