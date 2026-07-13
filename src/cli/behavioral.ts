import { existsSync, readFileSync, realpathSync, statSync } from 'fs'
import { spawn } from 'child_process'
import { createHash } from 'crypto'
import { isAbsolute, relative, resolve } from 'path'
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
  skillId?: string
  agentId?: string
  require?: string[]
  forbid?: string[]
  expectedExitCodes?: number[]
  expectFailure?: boolean
  runnerArgs?: string[]
  timeoutMs?: number
  artifacts?: BehavioralArtifactAssertion[]
}

interface BehavioralCaseConfig {
  name: string
  commandId?: string
  skillId?: string
  agentId?: string
  targets: Partial<Record<BehavioralPlatform, BehavioralCaseTargetConfig>>
}

interface BehavioralArtifactAssertion {
  path: string
  exists?: boolean
  state?: 'preexisting' | 'created' | 'changed'
  require?: string[]
  forbid?: string[]
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
  skillId?: string
  agentId?: string
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
  receipt: BehavioralReceipt
}

export interface BehavioralArtifactResult {
  path: string
  expectedToExist: boolean
  state: 'preexisting' | 'created' | 'changed'
  exists: boolean
  kind?: 'file' | 'directory'
  bytes?: number
  require?: string[]
  forbid?: string[]
  ok: boolean
  failures: string[]
}

interface BehavioralArtifactSnapshot {
  exists: boolean
  fingerprint?: string
  error?: string
}

