#!/usr/bin/env bun

import { loadConfig } from '../config/load'
import { build } from '../generators'
import {
  AGENT_PROMPT_KINDS,
  AGENT_RUNNERS,
  applyAgentPreparePlan,
  applyAgentPromptPlan,
  planAgentPrepare,
  planAgentPrompt,
  planAgentRun,
  runAgentPlan,
  type AgentPromptKind,
  type AgentRunner,
  type AgentRunnerModelSummary,
} from './agent'
import { doctorConsumer, doctorProject, printDoctorReport } from './doctor'
import {
  ensureHookTrust,
  getInstallFollowupNotes,
  installPlugin,
  listHookCommands,
  planInstallPlugin,
  planInstallUserConfig,
  resolveInstallUserConfig,
  uninstallPlugin,
} from './install'
import { runDev } from './dev'
import {
  analyzeMcpQuality,
  applyMcpScaffoldPlan,
  buildToolExampleRequest,
  deriveDisplayName,
  derivePluginName,
  MCP_HOOK_MODES,
  MCP_RUNTIME_AUTH_MODES,
  MCP_SKILL_GROUPINGS,
  type McpQualityReport,
  planMcpScaffold,
  type McpHookMode,
  type McpRuntimeAuthMode,
  parseMcpSourceInput,
  type McpSkillGrouping,
  writeMcpScaffold,
} from './init-from-mcp'
import { migrate } from './migrate'
import { runMcpProxy } from './mcp-proxy'
import { lintProject, printLintResult, runLint } from './lint'
import {
  discoverMcpAuthFromError,
  introspectMcpServer,
  McpIntrospectionError,
  type IntrospectedMcpServer,
} from '../mcp/introspect'
import { promptText, promptYesNo, PromptCancelledError } from './prompt'
import * as clack from '@clack/prompts'
import type { McpAuth, McpServer, TargetPlatform } from '../schema'
import { basename, resolve } from 'path'
import { mkdir, mkdtemp, rm } from 'fs/promises'
import { tmpdir } from 'os'
import { spawn } from 'child_process'
import { formatSyncSummary, planSyncFromMcp, syncFromMcp } from './sync-from-mcp'
import { formatPublishPlan, planPublish, runPublish } from './publish'
import { createCliRuntime, createSpinner, printJson, readFlag, readMultiValueOption, readOption } from './runtime'
import { printTestResult, runTestSuite, type TestRunResult } from './test'
import { printEvalReport, runEvalSuite } from './eval'
import { buildPrimitiveTranslationSummary, renderPrimitiveTranslationSummary } from './primitive-summary'

const args = process.argv.slice(2)
const command = args[0]
const runtime = createCliRuntime(args)
const DEFAULT_INIT_TARGETS = ['claude-code', 'cursor', 'codex', 'opencode'] as const satisfies readonly TargetPlatform[]
const AUTOPILOT_MODES = ['quick', 'standard', 'thorough'] as const
const ALL_TARGET_PLATFORMS = [
  'claude-code',
  'cursor',
  'codex',
  'opencode',
  'github-copilot',
  'openhands',
  'warp',
  'gemini-cli',
  'roo-code',
  'cline',
  'amp',
] as const satisfies readonly TargetPlatform[]

export interface InitFromMcpOptions {
  source?: string
  assumeDefaults: boolean
  name?: string
  author?: string
  displayName?: string
  targets?: string
  authEnv?: string
  authType?: string
  authHeader?: string
  authTemplate?: string
  runtimeAuth?: string
  oauthWrapper: boolean
  grouping?: string
  hooks?: string
  transport?: string
  jsonOutput: boolean
}

interface InitFromMcpSummary {
  pluginName: string
  displayName: string
  source: string
  toolCount: number
  targets: TargetPlatform[]
  grouping: McpSkillGrouping
  requestedHookMode: McpHookMode
  hookMode: McpHookMode
  hookEvents: string[]
  files: string[]
  createdFiles: string[]
  updatedFiles: string[]
  lint: {
    errors: number
    warnings: number
  }
  quality: McpQualityReport
  notes: string[]
  nextSteps: string[]
  dryRun?: boolean
}

interface AutopilotSummary {
  ok: boolean
  pluginName: string
  displayName: string
  source: string
  mode: AutopilotMode
  runner: AgentRunner
  model: AgentRunnerModelSummary
  targets: TargetPlatform[]
  toolCount: number
  grouping: McpSkillGrouping
  requestedHookMode: McpHookMode
  hookMode: McpHookMode
  hookEvents: string[]
  quality: McpQualityReport
  review: boolean
  verify: boolean
  steps: number
  init: {
    createdFiles: string[]
    updatedFiles: string[]
    files: string[]
  }
  agent: {
    taxonomy: {
      enabled: boolean
      reason: string
      command?: string[]
      commandDisplay?: string
      createdFiles: string[]
      updatedFiles: string[]
      runnerExitCode?: number
      durationMs?: number
    }
    instructions: {
      enabled: boolean
      reason: string
      command?: string[]
      commandDisplay?: string
      createdFiles: string[]
      updatedFiles: string[]
      runnerExitCode?: number
      durationMs?: number
    }
    review?: {
      enabled: boolean
      reason: string
      command?: string[]
      commandDisplay?: string
      createdFiles: string[]
      updatedFiles: string[]
      runnerExitCode?: number
      durationMs?: number
    }
  }
  verification?: TestRunResult
  verificationDurationMs?: number
  runnerLogsStreamed?: boolean
  failureStage?: 'auth' | 'introspection' | 'runner' | 'verification'
  failureMessage?: string
  dryRun?: boolean
}

type AutopilotMode = typeof AUTOPILOT_MODES[number]

interface AutopilotPassDecision {
  enabled: boolean
  reason: string
}

export async function main() {
  switch (command) {
    case 'build':
      await runBuild()
      break
    case 'dev':
      await runDev(args.slice(1))
      break
    case 'validate':
      await runValidate()
      break
    case 'lint':
      await runLintCommand()
      break
    case 'doctor':
      await runDoctor()
      break
    case 'agent':
      await runAgent()
      break
    case 'mcp':
      await runMcp()
      break
    case 'autopilot':
      await runAutopilot()
      break
    case 'init':
      await runInit()
      break
    case 'install':
      await runInstall()
      break
    case 'publish':
      await runPublishCommand()
      break
    case 'uninstall':
      await runUninstall()
      break
    case 'sync':
      await runSync()
      break
    case 'migrate':
      await runMigrate()
      break
    case 'test':
      await runTestCommand()
      break
    case 'eval':
      await runEvalCommand()
      break
    case undefined:
    case 'help':
    case '--help':
    case '-h':
      printHelp()
      break
    default:
      console.error(`Unknown command: ${command}`)
      printHelp()
      process.exit(1)
  }
}

function hasAgentContextHints(input: {
  docsUrl?: string
  websiteUrl?: string
  contextPaths?: string[]
}): boolean {
  return Boolean(input.docsUrl || input.websiteUrl || (input.contextPaths?.length ?? 0) > 0)
}

function planAutopilotPasses(input: {
  mode: AutopilotMode
  quality: McpQualityReport
  reviewRequested: boolean
  docsUrl?: string
  websiteUrl?: string
  contextPaths?: string[]
}): Record<AgentPromptKind, AutopilotPassDecision> {
  const qualityHasWarnings = input.quality.warnings > 0
  const qualityHasSignals = qualityHasWarnings || input.quality.infos > 0
  const hasContext = hasAgentContextHints(input)

  if (input.mode === 'quick') {
    return {
      taxonomy: qualityHasWarnings
        ? { enabled: true, reason: 'quick mode runs taxonomy only when MCP metadata warnings are present' }
        : { enabled: false, reason: 'quick mode skips taxonomy when MCP metadata already looks usable' },
      instructions: { enabled: false, reason: 'quick mode skips the separate instructions rewrite pass' },
      review: { enabled: false, reason: 'quick mode never runs review; use standard or thorough for critique passes' },
    }
  }

  if (input.mode === 'standard') {
    return {
      taxonomy: qualityHasSignals || hasContext
        ? {
            enabled: true,
            reason: qualityHasSignals
              ? 'standard mode runs taxonomy when MCP metadata signals cleanup work'
              : 'standard mode runs taxonomy when docs, website, or extra context are provided',
          }
        : { enabled: false, reason: 'standard mode skips taxonomy when the deterministic scaffold already has strong metadata' },
      instructions: qualityHasWarnings || hasContext
        ? {
            enabled: true,
            reason: qualityHasWarnings
              ? 'standard mode rewrites instructions when MCP metadata warnings are present'
              : 'standard mode rewrites instructions when richer docs or website context are provided',
          }
        : { enabled: false, reason: 'standard mode skips the separate instructions pass to keep refinement lighter' },
      review: input.reviewRequested
        ? { enabled: true, reason: 'review requested explicitly via --review' }
        : { enabled: false, reason: 'review is opt-in in standard mode' },
    }
  }

  return {
    taxonomy: { enabled: true, reason: 'thorough mode always runs taxonomy refinement' },
    instructions: { enabled: true, reason: 'thorough mode always runs instructions refinement' },
    review: input.reviewRequested
      ? { enabled: true, reason: 'review requested explicitly via --review' }
      : { enabled: true, reason: 'thorough mode includes a review pass by default' },
  }
}

function countAutopilotSteps(input: {
  taxonomy: AutopilotPassDecision
  instructions: AutopilotPassDecision
  review: AutopilotPassDecision
  verify: boolean
}): number {
  return 2
    + Number(input.taxonomy.enabled)
    + Number(input.instructions.enabled)
    + Number(input.review.enabled)
    + Number(input.verify)
}

function formatAutopilotPassLine(label: string, decision: AutopilotPassDecision): string {
  return `${label}: ${decision.enabled ? 'run' : 'skip'} (${decision.reason})`
}

function summarizeAutopilotWorkload(input: {
  taxonomy: AutopilotPassDecision
  instructions: AutopilotPassDecision
  review: AutopilotPassDecision
  verify: boolean
}): string {
  const agentPassCount = Number(input.taxonomy.enabled) + Number(input.instructions.enabled) + Number(input.review.enabled)
  if (agentPassCount === 0 && !input.verify) {
    return 'deterministic scaffold only'
  }
  if (agentPassCount === 0) {
    return 'deterministic scaffold + verification'
  }
  return `${agentPassCount} agent pass${agentPassCount === 1 ? '' : 'es'}${input.verify ? ' + verification' : ''}`
}

function formatDuration(durationMs?: number): string | undefined {
  if (durationMs === undefined) {
    return undefined
  }

  if (durationMs < 1000) {
    return `${durationMs}ms`
  }

  return `${(durationMs / 1000).toFixed(durationMs >= 10_000 ? 0 : 1)}s`
}

interface InstallActionSummary {
  enabled: boolean
  platforms: TargetPlatform[]
  notes: string[]
  installTargets: Array<{
    platform: TargetPlatform
    pluginDir: string
    built: boolean
    existing: boolean
  }>
}

async function maybeInstallBuiltOutputs(
  config: Awaited<ReturnType<typeof loadConfig>>,
  platforms: TargetPlatform[],
): Promise<InstallActionSummary | undefined> {
  if (!args.includes('--install')) {
    return undefined
  }

  const distDir = `${process.cwd()}/${config.outDir}`
  const installPlan = planInstallPlugin(distDir, config.name, platforms)

  if (!runtime.dryRun) {
    await ensureHookTrust({
      pluginName: config.name,
      hooks: config.hooks,
      trust: args.includes('--trust'),
      isTTY: runtime.isInteractive,
    })
    const resolvedUserConfig = await resolveInstallUserConfig(config, platforms, {
      isTTY: runtime.isInteractive,
    })
    await installPlugin(distDir, config.name, platforms, {
      config,
      quiet: true,
      resolvedUserConfig,
    })
  }

  return {
    enabled: true,
    platforms,
    notes: getInstallFollowupNotes(platforms),
    installTargets: installPlan.map((target) => ({
      platform: target.platform,
      pluginDir: target.description,
      built: target.built,
      existing: target.existing,
    })),
  }
}

function logAutopilotRunnerWait(step: number, totalSteps: number, label: string, runner: AgentRunner): void {
  if (runtime.jsonOutput || runtime.quiet || !runtime.isInteractive) {
    return
  }

  clack.log.step(`Autopilot ${step}/${totalSteps} · ${label} via ${runner} headless runner. This can take a few minutes.`)
}

async function runTimedSpinnerTask<T>(input: {
  spinner: ReturnType<typeof clack.spinner> | undefined
  startLabel: string
  waitLabel: string
  successLabel: (result: T) => string
  task: () => Promise<T>
}): Promise<T> {
  const startedAt = Date.now()
  let interval: ReturnType<typeof setInterval> | undefined

  input.spinner?.start(input.startLabel)
  if (input.spinner) {
    interval = setInterval(() => {
      input.spinner?.message(`${input.waitLabel} (${formatDuration(Date.now() - startedAt) ?? '0ms'} elapsed)`)
    }, 1000)
  }

  try {
    const result = await input.task()
    if (interval) {
      clearInterval(interval)
    }
    input.spinner?.stop(input.successLabel(result))
    return result
  } catch (error) {
    if (interval) {
      clearInterval(interval)
    }
    throw error
  }
}

