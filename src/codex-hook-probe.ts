import { chmodSync, copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { mkdtemp, rm } from 'fs/promises'
import { realpathSync } from 'fs'
import { resolve } from 'path'
import { executeCodexExecCommand, type CodexExecRunResult } from './codex-exec-runner'
import { buildCodexProbeEnv, resolveCodexAuthSourceHome } from './codex-probe-shared'

export type CodexHookFeatureMode = 'hooks' | 'codex_hooks' | 'none'

export interface CodexHookProbeScenario {
  name: string
  featureMode: CodexHookFeatureMode
  trustProject: boolean
  prompt?: string
  extraCliArgs?: string[]
}

export type CodexHookProbeStatus =
  | 'hook-executed'
  | 'headless-response-no-hook'
  | 'runner-failed'
  | 'runner-timed-out'

export interface CodexHookProbeResult extends CodexExecRunResult {
  scenarioName: string
  featureMode: CodexHookFeatureMode
  trustProject: boolean
  prompt: string
  status: CodexHookProbeStatus
  workDir: string
  realWorkDir: string
  codexHome: string
  configPath: string
  hooksPath: string
  hookScriptPath: string
  hookRan: boolean
  hookOutput: string
}

export interface CodexHookProbeSuiteResult {
  generatedAt: string
  codexBinary: string
  authSourceHome: string
  timeoutMs: number
  results: CodexHookProbeResult[]
}

export interface RunCodexHookProbeOptions {
  codexBinary?: string
  authSourceHome?: string
  timeoutMs?: number
  keepTemp?: boolean
}

const DEFAULT_PROMPT = 'Reply only with OK'

export function getDefaultCodexHookProbeScenarios(): CodexHookProbeScenario[] {
  return [
    { name: 'hooks-no-trust', featureMode: 'hooks', trustProject: false },
    { name: 'hooks-trusted', featureMode: 'hooks', trustProject: true },
    { name: 'codex-hooks-trusted', featureMode: 'codex_hooks', trustProject: true },
  ]
}

export async function runCodexHookProbeSuite(
  scenarios: CodexHookProbeScenario[] = getDefaultCodexHookProbeScenarios(),
  options: RunCodexHookProbeOptions = {},
): Promise<CodexHookProbeSuiteResult> {
  const codexBinary = options.codexBinary ?? 'codex'
  const authSourceHome = resolveCodexAuthSourceHome(options.authSourceHome)
  const timeoutMs = options.timeoutMs ?? 15_000

  const results: CodexHookProbeResult[] = []
  for (const scenario of scenarios) {
    results.push(await runCodexHookProbeScenario(scenario, {
      codexBinary,
      authSourceHome,
      timeoutMs,
      keepTemp: options.keepTemp,
    }))
  }

  return {
    generatedAt: new Date().toISOString(),
    codexBinary,
    authSourceHome,
    timeoutMs,
    results,
  }
}

async function runCodexHookProbeScenario(
  scenario: CodexHookProbeScenario,
  options: Required<Pick<RunCodexHookProbeOptions, 'codexBinary' | 'authSourceHome' | 'timeoutMs'>> & Pick<RunCodexHookProbeOptions, 'keepTemp'>,
): Promise<CodexHookProbeResult> {
  const codexHome = await mkdtemp('/tmp/pluxx-codex-probe-home-')
  const workDir = await mkdtemp('/tmp/pluxx-codex-probe-work-')
  const realWorkDir = realpathSync(workDir)
  const configPath = resolve(codexHome, 'config.toml')
  const hooksPath = resolve(workDir, '.codex/hooks.json')
  const hookScriptPath = resolve(workDir, 'scripts/hook.sh')

  try {
    mkdirSync(resolve(workDir, '.codex'), { recursive: true })
    mkdirSync(resolve(workDir, 'scripts'), { recursive: true })

    const authPath = resolve(options.authSourceHome, 'auth.json')
    if (!existsSync(authPath)) {
      throw new Error(`Codex auth source is missing ${authPath}.`)
    }
    copyFileSync(authPath, resolve(codexHome, 'auth.json'))

    writeFileSync(configPath, buildCodexProbeConfig(realWorkDir, scenario.featureMode, scenario.trustProject))
    writeFileSync(hooksPath, JSON.stringify({
      version: 1,
      hooks: {
        SessionStart: [
          {
            hooks: [
              {
                type: 'command',
                command: 'bash ./scripts/hook.sh',
              },
            ],
          },
        ],
      },
    }, null, 2))
    writeFileSync(hookScriptPath, '#!/usr/bin/env bash\nset -euo pipefail\necho ran > ./hook-ran.txt\n')
    chmodSync(hookScriptPath, 0o755)

    const env = buildCodexProbeEnv(codexHome)
    const prompt = scenario.prompt?.trim() || DEFAULT_PROMPT
    const execution = await executeCodexExecCommand([
      options.codexBinary,
      'exec',
      ...(scenario.extraCliArgs ?? []),
      '--skip-git-repo-check',
      '--sandbox',
      'workspace-write',
      prompt,
    ], {
      cwd: workDir,
      timeoutMs: options.timeoutMs,
      env,
      outputDirPrefix: 'pluxx-codex-probe-last-message-',
    })

    const hookOutput = existsSync(resolve(workDir, 'hook-ran.txt'))
      ? readFileSync(resolve(workDir, 'hook-ran.txt'), 'utf-8').trim()
      : ''

    return {
      ...execution,
      scenarioName: scenario.name,
      featureMode: scenario.featureMode,
      trustProject: scenario.trustProject,
      prompt,
      status: classifyProbeStatus(execution, hookOutput.length > 0),
      workDir,
      realWorkDir,
      codexHome,
      configPath,
      hooksPath,
      hookScriptPath,
      hookRan: hookOutput.length > 0,
      hookOutput,
    }
  } finally {
    if (!options.keepTemp) {
      await rm(codexHome, { recursive: true, force: true })
      await rm(workDir, { recursive: true, force: true })
    }
  }
}

function buildCodexProbeConfig(
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

function classifyProbeStatus(execution: CodexExecRunResult, hookRan: boolean): CodexHookProbeStatus {
  if (hookRan) return 'hook-executed'
  if (execution.timedOut) return 'runner-timed-out'
  if (execution.exitCode !== 0 || execution.sawTurnFailed) return 'runner-failed'
  return 'headless-response-no-hook'
}
