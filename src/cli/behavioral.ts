import { existsSync, readFileSync } from 'fs'
import { spawn } from 'child_process'
import { resolve } from 'path'
import type { PluginConfig, TargetPlatform } from '../schema'
import { executeCodexExecCommand } from '../codex-exec-runner'

const BEHAVIORAL_CONFIG_PATH = '.pluxx/behavioral-smoke.json'
const CURSOR_RUNNER_BINARIES = ['agent', 'cursor-agent'] as const
const SUPPORTED_PLATFORMS = ['claude-code', 'cursor', 'codex', 'opencode'] as const satisfies readonly TargetPlatform[]
const DEFAULT_BEHAVIORAL_TIMEOUT_MS = 60_000

type BehavioralPlatform = typeof SUPPORTED_PLATFORMS[number]

interface BehavioralCaseTargetConfig {
  prompt: string
  commandId?: string
  require?: string[]
  forbid?: string[]
  expectedExitCodes?: number[]
  expectFailure?: boolean
  runnerArgs?: string[]
  timeoutMs?: number
}

interface BehavioralCaseConfig {
  name: string
  commandId?: string
  targets: Partial<Record<BehavioralPlatform, BehavioralCaseTargetConfig>>
}

interface BehavioralConfigFile {
  cases: BehavioralCaseConfig[]
}

export interface BehavioralSuiteOptions {
  promptOverride?: string
}

export interface BehavioralCheckResult {
  caseName: string
  platform: BehavioralPlatform
  prompt: string
  commandId?: string
  command: string[]
  ok: boolean
  exitCode: number
  responseBytes: number
  responsePreview: string
  require?: string[]
  forbid?: string[]
  expectedExitCodes: number[]
  timeoutMs: number
  failures: string[]
}

export interface BehavioralSuiteResult {
  ok: boolean
  source: string
  checks: BehavioralCheckResult[]
}

export async function runBehavioralSuite(
  rootDir: string,
  config: PluginConfig,
  targets: TargetPlatform[],
  options: BehavioralSuiteOptions = {},
): Promise<BehavioralSuiteResult> {
  const selectedPlatforms = targets.filter((target): target is BehavioralPlatform =>
    (SUPPORTED_PLATFORMS as readonly string[]).includes(target),
  )

  const cases = loadBehavioralCases(rootDir, selectedPlatforms, options.promptOverride)
  const checks: BehavioralCheckResult[] = []

  for (const behavioralCase of cases) {
    for (const platform of selectedPlatforms) {
      const targetConfig = behavioralCase.targets[platform]
      if (!targetConfig) continue
      checks.push(await runBehavioralCheck(
        rootDir,
        config,
        behavioralCase.name,
        behavioralCase.commandId,
        platform,
        targetConfig,
      ))
    }
  }

  return {
    ok: checks.every((check) => check.ok),
    source: options.promptOverride ? '--behavioral-prompt' : BEHAVIORAL_CONFIG_PATH,
    checks,
  }
}

function loadBehavioralCases(
  rootDir: string,
  targets: BehavioralPlatform[],
  promptOverride?: string,
): BehavioralCaseConfig[] {
  if (promptOverride) {
    return [{
      name: 'inline-prompt',
      targets: Object.fromEntries(
        targets.map((target) => [target, { prompt: promptOverride }]),
      ) as Partial<Record<BehavioralPlatform, BehavioralCaseTargetConfig>>,
    }]
  }

  const filePath = resolve(rootDir, BEHAVIORAL_CONFIG_PATH)
  if (!existsSync(filePath)) {
    throw new Error(
      `No behavioral smoke config found at ${BEHAVIORAL_CONFIG_PATH}. Add that file or pass --behavioral-prompt to define a real example query.`,
    )
  }

  const parsed = JSON.parse(readFileSync(filePath, 'utf-8')) as BehavioralConfigFile
  if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.cases) || parsed.cases.length === 0) {
    throw new Error(`${BEHAVIORAL_CONFIG_PATH} must contain a non-empty "cases" array.`)
  }

  return parsed.cases
}