async function runBuild() {
  const targets = parseTargetFlagValues(args)
  const config = await loadConfig()
  const platforms = targets ?? config.targets
  const cwd = process.cwd()
  const shouldInstall = args.includes('--install')

  if (runtime.dryRun) {
    const install = await maybeInstallBuiltOutputs(config, platforms)
    const summary = {
      dryRun: true,
      targets: platforms,
      outDir: config.outDir,
      outputPaths: platforms.map((platform) => `${config.outDir}/${platform}/`),
      install,
    }
    if (runtime.jsonOutput) {
      printJson(summary)
    } else if (!runtime.quiet) {
      console.log(`Dry run: would build ${platforms.join(', ')}`)
      summary.outputPaths.forEach((path) => console.log(`  ${path}`))
    }
    return
  }

  if (!runtime.jsonOutput && !runtime.quiet) {
    console.log(`Building for: ${platforms.join(', ')}`)
  }

  const lintResult = await lintProject(cwd, { targets: platforms })
  if (lintResult.errors > 0) {
    if (runtime.jsonOutput) {
      printJson({
        ok: false,
        reason: 'lint-errors',
        lint: lintResult,
      })
    } else {
      printLintResult(lintResult, cwd)
      console.error('Build aborted due to lint errors.')
    }
    process.exit(1)
  }

  if (!runtime.jsonOutput && !runtime.quiet && lintResult.warnings > 0) {
    printLintResult(lintResult, cwd)
  }

  await build(config, cwd, { targets })
  const install = await maybeInstallBuiltOutputs(config, platforms)

  if (runtime.jsonOutput) {
    printJson({
      ok: true,
      targets: platforms,
      outDir: config.outDir,
      outputPaths: platforms.map((platform) => `${config.outDir}/${platform}/`),
      lint: lintResult,
      primitiveSummary: buildPrimitiveTranslationSummary(config, platforms),
      install,
    })
    return
  }

  if (!runtime.quiet) {
    console.log(`Done! Output in ${config.outDir}/`)
    for (const platform of platforms) {
      console.log(`  ${config.outDir}/${platform}/`)
    }
    const primitiveLines = renderPrimitiveTranslationSummary(
      buildPrimitiveTranslationSummary(config, platforms),
    )
    if (primitiveLines.length > 0) {
      console.log('')
      for (const line of primitiveLines) {
        console.log(line)
      }
    }
    if (shouldInstall && install) {
      console.log('Installed for local testing:')
      for (const target of install.installTargets) {
        console.log(`  ${target.platform} -> ${target.pluginDir}`)
      }
      for (const note of install.notes) {
        console.log(note)
      }
    }
  }
}

async function runValidate() {
  try {
    const config = await loadConfig()
    console.log(`Config valid: ${config.name}@${config.version}`)
    console.log(`  Targets: ${config.targets.join(', ')}`)
    console.log(`  Skills: ${config.skills}`)
    if (config.mcp) {
      console.log(`  MCP servers: ${Object.keys(config.mcp).join(', ')}`)
    }
    if (config.hooks) {
      const events = Object.keys(config.hooks).filter(k => config.hooks![k as keyof typeof config.hooks])
      console.log(`  Hook events: ${events.join(', ')}`)
    }
  } catch (err) {
    console.error('Validation failed:')
    console.error(err instanceof Error ? err.message : err)
    process.exit(1)
  }
}

async function runLintCommand() {
  if (runtime.jsonOutput) {
    const result = await lintProject(process.cwd())
    printJson(result)
    if (result.errors > 0) {
      process.exit(1)
    }
    return
  }

  if (runtime.quiet) {
    const result = await lintProject(process.cwd())
    if (result.errors > 0 || result.warnings > 0) {
      printLintResult(result, process.cwd())
    }
    if (result.errors > 0) {
      process.exit(1)
    }
    return
  }

  const exitCode = await runLint(process.cwd())
  if (exitCode !== 0) {
    process.exit(exitCode)
  }
}

async function resolveTextOption(options: {
  label: string
  defaultValue?: string
  providedValue?: string
  assumeDefaults?: boolean
}): Promise<string> {
  if (options.providedValue !== undefined) {
    return options.providedValue
  }

  if (options.assumeDefaults) {
    return options.defaultValue ?? ''
  }

  return await promptText(options.label, options.defaultValue)
}

async function resolveChoiceOption<T extends string>(options: {
  label: string
  values: readonly T[]
  defaultValue: T
  providedValue?: string
  assumeDefaults?: boolean
}): Promise<T> {
  const raw = await resolveTextOption({
    label: `${options.label} (${options.values.join('/')})`,
    defaultValue: options.defaultValue,
    providedValue: options.providedValue,
    assumeDefaults: options.assumeDefaults,
  })
  return parseChoiceOption(raw, options.values, options.label)
}

function parseChoiceOption<T extends string>(value: string, validValues: readonly T[], label: string): T {
  const normalized = value.trim().toLowerCase()
  const match = validValues.find((entry) => entry.toLowerCase() === normalized)
  if (!match) {
    throw new Error(`${label} must be one of: ${validValues.join(', ')}`)
  }
  return match
}

function parseTargetPlatforms(raw: string): TargetPlatform[] {
  const targets = raw
    .split(',')
    .map((target) => target.trim())
    .filter(Boolean)

  if (targets.length === 0) {
    throw new Error('Provide at least one target platform.')
  }

  const invalid = targets.filter((target) => !(ALL_TARGET_PLATFORMS as readonly string[]).includes(target))
  if (invalid.length > 0) {
    throw new Error(
      `Unknown target platform(s): ${invalid.join(', ')}. Supported: ${ALL_TARGET_PLATFORMS.join(', ')}`,
    )
  }

  return targets as TargetPlatform[]
}

function parseTargetFlagValues(rawArgs: string[]): TargetPlatform[] | undefined {
  const values = readMultiValueOption(rawArgs, '--target')
  if (!values) return undefined
  return parseTargetPlatforms(values.join(','))
}

function defaultHookMode(source: { auth?: { type: string; envVar?: string }; transport?: string; env?: Record<string, string> }): McpHookMode {
  if (source.auth?.type && source.auth.type !== 'none' && source.auth.envVar) {
    return 'safe'
  }

  if (source.transport === 'stdio' && source.env && Object.keys(source.env).length > 0) {
    return 'safe'
  }

  return 'none'
}

interface McpAuthProviderHint {
  id: 'linear' | 'generic-oauth'
  label: string
  envVar: string
  tokenLabel: string
  tokenAuthType: 'bearer' | 'header'
  authHeader?: string
  authTemplate?: string
  wrapperCommand?: string
  guidance?: string
}

function getSourceUrl(source: McpServer): string | undefined {
  return source.transport === 'stdio' ? undefined : source.url
}

function collectAuthCandidateUrls(
  source: McpServer,
  discoveredAuth?: ReturnType<typeof discoverMcpAuthFromError> | null,
): string[] {
  return [
    getSourceUrl(source),
    discoveredAuth?.authorizationUrl,
    discoveredAuth?.resourceMetadataUrl,
  ].filter((value): value is string => Boolean(value))
}

function matchesHost(urlValue: string, suffix: string): boolean {
  try {
    return new URL(urlValue).hostname.endsWith(suffix)
  } catch {
    return false
  }
}

export function buildOauthWrapperCommand(source: McpServer): string | undefined {
  if (source.transport !== 'http') return undefined
  return `npx -y mcp-remote ${source.url}`
}

export function buildOauthWrapperSource(source: McpServer): McpServer | undefined {
  if (source.transport !== 'http') return undefined
  return {
    transport: 'stdio',
    command: 'npx',
    args: ['-y', 'mcp-remote', source.url],
  }
}

export function inferMcpAuthProvider(
  source: McpServer,
  discoveredAuth?: ReturnType<typeof discoverMcpAuthFromError> | null,
): McpAuthProviderHint | null {
  const candidates = collectAuthCandidateUrls(source, discoveredAuth)
  if (candidates.some((value) => matchesHost(value, 'linear.app'))) {
    return {
      id: 'linear',
      label: 'Linear',
      envVar: 'LINEAR_API_KEY',
      tokenLabel: 'API key or OAuth token',
      tokenAuthType: 'bearer',
      authTemplate: 'Bearer ${value}',
      wrapperCommand: buildOauthWrapperCommand(source),
      guidance: 'Linear supports direct Authorization: Bearer tokens/API keys and the official mcp-remote wrapper for clients that do not support remote MCP.',
    }
  }

  if (discoveredAuth?.kind === 'platform') {
    return {
      id: 'generic-oauth',
      label: 'OAuth-first MCP',
      envVar: 'OAUTH_ACCESS_TOKEN',
      tokenLabel: 'access token or API key',
      tokenAuthType: 'bearer',
      authTemplate: 'Bearer ${value}',
      wrapperCommand: buildOauthWrapperCommand(source),
    }
  }

  return null
}

function defaultAuthEnvVar(
  provider: McpAuthProviderHint | null,
  discoveredAuth?: ReturnType<typeof discoverMcpAuthFromError> | null,
): string {
  if (provider?.envVar) return provider.envVar
  if (discoveredAuth?.kind === 'header') return 'API_KEY'
  if (discoveredAuth?.kind === 'platform') return 'OAUTH_ACCESS_TOKEN'
  return ''
}

function tryOpenBrowser(url: string): boolean {
  const launcher = process.platform === 'darwin'
    ? { command: 'open', args: [url] }
    : process.platform === 'win32'
      ? { command: 'cmd', args: ['/c', 'start', '', url] }
      : { command: 'xdg-open', args: [url] }

  try {
    const child = spawn(launcher.command, launcher.args, {
      detached: true,
      stdio: 'ignore',
    })
    child.unref()
    return true
  } catch {
    return false
  }
}

export function resolveRemoteAuthType(options: Pick<InitFromMcpOptions, 'authType' | 'authHeader'>): 'bearer' | 'header' | 'platform' {
  if (options.authType) {
    return parseChoiceOption(options.authType, ['bearer', 'header', 'platform'] as const, 'Auth type')
  }

  if (options.authHeader && options.authHeader.trim() && options.authHeader.trim().toLowerCase() !== 'authorization') {
    return 'header'
  }

  return 'bearer'
}

export function buildRemoteAuthConfig(options: Pick<InitFromMcpOptions, 'authEnv' | 'authType' | 'authHeader' | 'authTemplate'>): McpAuth | undefined {
  if (options.authType?.trim() === 'platform') {
    return {
      type: 'platform',
      mode: 'oauth',
    }
  }

  const envVar = options.authEnv?.trim()
  if (!envVar) return undefined

  const authType = resolveRemoteAuthType(options)

  if (authType === 'platform') {
    return {
      type: 'platform',
      mode: 'oauth',
    }
  }

  if (authType === 'header') {
    const headerName = options.authHeader?.trim()
    if (!headerName) {
      throw new Error('Header auth requires --auth-header HEADER_NAME.')
    }

    return {
      type: 'header',
      envVar,
      headerName,
      headerTemplate: options.authTemplate?.trim() || '${value}',
    }
  }

  return {
    type: 'bearer',
    envVar,
    headerName: options.authHeader?.trim() || 'Authorization',
    headerTemplate: options.authTemplate?.trim() || 'Bearer ${value}',
  }
}

function resolveRuntimeAuthMode(value?: string): McpRuntimeAuthMode {
  return value
    ? parseChoiceOption(value, MCP_RUNTIME_AUTH_MODES, 'Runtime auth mode')
    : 'inline'
}

function applyGeneratedAuthEnv(
  source: ReturnType<typeof parseMcpSourceInput>,
  envVar?: string,
  remoteAuthOptions?: Pick<InitFromMcpOptions, 'authType' | 'authHeader' | 'authTemplate'>,
) {
  if (!envVar) return source

  if (source.transport === 'stdio') {
    return {
      ...source,
      env: {
        ...(source.env ?? {}),
        [envVar]: `\${${envVar}}`,
      },
    }
  }

  if (!source.auth) {
    const auth = buildRemoteAuthConfig({
      authEnv: envVar,
      authType: remoteAuthOptions?.authType,
      authHeader: remoteAuthOptions?.authHeader,
      authTemplate: remoteAuthOptions?.authTemplate,
    })
    return {
      ...source,
      auth,
    }
  }

  return source
}

function isAuthRequiredError(error: unknown): error is McpIntrospectionError {
  if (!(error instanceof McpIntrospectionError)) return false

  if (error.status !== undefined && [401, 402, 403].includes(error.status)) {
    return true
  }

  const message = error.message.toLowerCase()
  if (message.includes('missing environment variable')) {
    return true
  }

  const wwwAuthenticate = error.context?.responseHeaders?.['www-authenticate']?.toLowerCase() ?? ''
  return wwwAuthenticate.includes('bearer') || wwwAuthenticate.includes('oauth')
}

