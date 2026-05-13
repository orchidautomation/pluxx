import { getDefaultCodexMcpProbeScenarios, runCodexMcpProbeSuite } from '../src/codex-mcp-probe'

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

const suite = await runCodexMcpProbeSuite(getDefaultCodexMcpProbeScenarios(), {
  keepTemp,
  ...(timeoutMs ? { timeoutMs } : {}),
  ...(binaryFlag ? { codexBinary: binaryFlag } : {}),
  ...(authHomeFlag ? { authSourceHome: authHomeFlag } : {}),
})

if (jsonOutput) {
  console.log(JSON.stringify(suite, null, 2))
  process.exit(0)
}

console.log('Codex MCP runtime probe')
console.log(`  generated: ${suite.generatedAt}`)
console.log(`  binary: ${suite.codexBinary}`)
console.log(`  auth home: ${suite.authSourceHome}`)
console.log(`  timeout ms: ${suite.timeoutMs}`)
for (const result of suite.results) {
  console.log(`\n${result.scenarioName}`)
  console.log(`  config scope: ${result.configScope}`)
  console.log(`  requested agent: ${result.requestCustomAgent ? 'yes' : 'no'}`)
  console.log(`  status: ${result.status}`)
  console.log(`  exit: ${result.exitCode}`)
  console.log(`  mcp list sees server: ${result.mcpListSawServerName ? 'yes' : 'no'}`)
  console.log(`  mcp session observed: ${result.mcpSessionObserved ? 'yes' : 'no'}`)
  console.log(`  mcp methods: ${result.mcpMethodsObserved.join(', ') || '(none)'}`)
  console.log(`  mcp_tool_call item: ${result.sawMcpToolCallItem ? 'yes' : 'no'}`)
  console.log(`  mcp_tool_call statuses: ${result.mcpToolCallStatuses.join(', ') || '(none)'}`)
  console.log(`  mcp_tool_call errors: ${result.mcpToolCallErrorMessages.join(' | ') || '(none)'}`)
  console.log(`  mcp call observed: ${result.mcpCallObserved ? 'yes' : 'no'}`)
  console.log(`  called tools: ${result.calledMcpTools.join(', ') || '(none)'}`)
  console.log(`  last message: ${result.lastMessage || '(empty)'}`)
  if (result.requestCustomAgent) {
    console.log(`  spawn_agent call: ${result.sawSpawnAgentCall ? 'yes' : 'no'}`)
    console.log(`  wait call: ${result.sawWaitCall ? 'yes' : 'no'}`)
    console.log(`  spawned threads: ${result.spawnedThreadIds.join(', ') || '(none)'}`)
    console.log(`  child messages: ${result.childAgentMessages.join(' | ') || '(none)'}`)
  }
  if (result.messageExpectationStatus !== 'not-applicable') {
    console.log(`  message expectation: ${result.messageExpectationStatus}`)
    console.log(`  expected last message: ${result.expectedLastMessage || '(empty)'}`)
  }
  if (result.mcpExpectationStatus !== 'not-applicable') {
    console.log(`  MCP expectation: ${result.mcpExpectationStatus}`)
    console.log(`  expected MCP call: ${result.expectedMcpCall ? 'yes' : 'no'}`)
  }
  if (result.mcpListStderr.trim()) {
    console.log(`  mcp list stderr: ${truncate(result.mcpListStderr.trim(), 280)}`)
  }
  if (result.stderr.trim()) {
    console.log(`  exec stderr: ${truncate(result.stderr.trim(), 280)}`)
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
