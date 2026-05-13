import { spawn } from 'child_process'
import { chmodSync, copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'fs'
import { realpathSync } from 'fs'
import { mkdtemp, rm } from 'fs/promises'
import { resolve } from 'path'
import type { CodexHookFeatureMode } from './codex-hook-probe'
import { sanitizeTerminalTranscript, signalSpawnedProcess } from './codex-interactive-probe-shared'
import { buildCodexProbeEnv, resolveCodexAuthSourceHome } from './codex-probe-shared'

export type CodexInteractiveHookEventName = 'SessionStart' | 'UserPromptSubmit'
export type CodexInteractiveHookProbeExecutionMode = 'single' | 'reviewed-session-start'
export type CodexInteractiveHookProbeAttemptPhase = 'single' | 'pre-review' | 'post-review'

export interface CodexInteractiveHookProbeScenario {
  name: string
  featureMode: CodexHookFeatureMode
  eventName: CodexInteractiveHookEventName
  trustProject: boolean
  prompt?: string
  extraCliArgs?: string[]
  executionMode?: CodexInteractiveHookProbeExecutionMode
}

export type CodexInteractiveHookProbeStatus =
  | 'interactive-hook-executed'
  | 'review-gate-observed'
  | 'no-signal-observed'
  | 'runner-failed'
  | 'runner-timed-out'

export interface CodexInteractiveHookProbeAttemptResult {
  phase: CodexInteractiveHookProbeAttemptPhase
  prompt: string
  transcriptPath: string
  status: CodexInteractiveHookProbeStatus
  exitCode: number
  stdout: string
  stderr: string
  transcript: string
  sanitizedTranscript: string
  normalizedTranscript: string
  timedOut: boolean
  killedAfterSignal: boolean
  forcedKillAfterSignal: boolean
  hookRan: boolean
  hookOutput: string
  sawReviewGate: boolean
  reviewGateMessage: string
  sawUnknownFeatureKeyWarning: boolean
  sawCodexHooksDeprecationWarning: boolean
  codexHooksDeprecationMessage: string
  tuiLogPreview: string
}

export interface CodexInteractiveHookProbeResult {
  scenarioName: string
  featureMode: CodexHookFeatureMode
  eventName: CodexInteractiveHookEventName
  trustProject: boolean
  executionMode: CodexInteractiveHookProbeExecutionMode
  prompt: string
  status: CodexInteractiveHookProbeStatus
  workDir: string
  realWorkDir: string
  codexHome: string
  configPath: string
  hooksPath: string
  hookScriptPath: string
  transcriptPath: string
  tuiLogPath: string
  exitCode: number
  stdout: string
  stderr: string
  transcript: string
  sanitizedTranscript: string
  normalizedTranscript: string
  timedOut: boolean
  killedAfterSignal: boolean
  forcedKillAfterSignal: boolean
  hookRan: boolean
  hookOutput: string
  sawReviewGate: boolean
  reviewGateMessage: string
  sawUnknownFeatureKeyWarning: boolean
  sawCodexHooksDeprecationWarning: boolean
  codexHooksDeprecationMessage: string
  tuiLogPreview: string
  attempts: CodexInteractiveHookProbeAttemptResult[]
}

export interface CodexInteractiveHookProbeSuiteResult {
  generatedAt: string
  codexBinary: string
  scriptBinary: string
  authSourceHome: string
  timeoutMs: number
  results: CodexInteractiveHookProbeResult[]
}

export interface RunCodexInteractiveHookProbeOptions {
  codexBinary?: string
  scriptBinary?: string
  authSourceHome?: string
  timeoutMs?: number
  keepTemp?: boolean
}

interface InteractiveExecutionResult {
  exitCode: number
  stdout: string
  stderr: string
  timedOut: boolean
  killedAfterSignal: boolean
  forcedKillAfterSignal: boolean
}

interface InteractiveTranscriptAnalysis {
  sanitizedTranscript: string
  normalizedTranscript: string
  sawReviewGate: boolean
  reviewGateMessage: string
}

interface InteractiveHookAttemptPlan {
  phase: CodexInteractiveHookProbeAttemptPhase
  prompt: string
  transcriptPath: string
}

const DEFAULT_TIMEOUT_MS = 45_000
const SIGNAL_GRACE_MS = 1_000
const SIGNAL_FORCE_KILL_MS = 2_500
const DEFAULT_PROMPT = 'Reply only with OK'

export function getDefaultCodexInteractiveHookProbeScenarios(): CodexInteractiveHookProbeScenario[] {
  return [
    {
      name: 'user-prompt-submit-codex-hooks-trusted',
      featureMode: 'codex_hooks',
      eventName: 'UserPromptSubmit',
      trustProject: true,
    },
    {
      name: 'user-prompt-submit-hooks-trusted',
      featureMode: 'hooks',
      eventName: 'UserPromptSubmit',
      trustProject: true,
    },
    {
      name: 'session-start-codex-hooks-trusted-unreviewed',
      featureMode: 'codex_hooks',
      eventName: 'SessionStart',
      trustProject: true,
    },
    {
      name: 'session-start-hooks-trusted-unreviewed',
      featureMode: 'hooks',
      eventName: 'SessionStart',
      trustProject: true,
    },
  ]
}

export async function runCodexInteractiveHookProbeSuite(
  scenarios: CodexInteractiveHookProbeScenario[] = getDefaultCodexInteractiveHookProbeScenarios(),
  options: RunCodexInteractiveHookProbeOptions = {},
): Promise<CodexInteractiveHookProbeSuiteResult> {
  const codexBinary = options.codexBinary ?? 'codex'
  const scriptBinary = options.scriptBinary ?? 'script'
  const authSourceHome = resolveCodexAuthSourceHome(options.authSourceHome)
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS
  const results: CodexInteractiveHookProbeResult[] = []

  for (const scenario of scenarios) {
    results.push(await runCodexInteractiveHookProbeScenario(scenario, {
      codexBinary,
      scriptBinary,
      authSourceHome,
      timeoutMs,
      keepTemp: options.keepTemp,
    }))
  }

  return {
    generatedAt: new Date().toISOString(),
    codexBinary,
    scriptBinary,
    authSourceHome,
    timeoutMs,
    results,
  }
}

async function runCodexInteractiveHookProbeScenario(
  scenario: CodexInteractiveHookProbeScenario,
  options: Required<Pick<RunCodexInteractiveHookProbeOptions, 'codexBinary' | 'scriptBinary' | 'authSourceHome' | 'timeoutMs'>> & Pick<RunCodexInteractiveHookProbeOptions, 'keepTemp'>,
): Promise<CodexInteractiveHookProbeResult> {
  const codexHome = await mkdtemp('/tmp/pluxx-codex-hook-interactive-home-')
  const workDir = await mkdtemp('/tmp/pluxx-codex-hook-interactive-work-')
  const realWorkDir = realpathSync(workDir)
  const configPath = resolve(codexHome, 'config.toml')
  const hooksPath = resolve(workDir, '.codex/hooks.json')
  const hookScriptPath = resolve(workDir, 'scripts/hook.sh')
  const tuiLogPath = resolve(codexHome, 'log/codex-tui.log')
  const hookOutputPath = resolve(workDir, 'hook-ran.txt')

  try {
    mkdirSync(resolve(workDir, '.codex'), { recursive: true })
    mkdirSync(resolve(workDir, 'scripts'), { recursive: true })

    const authPath = resolve(options.authSourceHome, 'auth.json')
    if (!existsSync(authPath)) {
      throw new Error(`Codex auth source is missing ${authPath}.`)
    }
    copyFileSync(authPath, resolve(codexHome, 'auth.json'))

    writeFileSync(configPath, buildCodexInteractiveHookConfig(realWorkDir, scenario.featureMode, scenario.trustProject))
    writeFileSync(hooksPath, JSON.stringify({
      version: 1,
      hooks: {
        [scenario.eventName]: [
          {
            hooks: [
              {
                type: 'command',
                command: `bash ./scripts/hook.sh ${scenario.eventName}`,
              },
            ],
          },
        ],
      },
    }, null, 2))
    writeFileSync(hookScriptPath, [
      '#!/usr/bin/env bash',
      'set -euo pipefail',
      'event_name="${1:-unknown}"',
      'printf "%s\\n" "$event_name" > ./hook-ran.txt',
      '',
    ].join('\n'))
    chmodHookScript(hookScriptPath)

    const prompt = scenario.prompt?.trim() || DEFAULT_PROMPT
    const executionMode = scenario.executionMode ?? 'single'
    const attemptPlans = buildInteractiveHookAttemptPlans(scenario, prompt, workDir)
    const attempts: CodexInteractiveHookProbeAttemptResult[] = []

    for (const attemptPlan of attemptPlans) {
      removeIfExists(hookOutputPath)
      removeIfExists(tuiLogPath)

      const execution = await executeCodexInteractiveHookCommand({
        scriptBinary: options.scriptBinary,
        codexBinary: options.codexBinary,
        prompt: attemptPlan.prompt,
        extraCliArgs: scenario.extraCliArgs,
        cwd: workDir,
        env: {
          ...buildCodexProbeEnv(codexHome),
          TERM: 'xterm-256color',
        },
        transcriptPath: attemptPlan.transcriptPath,
        hookOutputPath,
        timeoutMs: options.timeoutMs,
      })

      const transcript = readIfExists(attemptPlan.transcriptPath)
      const analysis = analyzeInteractiveHookTranscript(transcript)
      const hookOutput = readIfExists(hookOutputPath).trim()
      const tuiLog = readIfExists(tuiLogPath)
      const tuiLogPreview = previewTail(tuiLog, 30)
      const codexHooksDeprecationMessage = extractCodexHooksDeprecationMessage(analysis.sanitizedTranscript)

      attempts.push({
        phase: attemptPlan.phase,
        prompt: attemptPlan.prompt,
        transcriptPath: attemptPlan.transcriptPath,
        status: classifyInteractiveHookProbeStatus(execution, hookOutput.length > 0, analysis.sawReviewGate),
        exitCode: execution.exitCode,
        stdout: execution.stdout,
        stderr: execution.stderr,
        transcript,
        sanitizedTranscript: analysis.sanitizedTranscript,
        normalizedTranscript: analysis.normalizedTranscript,
        timedOut: execution.timedOut,
        killedAfterSignal: execution.killedAfterSignal,
        forcedKillAfterSignal: execution.forcedKillAfterSignal,
        hookRan: hookOutput.length > 0,
        hookOutput,
        sawReviewGate: analysis.sawReviewGate,
        reviewGateMessage: analysis.reviewGateMessage,
        sawUnknownFeatureKeyWarning: /unknown feature key in config:\s*hooks/i.test(tuiLog),
        sawCodexHooksDeprecationWarning: codexHooksDeprecationMessage.length > 0,
        codexHooksDeprecationMessage,
        tuiLogPreview,
      })
    }

    const finalAttempt = attempts[attempts.length - 1]
    if (!finalAttempt) {
      throw new Error(`No interactive hook attempts ran for scenario ${scenario.name}.`)
    }

    return {
      scenarioName: scenario.name,
      featureMode: scenario.featureMode,
      eventName: scenario.eventName,
      trustProject: scenario.trustProject,
      executionMode,
      prompt: finalAttempt.prompt,
      status: finalAttempt.status,
      workDir,
      realWorkDir,
      codexHome,
      configPath,
      hooksPath,
      hookScriptPath,
      transcriptPath: finalAttempt.transcriptPath,
      tuiLogPath,
      exitCode: finalAttempt.exitCode,
      stdout: finalAttempt.stdout,
      stderr: finalAttempt.stderr,
      transcript: finalAttempt.transcript,
      sanitizedTranscript: finalAttempt.sanitizedTranscript,
      normalizedTranscript: finalAttempt.normalizedTranscript,
      timedOut: finalAttempt.timedOut,
      killedAfterSignal: finalAttempt.killedAfterSignal,
      forcedKillAfterSignal: finalAttempt.forcedKillAfterSignal,
      hookRan: finalAttempt.hookRan,
      hookOutput: finalAttempt.hookOutput,
      sawReviewGate: finalAttempt.sawReviewGate,
      reviewGateMessage: finalAttempt.reviewGateMessage,
      sawUnknownFeatureKeyWarning: finalAttempt.sawUnknownFeatureKeyWarning,
      sawCodexHooksDeprecationWarning: finalAttempt.sawCodexHooksDeprecationWarning,
      codexHooksDeprecationMessage: finalAttempt.codexHooksDeprecationMessage,
      tuiLogPreview: finalAttempt.tuiLogPreview,
      attempts,
    }
  } finally {
    if (!options.keepTemp) {
      await rm(codexHome, { recursive: true, force: true })
      await rm(workDir, { recursive: true, force: true })
    }
  }
}

function buildInteractiveHookAttemptPlans(
  scenario: CodexInteractiveHookProbeScenario,
  prompt: string,
  workDir: string,
): InteractiveHookAttemptPlan[] {
  const executionMode = scenario.executionMode ?? 'single'
  if (executionMode === 'single') {
    return [{
      phase: 'single',
      prompt,
      transcriptPath: resolve(workDir, 'codex-interactive-hook.transcript'),
    }]
  }

  if (scenario.eventName !== 'SessionStart') {
    throw new Error('The reviewed-session-start execution mode only applies to SessionStart hook scenarios.')
  }

  return [
    {
      phase: 'pre-review',
      prompt,
      transcriptPath: resolve(workDir, 'codex-interactive-hook.pre-review.transcript'),
    },
    {
      phase: 'post-review',
      prompt,
      transcriptPath: resolve(workDir, 'codex-interactive-hook.post-review.transcript'),
    },
  ]
}

async function executeCodexInteractiveHookCommand(input: {
  scriptBinary: string
  codexBinary: string
  prompt: string
  extraCliArgs?: string[]
  cwd: string
  env: NodeJS.ProcessEnv
  transcriptPath: string
  hookOutputPath: string
  timeoutMs: number
}): Promise<InteractiveExecutionResult> {
  return await new Promise((resolvePromise, reject) => {
    const stdoutChunks: Buffer[] = []
    const stderrChunks: Buffer[] = []
    let timedOut = false
    let killedAfterSignal = false
    let forcedKillAfterSignal = false
    let signalSeenAt: number | null = null
    let settled = false

    const child = spawn(input.scriptBinary, [
      '-q',
      input.transcriptPath,
      input.codexBinary,
      '--no-alt-screen',
      ...(input.extraCliArgs ?? []),
      '--sandbox',
      'workspace-write',
      '-a',
      'never',
      input.prompt,
    ], {
      cwd: input.cwd,
      detached: process.platform !== 'win32',
      stdio: ['ignore', 'pipe', 'pipe'],
      env: input.env,
    })

    const interval = setInterval(() => {
      const transcript = readIfExists(input.transcriptPath)
      const analysis = analyzeInteractiveHookTranscript(transcript)
      const hookRan = existsSync(input.hookOutputPath)
      if (!hookRan && !analysis.sawReviewGate) return
      if (signalSeenAt == null) {
        signalSeenAt = Date.now()
        return
      }
      const elapsed = Date.now() - signalSeenAt
      if (!killedAfterSignal && elapsed >= SIGNAL_GRACE_MS) {
        killedAfterSignal = true
        signalSpawnedProcess(child, 'SIGTERM')
        return
      }
      if (!forcedKillAfterSignal && elapsed >= SIGNAL_FORCE_KILL_MS) {
        forcedKillAfterSignal = true
        signalSpawnedProcess(child, 'SIGKILL')
      }
    }, 250)

    const timeout = setTimeout(() => {
      timedOut = true
      signalSpawnedProcess(child, 'SIGKILL')
    }, input.timeoutMs)

    child.stdout?.on('data', (chunk) => stdoutChunks.push(Buffer.from(chunk)))
    child.stderr?.on('data', (chunk) => stderrChunks.push(Buffer.from(chunk)))
    child.on('error', (error) => {
      if (settled) return
      settled = true
      clearInterval(interval)
      clearTimeout(timeout)
      reject(error)
    })
    child.on('close', (code) => {
      if (settled) return
      settled = true
      clearInterval(interval)
      clearTimeout(timeout)
      const exitCode = timedOut && !killedAfterSignal
        ? 124
        : (killedAfterSignal ? 0 : (code ?? 1))
      resolvePromise({
        exitCode,
        stdout: Buffer.concat(stdoutChunks).toString('utf-8'),
        stderr: Buffer.concat(stderrChunks).toString('utf-8'),
        timedOut: timedOut && !killedAfterSignal,
        killedAfterSignal,
        forcedKillAfterSignal,
      })
    })
  })
}

function analyzeInteractiveHookTranscript(transcript: string): InteractiveTranscriptAnalysis {
  const sanitizedTranscript = sanitizeTerminalTranscript(transcript)
  const normalizedTranscript = sanitizedTranscript.replace(/\s+/g, '')
  const sawReviewGate = /\d+hooks?needsreviewbeforeitcanrun\.?Open\/hookstoreviewit\.?/i.test(normalizedTranscript)
    || /hookneedsreviewbeforeitcanrun\.?Open\/hookstoreviewit\.?/i.test(normalizedTranscript)
  const reviewGateMessage = sawReviewGate
    ? extractReviewGateMessage(sanitizedTranscript)
    : ''

  return {
    sanitizedTranscript,
    normalizedTranscript,
    sawReviewGate,
    reviewGateMessage,
  }
}

function extractCodexHooksDeprecationMessage(sanitizedTranscript: string): string {
  const normalized = sanitizedTranscript.replace(/\s+/g, '')
  if (/`\[features\]\.codex_hooks`isdeprecated\.Use`\[features\]\.hooks`instead\./i.test(normalized)) {
    return '`[features].codex_hooks` is deprecated. Use `[features].hooks` instead.'
  }

  const flattened = sanitizedTranscript.replace(/\s+/g, ' ').trim()
  const exactMatch = flattened.match(/`\[features\]\.codex_hooks`\s+is\s+deprecated\.\s+Use\s+`\[features\]\.hooks`\s+instead\./i)
  if (exactMatch) {
    return exactMatch[0]
  }
  return ''
}

function extractReviewGateMessage(sanitizedTranscript: string): string {
  const flattened = sanitizedTranscript.replace(/\s+/g, ' ').trim()
  const exactMatch = flattened.match(/\d+\s+hook(?:s)?\s+need(?:s)?\s+review\s+before\s+it\s+can\s+run\.\s+Open\s+\/hooks\s+to\s+review\s+it\./i)
  if (exactMatch) {
    return exactMatch[0]
  }
  if (/Open\s+\/hooks\s+to\s+review\s+it\./i.test(flattened)) {
    return 'Open /hooks to review it.'
  }
  return 'hook review required'
}

function buildCodexInteractiveHookConfig(
  realWorkDir: string,
  featureMode: CodexHookFeatureMode,
  trustProject: boolean,
): string {
  const lines = ['[features]']
  if (featureMode === 'hooks') {
    lines.push('hooks = true')
  } else if (featureMode === 'codex_hooks') {
    lines.push('codex_hooks = true')
  }

  if (trustProject) {
    lines.push('', `[projects.${JSON.stringify(realWorkDir)}]`, 'trust_level = "trusted"')
  }

  return `${lines.join('\n')}\n`
}

function classifyInteractiveHookProbeStatus(
  execution: InteractiveExecutionResult,
  hookRan: boolean,
  sawReviewGate: boolean,
): CodexInteractiveHookProbeStatus {
  if (execution.timedOut) return 'runner-timed-out'
  if (execution.exitCode !== 0 && !execution.killedAfterSignal) return 'runner-failed'
  if (hookRan) return 'interactive-hook-executed'
  if (sawReviewGate) return 'review-gate-observed'
  return 'no-signal-observed'
}

function chmodHookScript(path: string): void {
  chmodSync(path, 0o755)
}

function removeIfExists(path: string): void {
  if (!existsSync(path)) return
  rmSync(path, { force: true })
}

function readIfExists(path: string): string {
  return existsSync(path)
    ? readFileSync(path, 'utf-8')
    : ''
}

function previewTail(value: string, lineCount: number): string {
  if (!value.trim()) return ''
  return value.trimEnd().split(/\r?\n/).slice(-lineCount).join('\n')
}