function isLikelyOAuthFirstError(error: McpIntrospectionError): boolean {
  return discoverMcpAuthFromError(error)?.kind === 'platform'
}

function formatAuthRequiredMessage(
  commandName: 'init' | 'autopilot',
  error?: McpIntrospectionError,
  source?: McpServer,
): string {
  const discoveredAuth = error ? discoverMcpAuthFromError(error) : null
  const provider = source ? inferMcpAuthProvider(source, discoveredAuth) : null
  const rerun = discoveredAuth?.kind === 'header' && discoveredAuth.headerName
    ? `Re-run ${commandName} with --auth-env YOUR_ENV_VAR --auth-type header --auth-header ${discoveredAuth.headerName} [--auth-template '\${value}']`
    : `Re-run ${commandName} with --auth-env YOUR_ENV_VAR and either:
- Bearer auth: --auth-type bearer
- Custom header auth: --auth-type header --auth-header HEADER_NAME [--auth-template '\${value}']`
  const providerNote = provider?.guidance ? `\n\n${provider.guidance}` : ''
  const wrapperNote = provider?.wrapperCommand
    ? `\nLocal wrapper/proxy helper: ${provider.wrapperCommand}`
    : ''
  const oauthNote = discoveredAuth?.kind === 'platform'
    ? `

This server appears OAuth-first${discoveredAuth.authorizationUrl ? ` (${discoveredAuth.authorizationUrl})` : ''}. Complete the provider's OAuth flow first, export the resulting token/API key to YOUR_ENV_VAR, then rerun.
If the server supports public discovery and only needs OAuth at runtime, you can scaffold it with --auth-type platform --runtime-auth platform.
If it requires browser-interactive OAuth during handshake, run a local stdio MCP wrapper/proxy and import that command instead.${wrapperNote}${providerNote}`
    : ''

  return `This MCP server requires authentication.
${rerun}${oauthNote}`
}

type OAuthImportStrategy = 'token' | 'wrapper'

async function chooseOAuthImportStrategy(
  provider: McpAuthProviderHint | null,
): Promise<OAuthImportStrategy> {
  const options: Array<{ value: OAuthImportStrategy; label: string; hint?: string }> = [
    {
      value: 'token',
      label: 'token',
      hint: `Complete auth in the browser, then continue with a ${provider?.tokenLabel ?? 'token or API key'}`,
    },
  ]

  if (provider?.wrapperCommand) {
    options.push({
      value: 'wrapper',
      label: 'wrapper',
      hint: `Import through ${provider.wrapperCommand}`,
    })
  }

  return await clackSelect('OAuth import path', options, provider?.wrapperCommand ? 'wrapper' : 'token')
}

async function maybeCaptureOAuthCredential(
  provider: McpAuthProviderHint | null,
  authorizationUrl?: string,
): Promise<string | undefined> {
  if (authorizationUrl) {
    const opened = tryOpenBrowser(authorizationUrl)
    const message = opened
      ? `Opened ${authorizationUrl} in your browser. Finish the auth flow, then paste the resulting ${provider?.tokenLabel ?? 'token or API key'} below if you want Pluxx to retry immediately.`
      : `Open ${authorizationUrl} in your browser. Finish the auth flow, then paste the resulting ${provider?.tokenLabel ?? 'token or API key'} below if you want Pluxx to retry immediately.`
    clack.note(message, 'OAuth flow')
  }

  const credential = (await clackPassword(`Paste ${provider?.tokenLabel ?? 'token or API key'} for this session (optional)`)).trim()
  return credential || undefined
}

function applySessionCredential(envVar: string | undefined, credential: string | undefined) {
  if (!envVar || !credential) return
  process.env[envVar] = credential
}

function buildInitSummary(input: {
  pluginName: string
  displayName: string
  source: string
  toolCount: number
  targets: TargetPlatform[]
  grouping: McpSkillGrouping
  requestedHookMode: McpHookMode
  hookMode: McpHookMode
  hookEvents: string[]
  files: string[]
  createdFiles: string[]
  updatedFiles: string[]
  lint: { errors: number; warnings: number }
  quality: McpQualityReport
  dryRun?: boolean
}): InitFromMcpSummary {
  const installTarget = input.targets[0]
  const installCommand = input.hookMode === 'safe'
    ? `Run: pluxx install --trust --target ${installTarget}`
    : `Run: pluxx install --target ${installTarget}`
  const notes: string[] = []

  if (input.requestedHookMode === 'safe' && input.hookMode === 'none') {
    notes.push('No safe hooks were generated for this MCP source. Safe hooks currently require explicit env vars in the generated MCP config.')
  } else if (input.hookMode === 'safe') {
    notes.push(`Generated install-ready hook events: ${input.hookEvents.join(', ')}`)
  }

  if (input.quality.warnings > 0 || input.quality.infos > 0) {
    notes.push(`MCP quality: ${input.quality.warnings} warning(s), ${input.quality.infos} info message(s)`)
  }

  if (input.quality.warnings > 0) {
    notes.push('Consider using pluxx autopilot with --website/--docs or adding pluxx.agent.md hints before publishing this plugin.')
  }

  const nextSteps = [
    'Review INSTRUCTIONS.md and the generated skills before publishing.',
    'Run: pluxx build',
    installCommand,
  ]

  return {
    pluginName: input.pluginName,
    displayName: input.displayName,
    source: input.source,
    toolCount: input.toolCount,
    targets: input.targets,
    grouping: input.grouping,
    requestedHookMode: input.requestedHookMode,
    hookMode: input.hookMode,
    hookEvents: input.hookEvents,
    files: input.files,
    createdFiles: input.createdFiles,
    updatedFiles: input.updatedFiles,
    lint: input.lint,
    quality: input.quality,
    notes,
    nextSteps,
    dryRun: input.dryRun,
  }
}

function formatMcpQualityLines(report: McpQualityReport): string[] {
  const lines = [`MCP quality: ${report.warnings} warning(s), ${report.infos} info message(s)`]

  for (const issue of report.issues) {
    lines.push(`- [${issue.level}] ${issue.title}: ${issue.detail}`)
  }

  return lines
}

function formatMcpDiscoverySummary(introspection: IntrospectedMcpServer): string {
  const parts = [`${introspection.tools.length} tools`]
  const resourceCount = (introspection.resources?.length ?? 0) + (introspection.resourceTemplates?.length ?? 0)
  const promptCount = introspection.prompts?.length ?? 0

  if (resourceCount > 0) {
    parts.push(`${resourceCount} resources`)
  }
  if (promptCount > 0) {
    parts.push(`${promptCount} prompts`)
  }

  return `${parts.join(', ')} discovered`
}

export function parseInitFromMcpOptions(rawArgs: string[], initialName?: string, initialSource?: string): InitFromMcpOptions {
  return {
    source: initialSource ?? readOption(rawArgs, '--from-mcp'),
    assumeDefaults: rawArgs.includes('--yes'),
    name: readOption(rawArgs, '--name') ?? initialName,
    author: readOption(rawArgs, '--author'),
    displayName: readOption(rawArgs, '--display-name'),
    targets: readOption(rawArgs, '--targets'),
    authEnv: readOption(rawArgs, '--auth-env'),
    authType: readOption(rawArgs, '--auth-type'),
    authHeader: readOption(rawArgs, '--auth-header'),
    authTemplate: readOption(rawArgs, '--auth-template'),
    runtimeAuth: readOption(rawArgs, '--runtime-auth'),
    oauthWrapper: rawArgs.includes('--oauth-wrapper'),
    grouping: readOption(rawArgs, '--grouping'),
    hooks: readOption(rawArgs, '--hooks'),
    transport: readOption(rawArgs, '--transport'),
    jsonOutput: rawArgs.includes('--json'),
  }
}

