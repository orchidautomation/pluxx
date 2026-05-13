import { getDefaultCodexHookProbeScenarios, runCodexHookProbeSuite } from '../src/codex-hook-probe'

const args = process.argv.slice(2)
const jsonOutput = args.includes('--json')
const keepTemp = args.includes('--keep-temp')
const includeEnableHooksCli = args.includes('--include-enable-hooks-cli')
const timeoutFlag = readFlagValue(args, '--timeout-ms')
const binaryFlag = readFlagValue(args, '--binary')
const authHomeFlag = readFlagValue(args, '--auth-home')

const timeoutMs = timeoutFlag ? Number(timeoutFlag) : undefined
if (timeoutFlag && (!Number.isFinite(timeoutMs) || timeoutMs! <= 0)) {
  console.error(`Invalid --timeout-ms value: ${timeoutFlag}`)
  process.exit(1)
}

const scenarios = getDefaultCodexHookProbeScenarios()
if (includeEnableHooksCli) {
  scenarios.push({
    name: 'enable-hooks-trusted',
    featureMode: 'none',
    trustProject: true,
    extraCliArgs: ['--enable', 'hooks'],
  })
}

const suite = await runCodexHookProbeSuite(scenarios, {
  keepTemp,
  ...(timeoutMs ? { timeoutMs } : {}),
  ...(binaryFlag ? { codexBinary: binaryFlag } : {}),
  ...(authHomeFlag ? { authSourceHome: authHomeFlag } : {}),
})

if (jsonOutput) {
  console.log(JSON.stringify(suite, null, 2))
  process.exit(0)
}

console.log('Codex headless hook probe')
console.log(`  generated: ${suite.generatedAt}`)
console.log(`  binary: ${suite.codexBinary}`)
console.log(`  auth home: ${suite.authSourceHome}`)
console.log(`  timeout ms: ${suite.timeoutMs}`)
for (const result of suite.results) {
  console.log(`\n${result.scenarioName}`)
  console.log(`  feature mode: ${result.featureMode}`)
  console.log(`  trust project: ${result.trustProject ? 'yes' : 'no'}`)
  console.log(`  status: ${result.status}`)
  console.log(`  exit: ${result.exitCode}`)
  console.log(`  hook ran: ${result.hookRan ? 'yes' : 'no'}`)
  console.log(`  last message: ${result.lastMessage || '(empty)'}`)
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
