import { afterEach, describe, expect, it } from 'bun:test'
import { chmodSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { resolve } from 'path'
import { runCodexInteractiveAgentProbeSuite, type CodexInteractiveAgentProbeScenario } from '../src/codex-interactive-agent-probe'

const TMP_ROOTS: string[] = []
const ORIGINAL_FAKE_MODE = process.env.PLUXX_FAKE_CODEX_INTERACTIVE_MODE

function makeTempDir(prefix: string): string {
  const dir = mkdtempSync(resolve(tmpdir(), prefix))
  TMP_ROOTS.push(dir)
  return dir
}

function makeStubExecutable(path: string, body: string): void {
  writeFileSync(path, body)
  chmodSync(path, 0o755)
}

afterEach(() => {
  if (ORIGINAL_FAKE_MODE === undefined) {
    delete process.env.PLUXX_FAKE_CODEX_INTERACTIVE_MODE
  } else {
    process.env.PLUXX_FAKE_CODEX_INTERACTIVE_MODE = ORIGINAL_FAKE_MODE
  }

  while (TMP_ROOTS.length > 0) {
    rmSync(TMP_ROOTS.pop()!, { recursive: true, force: true })
  }
})

function makeAuthHome(rootDir: string): string {
  const authHome = resolve(rootDir, 'codex-home')
  mkdirSync(authHome, { recursive: true })
  writeFileSync(resolve(authHome, 'auth.json'), '{"access_token":"test"}\n')
  return authHome
}

function makeFakeScript(rootDir: string): string {
  const binDir = resolve(rootDir, '.bin')
  mkdirSync(binDir, { recursive: true })
  const binary = resolve(binDir, 'script')
  makeStubExecutable(binary, `#!/bin/sh
MODE="\${PLUXX_FAKE_CODEX_INTERACTIVE_MODE:-readonly-proof}"
TRANSCRIPT=""
if [ "$1" = "-q" ]; then
  shift
fi
TRANSCRIPT="$1"
shift
case "$MODE" in
  readonly-proof)
    cat > "$TRANSCRIPT" <<'EOF'
Spawned worker agent [proof] (gpt-5.5 low)
Finished waiting
worker[proof]: Completed-SANDBOX_WRITE_PROOF
EOF
    printf 'interactive-readonly\\n' > sandbox-proof.txt
    ;;
  workspace-proof)
    cat > "$TRANSCRIPT" <<'EOF'
Spawned worker agent [proof] (gpt-5.5 low)
Finished waiting
worker[proof]: Completed-SANDBOX_WRITE_PROOF
EOF
    printf 'interactive-writable\\n' > sandbox-proof.txt
    ;;
  blocked-proof)
    cat > "$TRANSCRIPT" <<'EOF'
Spawned worker agent [proof] (gpt-5.5 low)
Finished waiting
worker[proof]: Completed-SANDBOX_BLOCKED
EOF
    ;;
  ansi-proof)
    printf '\\033]0;demo\\007\\033[1;1HSpawned\\nworker\\nagent\\n[proof]\\n\\033[0m\\nworker[proof]: Completed-SANDBOX_WRITE_PROOF\\n' > "$TRANSCRIPT"
    printf 'interactive-readonly\\n' > sandbox-proof.txt
    ;;
  linger)
    cat > "$TRANSCRIPT" <<'EOF'
Spawned worker agent [proof] (gpt-5.5 low)
Finished waiting
worker[proof]: Completed-SANDBOX_WRITE_PROOF
EOF
    printf 'interactive-readonly\\n' > sandbox-proof.txt
    sleep 10
    ;;
  fail)
    echo 'interactive failure' >&2
    exit 1
    ;;
esac
`)
  return binary
}

function makeFakeCodex(rootDir: string): string {
  const binDir = resolve(rootDir, '.bin')
  mkdirSync(binDir, { recursive: true })
  const binary = resolve(binDir, 'codex')
  makeStubExecutable(binary, '#!/bin/sh\nexit 0\n')
  return binary
}

async function runScenario(scenario: CodexInteractiveAgentProbeScenario, mode: string) {
  process.env.PLUXX_FAKE_CODEX_INTERACTIVE_MODE = mode
  const rootDir = makeTempDir('pluxx-codex-interactive-probe-')
  const authHome = makeAuthHome(rootDir)
  const scriptBinary = makeFakeScript(rootDir)
  const codexBinary = makeFakeCodex(rootDir)

  const suite = await runCodexInteractiveAgentProbeSuite([scenario], {
    authSourceHome: authHome,
    scriptBinary,
    codexBinary,
    timeoutMs: 2_000,
  })

  expect(suite.results).toHaveLength(1)
  return suite.results[0]!
}

describe('codex interactive agent probe', () => {
  it('records a mismatched sandbox expectation when a trusted interactive read-only agent still writes', async () => {
    const result = await runScenario({
      name: 'sandbox-readonly-trusted',
      sandboxMode: 'read-only',
      sideEffectRelativePath: 'sandbox-proof.txt',
      expectedSideEffectPresent: false,
    }, 'readonly-proof')

    expect(result.status).toBe('interactive-proof-observed')
    expect(result.proofToken).toBe('SANDBOX_WRITE_PROOF')
    expect(result.sawSpawnedAgent).toBe(true)
    expect(result.sawCompletedProof).toBe(true)
    expect(result.sideEffectPresent).toBe(true)
    expect(result.sideEffectOutput).toBe('interactive-readonly')
    expect(result.expectationStatus).toBe('mismatched')
  })

  it('records a matched workspace-write control in the trusted interactive probe', async () => {
    const result = await runScenario({
      name: 'sandbox-workspace-write-trusted',
      sandboxMode: 'workspace-write',
      sideEffectRelativePath: 'sandbox-proof.txt',
      expectedSideEffectPresent: true,
      expectedSideEffectOutput: 'interactive-writable',
    }, 'workspace-proof')

    expect(result.status).toBe('interactive-proof-observed')
    expect(result.proofToken).toBe('SANDBOX_WRITE_PROOF')
    expect(result.sideEffectPresent).toBe(true)
    expect(result.sideEffectOutput).toBe('interactive-writable')
    expect(result.expectationStatus).toBe('matched')
  })

  it('treats a blocked interactive proof token as observed even without a side-effect file', async () => {
    const result = await runScenario({
      name: 'sandbox-readonly-trusted',
      sandboxMode: 'read-only',
      sideEffectRelativePath: 'sandbox-proof.txt',
      expectedSideEffectPresent: false,
    }, 'blocked-proof')

    expect(result.status).toBe('interactive-proof-observed')
    expect(result.proofToken).toBe('SANDBOX_BLOCKED')
    expect(result.sideEffectPresent).toBe(false)
    expect(result.expectationStatus).toBe('matched')
  })

  it('normalizes ANSI-heavy transcript output before matching proof tokens', async () => {
    const result = await runScenario({
      name: 'sandbox-readonly-trusted',
      sandboxMode: 'read-only',
      sideEffectRelativePath: 'sandbox-proof.txt',
      expectedSideEffectPresent: false,
    }, 'ansi-proof')

    expect(result.status).toBe('interactive-proof-observed')
    expect(result.proofToken).toBe('SANDBOX_WRITE_PROOF')
    expect(result.sawAgentName).toBe(true)
    expect(result.normalizedTranscript).toContain('SANDBOX_WRITE_PROOF')
  })

  it('kills lingering interactive script sessions once the proof signal lands', async () => {
    const result = await runScenario({
      name: 'sandbox-readonly-trusted',
      sandboxMode: 'read-only',
      sideEffectRelativePath: 'sandbox-proof.txt',
      expectedSideEffectPresent: false,
    }, 'linger')

    expect(result.status).toBe('interactive-proof-observed')
    expect(result.exitCode).toBe(0)
    expect(result.killedAfterProofSignal).toBe(true)
    expect(result.timedOut).toBe(false)
  })

  it('reports runner-failed when the interactive script wrapper exits non-zero without proof', async () => {
    const result = await runScenario({
      name: 'sandbox-readonly-trusted',
      sandboxMode: 'read-only',
      sideEffectRelativePath: 'sandbox-proof.txt',
      expectedSideEffectPresent: false,
    }, 'fail')

    expect(result.status).toBe('runner-failed')
    expect(result.exitCode).toBe(1)
    expect(result.sideEffectPresent).toBe(false)
  })
})