function toKebabCase(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function toTsString(value: string): string {
  return JSON.stringify(value)
}

async function runInit() {
  const positionalName = args[1] && !args[1].startsWith('-') ? args[1] : undefined
  const fromMcpFlag = args.indexOf('--from-mcp')
  const fromMcpInput = fromMcpFlag !== -1 && args[fromMcpFlag + 1] && !args[fromMcpFlag + 1].startsWith('-')
    ? args[fromMcpFlag + 1]
    : undefined

  if (fromMcpFlag !== -1) {
    await runInitFromMcp(positionalName, fromMcpInput)
    return
  }

  if (!runtime.isInteractive) {
    throw new Error('pluxx init requires an interactive terminal unless you use `pluxx init --from-mcp ... --yes`.')
  }

  const dirName = positionalName
    ? toKebabCase(positionalName)
    : basename(process.cwd()).toLowerCase().replace(/[^a-z0-9-]/g, '-')

  console.log('')
  console.log('  pluxx init — Create a new plugin')
  console.log('  ─────────────────────────────────')
  console.log('')

  try {
    // 1. Plugin identity
    const name = await promptText('Plugin name', dirName)
    const description = await promptText('Description')
    const authorName = await promptText('Author name')

    // 2. MCP server
    const hasMcp = await promptYesNo('Does your plugin connect to an MCP server?')
    let mcpUrl = ''
    let mcpEnvVar = ''
    if (hasMcp) {
      mcpUrl = await promptText('MCP server URL')
      mcpEnvVar = await promptText('Auth env var name (e.g. MY_API_KEY)')
    }

    // 3. Platforms
    const defaultTargets = 'claude-code,cursor,codex,opencode'
    const targetsRaw = await promptText('Which platforms? (comma-separated)', defaultTargets)
    const targets = targetsRaw.split(',').map(t => t.trim()).filter(Boolean)

    // 4. Brand metadata
    const hasBrand = await promptYesNo('Add brand metadata?')
    let displayName = ''
    let brandColor = ''
    if (hasBrand) {
      displayName = await promptText('Display name')
      brandColor = await promptText('Brand color (hex)', '#000000')
    }

    const pluginName = toKebabCase(name) || dirName
    const skillName = pluginName

    if (pluginName !== name) {
      console.log(`  Normalized plugin name to ${pluginName}`)
      console.log('')
    }

    // Build the config file content
    const targetsList = targets.map(toTsString).join(', ')
    let mcpBlock = ''
    if (hasMcp && mcpUrl) {
      const serverName = pluginName
      mcpBlock = `
  // MCP servers your plugin connects to
  mcp: {
    ${toTsString(serverName)}: {
      url: ${toTsString(mcpUrl)},${mcpEnvVar ? `
      auth: {
        type: 'bearer',
        envVar: ${toTsString(mcpEnvVar)},
      },` : ''}
    },
  },
`
    }

    let brandBlock = ''
    if (hasBrand && displayName) {
      brandBlock = `
  // Brand metadata
  brand: {
    displayName: ${toTsString(displayName)},${brandColor ? `
    color: ${toTsString(brandColor)},` : ''}
  },
`
    }

    const template = `import { definePlugin } from 'pluxx'

export default definePlugin({
  name: ${toTsString(pluginName)},
  version: '0.1.0',
  description: ${toTsString(description)},
  author: {
    name: ${toTsString(authorName)},
  },
  license: 'MIT',

  // Skills directory (SKILL.md files following Agent Skills standard)
  skills: './skills/',
${mcpBlock}${brandBlock}
  // Target platforms to generate
  targets: [${targetsList}],
})
`

    // Write config
    await Bun.write('pluxx.config.ts', template)

    // Create skills directory with a starter SKILL.md
    const skillDir = `skills/${skillName}`
    await mkdir(skillDir, { recursive: true })

    const skillContent = `---
name: ${JSON.stringify(skillName)}
description: ${JSON.stringify(description || `A starter skill for ${skillName}`)}
---

# ${displayName || pluginName}

${description || `TODO: Describe what ${displayName || pluginName} does.`}

## Usage

Describe how agents should use this skill.

## Examples

\`\`\`
Example prompt or command here
\`\`\`
`

    await Bun.write(`${skillDir}/SKILL.md`, skillContent)

    console.log('')
    console.log('  Created:')
    console.log('    pluxx.config.ts')
    console.log(`    ${skillDir}/SKILL.md`)
    console.log('')
    console.log('  Next steps:')
    console.log(`    1. Edit ${skillDir}/SKILL.md with your skill instructions`)
    console.log('    2. Run: pluxx build')
    console.log('    3. Run: pluxx install')
    console.log('')
  } catch (error) {
    if (error instanceof PromptCancelledError) {
      console.log('Init cancelled')
      return
    }

    throw error instanceof Error ? error : new Error(String(error))
  }
}

async function runInitFromMcp(initialName?: string, initialSource?: string) {
  const options = parseInitFromMcpOptions(args, initialName, initialSource)
  const defaultTargets = DEFAULT_INIT_TARGETS.join(',')
  const interactive = !options.jsonOutput && !options.assumeDefaults && runtime.isInteractive
  let runtimeAuthMode = resolveRuntimeAuthMode(options.runtimeAuth)

  if (!options.jsonOutput && !runtime.quiet) {
    clack.intro('pluxx init --from-mcp')
  }

  try {
    // ── Step 1/4 · Connecting to MCP server ──────────────────────────

    const rawSource = options.source ?? (interactive
      ? await clackText('MCP server URL or local command')
      : '')
    if (!rawSource) {
      throw new Error('Provide an MCP server URL or local command. Example: pluxx init --from-mcp https://example.com/mcp')
    }

    let source = parseMcpSourceInput(rawSource, options.transport)
    let introspectionSource = source
    const configuredRemoteAuth = source.transport === 'stdio'
      ? undefined
      : buildRemoteAuthConfig(options)
    if (configuredRemoteAuth && !source.auth) {
      source = {
        ...source,
        auth: configuredRemoteAuth,
      } satisfies McpServer
    }

    const s = createSpinner(runtime)
    s?.start('Step 1/4 \u00b7 Connecting to MCP server...')

    let introspection
    try {
      introspection = await introspectMcpServer(introspectionSource)
    } catch (error) {
      if (source.transport !== 'stdio' && isAuthRequiredError(error)) {
        const discoveredAuth = error instanceof McpIntrospectionError ? discoverMcpAuthFromError(error) : null
        const provider = inferMcpAuthProvider(source, discoveredAuth)
        s?.stop('Server requires authentication')
        let envVar = options.authEnv
        let authType = options.authType
        let authHeader = options.authHeader
        let authTemplate = options.authTemplate
        let usedOauthWrapper = false

        if (!usedOauthWrapper && discoveredAuth?.kind === 'platform' && (interactive || options.oauthWrapper)) {
          const strategy = options.oauthWrapper
            ? 'wrapper'
            : interactive
              ? await chooseOAuthImportStrategy(provider)
              : 'token'

          if (strategy === 'wrapper') {
            const wrapperSource = buildOauthWrapperSource(source)
            if (!wrapperSource) {
              throw new Error(formatAuthRequiredMessage('init', error, source))
            }
            introspectionSource = wrapperSource
            runtimeAuthMode = 'platform'
            s?.start('Step 1/4 · Reconnecting via local wrapper...')
            try {
              introspection = await introspectMcpServer(introspectionSource)
              usedOauthWrapper = true
            } catch (wrapperError) {
              if (isAuthRequiredError(wrapperError)) {
                throw new Error(`Wrapper-based OAuth import failed.
${formatAuthRequiredMessage('init', wrapperError, source)}`)
              }
              throw new Error(`MCP introspection failed via local wrapper: ${wrapperError instanceof Error ? wrapperError.message : String(wrapperError)}`)
            }
          }
        }

        if (!options.runtimeAuth && (discoveredAuth?.kind === 'platform' || usedOauthWrapper)) {
          runtimeAuthMode = 'platform'
        }

        if (usedOauthWrapper) {
          envVar = envVar ?? (interactive
            ? await clackText('Auth env var for generated non-platform targets (optional)', defaultAuthEnvVar(provider, discoveredAuth))
            : undefined)
          source = {
            ...source,
            auth: envVar
              ? buildRemoteAuthConfig({
                  authEnv: envVar,
                  authType: provider?.tokenAuthType ?? 'bearer',
                  authHeader: provider?.authHeader,
                  authTemplate: provider?.authTemplate,
                })
              : { type: 'platform', mode: 'oauth' },
          }
        } else {
          envVar = envVar ?? (interactive
            ? await clackText('Auth env var for this MCP server', defaultAuthEnvVar(provider, discoveredAuth))
            : '')
          if (!envVar) {
            throw new Error(formatAuthRequiredMessage('init', error, source))
          }

          if (interactive && discoveredAuth?.kind === 'platform') {
            const credential = await maybeCaptureOAuthCredential(provider, discoveredAuth.authorizationUrl)
            applySessionCredential(envVar, credential)
          }

          if (interactive && !authType) {
            authType = await clackSelect<'bearer' | 'header'>('Auth type', [
              { value: 'bearer', label: 'bearer', hint: 'Authorization: Bearer <token>' },
              { value: 'header', label: 'header', hint: 'Custom header such as X-API-Key' },
            ], discoveredAuth?.kind === 'header' ? 'header' : (provider?.tokenAuthType ?? 'bearer'))
          }

          if (resolveRemoteAuthType({ authType, authHeader }) === 'header') {
            if (interactive && !authHeader) {
              authHeader = await clackText('Auth header name', discoveredAuth?.headerName ?? provider?.authHeader ?? 'X-API-Key')
            }
            if (interactive && !authTemplate) {
              authTemplate = await clackText('Auth header template', provider?.authTemplate ?? '${value}')
            }
          }

          source = {
            ...source,
            auth: buildRemoteAuthConfig({
              authEnv: envVar,
              authType,
              authHeader,
              authTemplate,
            }),
          }
          introspectionSource = source
          s?.start('Step 1/4 · Reconnecting with auth...')
          try {
            introspection = await introspectMcpServer(introspectionSource)
          } catch (retryError) {
            if (isAuthRequiredError(retryError)) {
              throw new Error(`Authentication failed after retry.
${formatAuthRequiredMessage('init', retryError, source)}`)
            }
            throw new Error(`MCP introspection failed after auth retry: ${retryError instanceof Error ? retryError.message : String(retryError)}`)
          }
        }
      } else {
        s?.stop('Connection failed')
        throw new Error(`MCP introspection failed: ${error instanceof Error ? error.message : String(error)}`)
      }
    }

    if (!introspection) {
      throw new Error('MCP introspection did not return server metadata.')
    }

    const serverLabel = introspection.serverInfo.title ?? introspection.serverInfo.name
    s?.stop(`Connected: ${serverLabel} (${formatMcpDiscoverySummary(introspection)})`)
    const quality = analyzeMcpQuality(introspection.tools)

    if (!options.jsonOutput && !runtime.quiet && quality.issues.length > 0) {
      clack.note(formatMcpQualityLines(quality).join('\n'), 'MCP quality check')
    }

    // Only ask for stdio auth env when the source has no env vars and no auth already
    const stdioHasEnv = source.transport === 'stdio'
      && source.env
      && Object.keys(source.env).length > 0
    const stdioNeedsAuthPrompt = source.transport === 'stdio'
      && !stdioHasEnv
      && !source.auth
      && !options.authEnv

    const generatedAuthEnv = stdioNeedsAuthPrompt && interactive
      ? await clackText('Auth env var for generated plugin (optional)', '')
      : source.transport === 'stdio'
        ? (options.authEnv ?? undefined)
        : options.authEnv

    source = applyGeneratedAuthEnv(source, generatedAuthEnv)

    if (
      interactive
      && source.transport !== 'stdio'
      && source.auth
      && source.auth.type !== 'none'
      && !options.runtimeAuth
    ) {
      runtimeAuthMode = source.auth.type === 'platform' ? 'platform' : runtimeAuthMode
      runtimeAuthMode = await clackSelect<McpRuntimeAuthMode>('Claude/Cursor runtime auth', [
        { value: 'inline', label: 'inline', hint: 'Generate env/header auth directly into plugin output' },
        { value: 'platform', label: 'platform', hint: 'Use native platform-managed auth (for example OAuth/custom connector flows)' },
      ], runtimeAuthMode)
    }

    // ── Step 2/4 · Plugin identity ───────────────────────────────────

    if (!options.jsonOutput && !runtime.quiet) {
      clack.log.step('Step 2/4 \u00b7 Plugin identity')
    }

    const defaultPluginName = options.name ? toKebabCase(options.name) : derivePluginName(introspection, source)
    const pluginName = toKebabCase(
      options.name ?? (interactive
        ? await clackText('Plugin name', defaultPluginName)
        : defaultPluginName),
    )
    const defaultDisplayName = options.displayName ?? deriveDisplayName(introspection, pluginName)
    const displayName = options.displayName ?? (interactive
      ? await clackText('Display name', defaultDisplayName)
      : defaultDisplayName)
    const defaultAuthor = process.env.USER ?? ''
    const authorName = options.author ?? (interactive
      ? await clackText('Author name', defaultAuthor)
      : defaultAuthor)

    // ── Step 3/4 · Build settings ────────────────────────────────────

    if (!options.jsonOutput && !runtime.quiet) {
      clack.log.step('Step 3/4 \u00b7 Build settings')
    }

    const defaultTargetsValue = options.targets ?? defaultTargets
    const targetsRaw = options.targets ?? (interactive
      ? await clackText('Platforms (comma-separated)', defaultTargetsValue)
      : defaultTargetsValue)
    const targets = parseTargetPlatforms(targetsRaw)

    const defaultGrouping: McpSkillGrouping = 'workflow'
    const grouping: McpSkillGrouping = options.grouping
      ? parseChoiceOption(options.grouping, MCP_SKILL_GROUPINGS, 'Skill grouping')
      : interactive
        ? await clackSelect<McpSkillGrouping>('Skill grouping', [
            { value: 'workflow', label: 'workflow', hint: 'Group related tools into workflow skills' },
            { value: 'tool', label: 'tool', hint: 'One skill per tool' },
          ], defaultGrouping)
        : defaultGrouping

    const defaultHookModeValue = defaultHookMode(source)
    const hookMode: McpHookMode = options.hooks
      ? parseChoiceOption(options.hooks, MCP_HOOK_MODES, 'Install-ready hooks')
      : interactive
        ? await clackSelect<McpHookMode>('Install-ready hooks', [
            { value: 'none', label: 'none', hint: 'No install hooks' },
            { value: 'safe', label: 'safe', hint: 'Auto-generate safe install hooks' },
          ], defaultHookModeValue)
        : defaultHookModeValue

    // ── Step 4/4 · Generating scaffold ───────────────────────────────

    const g = createSpinner(runtime)
    g?.start('Step 4/4 \u00b7 Generating scaffold...')
    const plan = await planMcpScaffold({
      rootDir: process.cwd(),
      pluginName,
      authorName,
      targets,
      source,
      runtimeAuthMode,
      introspection,
      displayName,
      skillGrouping: grouping,
      hookMode,
    })
    const createdFiles = plan.files
      .filter((file) => file.action === 'create')
      .map((file) => file.relativePath)
    const updatedFiles = plan.files
      .filter((file) => file.action === 'update')
      .map((file) => file.relativePath)

    if (!runtime.dryRun) {
      await applyMcpScaffoldPlan(process.cwd(), plan)
    }

    const lintResult = runtime.dryRun
      ? { errors: 0, warnings: 0, issues: [] }
      : await lintProject(process.cwd())
    const summary = buildInitSummary({
      pluginName,
      displayName,
      source: rawSource,
      toolCount: introspection.tools.length,
      targets,
      grouping,
      requestedHookMode: hookMode,
      hookMode: plan.generatedHookMode,
      hookEvents: plan.generatedHookEvents,
      files: plan.generatedFiles,
      createdFiles,
      updatedFiles,
      lint: {
        errors: lintResult.errors,
        warnings: lintResult.warnings,
      },
      quality,
      dryRun: runtime.dryRun,
    })

    if (options.jsonOutput) {
      printJson(summary)
      return
    }

    g?.stop(`${runtime.dryRun ? 'Planned' : 'Created'} ${summary.files.length} files`)

    if (runtime.quiet) {
      return
    }

    if (summary.createdFiles.length > 0) {
      clack.log.info(`Create: ${summary.createdFiles.join(', ')}`)
    }
    if (summary.updatedFiles.length > 0) {
      clack.log.info(`Update: ${summary.updatedFiles.join(', ')}`)
    }

    if (!runtime.dryRun) {
      if (lintResult.errors > 0) {
        clack.log.error(`Lint: ${lintResult.errors} errors, ${lintResult.warnings} warnings`)
      } else if (lintResult.warnings > 0) {
        clack.log.warn(`Lint: ${lintResult.errors} errors, ${lintResult.warnings} warnings`)
      } else {
        clack.log.success('Lint: 0 errors, 0 warnings')
      }
    } else {
      clack.log.info('Dry run only: scaffold files were not written and lint was skipped.')
    }

    if (!runtime.dryRun && lintResult.issues.length > 0) {
      for (const issue of lintResult.issues) {
        const levelLabel = issue.level === 'error' ? 'ERROR' : 'WARN '
        const platformLabel = issue.platform ? `[${issue.platform}] ` : ''
        const loc = issue.file ? `${issue.file}: ` : ''
        const message = `${levelLabel} ${issue.code} ${platformLabel}${loc}${issue.message}`
        if (issue.level === 'error') {
          clack.log.error(message)
        } else {
          clack.log.warn(message)
        }
      }
    }

    if (summary.notes.length > 0) {
      for (const n of summary.notes) {
        clack.log.info(n)
      }
    }

    if (summary.quality.issues.length > 0) {
      for (const line of formatMcpQualityLines(summary.quality)) {
        clack.log.info(line)
      }
    }

    // Build a concrete test prompt from the first tool's example request
    const firstTool = introspection.tools[0]
    const testPrompt = firstTool ? buildToolExampleRequest(firstTool) : undefined
    const installTarget = targets[0]
    const installCommand = summary.hookMode === 'safe'
      ? `pluxx install --trust --target ${installTarget}`
      : `pluxx install --target ${installTarget}`

    const nextStepLines = [
      '1. Review INSTRUCTIONS.md and skills/',
      '2. pluxx build',
      `3. ${installCommand}`,
    ]
    if (testPrompt) {
      nextStepLines.push(`4. Test in ${installTarget}: "${testPrompt}"`)
    }
    nextStepLines.push('')
    nextStepLines.push(`To refresh later: pluxx sync --from-mcp`)

    clack.note(nextStepLines.join('\n'), 'Next steps')

    clack.outro(runtime.dryRun ? 'Dry run complete' : 'Scaffold complete')
  } catch (error) {
    if (error instanceof PromptCancelledError) {
      if (!options.jsonOutput && !runtime.quiet) {
        clack.cancel(error.message)
      }
      return
    }

    throw error instanceof Error ? error : new Error(String(error))
  }
}

/** Wrapper for clack.text that handles cancellation. */
async function clackText(message: string, defaultValue?: string): Promise<string> {
  const result = await clack.text({
    message,
    defaultValue,
    placeholder: defaultValue,
  })
  if (clack.isCancel(result)) {
    throw new PromptCancelledError()
  }
  return result
}

/** Wrapper for clack.password that handles cancellation. */
async function clackPassword(message: string): Promise<string> {
  const result = await clack.password({
    message,
    mask: '*',
  })
  if (clack.isCancel(result)) {
    throw new PromptCancelledError()
  }
  return result
}

/** Wrapper for clack.select that handles cancellation. */
async function clackSelect<T extends string>(
  message: string,
  options: Array<{ value: T; label: string; hint?: string }>,
  initialValue: T,
): Promise<T> {
  const result = await clack.select({
    message,
    options: options as Array<{ value: string; label: string; hint?: string }>,
    initialValue: initialValue as string,
  })
  if (clack.isCancel(result)) {
    throw new PromptCancelledError()
  }
  return result as T
}

async function runSync() {
  const fromMcpFlag = args.indexOf('--from-mcp')
  const fromMcpInput = fromMcpFlag !== -1 && args[fromMcpFlag + 1] && !args[fromMcpFlag + 1].startsWith('-')
    ? args[fromMcpFlag + 1]
    : undefined
  const source = fromMcpInput ? parseMcpSourceInput(fromMcpInput) : undefined
  const result = runtime.dryRun
    ? await planSyncFromMcp({
        rootDir: process.cwd(),
        source,
      })
    : await syncFromMcp({
        rootDir: process.cwd(),
        source,
      })

  if (runtime.jsonOutput) {
    printJson({
      ...result,
      dryRun: runtime.dryRun,
    })
    return
  }

  if (runtime.quiet) {
    return
  }

  const lines = formatSyncSummary(result, process.cwd())
  if (runtime.dryRun) {
    console.log('Dry run: planned sync changes')
  }
  lines.forEach((line) => console.log(line))
}

async function runDoctor() {
  const consumerMode = readFlag(args, '--consumer')
  const doctorPath = args.slice(1).find((value) => !value.startsWith('-'))
  const rootDir = doctorPath ? resolve(process.cwd(), doctorPath) : process.cwd()
  const report = consumerMode
    ? await doctorConsumer(rootDir)
    : await doctorProject(rootDir)

  if (runtime.jsonOutput) {
    printJson(report)
  } else if (!runtime.quiet) {
    printDoctorReport(report)
  }

  if (!report.ok) {
    process.exit(1)
  }
}

async function runAgent() {
  const subcommand = args[1]

  if (subcommand === 'prepare') {
    const plan = await planAgentPrepare(process.cwd(), {
      docsUrl: readOption(args, '--docs'),
      websiteUrl: readOption(args, '--website'),
      contextPaths: readMultiValueOption(args, '--context'),
    })

    if (!runtime.dryRun) {
      await applyAgentPreparePlan(process.cwd(), plan)
    }

    const summary = {
      pluginName: plan.pluginName,
      targetCount: plan.targetCount,
      toolCount: plan.toolCount,
      skillCount: plan.skillCount,
      editableFiles: plan.editableFiles,
      protectedFiles: plan.protectedFiles,
      generatedFiles: plan.generatedFiles,
      createdFiles: plan.createdFiles,
      updatedFiles: plan.updatedFiles,
      lint: plan.lint,
      contextInputs: plan.contextInputs,
      dryRun: runtime.dryRun,
    }

    if (runtime.jsonOutput) {
      printJson(summary)
      return
    }

    if (runtime.quiet) {
      return
    }

    console.log(`${runtime.dryRun ? 'Planned' : 'Prepared'} agent context for ${plan.pluginName}`)
    if (plan.createdFiles.length > 0) {
      console.log(`  Create: ${plan.createdFiles.join(', ')}`)
    }
    if (plan.updatedFiles.length > 0) {
      console.log(`  Update: ${plan.updatedFiles.join(', ')}`)
    }
    console.log(`  Editable files: ${plan.editableFiles.join(', ')}`)
    console.log(`  Protected files: ${plan.protectedFiles.join(', ')}`)
    console.log(`  Lint snapshot: ${plan.lint.errors} error(s), ${plan.lint.warnings} warning(s)`)
    if (plan.contextInputs.length > 0) {
      console.log(`  Context inputs: ${plan.contextInputs.join(', ')}`)
    }
    console.log('')
    console.log('Next steps:')
    console.log('  1. Review .pluxx/agent/context.md')
    console.log('  2. Hand the context pack to Claude Code or Codex')
    console.log('  3. MCP-derived scaffolds: keep edits inside Pluxx-managed sections. Manual projects: use review mode unless the source adds explicit edit boundaries.')
    return
  }

  if (subcommand === 'prompt') {
    const kind = args[2] as AgentPromptKind | undefined
    if (!kind || !AGENT_PROMPT_KINDS.includes(kind)) {
      console.error(`Usage: pluxx agent prompt <${AGENT_PROMPT_KINDS.join('|')}> [--json] [--dry-run] [--quiet]`)
      process.exit(1)
    }

    const plan = await planAgentPrompt(process.cwd(), kind)
    if (!runtime.dryRun) {
      await applyAgentPromptPlan(process.cwd(), plan)
    }

    const summary = {
      pluginName: plan.pluginName,
      kind: plan.kind,
      outputPath: plan.outputPath,
      createdFiles: plan.createdFiles,
      updatedFiles: plan.updatedFiles,
      dryRun: runtime.dryRun,
    }

    if (runtime.jsonOutput) {
      printJson(summary)
      return
    }

    if (runtime.quiet) {
      return
    }

    console.log(`${runtime.dryRun ? 'Planned' : 'Generated'} ${plan.kind} prompt for ${plan.pluginName}`)
    console.log(`  Output: ${plan.outputPath}`)
    return
  }

  if (subcommand === 'run') {
    const kind = args[2] as AgentPromptKind | undefined
    if (!kind || !AGENT_PROMPT_KINDS.includes(kind)) {
      console.error(`Usage: pluxx agent run <${AGENT_PROMPT_KINDS.join('|')}> --runner <${AGENT_RUNNERS.join('|')}> [--model NAME] [--attach URL (opencode only)] [--no-verify] [--verbose-runner] [--json] [--dry-run] [--quiet]`)
      process.exit(1)
    }

    const runnerRaw = readOption(args, '--runner')
    if (!runnerRaw || !AGENT_RUNNERS.includes(runnerRaw as AgentRunner)) {
      console.error(`Usage: pluxx agent run <${AGENT_PROMPT_KINDS.join('|')}> --runner <${AGENT_RUNNERS.join('|')}> [--model NAME] [--attach URL (opencode only)] [--no-verify] [--verbose-runner] [--json] [--dry-run] [--quiet]`)
      process.exit(1)
    }
    const verboseRunner = args.includes('--verbose-runner')

    const plan = await planAgentRun(process.cwd(), kind, {
      runner: runnerRaw as AgentRunner,
      model: readOption(args, '--model'),
      attach: readOption(args, '--attach'),
      verify: !args.includes('--no-verify'),
    }, {
      docsUrl: readOption(args, '--docs'),
      websiteUrl: readOption(args, '--website'),
      contextPaths: readMultiValueOption(args, '--context'),
    })

    const summary = {
      pluginName: plan.pluginName,
      kind: plan.kind,
      runner: plan.runner,
      model: plan.model,
      verify: plan.verify,
      command: plan.command,
      commandDisplay: plan.commandDisplay,
      promptPath: plan.promptPath,
      contextPath: plan.contextPath,
      createdFiles: plan.createdFiles,
      updatedFiles: plan.updatedFiles,
      contextInputs: plan.contextInputs,
      dryRun: runtime.dryRun,
    }

    if (runtime.dryRun) {
      if (runtime.jsonOutput) {
        printJson(summary)
      } else if (!runtime.quiet) {
        console.log(`Planned ${plan.kind} run for ${plan.pluginName}`)
        console.log(`  Runner: ${plan.runner}`)
        console.log(`  Model: ${plan.model.display}`)
        console.log(`  Command: ${plan.commandDisplay}`)
      }
      return
    }

    const result = await runAgentPlan(process.cwd(), plan, {
      streamOutput: verboseRunner && !runtime.jsonOutput && !runtime.quiet,
    })

    if (runtime.jsonOutput) {
      printJson(result)
      if (!result.ok) {
        process.exit(1)
      }
      return
    }

    if (!runtime.quiet) {
      console.log(`Completed ${result.kind} run for ${result.pluginName} via ${result.runner}`)
      console.log(`  Model: ${result.model.display}`)
      if (!verboseRunner) {
        console.log('  Runner logs: suppressed (use --verbose-runner to stream)')
      }
      if (result.verification) {
        console.log(`  Verification: ${result.verification.ok ? 'passed' : 'failed'}`)
      }
    }

    if (!result.ok) {
      process.exit(1)
    }
    return
  }

  console.error(`Usage: pluxx agent <prepare|prompt|run> [--docs URL] [--website URL] [--context <files...>] [--json] [--dry-run] [--quiet]`)
  process.exit(1)
}

async function runAutopilot() {
  const initOptions = parseInitFromMcpOptions(args)
  let runnerRaw = readOption(args, '--runner')
  let modeRaw = readOption(args, '--mode')
  let docsUrl = readOption(args, '--docs')
  let websiteUrl = readOption(args, '--website')
  const contextPaths = readMultiValueOption(args, '--context')
  const model = readOption(args, '--model')
  const attach = readOption(args, '--attach')
  const reviewRequested = args.includes('--review')
  const verify = !args.includes('--no-verify')
  const verboseRunner = args.includes('--verbose-runner')
  const interactive = !runtime.jsonOutput && runtime.isInteractive && !initOptions.assumeDefaults
  let authEnv = initOptions.authEnv
  let authType = initOptions.authType
  let authHeader = initOptions.authHeader
  let authTemplate = initOptions.authTemplate
  let runtimeAuthMode = resolveRuntimeAuthMode(initOptions.runtimeAuth)

  if (!initOptions.source && !interactive) {
    console.error(`Usage: pluxx autopilot --from-mcp <source> --runner <${AGENT_RUNNERS.join('|')}> [--mode <${AUTOPILOT_MODES.join('|')}>] [--name NAME] [--display-name NAME] [--author NAME] [--targets <platforms>] [--grouping workflow|tool] [--hooks none|safe] [--auth-env ENV] [--auth-type bearer|header|platform] [--auth-header NAME] [--auth-template TEMPLATE] [--runtime-auth inline|platform] [--oauth-wrapper] [--website URL] [--docs URL] [--context <files...>] [--review] [--no-verify] [--verbose-runner] [--json] [--dry-run] [--quiet]`)
    process.exit(1)
  }

  if ((!runnerRaw || !AGENT_RUNNERS.includes(runnerRaw as AgentRunner)) && !interactive) {
    console.error(`Usage: pluxx autopilot --from-mcp <source> --runner <${AGENT_RUNNERS.join('|')}> [--mode <${AUTOPILOT_MODES.join('|')}>] [--name NAME] [--display-name NAME] [--author NAME] [--targets <platforms>] [--grouping workflow|tool] [--hooks none|safe] [--auth-env ENV] [--auth-type bearer|header|platform] [--auth-header NAME] [--auth-template TEMPLATE] [--runtime-auth inline|platform] [--oauth-wrapper] [--website URL] [--docs URL] [--context <files...>] [--review] [--no-verify] [--verbose-runner] [--json] [--dry-run] [--quiet]`)
    process.exit(1)
  }

  if (modeRaw && !AUTOPILOT_MODES.includes(modeRaw as AutopilotMode)) {
    console.error(`Autopilot mode must be one of: ${AUTOPILOT_MODES.join(', ')}`)
    process.exit(1)
  }
  let tempDir: string | undefined

  try {
    if (!runtime.jsonOutput && !runtime.quiet && interactive) {
      clack.intro('pluxx autopilot')
    }

    const rawSource = initOptions.source ?? (interactive
      ? await clackText('MCP server URL or local command')
      : '')
    if (!rawSource) {
      throw new Error('Provide an MCP server URL or local command. Example: pluxx autopilot --from-mcp https://example.com/mcp --runner codex')
    }

    const runner = runnerRaw && AGENT_RUNNERS.includes(runnerRaw as AgentRunner)
      ? runnerRaw as AgentRunner
      : interactive
        ? await clackSelect<AgentRunner>('Agent runner', [
            { value: 'codex', label: 'codex', hint: 'Use Codex headless mode for refinement' },
            { value: 'claude', label: 'claude', hint: 'Use Claude Code headless mode for refinement' },
            { value: 'cursor', label: 'cursor', hint: 'Use Cursor CLI headless mode for refinement' },
            { value: 'opencode', label: 'opencode', hint: 'Use OpenCode run mode for refinement' },
          ], 'codex')
        : (() => { throw new Error(`Choose a runner: ${AGENT_RUNNERS.join(', ')}`) })()

    const mode = modeRaw && AUTOPILOT_MODES.includes(modeRaw as AutopilotMode)
      ? modeRaw as AutopilotMode
      : interactive
        ? await clackSelect<AutopilotMode>('Autopilot mode', [
            { value: 'quick', label: 'quick', hint: 'Fastest path; skip most agent work unless metadata is weak' },
            { value: 'standard', label: 'standard', hint: 'Balanced path; run agent passes only when they add value' },
            { value: 'thorough', label: 'thorough', hint: 'Always run taxonomy + instructions and include review' },
          ], 'standard')
        : 'standard'

    if (runner !== 'opencode' && attach) {
      throw new Error('--attach is only supported for the opencode runner.')
    }

    let source = parseMcpSourceInput(rawSource, initOptions.transport)
    let introspectionSource = source
    const configuredRemoteAuth = source.transport === 'stdio'
      ? undefined
      : buildRemoteAuthConfig({
          authEnv,
          authType,
          authHeader,
          authTemplate,
        })

    if (configuredRemoteAuth && !source.auth) {
      source = {
        ...source,
        auth: configuredRemoteAuth,
      } satisfies McpServer
    }

    const connectSpinner = createSpinner(runtime)
    connectSpinner?.start('Autopilot · Connecting to MCP server...')

    let introspection
    try {
      introspection = await introspectMcpServer(introspectionSource)
    } catch (error) {
      if (source.transport !== 'stdio' && isAuthRequiredError(error)) {
        const discoveredAuth = error instanceof McpIntrospectionError ? discoverMcpAuthFromError(error) : null
        const provider = inferMcpAuthProvider(source, discoveredAuth)
        connectSpinner?.stop('Server requires authentication')
        let usedOauthWrapper = false

        if (!usedOauthWrapper && discoveredAuth?.kind === 'platform' && (interactive || initOptions.oauthWrapper)) {
          const strategy = initOptions.oauthWrapper
            ? 'wrapper'
            : interactive
              ? await chooseOAuthImportStrategy(provider)
              : 'token'

          if (strategy === 'wrapper') {
            const wrapperSource = buildOauthWrapperSource(source)
            if (!wrapperSource) {
              throw new Error(formatAuthRequiredMessage('autopilot', error, source))
            }
            introspectionSource = wrapperSource
            runtimeAuthMode = 'platform'
            connectSpinner?.start('Autopilot · Reconnecting via local wrapper...')
            try {
              introspection = await introspectMcpServer(introspectionSource)
              usedOauthWrapper = true
            } catch (wrapperError) {
              if (isAuthRequiredError(wrapperError)) {
                throw new Error(`Wrapper-based OAuth import failed.
${formatAuthRequiredMessage('autopilot', wrapperError, source)}`)
              }
              throw new Error(`MCP introspection failed via local wrapper: ${wrapperError instanceof Error ? wrapperError.message : String(wrapperError)}`)
            }
          }
        }

        if (!initOptions.runtimeAuth && (discoveredAuth?.kind === 'platform' || usedOauthWrapper)) {
          runtimeAuthMode = 'platform'
        }

        if (usedOauthWrapper) {
          authEnv = authEnv ?? (interactive
            ? await clackText('Auth env var for generated non-platform targets (optional)', defaultAuthEnvVar(provider, discoveredAuth))
            : undefined)
          source = {
            ...source,
            auth: authEnv
              ? buildRemoteAuthConfig({
                  authEnv,
                  authType: provider?.tokenAuthType ?? 'bearer',
                  authHeader: provider?.authHeader,
                  authTemplate: provider?.authTemplate,
                })
              : { type: 'platform', mode: 'oauth' },
          }
        } else {
          authEnv = authEnv ?? (interactive
            ? await clackText('Auth env var for this MCP server', defaultAuthEnvVar(provider, discoveredAuth))
            : '')
          if (!authEnv) {
            throw new Error(formatAuthRequiredMessage('autopilot', error, source))
          }

          if (interactive && discoveredAuth?.kind === 'platform') {
            const credential = await maybeCaptureOAuthCredential(provider, discoveredAuth.authorizationUrl)
            applySessionCredential(authEnv, credential)
          }

          if (interactive && !authType) {
            authType = await clackSelect<'bearer' | 'header'>('Auth type', [
              { value: 'bearer', label: 'bearer', hint: 'Authorization: Bearer <token>' },
              { value: 'header', label: 'header', hint: 'Custom header such as X-API-Key' },
            ], discoveredAuth?.kind === 'header' ? 'header' : (provider?.tokenAuthType ?? 'bearer'))
          }

          if (resolveRemoteAuthType({ authType, authHeader }) === 'header') {
            if (interactive && !authHeader) {
              authHeader = await clackText('Auth header name', discoveredAuth?.headerName ?? provider?.authHeader ?? 'X-API-Key')
            }
            if (interactive && !authTemplate) {
              authTemplate = await clackText('Auth header template', provider?.authTemplate ?? '${value}')
            }
          }

          source = {
            ...source,
            auth: buildRemoteAuthConfig({
              authEnv,
              authType,
              authHeader,
              authTemplate,
            }),
          }
          introspectionSource = source
          connectSpinner?.start('Autopilot · Reconnecting with auth...')
          try {
            introspection = await introspectMcpServer(introspectionSource)
          } catch (retryError) {
            if (isAuthRequiredError(retryError)) {
              throw new Error(`Authentication failed after retry.
${formatAuthRequiredMessage('autopilot', retryError, source)}`)
            }
            throw new Error(`MCP introspection failed after auth retry: ${retryError instanceof Error ? retryError.message : String(retryError)}`)
          }
        }
      } else {
        connectSpinner?.stop('Connection failed')
        throw new Error(`MCP introspection failed: ${error instanceof Error ? error.message : String(error)}`)
      }
    }

    if (!introspection) {
      throw new Error('MCP introspection did not return server metadata.')
    }

    const stdioHasEnv = source.transport === 'stdio'
      && source.env
      && Object.keys(source.env).length > 0
    const generatedAuthEnv = source.transport === 'stdio' && !stdioHasEnv
      ? authEnv ?? undefined
      : authEnv

    source = applyGeneratedAuthEnv(source, generatedAuthEnv, {
      authType,
      authHeader,
      authTemplate,
    })

    if (
      interactive
      && source.transport !== 'stdio'
      && source.auth
      && source.auth.type !== 'none'
      && !initOptions.runtimeAuth
    ) {
      runtimeAuthMode = source.auth.type === 'platform' ? 'platform' : runtimeAuthMode
      runtimeAuthMode = await clackSelect<McpRuntimeAuthMode>('Claude/Cursor runtime auth', [
        { value: 'inline', label: 'inline', hint: 'Generate env/header auth directly into plugin output' },
        { value: 'platform', label: 'platform', hint: 'Use native platform-managed auth (for example OAuth/custom connector flows)' },
      ], runtimeAuthMode)
    }
    connectSpinner?.stop(`Connected: ${introspection.serverInfo.title ?? introspection.serverInfo.name} (${formatMcpDiscoverySummary(introspection)})`)
    const quality = analyzeMcpQuality(introspection.tools)

    if (!runtime.jsonOutput && !runtime.quiet && quality.issues.length > 0) {
      clack.note(formatMcpQualityLines(quality).join('\n'), 'MCP quality check')
    }

    const defaultPluginName = initOptions.name ? toKebabCase(initOptions.name) : derivePluginName(introspection, source)
    const pluginName = toKebabCase(
      initOptions.name ?? (interactive
        ? await clackText('Plugin name', defaultPluginName)
        : defaultPluginName),
    )
    const defaultDisplayName = initOptions.displayName ?? deriveDisplayName(introspection, pluginName)
    const displayName = initOptions.displayName ?? (interactive
      ? await clackText('Display name', defaultDisplayName)
      : defaultDisplayName)
    const defaultAuthorName = initOptions.author ?? process.env.USER ?? ''
    const authorName = initOptions.author ?? (interactive
      ? await clackText('Author name', defaultAuthorName)
      : defaultAuthorName)
    const targetsRaw = initOptions.targets ?? (interactive
      ? await clackText('Platforms (comma-separated)', DEFAULT_INIT_TARGETS.join(','))
      : DEFAULT_INIT_TARGETS.join(','))
    const targets = parseTargetPlatforms(targetsRaw)
    const grouping = initOptions.grouping
      ? parseChoiceOption(initOptions.grouping, MCP_SKILL_GROUPINGS, 'Skill grouping')
      : interactive
        ? await clackSelect<McpSkillGrouping>('Skill grouping', [
            { value: 'workflow', label: 'workflow', hint: 'Group related tools into workflow skills' },
            { value: 'tool', label: 'tool', hint: 'One skill per tool' },
          ], 'workflow')
        : 'workflow'
    const requestedHookMode = initOptions.hooks
      ? parseChoiceOption(initOptions.hooks, MCP_HOOK_MODES, 'Install-ready hooks')
      : interactive
        ? await clackSelect<McpHookMode>('Install-ready hooks', [
            { value: 'none', label: 'none', hint: 'No install hooks' },
            { value: 'safe', label: 'safe', hint: 'Auto-generate safe install hooks' },
          ], defaultHookMode(source))
        : defaultHookMode(source)

    if (quality.warnings > 0) {
      if (!websiteUrl) {
        websiteUrl = introspection.serverInfo.websiteUrl
      }

      if (interactive) {
        websiteUrl = await clackText('Website URL for agent context (optional)', websiteUrl ?? '')
        docsUrl = await clackText('Docs URL for agent context (optional)', docsUrl ?? '')
      }
    }

    const passDecisions = planAutopilotPasses({
      mode,
      quality,
      reviewRequested,
      docsUrl,
      websiteUrl,
      contextPaths,
    })
    const totalSteps = countAutopilotSteps({
      taxonomy: passDecisions.taxonomy,
      instructions: passDecisions.instructions,
      review: passDecisions.review,
      verify,
    })

    const workspaceRoot = runtime.dryRun
      ? await mkdtemp(`${tmpdir()}/pluxx-autopilot-`)
      : process.cwd()

    tempDir = runtime.dryRun ? workspaceRoot : undefined

    const scaffoldSpinner = createSpinner(runtime)
    scaffoldSpinner?.start(`Autopilot 2/${totalSteps} · Planning scaffold...`)
    const scaffoldPlan = await planMcpScaffold({
      rootDir: workspaceRoot,
      pluginName,
      authorName,
      targets,
      source,
      runtimeAuthMode,
      introspection,
      displayName,
      skillGrouping: grouping,
      hookMode: requestedHookMode,
    })
    const initCreatedFiles = scaffoldPlan.files.filter((file) => file.action === 'create').map((file) => file.relativePath)
    const initUpdatedFiles = scaffoldPlan.files.filter((file) => file.action === 'update').map((file) => file.relativePath)

    await applyMcpScaffoldPlan(workspaceRoot, scaffoldPlan)
    scaffoldSpinner?.stop(`${runtime.dryRun ? 'Planned' : 'Generated'} scaffold for ${pluginName}`)

    const agentContextOptions = {
      docsUrl,
      websiteUrl,
      contextPaths,
    }

    const agentSpinner = createSpinner(runtime)
    const taxonomyPlan = passDecisions.taxonomy.enabled
      ? await (async () => {
          agentSpinner?.start(`Autopilot 3/${totalSteps} · Planning taxonomy pass...`)
          const plan = await planAgentRun(workspaceRoot, 'taxonomy', {
            runner,
            model,
            attach,
            verify: false,
          }, agentContextOptions)
          agentSpinner?.stop('Planned taxonomy pass')
          return plan
        })()
      : undefined
    const instructionsPlan = passDecisions.instructions.enabled
      ? await (async () => {
          const step = 3 + Number(passDecisions.taxonomy.enabled)
          agentSpinner?.start(`Autopilot ${step}/${totalSteps} · Planning instructions pass...`)
          const plan = await planAgentRun(workspaceRoot, 'instructions', {
            runner,
            model,
            attach,
            verify: false,
          }, agentContextOptions)
          agentSpinner?.stop('Planned instructions pass')
          return plan
        })()
      : undefined
    const reviewPlan = passDecisions.review.enabled
      ? await (async () => {
          const step = 3 + Number(passDecisions.taxonomy.enabled) + Number(passDecisions.instructions.enabled)
          agentSpinner?.start(`Autopilot ${step}/${totalSteps} · Planning review pass...`)
          const plan = await planAgentRun(workspaceRoot, 'review', {
            runner,
            model,
            attach,
            verify: false,
          }, agentContextOptions)
          agentSpinner?.stop('Planned review pass')
          return plan
        })()
      : undefined

    if (runtime.dryRun) {
      const summary: AutopilotSummary = {
        ok: true,
        pluginName,
        displayName,
        source: rawSource,
        mode,
        runner,
        model: taxonomyPlan?.model ?? instructionsPlan?.model ?? reviewPlan?.model ?? {
          source: 'unknown',
          display: 'local default (CLI-managed)',
        },
        targets,
        toolCount: introspection.tools.length,
        grouping,
        requestedHookMode,
        hookMode: scaffoldPlan.generatedHookMode,
        hookEvents: scaffoldPlan.generatedHookEvents,
        quality,
        review: passDecisions.review.enabled,
        verify,
        steps: totalSteps,
        init: {
          createdFiles: initCreatedFiles,
          updatedFiles: initUpdatedFiles,
          files: scaffoldPlan.generatedFiles,
        },
        agent: {
          taxonomy: {
            enabled: passDecisions.taxonomy.enabled,
            reason: passDecisions.taxonomy.reason,
            command: taxonomyPlan?.command,
            commandDisplay: taxonomyPlan?.commandDisplay,
            createdFiles: taxonomyPlan?.createdFiles ?? [],
            updatedFiles: taxonomyPlan?.updatedFiles ?? [],
          },
          instructions: {
            enabled: passDecisions.instructions.enabled,
            reason: passDecisions.instructions.reason,
            command: instructionsPlan?.command,
            commandDisplay: instructionsPlan?.commandDisplay,
            createdFiles: instructionsPlan?.createdFiles ?? [],
            updatedFiles: instructionsPlan?.updatedFiles ?? [],
          },
          review: {
            enabled: passDecisions.review.enabled,
            reason: passDecisions.review.reason,
            command: reviewPlan?.command,
            commandDisplay: reviewPlan?.commandDisplay,
            createdFiles: reviewPlan?.createdFiles ?? [],
            updatedFiles: reviewPlan?.updatedFiles ?? [],
          },
        },
        dryRun: true,
        runnerLogsStreamed: verboseRunner,
      }

      if (runtime.jsonOutput) {
        printJson(summary)
      } else if (!runtime.quiet) {
        console.log(`Planned autopilot for ${pluginName}`)
        console.log(`  Mode: ${mode}`)
        console.log(`  Import: ${introspection.tools.length} tools -> ${targets.join(', ')}`)
        console.log(`  Runner: ${runner}`)
        console.log(`  Model: ${summary.model.display}`)
        console.log(`  Workload: ${summarizeAutopilotWorkload({
          taxonomy: passDecisions.taxonomy,
          instructions: passDecisions.instructions,
          review: passDecisions.review,
          verify,
        })}`)
        console.log(`  Quality: ${quality.warnings} warning(s), ${quality.infos} info message(s)`)
        console.log(`  Scaffold create/update: ${[...initCreatedFiles, ...initUpdatedFiles].join(', ') || 'none'}`)
        console.log(`  ${formatAutopilotPassLine('Taxonomy', passDecisions.taxonomy)}`)
        if (taxonomyPlan?.commandDisplay) {
          console.log(`    ${taxonomyPlan.commandDisplay}`)
        }
        console.log(`  ${formatAutopilotPassLine('Instructions', passDecisions.instructions)}`)
        if (instructionsPlan?.commandDisplay) {
          console.log(`    ${instructionsPlan.commandDisplay}`)
        }
        console.log(`  ${formatAutopilotPassLine('Review', passDecisions.review)}`)
        if (reviewPlan?.commandDisplay) {
          console.log(`    ${reviewPlan.commandDisplay}`)
        }
        if (verify) {
          console.log('  Verification: pluxx test')
        } else {
          console.log('  Verification: skipped (--no-verify)')
        }
      }
      return
    }

    const streamOutput = verboseRunner && !runtime.jsonOutput && !runtime.quiet
    let stepNumber = 3
    let taxonomyDurationMs: number | undefined
    let instructionsDurationMs: number | undefined
    let reviewDurationMs: number | undefined
    let verificationDurationMs: number | undefined

    const taxonomyResult = taxonomyPlan
      ? await (async () => {
          logAutopilotRunnerWait(stepNumber, totalSteps, 'Running taxonomy pass', runner)
          const step = stepNumber
          const result = await runTimedSpinnerTask({
            spinner: agentSpinner,
            startLabel: `Autopilot ${step}/${totalSteps} · Starting taxonomy pass...`,
            waitLabel: `Autopilot ${step}/${totalSteps} · Waiting for taxonomy result`,
            successLabel: (passResult) => `Taxonomy pass ${passResult.runnerExitCode === 0 ? 'complete' : 'failed'} (exit ${passResult.runnerExitCode})`,
            task: async () => {
              const startedAt = Date.now()
              const passResult = await runAgentPlan(workspaceRoot, taxonomyPlan, { streamOutput })
              taxonomyDurationMs = Date.now() - startedAt
              return passResult
            },
          })
          stepNumber += 1
          return result
        })()
      : undefined

    const instructionsResult = instructionsPlan
      ? await (async () => {
          logAutopilotRunnerWait(stepNumber, totalSteps, 'Running instructions pass', runner)
          const step = stepNumber
          const result = await runTimedSpinnerTask({
            spinner: agentSpinner,
            startLabel: `Autopilot ${step}/${totalSteps} · Starting instructions pass...`,
            waitLabel: `Autopilot ${step}/${totalSteps} · Waiting for instructions result`,
            successLabel: (passResult) => `Instructions pass ${passResult.runnerExitCode === 0 ? 'complete' : 'failed'} (exit ${passResult.runnerExitCode})`,
            task: async () => {
              const startedAt = Date.now()
              const passResult = await runAgentPlan(workspaceRoot, instructionsPlan, { streamOutput })
              instructionsDurationMs = Date.now() - startedAt
              return passResult
            },
          })
          stepNumber += 1
          return result
        })()
      : undefined

    const reviewResult = reviewPlan
      ? await (async () => {
          logAutopilotRunnerWait(stepNumber, totalSteps, 'Running review pass', runner)
          const step = stepNumber
          const result = await runTimedSpinnerTask({
            spinner: agentSpinner,
            startLabel: `Autopilot ${step}/${totalSteps} · Starting review pass...`,
            waitLabel: `Autopilot ${step}/${totalSteps} · Waiting for review result`,
            successLabel: (passResult) => `Review pass ${passResult.runnerExitCode === 0 ? 'complete' : 'failed'} (exit ${passResult.runnerExitCode})`,
            task: async () => {
              const startedAt = Date.now()
              const passResult = await runAgentPlan(workspaceRoot, reviewPlan, { streamOutput })
              reviewDurationMs = Date.now() - startedAt
              return passResult
            },
          })
          stepNumber += 1
          return result
        })()
      : undefined

    const verification = verify
      ? await (async () => {
          const step = stepNumber
          const result = await runTimedSpinnerTask({
            spinner: agentSpinner,
            startLabel: `Autopilot ${step}/${totalSteps} · Starting verification...`,
            waitLabel: `Autopilot ${step}/${totalSteps} · Verifying scaffold`,
            successLabel: (verificationResult) => `Verification ${verificationResult.ok ? 'passed' : 'failed'}`,
            task: async () => {
              const startedAt = Date.now()
              const verificationResult = await runTestSuite({ rootDir: workspaceRoot, targets })
              verificationDurationMs = Date.now() - startedAt
              return verificationResult
            },
          })
          return result
        })()
      : undefined

    const ok = (taxonomyResult?.ok ?? true)
      && (instructionsResult?.ok ?? true)
      && (reviewResult?.ok ?? true)
      && (verification?.ok ?? true)

    const failureStage: AutopilotSummary['failureStage'] = taxonomyResult && taxonomyResult.runnerExitCode !== 0
      ? 'runner'
      : instructionsResult && instructionsResult.runnerExitCode !== 0
        ? 'runner'
        : reviewResult && reviewResult.runnerExitCode !== 0
          ? 'runner'
          : verification && !verification.ok
            ? 'verification'
            : undefined
    const failureMessage = failureStage === 'runner'
      ? 'A headless runner command failed. Re-run with --verbose-runner to stream full runner output.'
      : failureStage === 'verification'
        ? 'Verification failed after scaffold/refinement. Run `pluxx test` for details.'
        : undefined

    const summary: AutopilotSummary = {
      ok,
      pluginName,
      displayName,
      source: rawSource,
      mode,
      runner,
      model: taxonomyPlan?.model ?? instructionsPlan?.model ?? reviewPlan?.model ?? {
        source: 'unknown',
        display: 'local default (CLI-managed)',
      },
      targets,
      toolCount: introspection.tools.length,
      grouping,
      requestedHookMode,
      hookMode: scaffoldPlan.generatedHookMode,
      hookEvents: scaffoldPlan.generatedHookEvents,
      quality,
      review: passDecisions.review.enabled,
      verify,
      steps: totalSteps,
      runnerLogsStreamed: verboseRunner,
      init: {
        createdFiles: initCreatedFiles,
        updatedFiles: initUpdatedFiles,
        files: scaffoldPlan.generatedFiles,
      },
      agent: {
        taxonomy: {
          enabled: passDecisions.taxonomy.enabled,
          reason: passDecisions.taxonomy.reason,
          command: taxonomyPlan?.command,
          commandDisplay: taxonomyPlan?.commandDisplay,
          createdFiles: taxonomyPlan?.createdFiles ?? [],
          updatedFiles: taxonomyPlan?.updatedFiles ?? [],
          runnerExitCode: taxonomyResult?.runnerExitCode,
          durationMs: taxonomyDurationMs,
        },
        instructions: {
          enabled: passDecisions.instructions.enabled,
          reason: passDecisions.instructions.reason,
          command: instructionsPlan?.command,
          commandDisplay: instructionsPlan?.commandDisplay,
          createdFiles: instructionsPlan?.createdFiles ?? [],
          updatedFiles: instructionsPlan?.updatedFiles ?? [],
          runnerExitCode: instructionsResult?.runnerExitCode,
          durationMs: instructionsDurationMs,
        },
        review: {
          enabled: passDecisions.review.enabled,
          reason: passDecisions.review.reason,
          command: reviewPlan?.command,
          commandDisplay: reviewPlan?.commandDisplay,
          createdFiles: reviewPlan?.createdFiles ?? [],
          updatedFiles: reviewPlan?.updatedFiles ?? [],
          runnerExitCode: reviewResult?.runnerExitCode,
          durationMs: reviewDurationMs,
        },
      },
      verification,
      verificationDurationMs,
      failureStage,
      failureMessage,
    }

    if (runtime.jsonOutput) {
      printJson(summary)
    } else if (!runtime.quiet) {
      console.log(`Autopilot ${ok ? 'completed' : 'failed'} for ${pluginName}`)
      console.log(`  Mode: ${mode}`)
      console.log(`  Import: ${introspection.tools.length} tools -> ${targets.join(', ')}`)
      console.log(`  Runner: ${runner}`)
      console.log(`  Model: ${summary.model.display}`)
      console.log(`  Workload: ${summarizeAutopilotWorkload({
        taxonomy: passDecisions.taxonomy,
        instructions: passDecisions.instructions,
        review: passDecisions.review,
        verify,
      })}`)
      console.log(`  Quality: ${quality.warnings} warning(s), ${quality.infos} info message(s)`)
      if (!verboseRunner) {
        console.log('  Runner logs: suppressed (use --verbose-runner to stream)')
      }
      console.log(`  ${formatAutopilotPassLine('Taxonomy', passDecisions.taxonomy)}`)
      if (taxonomyResult && formatDuration(taxonomyDurationMs)) {
        console.log(`    Duration: ${formatDuration(taxonomyDurationMs)}`)
      }
      console.log(`  ${formatAutopilotPassLine('Instructions', passDecisions.instructions)}`)
      if (instructionsResult && formatDuration(instructionsDurationMs)) {
        console.log(`    Duration: ${formatDuration(instructionsDurationMs)}`)
      }
      console.log(`  ${formatAutopilotPassLine('Review', passDecisions.review)}`)
      if (reviewResult && formatDuration(reviewDurationMs)) {
        console.log(`    Duration: ${formatDuration(reviewDurationMs)}`)
      }
      if (verification) {
        console.log(`  Verification: ${verification.ok ? 'passed' : 'failed'}${formatDuration(verificationDurationMs) ? ` (${formatDuration(verificationDurationMs)})` : ''}`)
      } else {
        console.log('  Verification: skipped (--no-verify)')
      }
      if (failureStage && failureMessage) {
        console.log(`  Failure stage: ${failureStage}`)
        console.log(`  Failure detail: ${failureMessage}`)
      }
      console.log('  Next steps:')
      console.log('  1. Review INSTRUCTIONS.md and skills/')
      console.log(`  2. Run: pluxx build${mode === 'quick' && !passDecisions.taxonomy.enabled && !passDecisions.instructions.enabled && !passDecisions.review.enabled ? ' (agent refinement was skipped; only do this if the deterministic scaffold already looks good)' : ''}`)
      console.log(`  3. Run: pluxx install${scaffoldPlan.generatedHookMode === 'safe' ? ' --trust' : ''} --target ${targets[0]}`)
    }

    if (!ok) {
      process.exit(1)
    }
  } finally {
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true })
    }
  }
}

