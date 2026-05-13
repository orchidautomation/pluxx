import {
  getDefaultClaudeHookProbeScenarios,
  getManagedClaudeHookProbeShadowScenarios,
  runClaudeHookProbeSuite,
} from '../src/claude-hook-probe'

const args = process.argv.slice(2)
const jsonOutput = args.includes('--json')
const keepTemp = args.includes('--keep-temp')
const includeManagedShadow = args.includes('--include-managed-shadow')
const timeoutFlag = readFlagValue(args, '--timeout-ms')
const binaryFlag = readFlagValue(args, '--binary')
const scenarios = includeManagedShadow
  ? [...getDefaultClaudeHookProbeScenarios(), ...getManagedClaudeHookProbeShadowScenarios()]
  : getDefaultClaudeHookProbeScenarios()

const timeoutMs = timeoutFlag ? Number(timeoutFlag) : undefined
if (timeoutFlag && (!Number.isFinite(timeoutMs) || timeoutMs! <= 0)) {
  console.error(`Invalid --timeout-ms value: ${timeoutFlag}`)
  process.exit(1)
}

const suite = await runClaudeHookProbeSuite(scenarios, {
  keepTemp,
  managedSettingsShadow: includeManagedShadow,
  ...(timeoutMs ? { timeoutMs } : {}),
  ...(binaryFlag ? { claudeBinary: binaryFlag } : {}),
})

if (jsonOutput) {
  console.log(JSON.stringify(suite, null, 2))
  process.exit(0)
}

console.log('Claude headless hook probe')
console.log(`  generated: ${suite.generatedAt}`)
console.log(`  binary: ${suite.claudeBinary}`)
console.log(`  timeout ms: ${suite.timeoutMs}`)
console.log(`  managed shadow: ${includeManagedShadow ? 'enabled' : 'disabled'}`)
for (const result of suite.results) {
  console.log(`\n${result.scenarioName}`)
  console.log(`  status: ${result.status}`)
  console.log(`  exit: ${result.exitCode}`)
  console.log(`  setting sources: ${result.settingSources.join(', ')}`)
  console.log(`  managed hook: ${result.managedHook ? 'yes' : 'no'}`)
  console.log(`  managed disableAllHooks: ${result.managedDisableAllHooks ? 'yes' : 'no'}`)
  console.log(`  managed allowManagedHooksOnly: ${result.managedAllowManagedHooksOnly ? 'yes' : 'no'}`)
  console.log(`  loaded plugins: ${result.loadedPlugins.join(', ') || '(none)'}`)
  console.log(`  plugin scope: ${result.pluginScope ?? '(none)'}`)
  console.log(`  plugin list errors: ${result.pluginListErrors.join(' | ') || '(none)'}`)
  console.log(`  duplicate hooks error: ${result.duplicateHooksError ? 'yes' : 'no'}`)
  console.log(`  side effects: ${result.sideEffects.map((effect) => effect.name).join(', ') || '(none)'}`)
  console.log(`  event types: ${result.eventTypes.join(', ') || '(none)'}`)
  if (result.stderr.trim()) {
    console.log(`  stderr: ${truncate(result.stderr.trim(), 280)}`)
  }
  if (keepTemp) {
    console.log(`  home dir: ${result.homeDir}`)
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
