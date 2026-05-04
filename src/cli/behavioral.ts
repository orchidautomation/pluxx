import { existsSync, readFileSync } from 'fs'
import { mkdtemp, rm } from 'fs/promises'
import { tmpdir } from 'os'
import { resolve } from 'path'
import { spawn } from 'child_process'
import type { PluginConfig, TargetPlatform } from '../schema'

const BEHAVIORAL_CONFIG_PATH = '.pluxx/behavioral-smoke.json'
const CURSOR_RUNNER_BINARIES = ['agent', 'cursor-agent'] as const
const SUPPORTED_PLATFORMS = ['claude-code', 'cursor', 'codex', 'opencode'] as const satisfies readonly TargetPlatform[]

type BehavioralPlatform = typeof SUPPORTED_PLATFORMS[number]

interface BehavioralCaseTargetConfig {
  prompt: string
  commandId?: string
  require?: string[]
  forbid?: string[]
  expectedExitCodes?: number[]
  expectFailure?: boolean
  runnerArgs?: string[]
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

  const command = await buildBehavioralCommand(platform, prompt, rootDir, targetConfig)
  const execution = await executeBehavioralCommand(platform, command, rootDir)
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
): Promise<{
  exitCode: number
  response: string
}> {
  let codexOutputDir: string | null = null
  let codexLastMessagePath: string | null = null
  const runtimeCommand = [...command]

  if (platform === 'codex') {
    codexOutputDir = await mkdtemp(resolve(tmpdir(), 'pluxx-codex-behavioral-'))
    codexLastMessagePath = resolve(codexOutputDir, 'last-message.txt')
    runtimeCommand.splice(2, 0, '--output-last-message', codexLastMessagePath)
  }

  try {
    return await new Promise((resolvePromise, reject) => {
      const child = spawn(runtimeCommand[0], runtimeCommand.slice(1), {
        cwd,
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
        const codexMessage = codexLastMessagePath && existsSync(codexLastMessagePath)
          ? readFileSync(codexLastMessagePath, 'utf-8')
          : ''
        resolvePromise({
          exitCode: code ?? 1,
          response: codexMessage.trim() || stdout.trim() || stderr.trim(),
        })
      })
    })
  } finally {
    if (codexOutputDir) {
      await rm(codexOutputDir, { recursive: true, force: true })
    }
  }
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