async function runTestCommand() {
  const targets = parseTargetFlagValues(args)
  const result = await runTestSuite({
    rootDir: process.cwd(),
    targets,
  })
  const config = result.config.ok ? await loadConfig() : null
  const platforms = targets ?? config?.targets ?? []
  const install = result.ok && config
    ? await maybeInstallBuiltOutputs(config, platforms)
    : undefined

  if (runtime.jsonOutput) {
    printJson({
      ...result,
      install,
    })
    return
  }

  if (!runtime.quiet) {
    printTestResult(result)
    if (install) {
      console.log('Installed for local testing:')
      for (const target of install.installTargets) {
        console.log(`  ${target.platform} -> ${target.pluginDir}`)
      }
      for (const note of install.notes) {
        console.log(note)
      }
    }
  }

  if (!result.ok) {
    process.exit(1)
  }
}

async function runEvalCommand() {
  const report = await runEvalSuite({
    rootDir: process.cwd(),
  })

  if (runtime.jsonOutput) {
    printJson(report)
    return
  }

  if (!runtime.quiet) {
    printEvalReport(report)
  }

  if (!report.ok) {
    process.exit(1)
  }
}

async function runInstall() {
  const trust = args.includes('--trust')
  const targets = parseTargetFlagValues(args)

  const config = await loadConfig()
  const distDir = `${process.cwd()}/${config.outDir}`
  const platforms = targets ?? config.targets
  const plannedUserConfig = planInstallUserConfig(config, platforms)

  if (runtime.dryRun) {
    const plan = planInstallPlugin(distDir, config.name, platforms)
    const hookCommands = listHookCommands(config.hooks)
    const summary = {
      dryRun: true,
      pluginName: config.name,
      platforms,
      notes: getInstallFollowupNotes(platforms),
      trustRequired: hookCommands.length > 0,
      userConfig: plannedUserConfig.map((entry) => ({
        key: entry.field.key,
        title: entry.field.title,
        envVar: entry.envVar,
        required: entry.field.required ?? true,
        source: entry.source,
      })),
      installTargets: plan.map((target) => ({
        platform: target.platform,
        sourceDir: target.sourceDir,
        pluginDir: target.description,
        built: target.built,
        existing: target.existing,
      })),
    }
    if (runtime.jsonOutput) {
      printJson(summary)
    } else if (!runtime.quiet) {
      console.log(`Dry run: would install ${config.name} for ${platforms.join(', ')}`)
      plan.forEach((target) => {
        console.log(`  ${target.platform} -> ${target.description}${target.built ? '' : ' (not built)'}`)
      })
      if (plannedUserConfig.length > 0) {
        console.log('  userConfig:')
        plannedUserConfig.forEach((entry) => {
          const envHint = entry.envVar ? ` [env: ${entry.envVar}]` : ''
          console.log(`    - ${entry.field.key}${envHint} (${entry.source})`)
        })
      }
      if (listHookCommands(config.hooks).length > 0) {
        console.log('  trust reminder: this plugin defines local hook commands; install requires review or --trust')
      }
      for (const note of getInstallFollowupNotes(platforms)) {
        console.log(`  note: ${note}`)
      }
    }
    return
  }

  if (!runtime.jsonOutput && !runtime.quiet) {
    console.log(`Installing ${config.name} plugin...`)
  }
  await ensureHookTrust({
    pluginName: config.name,
    hooks: config.hooks,
    trust,
    isTTY: runtime.isInteractive,
  })
  const resolvedUserConfig = await resolveInstallUserConfig(config, platforms, {
    isTTY: runtime.isInteractive,
  })
  await installPlugin(distDir, config.name, platforms, {
    config,
    quiet: runtime.quiet,
    resolvedUserConfig,
  })
}

