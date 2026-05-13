import { spawn } from 'child_process'
import { chmodSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'fs'
import { mkdtemp, rm } from 'fs/promises'
import { tmpdir } from 'os'
import { dirname, resolve } from 'path'

export type ClaudeSettingSource = 'user' | 'project' | 'local'
export type ClaudePluginScope = 'user' | 'project' | 'local' | 'managed'

export interface ClaudeHookProbeScenario {
  name: string
  prompt?: string
  settingSources?: ClaudeSettingSource[]
  pluginHook?: boolean
  pluginScope?: ClaudePluginScope
  includeStandardManifestHooks?: boolean
  managedHook?: boolean
  userHook?: boolean
  projectHook?: boolean
  localHook?: boolean
  managedDisableAllHooks?: boolean
  managedAllowManagedHooksOnly?: boolean
  userDisableAllHooks?: boolean
  projectDisableAllHooks?: boolean
  localDisableAllHooks?: boolean
}

export type ClaudeHookProbeStatus =
  | 'hook-executed'
  | 'duplicate-hook-load-error'
  | 'plugin-not-loaded'
  | 'no-hook-side-effect'
  | 'runner-failed'
  | 'runner-timed-out'

export interface ClaudeHookProbeSideEffect {
  name: string
  path: string
  output: string
}

export interface ClaudeHookProbeResult {
  scenarioName: string
  prompt: string
  settingSources: ClaudeSettingSource[]
  pluginHook: boolean
  pluginScope?: ClaudePluginScope
  includeStandardManifestHooks: boolean
  managedHook: boolean
  userHook: boolean
  projectHook: boolean
  localHook: boolean
  managedDisableAllHooks: boolean
  managedAllowManagedHooksOnly: boolean
  userDisableAllHooks: boolean
  projectDisableAllHooks: boolean
  localDisableAllHooks: boolean
  status: ClaudeHookProbeStatus
  exitCode: number
  timedOut: boolean
  stdout: string
  stderr: string
  eventTypes: string[]
  loadedPlugins: string[]
  pluginListErrors: string[]
  duplicateHooksError: boolean
  sideEffects: ClaudeHookProbeSideEffect[]
  homeDir: string
  workDir: string
}

export interface ClaudeHookProbeSuiteResult {
  generatedAt: string
  claudeBinary: string
  timeoutMs: number
  results: ClaudeHookProbeResult[]
}

export interface RunClaudeHookProbeOptions {
  claudeBinary?: string
  timeoutMs?: number
  keepTemp?: boolean
  managedSettingsShadow?: boolean
}

const DEFAULT_PROMPT = 'Reply only with OK'
const DEFAULT_SETTING_SOURCES: ClaudeSettingSource[] = ['user', 'project', 'local']
const MANAGED_SETTINGS_SHADOW_ENV_VAR = 'PLUXX_CLAUDE_MANAGED_SETTINGS_PATH'

interface ClaudePromptRunResult {
  exitCode: number
  stdout: string
  stderr: string
  timedOut: boolean
  eventTypes: string[]
  loadedPlugins: string[]
}

interface ClaudeCommandRunResult {
  exitCode: number
  stdout: string
  stderr: string
  timedOut: boolean
}

export function getDefaultClaudeHookProbeScenarios(): ClaudeHookProbeScenario[] {
  return [
    {
      name: 'plugin-default',
      pluginHook: true,
    },
    {
      name: 'plugin-duplicate-manifest',
      pluginHook: true,
      includeStandardManifestHooks: true,
    },
    {
      name: 'user-settings-default',
      userHook: true,
    },
    {
      name: 'project-settings-default',
      projectHook: true,
    },
    {
      name: 'local-settings-default',
      localHook: true,
    },
    {
      name: 'local-settings-filtered',
      localHook: true,
      settingSources: ['user', 'project'],
    },
    {
      name: 'local-settings-disabled-by-user',
      localHook: true,
      userDisableAllHooks: true,
    },
  ]
}

export function getManagedClaudeHookProbeShadowScenarios(): ClaudeHookProbeScenario[] {
  return [
    {
      name: 'managed-settings-disable-all-beats-local',
      localHook: true,
      managedDisableAllHooks: true,
    },
    {
      name: 'managed-settings-allow-managed-only',
      managedHook: true,
      localHook: true,
      managedAllowManagedHooksOnly: true,
    },
    {
      name: 'managed-settings-allow-managed-only-plugin',
      pluginHook: true,
      pluginScope: 'managed',
      managedAllowManagedHooksOnly: true,
    },
  ]
}

export async function runClaudeHookProbeSuite(
  scenarios: ClaudeHookProbeScenario[] = getDefaultClaudeHookProbeScenarios(),
  options: RunClaudeHookProbeOptions = {},
): Promise<ClaudeHookProbeSuiteResult> {
  const claudeBinary = options.claudeBinary ?? 'claude'
  const timeoutMs = options.timeoutMs ?? 15_000
  const results: ClaudeHookProbeResult[] = []

  for (const scenario of scenarios) {
    results.push(await runClaudeHookProbeScenario(scenario, {
      claudeBinary,
      timeoutMs,
      keepTemp: options.keepTemp,
      managedSettingsShadow: options.managedSettingsShadow,
    }))
  }

  return {
    generatedAt: new Date().toISOString(),
    claudeBinary,
    timeoutMs,
    results,
  }
}

async function runClaudeHookProbeScenario(
  scenario: ClaudeHookProbeScenario,
  options: Required<Pick<RunClaudeHookProbeOptions, 'claudeBinary' | 'timeoutMs'>> & Pick<RunClaudeHookProbeOptions, 'keepTemp' | 'managedSettingsShadow'>,
): Promise<ClaudeHookProbeResult> {
  const homeDir = await mkdtemp(resolve(tmpdir(), 'pluxx-claude-probe-home-'))
  const workDir = await mkdtemp(resolve(tmpdir(), 'pluxx-claude-probe-work-'))
  const sideEffectsDir = resolve(workDir, 'side-effects')
  const prompt = scenario.prompt?.trim() || DEFAULT_PROMPT
  const settingSources = scenario.settingSources?.length
    ? [...scenario.settingSources]
    : [...DEFAULT_SETTING_SOURCES]
  const managedSettingsShadowPath = options.managedSettingsShadow
    ? resolve(workDir, '.claude-managed/managed-settings.json')
    : undefined

  try {
    if (scenarioUsesManagedSettings(scenario) && !managedSettingsShadowPath) {
      throw new Error('Managed Claude hook probe scenarios require managedSettingsShadow: true.')
    }

    await writeClaudeProbeFixture(
      workDir,
      homeDir,
      sideEffectsDir,
      scenario,
      options.claudeBinary,
      options.timeoutMs,
      managedSettingsShadowPath,
    )

    const env = buildClaudeProbeEnv(homeDir, managedSettingsShadowPath)
    const pluginListErrors = scenario.pluginHook || scenario.includeStandardManifestHooks
      ? await collectClaudePluginListErrors(options.claudeBinary, workDir, env, options.timeoutMs)
      : []

    const command = [
      options.claudeBinary,
      '--no-session-persistence',
      '--output-format',
      'stream-json',
      '--include-hook-events',
      '--verbose',
      '--dangerously-skip-permissions',
      '--setting-sources',
      settingSources.join(','),
      '-p',
      prompt,
    ]

    const execution = await executeClaudePromptCommand(command, workDir, env, options.timeoutMs)
    const sideEffects = readSideEffects(sideEffectsDir)
    const duplicateHooksError = detectDuplicateHooksError(execution.stdout, execution.stderr, pluginListErrors)

    return {
      scenarioName: scenario.name,
      prompt,
      settingSources,
      pluginHook: scenario.pluginHook === true,
      pluginScope: getScenarioPluginScope(scenario),
      includeStandardManifestHooks: scenario.includeStandardManifestHooks === true,
      managedHook: scenario.managedHook === true,
      userHook: scenario.userHook === true,
      projectHook: scenario.projectHook === true,
      localHook: scenario.localHook === true,
      managedDisableAllHooks: scenario.managedDisableAllHooks === true,
      managedAllowManagedHooksOnly: scenario.managedAllowManagedHooksOnly === true,
      userDisableAllHooks: scenario.userDisableAllHooks === true,
      projectDisableAllHooks: scenario.projectDisableAllHooks === true,
      localDisableAllHooks: scenario.localDisableAllHooks === true,
      status: classifyClaudeProbeStatus(scenario, execution, sideEffects, duplicateHooksError),
      exitCode: execution.exitCode,
      timedOut: execution.timedOut,
      stdout: execution.stdout,
      stderr: execution.stderr,
      eventTypes: execution.eventTypes,
      loadedPlugins: execution.loadedPlugins,
      pluginListErrors,
      duplicateHooksError,
      sideEffects,
      homeDir,
      workDir,
    }
  } catch (error) {
    return {
      scenarioName: scenario.name,
      prompt,
      settingSources,
      pluginHook: scenario.pluginHook === true,
      pluginScope: getScenarioPluginScope(scenario),
      includeStandardManifestHooks: scenario.includeStandardManifestHooks === true,
      managedHook: scenario.managedHook === true,
      userHook: scenario.userHook === true,
      projectHook: scenario.projectHook === true,
      localHook: scenario.localHook === true,
      managedDisableAllHooks: scenario.managedDisableAllHooks === true,
      managedAllowManagedHooksOnly: scenario.managedAllowManagedHooksOnly === true,
      userDisableAllHooks: scenario.userDisableAllHooks === true,
      projectDisableAllHooks: scenario.projectDisableAllHooks === true,
      localDisableAllHooks: scenario.localDisableAllHooks === true,
      status: 'runner-failed',
      exitCode: 1,
      timedOut: false,
      stdout: '',
      stderr: error instanceof Error ? error.message : String(error),
      eventTypes: [],
      loadedPlugins: [],
      pluginListErrors: [],
      duplicateHooksError: false,
      sideEffects: readSideEffects(sideEffectsDir),
      homeDir,
      workDir,
    }
  } finally {
    if (!options.keepTemp) {
      await rm(homeDir, { recursive: true, force: true })
      await rm(workDir, { recursive: true, force: true })
    }
  }
}

async function writeClaudeProbeFixture(
  workDir: string,
  homeDir: string,
  sideEffectsDir: string,
  scenario: ClaudeHookProbeScenario,
  claudeBinary: string,
  timeoutMs: number,
  managedSettingsShadowPath?: string,
): Promise<void> {
  mkdirSync(sideEffectsDir, { recursive: true })
  mkdirSync(resolve(workDir, 'scripts'), { recursive: true })

  if (scenario.pluginHook || scenario.includeStandardManifestHooks) {
    await installClaudeProbePlugin(workDir, homeDir, sideEffectsDir, scenario, claudeBinary, timeoutMs)
  }

  writeClaudeSettingsFile(resolve(homeDir, '.claude/settings.json'), {
    hookScriptPath: scenario.userHook ? resolve(workDir, 'scripts/user-hook.sh') : undefined,
    hookLabel: 'user',
    disableAllHooks: scenario.userDisableAllHooks,
    sideEffectsDir,
  })
  writeClaudeSettingsFile(resolve(workDir, '.claude/settings.json'), {
    hookScriptPath: scenario.projectHook ? resolve(workDir, 'scripts/project-hook.sh') : undefined,
    hookLabel: 'project',
    disableAllHooks: scenario.projectDisableAllHooks,
    sideEffectsDir,
  })
  writeClaudeSettingsFile(resolve(workDir, '.claude/settings.local.json'), {
    hookScriptPath: scenario.localHook ? resolve(workDir, 'scripts/local-hook.sh') : undefined,
    hookLabel: 'local',
    disableAllHooks: scenario.localDisableAllHooks,
    sideEffectsDir,
  })
  if (managedSettingsShadowPath) {
    writeClaudeSettingsFile(managedSettingsShadowPath, {
      hookScriptPath: scenario.managedHook ? resolve(workDir, 'scripts/managed-hook.sh') : undefined,
      hookLabel: 'managed',
      disableAllHooks: scenario.managedDisableAllHooks,
      allowManagedHooksOnly: scenario.managedAllowManagedHooksOnly,
      sideEffectsDir,
    })
  }
}

function writeClaudeSettingsFile(
  filePath: string,
  options: {
    hookScriptPath?: string
    hookLabel: string
    disableAllHooks?: boolean
    allowManagedHooksOnly?: boolean
    sideEffectsDir: string
  },
): void {
  const payload = readJsonObject(filePath) ?? {}
  let changed = false
  if (options.disableAllHooks === true) {
    payload.disableAllHooks = true
    changed = true
  }
  if (options.allowManagedHooksOnly === true) {
    payload.allowManagedHooksOnly = true
    changed = true
  }
  if (options.hookScriptPath) {
    mkdirSync(dirname(options.hookScriptPath), { recursive: true })
    writeHookScript(options.hookScriptPath, resolve(options.sideEffectsDir, `${options.hookLabel}.txt`), options.hookLabel)
    payload.hooks = buildSessionStartHookConfig(`bash ${JSON.stringify(options.hookScriptPath)}`).hooks
    changed = true
  }
  if (!changed) return

  mkdirSync(dirname(filePath), { recursive: true })
  writeFileSync(filePath, JSON.stringify(payload, null, 2))
}

function buildSessionStartHookConfig(command: string): Record<string, unknown> {
  return {
    hooks: {
      SessionStart: [
        {
          hooks: [
            {
              type: 'command',
              command,
            },
          ],
        },
      ],
    },
  }
}

function writeHookScript(filePath: string, outputPath: string, label: string): void {
  writeFileSync(
    filePath,
    [
      '#!/usr/bin/env bash',
      'set -euo pipefail',
      `printf '%s\\n' ${JSON.stringify(label)} > ${JSON.stringify(outputPath)}`,
      '',
    ].join('\n'),
    'utf-8',
  )
  chmodSync(filePath, 0o755)
}

async function executeClaudePromptCommand(
  command: string[],
  cwd: string,
  env: NodeJS.ProcessEnv,
  timeoutMs: number,
): Promise<ClaudePromptRunResult> {
  const execution = await executeClaudeCommand(command, cwd, env, timeoutMs)
  return {
    ...execution,
    eventTypes: collectClaudeEventTypes(execution.stdout),
    loadedPlugins: collectLoadedClaudePlugins(execution.stdout),
  }
}

async function executeClaudeCommand(
  command: string[],
  cwd: string,
  env: NodeJS.ProcessEnv,
  timeoutMs: number,
): Promise<ClaudeCommandRunResult> {
  return await new Promise<ClaudeCommandRunResult>((resolvePromise, reject) => {
    const child = spawn(command[0], command.slice(1), {
      cwd,
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    let stdout = ''
    let stderr = ''
    let timedOut = false
    const timeout = setTimeout(() => {
      timedOut = true
      child.kill('SIGTERM')
      setTimeout(() => child.kill('SIGKILL'), 500).unref()
    }, timeoutMs)

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString()
    })
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString()
    })
    child.on('error', (error) => {
      clearTimeout(timeout)
      reject(error)
    })
    child.on('close', (code) => {
      clearTimeout(timeout)
      resolvePromise({
        exitCode: code ?? 1,
        stdout,
        stderr,
        timedOut,
      })
    })
  })
}

