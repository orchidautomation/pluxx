import type { TargetPlatform } from './schema'

const INSTALL_FOLLOWUP_NOTES: Partial<Record<TargetPlatform, string>> = {
  'claude-code': 'Claude Code note: if Claude is already open, run /reload-plugins in the session to pick up the new install.',
  cursor: 'Cursor note: if Cursor is already open, use Developer: Reload Window or restart Cursor to pick up the new install.',
  codex: 'Codex note: if Codex is already open, use Plugins > Refresh if that action is available in your current UI, or restart Codex to pick up the new install. Plugin-bundled MCP servers may appear on the plugin detail page without appearing in the global MCP servers settings page.',
  opencode: 'OpenCode note: if OpenCode is already open, restart or reload it so the plugin is picked up.',
}

const VERIFY_STALE_ACTIONS: Partial<Record<TargetPlatform, string>> = {
  codex: 'in Codex, use Plugins > Refresh if available, or restart Codex so the plugin cache reloads',
}

const PUBLISH_RELOAD_INSTRUCTIONS: Partial<Record<TargetPlatform, string>> = {
  'claude-code': 'If Claude is already open, run /reload-plugins in the active session.',
  cursor: 'If Cursor is already open, use Developer: Reload Window or restart Cursor so the plugin is picked up.',
  codex: 'If Codex is already open, use Plugins > Refresh if that action is available in your current UI, or restart Codex so the plugin is picked up.',
  opencode: 'If OpenCode is already open, restart or reload it so the plugin is picked up.',
}

export function getInstallFollowupNote(target: TargetPlatform): string | undefined {
  return INSTALL_FOLLOWUP_NOTES[target]
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
  return PUBLISH_RELOAD_INSTRUCTIONS[target]
}
