import {
  getDefaultCodexInteractiveHookProbeScenarios,
  runCodexInteractiveHookProbeSuite,
} from '../src/codex-interactive-hook-probe'

const args = process.argv.slice(2)
const jsonOutput = args.includes('--json')
const keepTemp = args.includes('--keep-temp')
const includeEnableHooksCli = args.includes('--include-enable-hooks-cli')
const includeReviewedSessionStart = args.includes('--include-reviewed-session-start')
const timeoutFlag = readFlagValue(args, '--timeout-ms')
const binaryFlag = readFlagValue(args, '--binary')
const scriptFlag = readFlagValue(args, '--script-binary')
const authHomeFlag = readFlagValue(args, '--auth-home')

const timeoutMs = timeoutFlag ? Number(timeoutFlag) : undefined
if (timeoutFlag && (!Number.isFinite(timeoutMs) || timeoutMs! <= 0)) {
  console.error(`Invalid --timeout-ms value: ${timeoutFlag}`)
  process.exit(1)
}

const scenarios = getDefaultCodexInteractiveHookProbeScenarios()
if (includeEnableHooksCli) {
  scenarios.push(
    {
      name: 'user-prompt-submit-enable-hooks-trusted',
      featureMode: 'none',
      eventName: 'UserPromptSubmit',
      trustProject: true,
      extraCliArgs: ['--enable', 'hooks'],
    },
    {
      name: 'session-start-enable-hooks-trusted',
      featureMode: 'none',
      eventName: 'SessionStart',
      trustProject: true,
      extraCliArgs: ['--enable', 'hooks'],
    },
  )
}
if (includeReviewedSessionStart) {
  scenarios.push({
    name: 'session-start-hooks-trusted-reviewed',
    featureMode: 'hooks',
    eventName: 'SessionStart',
    trustProject: true,
    executionMode: 'reviewed-session-start',
  })
}

const suite = await runCodexInteractiveHookProbeSuite(scenarios, {
  keepTemp,
  ...(timeoutMs ? { timeoutMs } : {}),
  ...(binaryFlag ? { codexBinary: binaryFlag } : {}),
  ...(scriptFlag ? { scriptBinary: scriptFlag } : {}),
  ...(authHomeFlag ? { authSourceHome: authHomeFlag } : {}),
})

if (jsonOutput) {
  console.log(JSON.stringify(suite, null, 2))
  process.exit(0)
}

console.log('Codex interactive hook probe')
console.log(`  generated: ${suite.generatedAt}`)
console.log(`  binary: ${suite.codexBinary}`)
console.log(`  script binary: ${suite.scriptBinary}`)
console.log(`  auth home: ${suite.authSourceHome}`)
console.log(`  timeout ms: ${suite.timeoutMs}`)
for (const result of suite.results) {
  console.log(`\n${result.scenarioName}`)
  console.log(`  feature mode: ${result.featureMode}`)
  console.log(`  event: ${result.eventName}`)
  console.log(`  trust project: ${result.trustProject ? 'yes' : 'no'}`)
  console.log(`  status: ${result.status}`)
  console.log(`  exit: ${result.exitCode}`)
  console.log(`  hook ran: ${result.hookRan ? 'yes' : 'no'}`)
  if (result.hookOutput) {
    console.log(`  hook output: ${result.hookOutput}`)
  }
  console.log(`  review gate: ${result.sawReviewGate ? 'yes' : 'no'}`)
  if (result.reviewGateMessage) {
    console.log(`  review message: ${truncate(result.reviewGateMessage, 200)}`)
  }
  if (result.attempts.length > 1) {
    console.log(`  execution mode: ${result.executionMode}`)
    for (const attempt of result.attempts) {
      console.log(`  attempt ${attempt.phase}: ${attempt.status}`)
      console.log(`    hook ran: ${attempt.hookRan ? 'yes' : 'no'}`)
      console.log(`    review gate: ${attempt.sawReviewGate ? 'yes' : 'no'}`)
      if (attempt.reviewGateMessage) {
        console.log(`    review message: ${truncate(attempt.reviewGateMessage, 200)}`)
      }
      if (attempt.hookOutput) {
        console.log(`    hook output: ${attempt.hookOutput}`)
      }
    }
  }
  console.log(`  hooks warning: ${result.sawUnknownFeatureKeyWarning ? 'yes' : 'no'}`)
  console.log(`  codex_hooks deprecated: ${result.sawCodexHooksDeprecationWarning ? 'yes' : 'no'}`)
  if (result.codexHooksDeprecationMessage) {
    console.log(`  deprecation message: ${truncate(result.codexHooksDeprecationMessage, 200)}`)
  }
  if (result.stderr.trim()) {
    console.log(`  stderr: ${truncate(result.stderr.trim(), 280)}`)
  }
  if (result.tuiLogPreview) {
    console.log(`  tui log tail: ${truncate(result.tuiLogPreview, 280)}`)
  }
  if (keepTemp) {
    console.log(`  codex home: ${result.codexHome}`)
    console.log(`  work dir: ${result.workDir}`)
  }
}

function readFlagValue(argv: string[], flag: string): string | undefined {
  const index = argv.indexOf(flag)
  if (index === -1) return undefined
  return argv[index + 1]
}

function truncate(value: string, length: number): string {
  if (value.length <= length) return value
  return `${value.slice(0, Math.max(0, length - 3))}...`
}