function collectClaudeEventTypes(stdout: string): string[] {
  const eventTypes = new Set<string>()
  for (const line of stdout.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed.startsWith('{')) continue
    try {
      const parsed = JSON.parse(trimmed) as { type?: unknown }
      if (typeof parsed.type === 'string' && parsed.type.length > 0) {
        eventTypes.add(parsed.type)
      }
    } catch {
      continue
    }
  }
  return [...eventTypes]
}

function readSideEffects(sideEffectsDir: string): ClaudeHookProbeSideEffect[] {
  if (!existsSync(sideEffectsDir)) return []

  return readdirSync(sideEffectsDir)
    .filter((entry) => entry.endsWith('.txt'))
    .sort()
    .map((entry) => {
      const path = resolve(sideEffectsDir, entry)
      return {
        name: entry.replace(/\.txt$/i, ''),
        path,
        output: readFileSync(path, 'utf-8').trim(),
      }
    })
}

function collectLoadedClaudePlugins(stdout: string): string[] {
  const loadedPlugins = new Set<string>()
  for (const line of stdout.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed.startsWith('{')) continue
    try {
      const parsed = JSON.parse(trimmed) as {
        type?: unknown
        subtype?: unknown
        plugins?: unknown
      }
      if (parsed.type !== 'system' || parsed.subtype !== 'init' || !Array.isArray(parsed.plugins)) continue
      for (const entry of parsed.plugins) {
        const normalized = normalizeLoadedClaudePlugin(entry)
        if (normalized) loadedPlugins.add(normalized)
      }
    } catch {
      continue
    }
  }
  return [...loadedPlugins]
}

