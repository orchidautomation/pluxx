import {
  getDefaultCodexInteractiveAgentProbeScenarios,
  runCodexInteractiveAgentProbeSuite,
} from '../src/codex-interactive-agent-probe'

const args = process.argv.slice(2)
const jsonOutput = args.includes('--json')
const keepTemp = args.includes('--keep-temp')
const timeoutFlag = readFlagValue(args, '--timeout-ms')
const binaryFlag = readFlagValue(args, '--binary')
const scriptBinaryFlag = readFlagValue(args, '--script-binary')
const authHomeFlag = readFlagValue(args, '--auth-home')

const timeoutMs = timeoutFlag ? Number(timeoutFlag) : undefined
if (timeoutFlag && (!Number.isFinite(timeoutMs) || timeoutMs! <= 0)) {
  console.error(`Invalid --timeout-ms value: ${timeoutFlag}`)
  process.exit(1)
}

const suite = await runCodexInteractiveAgentProbeSuite(getDefaultCodexInteractiveAgentProbeScenarios(), {
  keepTemp,
  ...(timeoutMs ? { timeoutMs } : {}),
  ...(binaryFlag ? { codexBinary: binaryFlag } : {}),
  ...(scriptBinaryFlag ? { scriptBinary: scriptBinaryFlag } : {}),
  ...(authHomeFlag ? { authSourceHome: authHomeFlag } : {}),
})

if (jsonOutput) {
  console.log(JSON.stringify(summarizeSuiteForJson(suite), null, 2))
  process.exit(0)
}

console.log('Codex interactive custom-agent probe')
console.log(`  generated: ${suite.generatedAt}`)
console.log(`  binary: ${suite.codexBinary}`)
console.log(`  script: ${suite.scriptBinary}`)
console.log(`  auth home: ${suite.authSourceHome}`)
console.log(`  timeout ms: ${suite.timeoutMs}`)
for (const result of suite.results) {
  console.log(`\n${result.scenarioName}`)
  console.log(`  status: ${result.status}`)
  console.log(`  exit: ${result.exitCode}`)
  console.log(`  agent sandbox: ${result.sandboxMode}`)
  console.log(`  saw spawned agent: ${result.sawSpawnedAgent ? 'yes' : 'no'}`)
  console.log(`  saw completed proof: ${result.sawCompletedProof ? 'yes' : 'no'}`)
  console.log(`  proof token: ${result.proofToken || '(missing)'}`)
  if (result.expectationStatus !== 'not-applicable') {
    console.log(`  config expectation: ${result.expectationStatus}`)
    console.log(`  expected side effect: ${result.expectedSideEffectPresent ? 'present' : 'absent'}`)
    console.log(`  observed side effect: ${result.sideEffectPresent ? truncate(result.sideEffectOutput || '(empty file)', 120) : 'absent'}`)
  }
  if (result.stderr.trim()) {
    console.log(`  stderr: ${truncate(result.stderr.trim(), 280)}`)
  }
  if (keepTemp) {
    console.log(`  codex home: ${result.codexHome}`)
    console.log(`  work dir: ${result.workDir}`)
    console.log(`  transcript: ${result.transcriptPath}`)
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

function summarizeSuiteForJson(
  suite: Awaited<ReturnType<typeof runCodexInteractiveAgentProbeSuite>>,
) {
  return {
    generatedAt: suite.generatedAt,
    codexBinary: suite.codexBinary,
    scriptBinary: suite.scriptBinary,
    authSourceHome: suite.authSourceHome,
    timeoutMs: suite.timeoutMs,
    results: suite.results.map((result) => ({
      scenarioName: result.scenarioName,
      prompt: result.prompt,
      status: result.status,
      sandboxMode: result.sandboxMode,
      workDir: result.workDir,
      realWorkDir: result.realWorkDir,
      codexHome: result.codexHome,
      configPath: result.configPath,
      agentFilePath: result.agentFilePath,
      transcriptPath: result.transcriptPath,
      exitCode: result.exitCode,
      timedOut: result.timedOut,
      killedAfterProofSignal: result.killedAfterProofSignal,
      forcedKillAfterProofSignal: result.forcedKillAfterProofSignal,
      sawAgentName: result.sawAgentName,
      sawSpawnedAgent: result.sawSpawnedAgent,
      sawCompletedProof: result.sawCompletedProof,
      proofToken: result.proofToken,
      sideEffectPath: result.sideEffectPath,
      sideEffectPresent: result.sideEffectPresent,
      sideEffectOutput: result.sideEffectOutput,
      expectedSideEffectPresent: result.expectedSideEffectPresent,
      expectedSideEffectOutput: result.expectedSideEffectOutput,
      expectationStatus: result.expectationStatus,
      stderrPreview: result.stderr.trim() ? truncate(result.stderr.trim(), 280) : '',
      transcriptPreview: truncate(result.sanitizedTranscript.replace(/\s+/g, ' ').trim(), 400),
      normalizedTranscriptPreview: truncate(result.normalizedTranscript, 240),
    })),
  }
}
