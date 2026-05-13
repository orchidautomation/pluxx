import { spawn } from 'child_process'
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { realpathSync } from 'fs'
import { mkdtemp, rm } from 'fs/promises'
import { resolve } from 'path'
import {
  buildCodexAgentToml,
  buildSandboxProofDeveloperInstructions,
  classifySideEffectExpectation,
  DEFAULT_AGENT_DESCRIPTION,
  DEFAULT_AGENT_NAME,
  DEFAULT_SANDBOX_MODE,
  SANDBOX_PROOF_PROMPT,
  type CodexAgentProbeExpectationStatus,
  type CodexAgentSandboxMode,
} from './codex-agent-probe-shared'
import { sanitizeTerminalTranscript, signalSpawnedProcess } from './codex-interactive-probe-shared'
import { buildCodexProbeEnv, resolveCodexAuthSourceHome } from './codex-probe-shared'

export interface CodexInteractiveAgentProbeScenario {
  name: string
  agentName?: string
  agentDescription?: string
  developerInstructions?: string
  sandboxMode?: CodexAgentSandboxMode
  prompt?: string
  sideEffectRelativePath?: string
  expectedSideEffectPresent?: boolean
  expectedSideEffectOutput?: string
}

export type CodexInteractiveAgentProbeStatus =
  | 'interactive-proof-observed'
  | 'no-proof-observed'
  | 'runner-failed'
  | 'runner-timed-out'

export interface CodexInteractiveAgentProbeResult {
  scenarioName: string
  prompt: string
  status: CodexInteractiveAgentProbeStatus
  sandboxMode: CodexAgentSandboxMode
  workDir: string
  realWorkDir: string
  codexHome: string
  configPath: string
  agentFilePath: string
  transcriptPath: string
  exitCode: number
  stdout: string
  stderr: string
  transcript: string
  sanitizedTranscript: string
  normalizedTranscript: string
  timedOut: boolean
  killedAfterProofSignal: boolean
  forcedKillAfterProofSignal: boolean
  sawAgentName: boolean
  sawSpawnedAgent: boolean
  sawCompletedProof: boolean
  proofToken: '' | 'SANDBOX_WRITE_PROOF' | 'SANDBOX_BLOCKED'
  sideEffectPath: string | null
  sideEffectPresent: boolean
  sideEffectOutput: string
  expectedSideEffectPresent: boolean | null
  expectedSideEffectOutput: string | null
  expectationStatus: CodexAgentProbeExpectationStatus
}

export interface CodexInteractiveAgentProbeSuiteResult {
  generatedAt: string
  codexBinary: string
  scriptBinary: string
  authSourceHome: string
  timeoutMs: number
  results: CodexInteractiveAgentProbeResult[]
}

export interface RunCodexInteractiveAgentProbeOptions {
  codexBinary?: string
  scriptBinary?: string
  authSourceHome?: string
  timeoutMs?: number
  keepTemp?: boolean
}

const DEFAULT_TIMEOUT_MS = 90_000
const PROOF_TOKEN_GRACE_MS = 1_000
const PROOF_TOKEN_FORCE_KILL_MS = 2_500
const SIDE_EFFECT_ONLY_GRACE_MS = 8_000
const SIDE_EFFECT_ONLY_FORCE_KILL_MS = 12_000

export function getDefaultCodexInteractiveAgentProbeScenarios(): CodexInteractiveAgentProbeScenario[] {
  return [
    {
      name: 'sandbox-readonly-trusted',
      developerInstructions: buildSandboxProofDeveloperInstructions('interactive-readonly'),
      sandboxMode: 'read-only',
      prompt: SANDBOX_PROOF_PROMPT,
      sideEffectRelativePath: 'sandbox-proof.txt',
      expectedSideEffectPresent: false,
    },
    {
      name: 'sandbox-workspace-write-trusted',
      developerInstructions: buildSandboxProofDeveloperInstructions('interactive-writable'),
      sandboxMode: 'workspace-write',
      prompt: SANDBOX_PROOF_PROMPT,
      sideEffectRelativePath: 'sandbox-proof.txt',
      expectedSideEffectPresent: true,
      expectedSideEffectOutput: 'interactive-writable',
    },
  ]
}