function normalizeLoadedClaudePlugin(entry: unknown): string | undefined {
  if (typeof entry === 'string' && entry.length > 0) return entry
  if (!entry || typeof entry !== 'object') return undefined

  const source = (entry as { source?: unknown }).source
  if (typeof source === 'string' && source.length > 0) return source

  const name = (entry as { name?: unknown }).name
  if (typeof name === 'string' && name.length > 0) return name

  return undefined
}

function detectDuplicateHooksError(stdout: string, stderr: string, pluginListErrors: string[]): boolean {
  return /hook-load-failed|duplicate hooks?-file load error|duplicate hooks file detected|auto-loads hooks\/hooks\.json/i.test(`${stdout}\n${stderr}\n${pluginListErrors.join('\n')}`)
}

function classifyClaudeProbeStatus(
  scenario: ClaudeHookProbeScenario,
  execution: ClaudePromptRunResult,
  sideEffects: ClaudeHookProbeSideEffect[],
  duplicateHooksError: boolean,
): ClaudeHookProbeStatus {
  if (duplicateHooksError) return 'duplicate-hook-load-error'
  if (sideEffects.length > 0) return 'hook-executed'
  if ((scenario.pluginHook || scenario.includeStandardManifestHooks) && execution.loadedPlugins.length === 0) {
    return 'plugin-not-loaded'
  }
  if (execution.timedOut) return 'runner-timed-out'
  if (execution.stdout.trim().length > 0 || execution.stderr.trim().length > 0 || execution.eventTypes.length > 0) {
    return 'no-hook-side-effect'
  }
  return 'runner-failed'
}