async function runBehavioralCheck(
  rootDir: string,
  config: PluginConfig,
  caseName: string,
  caseCommandId: string | undefined,
  platform: BehavioralPlatform,
  targetConfig: BehavioralCaseTargetConfig,
): Promise<BehavioralCheckResult> {
  const prompt = targetConfig.prompt.trim()
  if (!prompt) {
    throw new Error(`Behavioral smoke case "${caseName}" for ${platform} is missing a prompt.`)
  }
  const commandId = targetConfig.commandId ?? caseCommandId
  if (commandId) {
    if (!behavioralPromptReferencesCommand(prompt, commandId)) {
      throw new Error(
        `Behavioral smoke case "${caseName}" for ${platform} declares commandId "${commandId}" but the prompt does not reference that command explicitly.`,
      )
    }
    if (!targetConfig.require?.length) {
      throw new Error(
        `Behavioral smoke case "${caseName}" for ${platform} declares commandId "${commandId}" but does not define any required output markers.`,
      )
    }
  }

  const expectedExitCodes = targetConfig.expectedExitCodes?.length
    ? [...new Set(targetConfig.expectedExitCodes)]
    : targetConfig.expectFailure
      ? [1]
      : [0]
  const timeoutMs = Number.isFinite(targetConfig.timeoutMs) && (targetConfig.timeoutMs ?? 0) > 0
    ? Math.trunc(targetConfig.timeoutMs!)
    : DEFAULT_BEHAVIORAL_TIMEOUT_MS

  let command: string[] = []
  let execution: {
    exitCode: number
    response: string
  }

  try {
    command = await buildBehavioralCommand(platform, prompt, rootDir, targetConfig)
    execution = await executeBehavioralCommand(platform, command, rootDir, timeoutMs)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return {
      caseName,
      platform,
      prompt,
      commandId,
      command,
      ok: false,
      exitCode: 1,
      responseBytes: message.length,
      responsePreview: truncate(message, 220),
      require: targetConfig.require,
      forbid: targetConfig.forbid,
      expectedExitCodes,
      timeoutMs,
      failures: [message],
    }
  }

  const responseText = execution.response.trim()
  const failures: string[] = []

  if (!expectedExitCodes.includes(execution.exitCode)) {
    failures.push(`runner exited with code ${execution.exitCode}; expected one of ${expectedExitCodes.join(', ')}`)
  }

  if (!responseText) {
    failures.push('runner returned no response text')
  }

  for (const required of targetConfig.require ?? []) {
    if (!includesNeedle(responseText, required)) {
      failures.push(`missing required text: ${required}`)
    }
  }

  for (const forbidden of targetConfig.forbid ?? []) {
    if (includesNeedle(responseText, forbidden)) {
      failures.push(`matched forbidden text: ${forbidden}`)
    }
  }

  return {
    caseName,
    platform,
    prompt,
    commandId,
    command,
    ok: failures.length === 0,
    exitCode: execution.exitCode,
    responseBytes: responseText.length,
    responsePreview: truncate(responseText, 220),
    require: targetConfig.require,
    forbid: targetConfig.forbid,
    expectedExitCodes,
    timeoutMs,
    failures,
  }
}

async function buildBehavioralCommand(
  platform: BehavioralPlatform,
  prompt: string,
  workspace: string,
  targetConfig: BehavioralCaseTargetConfig,
): Promise<string[]> {
  const runnerArgs = targetConfig.runnerArgs ?? []

  if (platform === 'claude-code') {
    return [
      'claude',
      '--no-session-persistence',
      '--output-format',
      'text',
      '--permission-mode',
      'acceptEdits',
      ...runnerArgs,
      '-p',
      prompt,
    ]
  }

  if (platform === 'cursor') {
    const binary = await resolveCursorBinary()
    if (!binary) {
      throw new Error('Cursor CLI `agent` or `cursor-agent` is not available on PATH.')
    }
    await ensureCursorAuthenticated(binary)
    return [
      binary,
      '-p',
      '--trust',
      '--workspace',
      workspace,
      '--force',
      ...runnerArgs,
      prompt,
    ]
  }

  if (platform === 'codex') {
    return [
      'codex',
      'exec',
      '--ephemeral',
      '--skip-git-repo-check',
      '--full-auto',
      ...runnerArgs,
      prompt,
    ]
  }

  return ['opencode', 'run', ...runnerArgs, prompt]
}