async function runPublishCommand() {
  const config = await loadConfig()
  const requestedChannels: Array<'npm' | 'github-release'> = []
  if (args.includes('--npm')) requestedChannels.push('npm')
  if (args.includes('--github-release')) requestedChannels.push('github-release')

  const plan = planPublish(config, {
    rootDir: process.cwd(),
    requestedChannels,
    version: readOption(args, '--version'),
    tag: readOption(args, '--tag'),
    dryRun: runtime.dryRun,
  })

  if (runtime.dryRun) {
    if (runtime.jsonOutput) {
      printJson(plan)
    } else if (!runtime.quiet) {
      for (const line of formatPublishPlan(plan)) {
        console.log(line)
      }
    }

    if (plan.checks.some((check) => !check.ok)) {
      process.exit(1)
    }
    return
  }

  const result = runPublish(config, {
    rootDir: process.cwd(),
    requestedChannels,
    version: readOption(args, '--version'),
    tag: readOption(args, '--tag'),
    dryRun: false,
  })

  if (runtime.jsonOutput) {
    printJson(result)
  } else if (!runtime.quiet) {
    for (const line of formatPublishPlan(result)) {
      console.log(line)
    }

    if (result.execution?.npm) {
      console.log(`npm: ${result.execution.npm.ok ? 'ok' : 'fail'}${result.execution.npm.detail ? ` — ${result.execution.npm.detail}` : ''}`)
    }
    if (result.execution?.githubRelease) {
      console.log(`github-release: ${result.execution.githubRelease.ok ? 'ok' : 'fail'}${result.execution.githubRelease.detail ? ` — ${result.execution.githubRelease.detail}` : ''}`)
    }
  }

  if (!result.ok) {
    process.exit(1)
  }
}