export interface BehavioralReceipt {
  target: BehavioralPlatform
  commandId?: string
  skillId?: string
  agentId?: string
  assertions: {
    requiredText: string[]
    forbiddenText: string[]
    expectedExitCodes: number[]
  }
  artifacts: BehavioralArtifactResult[]
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
        behavioralCase.skillId,
        behavioralCase.agentId,
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
  caseSkillId: string | undefined,
  caseAgentId: string | undefined,
  platform: BehavioralPlatform,
  targetConfig: BehavioralCaseTargetConfig,
): Promise<BehavioralCheckResult> {
  const prompt = targetConfig.prompt.trim()
  if (!prompt) {
    throw new Error(`Behavioral smoke case "${caseName}" for ${platform} is missing a prompt.`)
  }
  const commandId = targetConfig.commandId ?? caseCommandId
  const skillId = targetConfig.skillId ?? caseSkillId
  const agentId = targetConfig.agentId ?? caseAgentId
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
  const receiptBase = {
    target: platform,
    commandId,
    skillId,
    agentId,
    assertions: {
      requiredText: targetConfig.require ?? [],
      forbiddenText: targetConfig.forbid ?? [],
      expectedExitCodes,
    },
  }
  const artifactAssertions = targetConfig.artifacts ?? []
  const artifactSnapshots = snapshotArtifactAssertions(rootDir, artifactAssertions)

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
    const artifacts = evaluateArtifactAssertions(rootDir, artifactAssertions, artifactSnapshots)
    const artifactFailures = artifacts.flatMap(artifact => artifact.failures.map(failure => `${artifact.path}: ${failure}`))
    return {
      caseName,
      platform,
      prompt,
      commandId,
      skillId,
      agentId,
      command,
      ok: false,
      exitCode: 1,
      responseBytes: message.length,
      responsePreview: truncate(message, 220),
      require: targetConfig.require,
      forbid: targetConfig.forbid,
      expectedExitCodes,
      timeoutMs,
      failures: [message, ...artifactFailures],
      receipt: {
        ...receiptBase,
        artifacts,
      },
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
  const artifacts = evaluateArtifactAssertions(rootDir, artifactAssertions, artifactSnapshots)
  failures.push(...artifacts.flatMap(artifact => artifact.failures.map(failure => `${artifact.path}: ${failure}`)))

  return {
    caseName,
    platform,
    prompt,
    commandId,
    skillId,
    agentId,
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
    receipt: {
      ...receiptBase,
      artifacts,
    },
  }
}

function evaluateArtifactAssertions(
  rootDir: string,
  assertions: BehavioralArtifactAssertion[],
  snapshots: BehavioralArtifactSnapshot[],
): BehavioralArtifactResult[] {
  return assertions.map((assertion, index) => {
    const expectedToExist = assertion.exists !== false
    const state = assertion.state ?? 'preexisting'
    const snapshot = snapshots[index] ?? { exists: false, error: 'artifact preflight snapshot is missing' }
    const failures: string[] = []
    if (snapshot.error) failures.push(snapshot.error)
    try {
    if (!assertion.path.trim() || isAbsolute(assertion.path)) {
      failures.push('artifact path must be a non-empty project-relative path')
      return {
        path: assertion.path,
        expectedToExist,
        state,
        exists: false,
        require: assertion.require,
        forbid: assertion.forbid,
        ok: false,
        failures,
      }
    }

    const artifactPath = resolve(rootDir, assertion.path)
    const relativePath = relative(rootDir, artifactPath)
    if (relativePath === '..' || relativePath.startsWith(`..${process.platform === 'win32' ? '\\' : '/'}`) || isAbsolute(relativePath)) {
      failures.push('artifact path escapes the project root')
      return {
        path: assertion.path,
        expectedToExist,
        state,
        exists: false,
        require: assertion.require,
        forbid: assertion.forbid,
        ok: false,
        failures,
      }
    }

    const present = existsSync(artifactPath)
    if (present !== expectedToExist) {
      failures.push(expectedToExist ? 'expected artifact to exist' : 'expected artifact to be absent')
    }

    let kind: BehavioralArtifactResult['kind']
    let bytes: number | undefined
    if (present) {
      const realRoot = realpathSync(rootDir)
      const realArtifactPath = realpathSync(artifactPath)
      const realRelativePath = relative(realRoot, realArtifactPath)
      if (realRelativePath === '..' || realRelativePath.startsWith(`..${process.platform === 'win32' ? '\\' : '/'}`) || isAbsolute(realRelativePath)) {
        failures.push('artifact path resolves outside the project root')
        return {
          path: assertion.path,
          expectedToExist,
          state,
          exists: true,
          require: assertion.require,
          forbid: assertion.forbid,
          ok: false,
          failures,
        }
      }
      const stat = statSync(artifactPath)
      kind = stat.isDirectory() ? 'directory' : 'file'
      bytes = stat.size
      const currentFingerprint = fingerprintArtifact(artifactPath)
      if (state === 'created' && snapshot.exists) {
        failures.push('expected artifact to be created by the runner, but it existed before execution')
      }
      if (state === 'changed' && snapshot.exists && snapshot.fingerprint === currentFingerprint) {
        failures.push('expected artifact to change during runner execution')
      }
      if ((assertion.require?.length || assertion.forbid?.length) && !stat.isFile()) {
        failures.push('text assertions require a file artifact')
      } else if (stat.isFile()) {
        const content = readFileSync(artifactPath, 'utf-8')
        for (const required of assertion.require ?? []) {
          if (!includesNeedle(content, required)) failures.push(`missing required text: ${required}`)
        }
        for (const forbidden of assertion.forbid ?? []) {
          if (includesNeedle(content, forbidden)) failures.push(`matched forbidden text: ${forbidden}`)
        }
      }
    }

    return {
      path: assertion.path,
      expectedToExist,
      state,
      exists: present,
      kind,
      bytes,
      require: assertion.require,
      forbid: assertion.forbid,
      ok: failures.length === 0,
      failures,
    }
    } catch (error) {
      failures.push(`artifact evaluation failed: ${error instanceof Error ? error.message : String(error)}`)
      return {
        path: assertion.path,
        expectedToExist,
        state,
        exists: false,
        require: assertion.require,
        forbid: assertion.forbid,
        ok: false,
        failures,
      }
    }
  })
}

function snapshotArtifactAssertions(
  rootDir: string,
  assertions: BehavioralArtifactAssertion[],
): BehavioralArtifactSnapshot[] {
  return assertions.map((assertion) => {
    try {
      if (!assertion.path.trim() || isAbsolute(assertion.path)) return { exists: false }
      const artifactPath = resolve(rootDir, assertion.path)
      if (!existsSync(artifactPath)) return { exists: false }
      const realRoot = realpathSync(rootDir)
      const realArtifactPath = realpathSync(artifactPath)
      const realRelativePath = relative(realRoot, realArtifactPath)
      if (realRelativePath === '..' || realRelativePath.startsWith(`..${process.platform === 'win32' ? '\\' : '/'}`) || isAbsolute(realRelativePath)) {
        return { exists: true, error: 'artifact path resolves outside the project root' }
      }
      return { exists: true, fingerprint: fingerprintArtifact(artifactPath) }
    } catch (error) {
      return { exists: false, error: `artifact preflight failed: ${error instanceof Error ? error.message : String(error)}` }
    }
  })
}

function fingerprintArtifact(path: string): string {
  const stat = statSync(path)
  if (stat.isFile()) {
    return `file:${createHash('sha256').update(readFileSync(path)).digest('hex')}`
  }
  return `directory:${stat.size}:${stat.mtimeMs}`
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
    const startedAt = Date.now()
    const child = spawn(command[0], command.slice(1), {
      cwd,
      detached: process.platform !== 'win32',
      stdio: ['ignore', 'pipe', 'pipe'],
      env: process.env,
    })

    const stdoutChunks: Buffer[] = []
    const stderrChunks: Buffer[] = []
    let settled = false
    let timedOut = false
    const timeout = setTimeout(() => {
      timedOut = true
      signalBehavioralProcess(child, 'SIGKILL')
    }, timeoutMs)

    child.stdout?.on('data', (chunk) => stdoutChunks.push(Buffer.from(chunk)))
    child.stderr?.on('data', (chunk) => stderrChunks.push(Buffer.from(chunk)))
    child.on('error', (error) => {
      if (settled) return
      settled = true
      clearTimeout(timeout)
      reject(error)
    })
    child.on('close', (code) => {
      if (settled) return
      settled = true
      clearTimeout(timeout)
      const exceededDeadline = timedOut || Date.now() - startedAt > timeoutMs
      const stdout = Buffer.concat(stdoutChunks).toString('utf-8')
      const stderr = Buffer.concat(stderrChunks).toString('utf-8')
      resolvePromise({
        exitCode: exceededDeadline ? 124 : (code ?? 1),
        response: exceededDeadline
          ? `behavioral runner timed out after ${timeoutMs}ms`
          : stdout.trim() || stderr.trim(),
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

function signalBehavioralProcess(
  child: ReturnType<typeof spawn>,
  signal: NodeJS.Signals,
): void {
  if (child.exitCode != null || child.signalCode != null) {
    return
  }

  if (process.platform !== 'win32' && typeof child.pid === 'number') {
    try {
      process.kill(-child.pid, signal)
      return
    } catch {
      // Fall back to signaling the direct child if the process group is gone.
    }
  }

  try {
    child.kill(signal)
  } catch {
    // Ignore signaling failures after the child exits.
  }
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