export async function runCodexInteractiveAgentProbeSuite(
  scenarios: CodexInteractiveAgentProbeScenario[] = getDefaultCodexInteractiveAgentProbeScenarios(),
  options: RunCodexInteractiveAgentProbeOptions = {},
): Promise<CodexInteractiveAgentProbeSuiteResult> {
  const codexBinary = options.codexBinary ?? 'codex'
  const scriptBinary = options.scriptBinary ?? 'script'
  const authSourceHome = resolveCodexAuthSourceHome(options.authSourceHome)
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS
  const results: CodexInteractiveAgentProbeResult[] = []

  for (const scenario of scenarios) {
    results.push(await runCodexInteractiveAgentProbeScenario(scenario, {
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

async function runCodexInteractiveAgentProbeScenario(
  scenario: CodexInteractiveAgentProbeScenario,
  options: Required<Pick<RunCodexInteractiveAgentProbeOptions, 'codexBinary' | 'scriptBinary' | 'authSourceHome' | 'timeoutMs'>> & Pick<RunCodexInteractiveAgentProbeOptions, 'keepTemp'>,
): Promise<CodexInteractiveAgentProbeResult> {
  const codexHome = await mkdtemp('/tmp/pluxx-codex-interactive-home-')
  const workDir = await mkdtemp('/tmp/pluxx-codex-interactive-work-')
  const realWorkDir = realpathSync(workDir)
  const configPath = resolve(codexHome, 'config.toml')
  const transcriptPath = resolve(workDir, 'codex-interactive.transcript')
  const agentName = scenario.agentName?.trim() || DEFAULT_AGENT_NAME
  const agentDescription = scenario.agentDescription?.trim() || DEFAULT_AGENT_DESCRIPTION
  const developerInstructions = scenario.developerInstructions?.trim() || buildSandboxProofDeveloperInstructions('interactive-default')
  const sandboxMode = scenario.sandboxMode ?? DEFAULT_SANDBOX_MODE
  const agentFilePath = resolve(workDir, `.codex/agents/${agentName}.toml`)
  const sideEffectPath = scenario.sideEffectRelativePath
    ? resolve(workDir, scenario.sideEffectRelativePath)
    : null

  try {
    mkdirSync(resolve(workDir, '.codex/agents'), { recursive: true })

    const authPath = resolve(options.authSourceHome, 'auth.json')
    if (!existsSync(authPath)) {
      throw new Error(`Codex auth source is missing ${authPath}.`)
    }
    copyFileSync(authPath, resolve(codexHome, 'auth.json'))

    writeFileSync(configPath, buildTrustedCodexConfig(realWorkDir))
    writeFileSync(agentFilePath, buildCodexAgentToml({
      agentName,
      agentDescription,
      developerInstructions,
      sandboxMode,
    }))

    const prompt = scenario.prompt?.trim() || SANDBOX_PROOF_PROMPT
    const execution = await executeCodexInteractiveAgentCommand({
      scriptBinary: options.scriptBinary,
      codexBinary: options.codexBinary,
      agentName,
      prompt,
      cwd: workDir,
      env: {
        ...buildCodexProbeEnv(codexHome),
        TERM: 'xterm-256color',
      },
      transcriptPath,
      sideEffectPath,
      timeoutMs: options.timeoutMs,
    })

    const transcript = existsSync(transcriptPath)
      ? readFileSync(transcriptPath, 'utf-8')
      : ''
    const analysis = analyzeInteractiveTranscript(transcript, agentName)
    const sideEffectPresent = sideEffectPath ? existsSync(sideEffectPath) : false
    const sideEffectOutput = sideEffectPresent && sideEffectPath
      ? readFileSync(sideEffectPath, 'utf-8').trim()
      : ''
    const expectationStatus = classifySideEffectExpectation(
      scenario.expectedSideEffectPresent,
      scenario.expectedSideEffectOutput,
      sideEffectPresent,
      sideEffectOutput,
    )

    return {
      scenarioName: scenario.name,
      prompt,
      status: classifyInteractiveAgentProbeStatus(execution, analysis, sideEffectPresent),
      sandboxMode,
      workDir,
      realWorkDir,
      codexHome,
      configPath,
      agentFilePath,
      transcriptPath,
      exitCode: execution.exitCode,
      stdout: execution.stdout,
      stderr: execution.stderr,
      transcript,
      sanitizedTranscript: analysis.sanitizedTranscript,
      normalizedTranscript: analysis.normalizedTranscript,
      timedOut: execution.timedOut,
      killedAfterProofSignal: execution.killedAfterProofSignal,
      forcedKillAfterProofSignal: execution.forcedKillAfterProofSignal,
      sawAgentName: analysis.sawAgentName,
      sawSpawnedAgent: analysis.sawSpawnedAgent,
      sawCompletedProof: analysis.sawCompletedProof,
      proofToken: analysis.proofToken,
      sideEffectPath,
      sideEffectPresent,
      sideEffectOutput,
      expectedSideEffectPresent: typeof scenario.expectedSideEffectPresent === 'boolean'
        ? scenario.expectedSideEffectPresent
        : null,
      expectedSideEffectOutput: scenario.expectedSideEffectOutput ?? null,
      expectationStatus,
    }
  } finally {
    if (!options.keepTemp) {
      await rm(codexHome, { recursive: true, force: true })
      await rm(workDir, { recursive: true, force: true })
    }
  }
}

interface InteractiveExecutionResult {
  exitCode: number
  stdout: string
  stderr: string
  timedOut: boolean
  killedAfterProofSignal: boolean
  forcedKillAfterProofSignal: boolean
}

async function executeCodexInteractiveAgentCommand(input: {
  scriptBinary: string
  codexBinary: string
  agentName: string
  prompt: string
  cwd: string
  env: NodeJS.ProcessEnv
  transcriptPath: string
  sideEffectPath: string | null
  timeoutMs: number
}): Promise<InteractiveExecutionResult> {
  return await new Promise((resolvePromise, reject) => {
    const stdoutChunks: Buffer[] = []
    const stderrChunks: Buffer[] = []
    let timedOut = false
    let killedAfterProofSignal = false
    let forcedKillAfterProofSignal = false
    let proofSignalSeenAt: number | null = null
    let settled = false

    const child = spawn(input.scriptBinary, [
      '-q',
      input.transcriptPath,
      input.codexBinary,
      '--no-alt-screen',
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
      const transcript = existsSync(input.transcriptPath)
        ? readFileSync(input.transcriptPath, 'utf-8')
        : ''
      const analysis = analyzeInteractiveTranscript(transcript, input.agentName)
      const sideEffectPresent = input.sideEffectPath ? existsSync(input.sideEffectPath) : false
      const sawProofSignal = sideEffectPresent || analysis.proofToken.length > 0
      if (!sawProofSignal) return
      if (proofSignalSeenAt == null) {
        proofSignalSeenAt = Date.now()
        return
      }
      const elapsed = Date.now() - proofSignalSeenAt
      const graceMs = analysis.proofToken.length > 0
        ? PROOF_TOKEN_GRACE_MS
        : SIDE_EFFECT_ONLY_GRACE_MS
      const forceMs = analysis.proofToken.length > 0
        ? PROOF_TOKEN_FORCE_KILL_MS
        : SIDE_EFFECT_ONLY_FORCE_KILL_MS
      if (!killedAfterProofSignal && elapsed >= graceMs) {
        killedAfterProofSignal = true
        signalSpawnedProcess(child, 'SIGTERM')
        return
      }
      if (!forcedKillAfterProofSignal && elapsed >= forceMs) {
        forcedKillAfterProofSignal = true
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
      const exitCode = timedOut && !killedAfterProofSignal
        ? 124
        : (killedAfterProofSignal ? 0 : (code ?? 1))
      resolvePromise({
        exitCode,
        stdout: Buffer.concat(stdoutChunks).toString('utf-8'),
        stderr: Buffer.concat(stderrChunks).toString('utf-8'),
        timedOut: timedOut && !killedAfterProofSignal,
        killedAfterProofSignal,
        forcedKillAfterProofSignal,
      })
    })
  })
}

interface InteractiveTranscriptAnalysis {
  sanitizedTranscript: string
  normalizedTranscript: string
  sawAgentName: boolean
  sawSpawnedAgent: boolean
  sawCompletedProof: boolean
  proofToken: '' | 'SANDBOX_WRITE_PROOF' | 'SANDBOX_BLOCKED'
}

function analyzeInteractiveTranscript(
  transcript: string,
  agentName: string,
): InteractiveTranscriptAnalysis {
  const sanitizedTranscript = sanitizeTerminalTranscript(transcript)
  const normalizedTranscript = sanitizedTranscript.replace(/\s+/g, '')
  const proofToken = normalizedTranscript.includes('SANDBOX_WRITE_PROOF')
    ? 'SANDBOX_WRITE_PROOF'
    : (normalizedTranscript.includes('SANDBOX_BLOCKED') ? 'SANDBOX_BLOCKED' : '')
  const sawAgentName = normalizedTranscript.includes(`[${agentName}]`)
  return {
    sanitizedTranscript,
    normalizedTranscript,
    sawAgentName,
    sawSpawnedAgent: sawAgentName && normalizedTranscript.includes('Spawned'),
    sawCompletedProof: proofToken.length > 0 && normalizedTranscript.includes(`Completed-${proofToken}`),
    proofToken,
  }
}

function classifyInteractiveAgentProbeStatus(
  execution: InteractiveExecutionResult,
  analysis: InteractiveTranscriptAnalysis,
  sideEffectPresent: boolean,
): CodexInteractiveAgentProbeStatus {
  if (execution.timedOut) return 'runner-timed-out'
  if (execution.exitCode !== 0 && !execution.killedAfterProofSignal) return 'runner-failed'
  if (analysis.proofToken.length > 0 || sideEffectPresent) return 'interactive-proof-observed'
  return 'no-proof-observed'
}

function buildTrustedCodexConfig(realWorkDir: string): string {
  return [
    `[projects.${JSON.stringify(realWorkDir)}]`,
    'trust_level = "trusted"',
    '',
  ].join('\n')
}
