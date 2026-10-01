import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { mkdirSync, readFileSync, rmSync, writeFileSync, existsSync, readdirSync, symlinkSync, readlinkSync, lstatSync } from 'fs'
import { resolve } from 'path'
import { pathToFileURL } from 'url'
import { spawnSync } from 'child_process'
import { build } from '../src/generators'
import { PluginConfigSchema } from '../src/schema'
import { installPlugin, planInstallPlugin } from '../src/cli/install'
import { verifyInstall } from '../src/cli/verify-install'
import { transactionalInstallGroup, getInstallOwnershipPath } from '../src/install-ownership'
import { probeOpenCodeDefinition } from '../src/opencode-probe'

const ROOT = resolve(import.meta.dir, '.opencode-v2-fixture')
const HOME_DIR = resolve(ROOT, 'home')
const bundle = resolve(ROOT, 'dist/opencode')
const installed = resolve(HOME_DIR, '.config/opencode/pluxx/v2-proof')
const entry = resolve(HOME_DIR, '.config/opencode/plugins/v2-proof.ts')
const previousHome = process.env.HOME
let config: ReturnType<typeof PluginConfigSchema.parse>

beforeEach(async () => {
  rmSync(ROOT, { recursive: true, force: true })
  process.env.HOME = HOME_DIR
  mkdirSync(resolve(ROOT, 'skills'), { recursive: true })
  mkdirSync(resolve(ROOT, 'commands'), { recursive: true })
  writeFileSync(resolve(ROOT, 'commands/doctor.md'), '---\nname: doctor\ndescription: Check setup\n---\nRun setup_doctor $ARGUMENTS $1\n')
  writeFileSync(resolve(ROOT, 'INSTRUCTIONS.md'), 'Always check setup.')
  config = PluginConfigSchema.parse({ name: 'v2-proof', version: '1.0.0', description: 'Compatibility fixture', author: { name: 'Test' }, targets: ['opencode'], commands: './commands', instructions: './INSTRUCTIONS.md',
    mcp: { fixture: { transport: 'stdio', command: 'node', args: ['-e', 'process.stdin.resume()'], env: { TEST_VALUE: 'fixture' } } } })
  await build(config, ROOT)
})
afterEach(() => { process.env.HOME = previousHome; rmSync(ROOT, { recursive: true, force: true }) })

function context() {
  const servers: Record<string, any> = {}
  const commands: Record<string, any> = {}
  const hooks: Record<string, (event: any) => Promise<void>> = {}
  let disposed = 0
  let signal: AbortSignal | undefined
  const registration = () => ({ dispose: async () => { disposed++ } })
  const domain = (name: string) => ({ hook: async (kind: string, callback: any) => { hooks[name + '.' + kind] = callback; return registration() } })
  const prompts: any[] = []
  const ctx = {
    location: { directory: ROOT, project: { id: 'test' } },
    mcp: { transform: async (callback: any) => { callback({ set: (name: string, value: any) => { servers[name] = value } }); return registration() } },
    command: { transform: async (callback: any) => { callback({ add: (value: any) => { commands[value.name] = value } }); return registration() } },
    tool: domain('tool'), shell: domain('shell'), session: { ...domain('session'), prompt: async (input: any) => { await hooks['session.prompt']?.({ sessionID: input.sessionID, prompt: input }); prompts.push(input) } },
    event: { subscribe: async function* (options: { signal: AbortSignal }) { signal = options.signal; yield { type: 'session.created' } } },
  }
  return { ctx, servers, commands, hooks, prompts, disposed: () => disposed, signal: () => signal }
}

async function definition() { return (await import(`${pathToFileURL(resolve(bundle, 'index.ts')).href}?v=${Date.now()}`)).default }

