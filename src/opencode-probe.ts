import { createJiti } from 'jiti'
import { readFileSync } from 'fs'
import { resolve } from 'path'

/** Load the installed entry and exercise setup without connecting MCP or running
 * hooks. Host discovery/connection is a separate real-host acceptance check. */
export async function probeOpenCodeDefinition(entryPath: string, bundlePath: string, pluginName: string, expectedMcpNames: string[] = []): Promise<void> {
  const jiti = createJiti(import.meta.url, { interopDefault: false, moduleCache: false, fsCache: false, tryNative: false })
  const module = await jiti.import(entryPath) as Record<string, unknown>
  const definition = module.default as { id?: unknown; setup?: unknown; server?: unknown } | undefined
  if (!definition || definition.id !== pluginName || typeof definition.setup !== 'function' || typeof definition.server !== 'function') {
    throw new Error('OpenCode entry requires one default id/setup definition and V1 server compatibility (OpenCode 1.18.29+).')
  }
  if (Object.keys(module).some(key => key !== 'default')) throw new Error('OpenCode bundle exports multiple plugin candidates.')
  const v1Hooks = await definition.server({ directory: process.cwd(), project: {},
    client: { app: { log: async () => {} } }, $: async () => {} }) as Record<string, unknown> | undefined
  if (!v1Hooks || typeof v1Hooks !== 'object' || Array.isArray(v1Hooks)
    || typeof v1Hooks.config !== 'function'
    || Object.values(v1Hooks).some(value => typeof value !== 'function')) {
    throw new Error('OpenCode V1 server must return a hook object with a config function.')
  }
  const v1Config: { mcp?: Record<string, unknown> } = {}
  await v1Hooks.config(v1Config)
  for (const name of expectedMcpNames) {
    const server = v1Config.mcp?.[name] as { type?: string; command?: unknown; url?: unknown } | undefined
    if (!server) throw new Error(`OpenCode V1 config did not register configured MCP: ${name}`)
    if (!['local', 'remote'].includes(server.type ?? '') || (server.type === 'local' ? !Array.isArray(server.command) : typeof server.url !== 'string')) {
      throw new Error(`Invalid OpenCode V1 MCP configuration: ${name}`)
    }
  }
  const servers = new Map<string, unknown>()
  const registration = { dispose: async () => {} }
  const hook = async () => registration
  const ctx = {
    location: { directory: process.cwd(), project: { id: 'pluxx-verification' } },
    mcp: { transform: async (callback: (editor: unknown) => void) => {
      callback({ set: (name: string, config: { type?: string; command?: unknown; url?: unknown }) => {
        if (!['local', 'remote'].includes(config.type ?? '') || (config.type === 'local' ? !Array.isArray(config.command) : typeof config.url !== 'string')) {
          throw new Error(`Invalid registered MCP configuration: ${name}`)
        }
        servers.set(name, config)
      } })
      return registration
    } },
    command: { transform: async (callback: (editor: unknown) => void) => { callback({ add: () => {} }); return registration } },
    tool: { hook }, shell: { hook }, session: { hook },
    event: { subscribe: async function* () {} },
  }
  const cleanup = await definition.setup(ctx)
  try {
    for (const name of expectedMcpNames) if (!servers.has(name)) throw new Error(`OpenCode setup did not register configured MCP: ${name}`)
    const source = readFileSync(resolve(bundlePath, 'index.ts'), 'utf-8')
    const match = source.match(/const MCP_DEFINITIONS(?:[^=\n]*) = ([\s\S]*?)\n\nconst /)
    if (match) {
      const expected = Object.keys(JSON.parse(match[1]) as Record<string, unknown>)
      for (const name of expected) if (!servers.has(name)) throw new Error(`OpenCode setup did not register configured MCP: ${name}`)
    }
  } finally {
    if (typeof cleanup === 'function') await cleanup()
  }
}