async function executeBehavioralCommand(
  platform: BehavioralPlatform,
  command: string[],
  cwd: string,
  timeoutMs: number,
): Promise<{
  exitCode: number
  response: string
}> {
  if (platform === 'codex') {
    const result = await executeCodexExecCommand(command, {
      cwd,
      timeoutMs,
      env: process.env,
      outputDirPrefix: 'pluxx-codex-behavioral-',
    })
    return {
      exitCode: result.exitCode,
      response: result.response,
    }
  }

  return await new Promise((resolvePromise, reject) => {
    const child = spawn(command[0], command.slice(1), {
      cwd,
      detached: process.platform !== 'win32',
      stdio: ['ignore', 'pipe', 'pipe'],
      env: process.env,
    })

    const stdoutChunks: Buffer[] = []
    const stderrChunks: Buffer[] = []

    child.stdout?.on('data', (chunk) => stdoutChunks.push(Buffer.from(chunk)))
    child.stderr?.on('data', (chunk) => stderrChunks.push(Buffer.from(chunk)))
    child.on('error', reject)
    child.on('close', (code) => {
      const stdout = Buffer.concat(stdoutChunks).toString('utf-8')
      const stderr = Buffer.concat(stderrChunks).toString('utf-8')
      resolvePromise({
        exitCode: code ?? 1,
        response: stdout.trim() || stderr.trim(),
      })
    })
  })
}

async function resolveCursorBinary(): Promise<string | undefined> {
  for (const candidate of CURSOR_RUNNER_BINARIES) {
    if (await commandExists(candidate)) {
      return candidate
    }
  }

  return undefined
}

async function ensureCursorAuthenticated(binary: string): Promise<void> {
  if (process.env.CURSOR_API_KEY && process.env.CURSOR_API_KEY.trim()) {
    return
  }

  const ok = await commandSucceeds([binary, 'status'])
  if (!ok) {
    throw new Error('Cursor CLI authentication is required. Run `agent login` (or `cursor-agent login`) or export `CURSOR_API_KEY` before behavioral smoke runs.')
  }
}

async function commandExists(binary: string): Promise<boolean> {
  return await new Promise<boolean>((resolvePromise) => {
    const child = spawn('sh', ['-c', `command -v ${shellQuote(binary)} >/dev/null 2>&1`], {
      stdio: 'ignore',
      env: process.env,
    })
    child.on('close', (code) => resolvePromise(code === 0))
    child.on('error', () => resolvePromise(false))
  })
}

async function commandSucceeds(command: string[]): Promise<boolean> {
  return await new Promise<boolean>((resolvePromise) => {
    const child = spawn(command[0], command.slice(1), {
      stdio: 'ignore',
      env: process.env,
    })
    child.on('close', (code) => resolvePromise(code === 0))
    child.on('error', () => resolvePromise(false))
  })
}

function truncate(value: string, length: number): string {
  if (value.length <= length) return value
  return `${value.slice(0, Math.max(0, length - 3))}...`
}

function includesNeedle(haystack: string, needle: string): boolean {
  return haystack.toLowerCase().includes(needle.trim().toLowerCase())
}

function behavioralPromptReferencesCommand(prompt: string, commandId: string): boolean {
  const normalizedPrompt = prompt.toLowerCase()
  const normalizedCommandId = commandId.trim().toLowerCase()
  if (!normalizedCommandId) return false

  return normalizedPrompt.includes(`/${normalizedCommandId}`)
    || normalizedPrompt.includes(`:${normalizedCommandId}`)
    || normalizedPrompt.includes(`command ${normalizedCommandId}`)
    || normalizedPrompt.includes(`command \`${normalizedCommandId}\``)
    || normalizedPrompt.includes(normalizedCommandId)
}

function shellQuote(value: string): string {
  if (/^[A-Za-z0-9_./:-]+$/.test(value)) return value
  return `'${value.replace(/'/g, `'\\''`)}'`
}