async function installClaudeProbePlugin(
  workDir: string,
  homeDir: string,
  sideEffectsDir: string,
  scenario: ClaudeHookProbeScenario,
  claudeBinary: string,
  timeoutMs: number,
): Promise<void> {
  const marketplaceName = `pluxx-local-${sanitizeScenarioName(scenario.name)}`
  const marketplaceRoot = resolve(homeDir, '.claude/plugins/data', marketplaceName)
  const pluginRoot = resolve(marketplaceRoot, 'plugins/probe-plugin')
  const pluginHookScript = resolve(pluginRoot, 'scripts/plugin-hook.sh')
  const manifestPath = resolve(pluginRoot, '.claude-plugin/plugin.json')
  const hookConfigPath = resolve(pluginRoot, 'hooks/hooks.json')

  mkdirSync(resolve(pluginRoot, '.claude-plugin'), { recursive: true })
  mkdirSync(resolve(pluginRoot, 'hooks'), { recursive: true })
  mkdirSync(resolve(pluginRoot, 'scripts'), { recursive: true })
  mkdirSync(resolve(marketplaceRoot, '.claude-plugin'), { recursive: true })

  writeHookScript(pluginHookScript, resolve(sideEffectsDir, 'plugin.txt'), 'plugin')
  writeFileSync(
    manifestPath,
    JSON.stringify({
      name: 'probe-plugin',
      version: '0.0.0',
      ...(scenario.includeStandardManifestHooks ? { hooks: './hooks/hooks.json' } : {}),
    }, null, 2),
  )
  writeFileSync(
    hookConfigPath,
    JSON.stringify(buildSessionStartHookConfig(`bash "\${CLAUDE_PLUGIN_ROOT}/scripts/plugin-hook.sh" "${resolve(sideEffectsDir, 'plugin.txt')}"`), null, 2),
  )
  writeFileSync(
    resolve(marketplaceRoot, '.claude-plugin/marketplace.json'),
    JSON.stringify({
      name: marketplaceName,
      owner: {
        name: 'Pluxx',
      },
      plugins: [
        {
          name: 'probe-plugin',
          source: './plugins/probe-plugin',
          description: 'Pluxx Claude hook probe plugin',
          version: '0.0.0',
          author: {
            name: 'Pluxx',
          },
          license: 'MIT',
        },
      ],
    }, null, 2),
  )

  const env = {
    ...buildClaudeProbeEnv(homeDir),
  }
  const register = await executeClaudeCommand(
    [claudeBinary, 'plugin', 'marketplace', 'add', marketplaceRoot],
    workDir,
    env,
    timeoutMs,
  )
  if (register.exitCode !== 0) {
    throw new Error(`Failed to register Claude probe marketplace: ${register.stderr || register.stdout || `exit ${register.exitCode}`}`)
  }

  const install = await executeClaudeCommand(
    [claudeBinary, 'plugin', 'install', `probe-plugin@${marketplaceName}`, '--scope', getScenarioPluginScope(scenario) ?? 'user'],
    workDir,
    env,
    timeoutMs,
  )
  if (install.exitCode !== 0) {
    throw new Error(`Failed to install Claude probe plugin: ${install.stderr || install.stdout || `exit ${install.exitCode}`}`)
  }
}