async function runUninstall() {
  const targets = parseTargetFlagValues(args)

  const config = await loadConfig()

  if (!runtime.jsonOutput && !runtime.quiet) {
    console.log(`Uninstalling ${config.name} plugin...`)
  }
  await uninstallPlugin(config.name, targets, { quiet: runtime.quiet })
}

async function runMigrate() {
  const inputPath = args[1]
  if (!inputPath) {
    console.error('Usage: pluxx migrate <path>')
    console.error('')
    console.error('  Import an existing single-platform plugin into a pluxx.config.ts.')
    console.error('  Pass the path to a plugin directory containing .claude-plugin/,')
    console.error('  .cursor-plugin/, .codex-plugin/, or a package.json with @opencode-ai/plugin.')
    process.exit(1)
  }
  await migrate(inputPath)
}

async function runMcp() {
  const subcommand = args[1]
  if (subcommand !== 'proxy') {
    console.error('Usage: pluxx mcp proxy --from-mcp <source> [--record <tape.json>]')
    console.error('       pluxx mcp proxy --replay <tape.json>')
    process.exit(1)
  }

  try {
    await runMcpProxy(args.slice(2))
  } catch (error) {
    if (error instanceof Error && error.message === 'Invalid MCP proxy arguments.') {
      process.exit(1)
    }
    throw error
  }
}