describe('OpenCode 2 installed contract', () => {
  it('typechecks the generated dual entry against pinned V1 and V2 SDKs', () => {
    const result = spawnSync('node', [resolve(import.meta.dir, '../node_modules/typescript/bin/tsc'), '--noEmit', '--skipLibCheck', '--strict', '--target', 'ES2022', '--module', 'ESNext', '--moduleResolution', 'bundler', resolve(bundle, 'index.ts')], { encoding: 'utf-8' })
    expect(result.stdout + result.stderr).toBe('')
    expect(result.status).toBe(0)
  })

  it('loads one installed default entry and registers MCP, commands and hooks with the workspace intact', async () => {
    await installPlugin(resolve(ROOT, 'dist'), config.name, ['opencode'], { quiet: true, useNativeClaudeInstall: false })
    const module = await import(pathToFileURL(entry).href)
    expect(Object.keys(module)).toEqual(['default'])
    expect(readdirSync(resolve(HOME_DIR, '.config/opencode/plugins'))).toEqual(['v2-proof.ts'])
    const state = context()
    const cleanup = await module.default.setup(state.ctx)
    expect(state.servers.fixture.environment.TEST_VALUE).toBe('fixture')
    expect(state.servers.fixture.environment.PLUXX_PLUGIN_ROOT).toBe(bundle)
    expect(state.servers.fixture.environment.PLUXX_WORKSPACE_ROOT).toBe(ROOT)
    expect(state.servers.fixture.disabled).toBe(false)
    await state.commands.doctor.execute({ sessionID: 'session', prompt: { text: 'check now', attachments: [] }, delivery: 'queue' })
    expect(state.prompts[0]).toMatchObject({ sessionID: 'session', text: 'Run setup_doctor check now check', delivery: 'queue', attachments: [] })
    const event = { system: [] }
    await state.hooks['session.context'](event)
    await state.hooks['session.context'](event)
    expect(event.system).toEqual([{ type: 'text', text: 'Always check setup.' }])
    await cleanup()
    expect(state.disposed()).toBe(10)
    const result = await verifyInstall(config, ROOT, { targets: ['opencode'] })
    expect(result.ok).toBe(true)
  })

  it('retains V1 server config and hooks', async () => {
    const plugin = await definition()
    const hooks = await plugin.server({ directory: ROOT, project: {}, client: { app: { log: async () => {} } }, $: async () => {} })
    const output: any = {}
    await hooks.config(output)
    expect(output.mcp.fixture.type).toBe('local')
    expect(output.command.doctor.template).toContain('setup_doctor')
    expect(typeof hooks['tool.execute.before']).toBe('function')
  })

  it('rejects V1-only artifacts, duplicate discovery, and missing MCP registration', async () => {
    await installPlugin(resolve(ROOT, 'dist'), config.name, ['opencode'], { quiet: true, useNativeClaudeInstall: false })
    mkdirSync(resolve(HOME_DIR, '.config/opencode/plugins/v2-proof'), { recursive: true })
    const duplicate = (await verifyInstall(config, ROOT, { targets: ['opencode'] })).checks[0].issues.find(issue => issue.code === 'consumer-opencode-duplicate-discovery')
    expect(duplicate?.fix).toContain('move')
    rmSync(resolve(HOME_DIR, '.config/opencode/plugins/v2-proof'), { recursive: true })
    writeFileSync(resolve(bundle, 'index.ts'), 'import "./missing-dependency.js"; export default { id:"v2-proof",setup:async()=>{},server:async()=>{} }')
    expect((await verifyInstall(config, ROOT, { targets: ['opencode'] })).ok).toBe(false)
    writeFileSync(resolve(bundle, 'index.ts'), 'export const V1 = async () => ({})\n')
    expect((await verifyInstall(config, ROOT, { targets: ['opencode'] })).ok).toBe(false)
    writeFileSync(resolve(bundle, 'index.ts'), 'const MCP_DEFINITIONS = {"fixture":{}}\n\nconst unused = 1\nexport default {id:"v2-proof",server:async()=>({config:async c=>{c.mcp={fixture:{type:"local",command:["node"]}}}}),setup:async()=>{}}')
    const missing = await verifyInstall(config, ROOT, { targets: ['opencode'] })
    expect(missing.checks[0].issues.map(issue => issue.detail).join('\n')).toContain('did not register configured MCP')
  })

  it('rejects broken V1 factories, hook shapes and MCP configuration', async () => {
    for (const [server, reason] of [
      ['async()=>{throw new Error("V1 factory failed")}', 'V1 factory failed'],
      ['async()=>undefined', 'V1 server must return'],
      ['async()=>({config:42})', 'V1 server must return'],
      ['async()=>({config:async c=>{c.mcp={fixture:{type:"local",command:"node"}}}})', 'Invalid OpenCode V1 MCP'],
    ]) {
      writeFileSync(resolve(bundle, 'index.ts'), `export default {id:"v2-proof",setup:async()=>{},server:${server}}`)
      await expect(probeOpenCodeDefinition(resolve(bundle, 'index.ts'), bundle, config.name, ['fixture'])).rejects.toThrow(reason)
    }
  })

  it('disposes earlier registrations when setup fails', async () => {
    const state = context()
    state.ctx.command.transform = async () => { throw new Error('registration failed') }
    await expect((await definition()).setup(state.ctx)).rejects.toThrow('registration failed')
    expect(state.disposed()).toBe(1)
  })

  it('migrates an owned legacy bundle and restores it when a published candidate fails validation', () => {
    const legacy = resolve(HOME_DIR, '.config/opencode/plugins/v2-proof')
    transactionalInstallGroup({ pluginName: config.name, platform: 'opencode', targets: [{ sourcePath: bundle, installPath: legacy, kind: 'copy' }] })
    expect(planInstallPlugin(resolve(ROOT, 'dist'), config.name, ['opencode'])[0].existing).toBe(true)
    const ledger = readFileSync(getInstallOwnershipPath(config.name, 'opencode'), 'utf-8')
    expect(() => transactionalInstallGroup({ pluginName: config.name, platform: 'opencode', previousInstallPath: legacy, targets: [{ sourcePath: bundle, installPath: installed, kind: 'copy', validate: path => { if (path === installed) throw new Error('published validation failed') } }] })).toThrow('published validation failed')
    expect(existsSync(legacy)).toBe(true)
    expect(existsSync(installed)).toBe(false)
    expect(readFileSync(getInstallOwnershipPath(config.name, 'opencode'), 'utf-8')).toBe(ledger)
    transactionalInstallGroup({ pluginName: config.name, platform: 'opencode', previousInstallPath: legacy, targets: [{ sourcePath: bundle, installPath: installed, kind: 'copy' }], verify: () => {
      expect(readdirSync(resolve(legacy, '..'))).toEqual([])
      expect(readdirSync(resolve(installed, '..')).some(name => name.includes('pluxx-legacy'))).toBe(true)
    } })
    expect(existsSync(legacy)).toBe(false)
    expect(existsSync(installed)).toBe(true)
  })

  it('rejects unowned dangling legacy links and restores owned links after rollback', () => {
    const legacy = resolve(HOME_DIR, '.config/opencode/plugins/v2-proof')
    const target = resolve(ROOT, 'missing-source')
    mkdirSync(resolve(legacy, '..'), { recursive: true })
    symlinkSync(target, legacy)
    const migrate = (verify?: () => void) => transactionalInstallGroup({ pluginName: config.name, platform: 'opencode', previousInstallPath: legacy, targets: [{ sourcePath: bundle, installPath: installed, kind: 'copy' }], verify })
    expect(() => migrate()).toThrow('unowned or modified')
    expect(readlinkSync(legacy)).toBe(target)
    rmSync(legacy)
    transactionalInstallGroup({ pluginName: config.name, platform: 'opencode', targets: [{ sourcePath: target, installPath: legacy, kind: 'symlink' }] })
    const ledger = readFileSync(getInstallOwnershipPath(config.name, 'opencode'), 'utf-8')
    expect(() => migrate(() => { throw new Error('rollback dangling link') })).toThrow('rollback dangling link')
    expect(readlinkSync(legacy)).toBe(target)
    expect(readFileSync(getInstallOwnershipPath(config.name, 'opencode'), 'utf-8')).toBe(ledger)
    migrate()
    expect(lstatSync(legacy, { throwIfNoEntry: false })).toBeUndefined()
    expect(existsSync(installed)).toBe(true)
  })

  it('preserves unowned legacy bundles and refuses migration', async () => {
    const legacy = resolve(HOME_DIR, '.config/opencode/plugins/v2-proof')
    mkdirSync(legacy, { recursive: true })
    writeFileSync(resolve(legacy, 'user.txt'), 'preserve')
    await expect(installPlugin(resolve(ROOT, 'dist'), config.name, ['opencode'], { quiet: true })).rejects.toThrow('unowned or modified')
    expect(readFileSync(resolve(legacy, 'user.txt'), 'utf-8')).toBe('preserve')
    expect(existsSync(entry)).toBe(false)
  })
})