function sanitizeScenarioName(name: string): string {
  return name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'probe'
}

async function collectClaudePluginListErrors(
  claudeBinary: string,
  workDir: string,
  env: NodeJS.ProcessEnv,
  timeoutMs: number,
): Promise<string[]> {
  const execution = await executeClaudeCommand(
    [claudeBinary, 'plugin', 'list', '--json'],
    workDir,
    env,
    timeoutMs,
  )
  return parseClaudePluginListErrors(execution.stdout, execution.stderr)
}

function parseClaudePluginListErrors(stdout: string, stderr: string): string[] {
  try {
    const parsed = JSON.parse(stdout) as Array<{ errors?: unknown }>
    if (!Array.isArray(parsed)) {
      return stderr.trim() ? [stderr.trim()] : []
    }
    return parsed.flatMap((entry) => Array.isArray(entry.errors) ? entry.errors.filter((error): error is string => typeof error === 'string' && error.length > 0) : [])
  } catch {
    return stderr.trim() ? [stderr.trim()] : []
  }
}

function readJsonObject(filePath: string): Record<string, unknown> | undefined {
  if (!existsSync(filePath)) return undefined
  try {
    const parsed = JSON.parse(readFileSync(filePath, 'utf-8')) as unknown
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>
    }
  } catch {
    return undefined
  }
  return undefined
}

function scenarioUsesManagedSettings(scenario: ClaudeHookProbeScenario): boolean {
  return scenario.managedHook === true
    || scenario.managedDisableAllHooks === true
    || scenario.managedAllowManagedHooksOnly === true
}

function getScenarioPluginScope(scenario: ClaudeHookProbeScenario): ClaudePluginScope | undefined {
  if (scenario.pluginHook !== true && scenario.includeStandardManifestHooks !== true) return undefined
  return scenario.pluginScope ?? 'user'
}

function buildClaudeProbeEnv(homeDir: string, managedSettingsShadowPath?: string): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    HOME: homeDir,
  }
  if (managedSettingsShadowPath) {
    env[MANAGED_SETTINGS_SHADOW_ENV_VAR] = managedSettingsShadowPath
  } else {
    delete env[MANAGED_SETTINGS_SHADOW_ENV_VAR]
  }
  return env
}