function printHelp() {
  console.log(`
pluxx — Cross-platform AI agent plugin SDK

Usage:
  pluxx build [--target <platforms...>] [--install]   Generate platform-specific plugin files
  pluxx dev [--target <platforms...>]     Watch for changes and auto-rebuild
  pluxx validate                          Validate your config
  pluxx lint                              Lint skills and cross-platform metadata
  pluxx doctor [path] [--consumer]       Check source-project or installed-bundle health
  pluxx agent prepare                     Generate agent context + boundary files for host agents
  pluxx agent prompt <kind>               Generate a prompt pack (taxonomy, instructions, review)
  pluxx agent run <kind> --runner <id>    Execute a prompt pack via Claude, Cursor, Codex, or OpenCode headlessly
  pluxx mcp proxy ...                     Run a local MCP proxy with optional record/replay tapes
  pluxx autopilot --from-mcp ...          Run import + agent refinement + verification in one command
  pluxx init [name] [--from-mcp <source>] Create a new pluxx.config.ts
  pluxx sync [--from-mcp <source>]        Refresh MCP-derived scaffold files
  pluxx migrate <path>                    Import an existing plugin into pluxx
  pluxx test [--target <platforms...>] [--install]    Run config, lint, eval, build, and smoke checks
  pluxx eval                              Evaluate scaffold and prompt-pack quality
  pluxx install [--target <platforms>] [--trust]  Install built plugins for local testing
  pluxx publish [--npm] [--github-release] [--dry-run] [--json] [--tag latest] [--version x.y.z]
  pluxx uninstall [--target <platforms>]  Remove symlinked plugins
  pluxx help                              Show this help

Common flags:
  --json                                  Print machine-readable output
  --quiet                                 Suppress non-error chatter
  --verbose-runner                        Stream runner stdout/stderr for agent run/autopilot
  --dry-run                               Show planned work without writing files or installing anything
  --mode quick|standard|thorough          Control how much agent refinement autopilot performs

Targets:
  claude-code, cursor, codex, opencode, github-copilot, openhands,
  warp, gemini-cli, roo-code, cline, amp

Examples:
  pluxx build                             Build for all configured targets
  pluxx build --install                   Build and install all configured targets locally
  pluxx build --target claude-code cursor  Build for specific platforms
  pluxx init my-plugin                    Scaffold a new plugin config
  pluxx init --from-mcp https://example.com/mcp  Scaffold from a remote MCP server
  pluxx init --from-mcp "npx -y @acme/mcp"       Scaffold from a local MCP command
  pluxx init --from-mcp https://example.com/mcp --yes --name acme --display-name "Acme" --author "Acme" --targets claude-code,codex --grouping workflow --hooks safe --json
  pluxx init --from-mcp https://example.com/mcp --yes --auth-env API_KEY --auth-type header --auth-header X-API-Key --auth-template "\${value}"
  pluxx init --from-mcp https://example.com/mcp --yes --auth-type platform --runtime-auth platform
  pluxx init --from-mcp https://mcp.linear.app/mcp --yes --oauth-wrapper --runtime-auth platform
  pluxx init --from-mcp https://example.com/sse --transport sse   Scaffold from an SSE-transport MCP server
  pluxx init --from-mcp https://example.com/mcp --yes --dry-run   Preview scaffold files without writing
  pluxx sync                              Refresh a scaffold using .pluxx/mcp.json metadata
  pluxx sync --from-mcp https://example.com/mcp  Refresh using an explicit MCP source override
  pluxx agent prepare --dry-run           Preview agent context files without writing
  pluxx agent prepare --website https://example.com --docs https://docs.example.com
  pluxx agent prompt taxonomy             Generate the taxonomy prompt pack
  pluxx agent run taxonomy --runner claude
  pluxx agent run taxonomy --runner cursor
  pluxx agent run taxonomy --runner codex
  pluxx agent run taxonomy --runner codex --verbose-runner
  pluxx agent run review --runner opencode --attach http://localhost:4096 --no-verify
  pluxx mcp proxy --from-mcp "bun ./server.js" --record .pluxx/tapes/dev.json
  pluxx mcp proxy --replay .pluxx/tapes/dev.json
  --attach is only supported for the opencode runner
  pluxx autopilot --from-mcp https://example.com/mcp --runner codex --mode quick --yes
  pluxx autopilot --from-mcp https://example.com/mcp --runner codex --mode standard --yes --name acme --display-name "Acme"
  pluxx autopilot --from-mcp https://example.com/mcp --runner codex --mode thorough --yes --verbose-runner
  pluxx autopilot --from-mcp https://mcp.linear.app/mcp --runner codex --yes --oauth-wrapper
  pluxx autopilot --from-mcp "npx -y @acme/mcp" --runner claude --targets claude-code,codex --website https://example.com --docs https://docs.example.com
  pluxx doctor --json                     Inspect source-project health as JSON
  pluxx doctor --consumer ./dist/cursor   Inspect a built or installed platform bundle
  pluxx eval --json                       Inspect scaffold/prompt-pack quality as JSON
  pluxx test --target claude-code codex  Verify selected target outputs
  pluxx test --install                    Verify and install all configured targets locally
  pluxx install                           Install to all configured targets
  pluxx install --target claude-code      Install to Claude Code only
  pluxx install --dry-run                 Preview local install paths and trust implications
  pluxx install --trust                   Install without hook trust confirmation
`)
}

if (import.meta.main) {
  main().catch(err => {
    console.error(err)
    process.exit(1)
  })
}
