import { getDefaultCodexAgentProbeScenarios, runCodexAgentProbeSuite } from '../src/codex-agent-probe'

const args = process.argv.slice(2)
const jsonOutput = args.includes('--json')
const keepTemp = args.includes('--keep-temp')
const timeoutFlag = readFlagValue(args, '--timeout-ms')
const binaryFlag = readFlagValue(args, '--binary')
const authHomeFlag = readFlagValue(args, '--auth-home')

const timeoutMs = timeoutFlag ? Number(timeoutFlag) : undefined
if (timeoutFlag && (!Number.isFinite(timeoutMs) || timeoutMs! <= 0)) {
  console.error(`Invalid --timeout-ms value: ${timeoutFlag}`)
  process.exit(1)
}

const suite = await runCodexAgentProbeSuite(getDefaultCodexAgentProbeScenarios(), {
  keepTemp,
  ...(timeoutMs ? { timeoutMs } : {}),
  ...(binaryFlag ? { codexBinary: binaryFlag } : {}),
  ...(authHomeFlag ? { authSourceHome: authHomeFlag } : {}),
})

if (jsonOutput) {
  console.log(JSON.stringify(suite, null, 2))
  process.exit(0)
}

console.log('Codex custom-agent probe')
console.log(`  generated: ${suite.generatedAt}`)
console.log(`  binary: ${suite.codexBinary}`)
console.log(`  auth home: ${suite.authSourceHome}`)
console.log(`  timeout ms: ${suite.timeoutMs}`)
for (const result of suite.results) {
  console.log(`\n${result.scenarioName}`)
  console.log(`  requested agent: ${result.requestCustomAgent ? 'yes' : 'no'}`)
  console.log(`  status: ${result.status}`)
  console.log(`  exit: ${result.exitCode}`)
  console.log(`  agent sandbox: ${result.sandboxMode}`)
  console.log(`  spawn_agent call: ${result.sawSpawnAgentCall ? 'yes' : 'no'}`)
  console.log(`  wait call: ${result.sawWaitCall ? 'yes' : 'no'}`)
  console.log(`  spawned threads: ${result.spawnedThreadIds.join(', ') || '(none)'}`)
  console.log(`  child proof messages: ${result.childAgentMessages.length}`)
  console.log(`  final proof prefix: ${result.finalMessageHasProofPrefix ? 'yes' : 'no'}`)
  console.log(`  last message: ${result.lastMessage || '(empty)'}`)
  if (result.expectationStatus !== 'not-applicable') {
    console.log(`  config expectation: ${result.expectationStatus}`)
    console.log(`  expected side effect: ${result.expectedSideEffectPresent ? 'present' : 'absent'}`)
    console.log(`  observed side effect: ${result.sideEffectPresent ? truncate(result.sideEffectOutput || '(empty file)', 120) : 'absent'}`)
  }
  if (result.messageExpectationStatus !== 'not-applicable') {
    console.log(`  message expectation: ${result.messageExpectationStatus}`)
    console.log(`  expected last message: ${result.expectedLastMessage || '(empty)'}`)
  }
  if (result.preSpawnActivityTypes.length > 0) {
    console.log(`  pre-spawn activity: ${result.preSpawnActivityTypes.join(', ')}`)
  }
  console.log(`  event types: ${result.eventTypes.join(', ') || '(none)'}`)
  if (result.stderr.trim()) {
    console.log(`  stderr: ${truncate(result.stderr.trim(), 280)}`)
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