describe('OpenCode 2 runtime gates', () => {
  it('rejects fail-closed event hooks before V2 registration', async () => {
    config.hooks = { sessionStart: [{ command: 'exit 7', failClosed: true }] }
    await build(config, ROOT)
    const state = context()
    await expect((await definition()).setup(state.ctx)).rejects.toThrow('cannot enforce failClosed event hooks')
    expect(state.disposed()).toBe(0)
  })

  it('runs after hooks for completed, failed and cancelled tools', async () => {
    config.hooks = { postToolUse: [{ command: 'printf after >> "${PLUGIN_ROOT}/after.txt"', matcher: 'Read' }] }
    await build(config, ROOT)
    const state = context()
    const cleanup = await (await definition()).setup(state.ctx)
    for (const status of ['completed', 'failed', 'cancelled']) await state.hooks['tool.execute.after']({ tool: 'read', input: {}, id: status, sessionID: 's', status })
    expect(readFileSync(resolve(bundle, 'after.txt'), 'utf-8')).toBe('afterafterafter')
    await cleanup()
  })

  it('runs prompt hooks once for a command and once for an ordinary prompt', async () => {
    config.hooks = { beforeSubmitPrompt: [{ command: 'printf prompt >> "${PLUGIN_ROOT}/prompts.txt"' }] }
    await build(config, ROOT)
    const state = context()
    const cleanup = await (await definition()).setup(state.ctx)
    await state.commands.doctor.execute({ sessionID: 's', prompt: { text: 'check' }, delivery: 'queue' })
    expect(readFileSync(resolve(bundle, 'prompts.txt'), 'utf-8')).toBe('prompt')
    await state.hooks['session.prompt']({ sessionID: 's', prompt: { text: 'ordinary' } })
    expect(readFileSync(resolve(bundle, 'prompts.txt'), 'utf-8')).toBe('promptprompt')
    await cleanup()
  })
  it('runs matched hooks in order and preserves fail-open/fail-closed behavior', async () => {
    config.hooks = { preToolUse: [
      { command: 'printf first >> "${PLUGIN_ROOT}/order.txt"', matcher: 'Read' },
      { command: 'exit 1', matcher: 'Read', failClosed: false },
      { command: 'printf second >> "${PLUGIN_ROOT}/order.txt"', matcher: 'Read' },
      { command: 'exit 2', matcher: 'Bash', failClosed: true },
    ] }
    await build(config, ROOT)
    const state = context()
    const cleanup = await (await definition()).setup(state.ctx)
    await state.hooks['tool.execute.before']({ tool: 'grep', input: {}, id: 'call', sessionID: 's' })
    expect(existsSync(resolve(bundle, 'order.txt'))).toBe(false)
    await state.hooks['tool.execute.before']({ tool: 'read', input: {}, id: 'call', sessionID: 's' })
    expect(readFileSync(resolve(bundle, 'order.txt'), 'utf-8')).toBe('firstsecond')
    await expect(state.hooks['tool.execute.before']({ tool: 'bash', input: {}, id: 'call', sessionID: 's' })).rejects.toThrow()
    await cleanup()
  })

  it('blocks canonical MCP and named-command readiness until status is ready, then aborts its event subscription', async () => {
    config.readiness = PluginConfigSchema.parse({ ...config, readiness: {
      dependencies: [{ id: 'cache', path: './status.json', refresh: { command: 'true', detached: false } }],
      gates: [{ dependency: 'cache', applyTo: ['mcp-tools', 'commands'], tools: ['fixture.setup_doctor'], commands: ['doctor'], timeoutMs: 10, pollMs: 5, onTimeout: 'fail' }],
    } }).readiness
    await build(config, ROOT)
    writeFileSync(resolve(bundle, 'status.json'), '{"status":"failed"}')
    const state = context()
    const cleanup = await (await definition()).setup(state.ctx)
    await expect(state.hooks['tool.execute.before']({ tool: 'fixture_setup_doctor', input: {}, id: 'call', sessionID: 's' })).rejects.toThrow()
    await expect(state.commands.doctor.execute({ sessionID: 's', prompt: { text: 'check' }, delivery: 'queue' })).rejects.toThrow()
    expect(state.prompts).toEqual([])
    writeFileSync(resolve(bundle, 'status.json'), '{"status":"succeeded"}')
    await state.hooks['tool.execute.before']({ tool: 'fixture_setup_doctor', input: {}, id: 'call', sessionID: 's' })
    await state.commands.doctor.execute({ sessionID: 's', prompt: { text: 'check' }, delivery: 'queue' })
    expect(state.prompts.length).toBe(1)
    await cleanup()
    expect(state.signal()?.aborted).toBe(true)
  })

  it('fails closed and rolls back registrations for unsupported global permission config', async () => {
    config.permissions = { deny: ['Read(.env)'] }
    await build(config, ROOT)
    const state = context()
    await expect((await definition()).setup(state.ctx)).rejects.toThrow('no global permission config transform')
    expect(state.disposed()).toBe(10)
  })
})
