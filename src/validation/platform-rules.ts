const NPM_PACKAGE_NAME_REGEX = /^(?:@(?:[a-z0-9-~][a-z0-9-._~]*)\/)?[a-z0-9-~][a-z0-9-._~]*$/

/**
 * OpenCode plugin function receives this context object.
 * Source: https://opencode.ai/docs/plugins and @opencode-ai/plugin types.
 */
export const OPENCODE_PLUGIN_CONTEXT_FIELDS = [
  'project',
  'client',
  '$',
  'directory',
  'worktree',
] as const

/**
 * Hook keys supported by pluxx's cross-platform hook abstraction.
 * These are mapped to OpenCode hooks/events by src/generators/opencode/index.ts.
 */
export const PLUXX_HOOK_KEYS = [
  'sessionStart',
  'sessionEnd',
  'preToolUse',
  'postToolUse',
  'beforeShellExecution',
  'afterShellExecution',
  'beforeMCPExecution',
  'afterMCPExecution',
  'afterFileEdit',
  'beforeReadFile',
  'beforeSubmitPrompt',
  'stop',
] as const

/**
 * Event names from @opencode-ai/sdk Event union (v1.3.13).
 * These can be consumed via OpenCode's `event` hook.
 */
export const OPENCODE_EVENT_NAMES = [
  'command.executed',
  'file.edited',
  'file.watcher.updated',
  'installation.update-available',
  'installation.updated',
  'lsp.client.diagnostics',
  'lsp.updated',
  'message.part.removed',
  'message.part.updated',
  'message.removed',
  'message.updated',
  'permission.replied',
  'permission.updated',
  'pty.created',
  'pty.deleted',
  'pty.exited',
  'pty.updated',
  'server.connected',
  'server.instance.disposed',
  'session.compacted',
  'session.created',
  'session.deleted',
  'session.diff',
  'session.error',
  'session.idle',
  'session.status',
  'session.updated',
  'todo.updated',
  'tui.command.execute',
  'tui.prompt.append',
  'tui.toast.show',
  'vcs.branch.updated',
] as const

/**
 * Named hook keys directly supported by @opencode-ai/plugin's Hooks type.
 * pluxx currently supports a subset through generated wrapper functions.
 */
export const OPENCODE_DIRECT_HOOK_NAMES = [
  'event',
  'config',
  'tool',
  'auth',
  'chat.message',
  'chat.params',
  'chat.headers',
  'permission.ask',
  'command.execute.before',
  'tool.execute.before',
  'shell.env',
  'tool.execute.after',
  'experimental.chat.messages.transform',
  'experimental.chat.system.transform',
  'experimental.session.compacting',
  'experimental.text.complete',
  'tool.definition',
] as const

/**
 * Public TS types exported by @opencode-ai/plugin (v1.3.13).
 */
export const OPENCODE_PLUGIN_TYPE_EXPORTS = [
  'Plugin',
  'PluginModule',
  'PluginInput',
  'PluginOptions',
  'Hooks',
  'Config',
  'ProviderContext',
  'AuthHook',
  'AuthOAuthResult',
  'AuthOuathResult',
  'ToolContext',
  'ToolDefinition',
  'tool',
] as const

/**
 * `opencode.json` `plugin` array item format:
 * - "plugin-name"
 * - ["plugin-name", { options }]
 * Source: https://opencode.ai/config.json and @opencode-ai/plugin Config type.
 */
export type OpenCodePluginConfigItem = string | [string, Record<string, unknown>]

const OPENCODE_EVENT_NAME_SET = new Set<string>(OPENCODE_EVENT_NAMES)
const OPENCODE_DIRECT_HOOK_NAME_SET = new Set<string>(OPENCODE_DIRECT_HOOK_NAMES)
const PLUXX_HOOK_KEY_SET = new Set<string>(PLUXX_HOOK_KEYS)

export function isSupportedOpenCodeEventName(value: string): boolean {
  return OPENCODE_EVENT_NAME_SET.has(value)
}

export function isOpenCodeDirectHookName(value: string): boolean {
  return OPENCODE_DIRECT_HOOK_NAME_SET.has(value)
}

export function isPluxxHookKey(value: string): boolean {
  return PLUXX_HOOK_KEY_SET.has(value)
}

export function isValidNpmPackageName(value: string): boolean {
  if (!value || value.length > 214) return false
  if (!NPM_PACKAGE_NAME_REGEX.test(value)) return false
  if (value.startsWith('.') || value.startsWith('_')) return false
  if (value.includes('/_') || value.includes('/.')) return false
  return true
}

export function isValidOpenCodePluginConfigItem(value: unknown): value is OpenCodePluginConfigItem {
  if (typeof value === 'string') return true
  if (!Array.isArray(value) || value.length !== 2) return false
  const [name, options] = value
  if (typeof name !== 'string' || !name) return false
  if (!options || typeof options !== 'object' || Array.isArray(options)) return false
  return true
}
