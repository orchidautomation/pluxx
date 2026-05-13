import { afterEach, describe, expect, it } from 'bun:test'
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { resolve } from 'path'
import { runCodexAgentProbeSuite, type CodexAgentProbeScenario } from '../src/codex-agent-probe'

const TMP_ROOTS: string[] = []
const ORIGINAL_THREAD_ID = process.env.CODEX_THREAD_ID
const ORIGINAL_SHELL = process.env.CODEX_SHELL
const ORIGINAL_ORIGINATOR = process.env.CODEX_INTERNAL_ORIGINATOR_OVERRIDE
const ORIGINAL_FAKE_MODE = process.env.PLUXX_FAKE_CODEX_AGENT_MODE

function makeTempDir(prefix: string): string {
  const dir = mkdtempSync(resolve(tmpdir(), prefix))
  TMP_ROOTS.push(dir)
  return dir
}

function trackTempPath(path: string): void {
  TMP_ROOTS.push(path)
}

function makeStubExecutable(path: string, body: string): void {
  writeFileSync(path, body)
  chmodSync(path, 0o755)
}

afterEach(() => {
  if (ORIGINAL_THREAD_ID === undefined) {
    delete process.env.CODEX_THREAD_ID
  } else {
    process.env.CODEX_THREAD_ID = ORIGINAL_THREAD_ID
  }

  if (ORIGINAL_SHELL === undefined) {
    delete process.env.CODEX_SHELL
  } else {
    process.env.CODEX_SHELL = ORIGINAL_SHELL
  }

  if (ORIGINAL_ORIGINATOR === undefined) {
    delete process.env.CODEX_INTERNAL_ORIGINATOR_OVERRIDE
  } else {
    process.env.CODEX_INTERNAL_ORIGINATOR_OVERRIDE = ORIGINAL_ORIGINATOR
  }

  if (ORIGINAL_FAKE_MODE === undefined) {
    delete process.env.PLUXX_FAKE_CODEX_AGENT_MODE
  } else {
    process.env.PLUXX_FAKE_CODEX_AGENT_MODE = ORIGINAL_FAKE_MODE
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

function makeFakeCodex(rootDir: string): string {
  const binDir = resolve(rootDir, '.bin')
  mkdirSync(binDir, { recursive: true })
  const binary = resolve(binDir, 'codex')
  makeStubExecutable(binary, `#!/bin/sh
MODE="\${PLUXX_FAKE_CODEX_AGENT_MODE:-explicit-positive}"
OUT=""
while [ "$#" -gt 0 ]; do
  if [ "$1" = "--output-last-message" ]; then
    shift
    OUT="$1"
  fi
  shift
done
printf '{"type":"thread.started","thread_id":"test"}\\n'
printf '{"type":"turn.started"}\\n'
if [ "$MODE" = "explicit-positive" ]; then
  printf '{"type":"item.started","item":{"type":"collab_tool_call","tool":"spawn_agent"}}\\n'
  printf '{"type":"item.completed","item":{"type":"collab_tool_call","tool":"spawn_agent","output":{"receiver_thread_ids":["child-thread-1"]}}}\\n'
  printf '{"type":"item.started","item":{"type":"collab_tool_call","tool":"wait"}}\\n'
  printf '{"type":"item.completed","item":{"type":"collab_tool_call","tool":"wait","output":{"agents_states":[{"last_message":"CUSTOM_AGENT_PROOF delegated answer"}]}}}\\n'
  printf 'CUSTOM_AGENT_PROOF delegated answer\\n' > "$OUT"
  printf '{"type":"item.completed","item":{"type":"agent_message","text":"CUSTOM_AGENT_PROOF delegated answer"}}\\n'
  printf '{"type":"turn.completed"}\\n'
elif [ "$MODE" = "explicit-negative" ]; then
  printf 'OK\\n' > "$OUT"
  printf '{"type":"item.completed","item":{"type":"agent_message","text":"OK"}}\\n'
  printf '{"type":"turn.completed"}\\n'
elif [ "$MODE" = "explorer-override" ]; then
  printf '{"type":"item.started","item":{"type":"collab_tool_call","tool":"spawn_agent"}}\\n'
  printf '{"type":"item.completed","item":{"type":"collab_tool_call","tool":"spawn_agent","output":{"receiver_thread_ids":["child-thread-override"]}}}\\n'
  printf '{"type":"item.started","item":{"type":"collab_tool_call","tool":"wait"}}\\n'
  printf '{"type":"item.completed","item":{"type":"collab_tool_call","tool":"wait","output":{"agents_states":[{"last_message":"CUSTOM_EXPLORER_OVERRIDE overridden explorer answer"}]}}}\\n'
  printf 'CUSTOM_EXPLORER_OVERRIDE overridden explorer answer\\n' > "$OUT"
  printf '{"type":"item.completed","item":{"type":"agent_message","text":"CUSTOM_EXPLORER_OVERRIDE overridden explorer answer"}}\\n'
  printf '{"type":"turn.completed"}\\n'
elif [ "$MODE" = "project-precedence" ]; then
  printf '{"type":"item.started","item":{"type":"collab_tool_call","tool":"spawn_agent"}}\\n'
  printf '{"type":"item.completed","item":{"type":"collab_tool_call","tool":"spawn_agent","output":{"receiver_thread_ids":["child-thread-project"]}}}\\n'
  printf '{"type":"item.started","item":{"type":"collab_tool_call","tool":"wait"}}\\n'
  printf '{"type":"item.completed","item":{"type":"collab_tool_call","tool":"wait","output":{"agents_states":[{"last_message":"PROJECT_AGENT_PROOF project local wins"}]}}}\\n'
  printf 'PROJECT_AGENT_PROOF project local wins\\n' > "$OUT"
  printf '{"type":"item.completed","item":{"type":"agent_message","text":"PROJECT_AGENT_PROOF project local wins"}}\\n'
  printf '{"type":"turn.completed"}\\n'
elif [ "$MODE" = "project-no-model-does-not-inherit-user-invalid-model" ]; then
  printf '{"type":"item.started","item":{"type":"collab_tool_call","tool":"spawn_agent"}}\\n'
  printf '{"type":"item.completed","item":{"type":"collab_tool_call","tool":"spawn_agent","output":{"receiver_thread_ids":["child-thread-project-no-model"]}}}\\n'
  printf '{"type":"item.started","item":{"type":"collab_tool_call","tool":"wait"}}\\n'
  printf '{"type":"item.completed","item":{"type":"collab_tool_call","tool":"wait","output":{"agents_states":[{"last_message":"PROJECT_NO_MODEL_PROOF"}]}}}\\n'
  printf 'PROJECT_NO_MODEL_PROOF\\n' > "$OUT"
  printf '{"type":"item.completed","item":{"type":"agent_message","text":"PROJECT_NO_MODEL_PROOF"}}\\n'
  printf '{"type":"turn.completed"}\\n'
elif [ "$MODE" = "project-valid-model-overrides-user-invalid-model" ]; then
  printf '{"type":"item.started","item":{"type":"collab_tool_call","tool":"spawn_agent"}}\\n'
  printf '{"type":"item.completed","item":{"type":"collab_tool_call","tool":"spawn_agent","output":{"receiver_thread_ids":["child-thread-project-valid-model"]}}}\\n'
  printf '{"type":"item.started","item":{"type":"collab_tool_call","tool":"wait"}}\\n'
  printf '{"type":"item.completed","item":{"type":"collab_tool_call","tool":"wait","output":{"agents_states":[{"last_message":"PROJECT_VALID_MODEL_PROOF"}]}}}\\n'
  printf 'PROJECT_VALID_MODEL_PROOF\\n' > "$OUT"
  printf '{"type":"item.completed","item":{"type":"agent_message","text":"PROJECT_VALID_MODEL_PROOF"}}\\n'
  printf '{"type":"turn.completed"}\\n'
elif [ "$MODE" = "sandbox-readonly-ignored" ]; then
  printf 'readonly\\n' > sandbox-proof.txt
  printf '{"type":"item.started","item":{"type":"collab_tool_call","tool":"spawn_agent"}}\\n'
  printf '{"type":"item.completed","item":{"type":"collab_tool_call","tool":"spawn_agent","output":{"receiver_thread_ids":["child-thread-sandbox-ro"]}}}\\n'
  printf '{"type":"item.started","item":{"type":"collab_tool_call","tool":"wait"}}\\n'
  printf '{"type":"item.completed","item":{"type":"collab_tool_call","tool":"wait","output":{"agents_states":[{"last_message":"SANDBOX_WRITE_PROOF"}]}}}\\n'
  printf 'SANDBOX_WRITE_PROOF\\n' > "$OUT"
  printf '{"type":"item.completed","item":{"type":"agent_message","text":"SANDBOX_WRITE_PROOF"}}\\n'
  printf '{"type":"turn.completed"}\\n'
elif [ "$MODE" = "sandbox-workspace-write" ]; then
  printf 'writable\\n' > sandbox-proof.txt
  printf '{"type":"item.started","item":{"type":"collab_tool_call","tool":"spawn_agent"}}\\n'
  printf '{"type":"item.completed","item":{"type":"collab_tool_call","tool":"spawn_agent","output":{"receiver_thread_ids":["child-thread-sandbox-ww"]}}}\\n'
  printf '{"type":"item.started","item":{"type":"collab_tool_call","tool":"wait"}}\\n'
  printf '{"type":"item.completed","item":{"type":"collab_tool_call","tool":"wait","output":{"agents_states":[{"last_message":"SANDBOX_WRITE_PROOF"}]}}}\\n'
  printf 'SANDBOX_WRITE_PROOF\\n' > "$OUT"
  printf '{"type":"item.completed","item":{"type":"agent_message","text":"SANDBOX_WRITE_PROOF"}}\\n'
  printf '{"type":"turn.completed"}\\n'
elif [ "$MODE" = "skill-available" ]; then
  printf '{"type":"item.started","item":{"type":"collab_tool_call","tool":"spawn_agent"}}\\n'
  printf '{"type":"item.completed","item":{"type":"collab_tool_call","tool":"spawn_agent","output":{"receiver_thread_ids":["child-thread-skill-ok"]}}}\\n'
  printf '{"type":"item.started","item":{"type":"collab_tool_call","tool":"wait"}}\\n'
  printf '{"type":"item.completed","item":{"type":"collab_tool_call","tool":"wait","output":{"agents_states":[{"last_message":"SKILL_PROOF_TOKEN_TEST"}]}}}\\n'
  printf 'SKILL_PROOF_TOKEN_TEST\\n' > "$OUT"
  printf '{"type":"item.completed","item":{"type":"agent_message","text":"SKILL_PROOF_TOKEN_TEST"}}\\n'
  printf '{"type":"turn.completed"}\\n'
elif [ "$MODE" = "skill-missing" ]; then
  printf '{"type":"item.started","item":{"type":"collab_tool_call","tool":"spawn_agent"}}\\n'
  printf '{"type":"item.completed","item":{"type":"collab_tool_call","tool":"spawn_agent","output":{"receiver_thread_ids":["child-thread-skill-missing"]}}}\\n'
  printf '{"type":"item.started","item":{"type":"collab_tool_call","tool":"wait"}}\\n'
  printf '{"type":"item.completed","item":{"type":"collab_tool_call","tool":"wait","output":{"agents_states":[{"last_message":"SKILL_PROOF_MISSING"}]}}}\\n'
  printf 'SKILL_PROOF_MISSING\\n' > "$OUT"
  printf '{"type":"item.completed","item":{"type":"agent_message","text":"SKILL_PROOF_MISSING"}}\\n'
  printf '{"type":"turn.completed"}\\n'
elif [ "$MODE" = "invalid-model" ]; then
  cat <<'EOF'
{"type":"item.started","item":{"type":"collab_tool_call","tool":"spawn_agent"}}
{"type":"item.completed","item":{"type":"collab_tool_call","tool":"spawn_agent","output":{"receiver_thread_ids":["child-thread-invalid-model"]}}}
{"type":"item.started","item":{"type":"collab_tool_call","tool":"wait"}}
{"type":"item.completed","item":{"id":"item_1","type":"collab_tool_call","tool":"wait","receiver_thread_ids":["child-thread-invalid-model"],"prompt":null,"agents_states":{"child-thread-invalid-model":{"status":"errored","message":"{\"type\":\"error\",\"status\":400,\"error\":{\"type\":\"invalid_request_error\",\"message\":\"The 'definitely-not-a-real-codex-model' model is not supported when using Codex with a ChatGPT account.\"}}"}},"status":"failed"}}
EOF
  printf 'The proof agent errored: \`The '\''definitely-not-a-real-codex-model'\'' model is not supported when using Codex with a ChatGPT account.\`\\n' > "$OUT"
  printf '{"type":"turn.completed"}\\n'
elif [ "$MODE" = "echo-thread" ]; then
  printf 'THREAD:%s\\n' "\${CODEX_THREAD_ID:-missing}" > "$OUT"
  printf '{"type":"item.completed","item":{"type":"agent_message","text":"THREAD:'"\${CODEX_THREAD_ID:-missing}"'"}}\\n'
  printf '{"type":"turn.completed"}\\n'
elif [ "$MODE" = "turn-failed" ]; then
  printf '{"type":"turn.failed"}\\n'
  exit 1
elif [ "$MODE" = "linger" ]; then
  printf 'CUSTOM_AGENT_PROOF delegated answer\\n' > "$OUT"
  printf '{"type":"item.started","item":{"type":"collab_tool_call","tool":"spawn_agent"}}\\n'
  printf '{"type":"item.completed","item":{"type":"collab_tool_call","tool":"spawn_agent","output":{"receiver_thread_ids":["child-thread-1"]}}}\\n'
  printf '{"type":"item.started","item":{"type":"collab_tool_call","tool":"wait"}}\\n'
  printf '{"type":"item.completed","item":{"type":"collab_tool_call","tool":"wait","output":{"agents_states":[{"last_message":"CUSTOM_AGENT_PROOF delegated answer"}]}}}\\n'
  printf '{"type":"item.completed","item":{"type":"agent_message","text":"CUSTOM_AGENT_PROOF delegated answer"}}\\n'
  sleep 10
fi
`)
  return binary
}

async function runScenario(
  scenario: CodexAgentProbeScenario,
  options: { keepTemp?: boolean } = {},
) {
  const rootDir = makeTempDir('pluxx-codex-agent-probe-')
  const authHome = makeAuthHome(rootDir)
  const codexBinary = makeFakeCodex(rootDir)

  const suite = await runCodexAgentProbeSuite([scenario], {
    codexBinary,
    authSourceHome: authHome,
    timeoutMs: 2000,
    keepTemp: options.keepTemp,
  })

  expect(suite.results).toHaveLength(1)
  return suite.results[0]!
}

describe('codex agent probe', () => {
  it('reports custom-agent-invoked when Codex spawns and waits on a delegated proof agent', async () => {
    process.env.PLUXX_FAKE_CODEX_AGENT_MODE = 'explicit-positive'
    const result = await runScenario({
      name: 'explicit-custom-agent',
      requestCustomAgent: true,
      prompt: 'Use the proof agent to answer this request.',
    })

    expect(result.status).toBe('custom-agent-invoked')
    expect(result.sawSpawnAgentCall).toBe(true)
    expect(result.sawWaitCall).toBe(true)
    expect(result.spawnedThreadIds).toEqual(['child-thread-1'])
    expect(result.childAgentMessages).toContain('CUSTOM_AGENT_PROOF delegated answer')
    expect(result.finalMessageHasProofPrefix).toBe(true)
  })

  it('reports no-custom-agent-invocation when Codex answers directly without spawning a custom agent', async () => {
    process.env.PLUXX_FAKE_CODEX_AGENT_MODE = 'explicit-negative'
    const result = await runScenario({
      name: 'implicit-control',
      requestCustomAgent: false,
      prompt: 'Reply only with OK.',
    })

    expect(result.status).toBe('no-custom-agent-invocation')
    expect(result.sawSpawnAgentCall).toBe(false)
    expect(result.sawWaitCall).toBe(false)
    expect(result.spawnedThreadIds).toHaveLength(0)
    expect(result.childAgentMessages).toHaveLength(0)
    expect(result.finalMessageHasProofPrefix).toBe(false)
    expect(result.lastMessage).toBe('OK')
  })

  it('reports custom-agent-invoked when a project-local explorer.toml overrides the built-in explorer agent', async () => {
    process.env.PLUXX_FAKE_CODEX_AGENT_MODE = 'explorer-override'
    const result = await runScenario({
      name: 'built-in-explorer-override',
      requestCustomAgent: true,
      agentName: 'explorer',
      proofPrefix: 'CUSTOM_EXPLORER_OVERRIDE',
      prompt: 'Use the explorer agent to answer this request.',
    })

    expect(result.status).toBe('custom-agent-invoked')
    expect(result.agentFilePath.endsWith('/.codex/agents/explorer.toml')).toBe(true)
    expect(result.sawSpawnAgentCall).toBe(true)
    expect(result.sawWaitCall).toBe(true)
    expect(result.spawnedThreadIds).toEqual(['child-thread-override'])
    expect(result.childAgentMessages).toContain('CUSTOM_EXPLORER_OVERRIDE overridden explorer answer')
    expect(result.finalMessageHasProofPrefix).toBe(true)
  })

  it('reports custom-agent-invoked when a project-local agent overrides a same-name user-local agent', async () => {
    process.env.PLUXX_FAKE_CODEX_AGENT_MODE = 'project-precedence'
    const result = await runScenario({
      name: 'project-overrides-user-local',
      requestCustomAgent: true,
      agentName: 'proof',
      proofPrefix: 'PROJECT_AGENT_PROOF',
      userAgentName: 'proof',
      userProofPrefix: 'USER_AGENT_PROOF',
      prompt: 'Use the proof agent to answer this request.',
    })

    expect(result.status).toBe('custom-agent-invoked')
    expect(result.userAgentFilePath?.endsWith('/agents/proof.toml')).toBe(true)
    expect(result.sawSpawnAgentCall).toBe(true)
    expect(result.sawWaitCall).toBe(true)
    expect(result.spawnedThreadIds).toEqual(['child-thread-project'])
    expect(result.childAgentMessages).toContain('PROJECT_AGENT_PROOF project local wins')
    expect(result.finalMessageHasProofPrefix).toBe(true)
    expect(result.lastMessage).toBe('PROJECT_AGENT_PROOF project local wins')
  })

  it('records a matched project-local success when a project agent without model does not inherit a same-name user agent invalid model', async () => {
    process.env.PLUXX_FAKE_CODEX_AGENT_MODE = 'project-no-model-does-not-inherit-user-invalid-model'
    const result = await runScenario({
      name: 'project-no-model-does-not-inherit-user-invalid-model',
      requestCustomAgent: true,
      agentName: 'proof',
      agentDescription: 'Project-local proof agent without an explicit model.',
      proofPrefix: 'PROJECT_NO_MODEL_PROOF',
      developerInstructions: 'Reply exactly PROJECT_NO_MODEL_PROOF and nothing else.',
      userAgentName: 'proof',
      userAgentDescription: 'User-local proof agent with an invalid model.',
      userAgentModel: 'definitely-not-a-real-codex-model',
      userProofPrefix: 'USER_INVALID_MODEL_PROOF',
      prompt: 'Use the proof agent to answer this request.',
      expectedLastMessage: 'PROJECT_NO_MODEL_PROOF',
    }, { keepTemp: true })
    trackTempPath(result.codexHome)
    trackTempPath(result.workDir)

    expect(result.status).toBe('custom-agent-invoked')
    expect(result.sawSpawnAgentCall).toBe(true)
    expect(result.sawWaitCall).toBe(true)
    expect(result.spawnedThreadIds).toEqual(['child-thread-project-no-model'])
    expect(result.childAgentMessages).toContain('PROJECT_NO_MODEL_PROOF')
    expect(result.lastMessage).toBe('PROJECT_NO_MODEL_PROOF')
    expect(result.messageExpectationStatus).toBe('matched')
    expect(readFileSync(result.agentFilePath, 'utf-8')).not.toContain('model = ')
    expect(readFileSync(result.userAgentFilePath!, 'utf-8'))
      .toContain('model = "definitely-not-a-real-codex-model"')
  })

  it('records a matched project-local success when a valid project model overrides a same-name user agent invalid model', async () => {
    process.env.PLUXX_FAKE_CODEX_AGENT_MODE = 'project-valid-model-overrides-user-invalid-model'
    const result = await runScenario({
      name: 'project-valid-model-overrides-user-invalid-model',
      requestCustomAgent: true,
      agentName: 'proof',
      agentDescription: 'Project-local proof agent with an explicit valid model.',
      agentModel: 'gpt-5.5',
      proofPrefix: 'PROJECT_VALID_MODEL_PROOF',
      developerInstructions: 'Reply exactly PROJECT_VALID_MODEL_PROOF and nothing else.',
      userAgentName: 'proof',
      userAgentDescription: 'User-local proof agent with an invalid model.',
      userAgentModel: 'definitely-not-a-real-codex-model',
      userProofPrefix: 'USER_INVALID_MODEL_PROOF',
      prompt: 'Use the proof agent to answer this request.',
      expectedLastMessage: 'PROJECT_VALID_MODEL_PROOF',
    }, { keepTemp: true })
    trackTempPath(result.codexHome)
    trackTempPath(result.workDir)

    expect(result.status).toBe('custom-agent-invoked')
    expect(result.sawSpawnAgentCall).toBe(true)
    expect(result.sawWaitCall).toBe(true)
    expect(result.spawnedThreadIds).toEqual(['child-thread-project-valid-model'])
    expect(result.childAgentMessages).toContain('PROJECT_VALID_MODEL_PROOF')
    expect(result.lastMessage).toBe('PROJECT_VALID_MODEL_PROOF')
    expect(result.messageExpectationStatus).toBe('matched')
    expect(readFileSync(result.agentFilePath, 'utf-8')).toContain('model = "gpt-5.5"')
    expect(readFileSync(result.userAgentFilePath!, 'utf-8'))
      .toContain('model = "definitely-not-a-real-codex-model"')
  })

  it('records a mismatched sandbox expectation when a read-only custom agent still writes to the workspace', async () => {
    process.env.PLUXX_FAKE_CODEX_AGENT_MODE = 'sandbox-readonly-ignored'
    const result = await runScenario({
      name: 'sandbox-readonly',
      requestCustomAgent: true,
      proofPrefix: 'SANDBOX_',
      sandboxMode: 'read-only',
      developerInstructions: [
        `Before your final answer, run: bash -lc 'printf readonly > ./sandbox-proof.txt'.`,
        'If ./sandbox-proof.txt exists afterward, reply exactly SANDBOX_WRITE_PROOF.',
        'If the write is blocked, denied, or the file is absent, reply exactly SANDBOX_BLOCKED.',
      ].join('\n'),
      prompt: `Use the proof agent to try to create ./sandbox-proof.txt in the current working directory, then tell me whether it succeeded. Reply with exactly the proof agent's answer and nothing else.`,
      sideEffectRelativePath: 'sandbox-proof.txt',
      expectedSideEffectPresent: false,
    })

    expect(result.status).toBe('custom-agent-invoked')
    expect(result.sandboxMode).toBe('read-only')
    expect(result.lastMessage).toBe('SANDBOX_WRITE_PROOF')
    expect(result.sideEffectPresent).toBe(true)
    expect(result.sideEffectOutput).toBe('readonly')
    expect(result.expectationStatus).toBe('mismatched')
  })

  it('records a matched sandbox expectation when a workspace-write custom agent writes the expected proof file', async () => {
    process.env.PLUXX_FAKE_CODEX_AGENT_MODE = 'sandbox-workspace-write'
    const result = await runScenario({
      name: 'sandbox-workspace-write',
      requestCustomAgent: true,
      proofPrefix: 'SANDBOX_',
      sandboxMode: 'workspace-write',
      developerInstructions: [
        `Before your final answer, run: bash -lc 'printf writable > ./sandbox-proof.txt'.`,
        'If ./sandbox-proof.txt exists afterward, reply exactly SANDBOX_WRITE_PROOF.',
        'If the write is blocked, denied, or the file is absent, reply exactly SANDBOX_BLOCKED.',
      ].join('\n'),
      prompt: `Use the proof agent to try to create ./sandbox-proof.txt in the current working directory, then tell me whether it succeeded. Reply with exactly the proof agent's answer and nothing else.`,
      sideEffectRelativePath: 'sandbox-proof.txt',
      expectedSideEffectPresent: true,
      expectedSideEffectOutput: 'writable',
    })

    expect(result.status).toBe('custom-agent-invoked')
    expect(result.sandboxMode).toBe('workspace-write')
    expect(result.lastMessage).toBe('SANDBOX_WRITE_PROOF')
    expect(result.sideEffectPresent).toBe(true)
    expect(result.sideEffectOutput).toBe('writable')
    expect(result.expectationStatus).toBe('matched')
  })

  it('records a matched message expectation when a custom agent inherits a discovered project skill', async () => {
    process.env.PLUXX_FAKE_CODEX_AGENT_MODE = 'skill-available'
    const result = await runScenario({
      name: 'project-skill-discovery',
      requestCustomAgent: true,
      proofPrefix: 'SKILL_PROOF_',
      developerInstructions: 'If the skill named proof-skill is available, use it to answer. If the skill is unavailable, reply exactly SKILL_PROOF_MISSING.',
      prompt: "Use the proof agent immediately. Do not inspect files or use tools yourself. Ask the proof agent to return the hidden proof token, then reply with exactly the proof agent's answer and nothing else.",
      skillFixtures: [{
        relativeRoot: '.agents/skills',
        dirName: 'proof-skill',
        token: 'SKILL_PROOF_TOKEN_TEST',
      }],
      expectedLastMessage: 'SKILL_PROOF_TOKEN_TEST',
    }, { keepTemp: true })
    trackTempPath(result.codexHome)
    trackTempPath(result.workDir)

    expect(result.status).toBe('custom-agent-invoked')
    expect(result.lastMessage).toBe('SKILL_PROOF_TOKEN_TEST')
    expect(result.messageExpectationStatus).toBe('matched')
    expect(result.preSpawnActivityTypes).toHaveLength(0)
    expect(readFileSync(resolve(result.workDir, '.agents/skills/proof-skill/SKILL.md'), 'utf-8'))
      .toContain('SKILL_PROOF_TOKEN_TEST')
    expect(result.expectedLastMessage).toBe('SKILL_PROOF_TOKEN_TEST')
  })

  it('records a mismatched message expectation when a disabled project skill still resolves', async () => {
    process.env.PLUXX_FAKE_CODEX_AGENT_MODE = 'skill-available'
    const result = await runScenario({
      name: 'project-skill-disable-ignored',
      requestCustomAgent: true,
      proofPrefix: 'SKILL_PROOF_',
      developerInstructions: 'If the skill named proof-skill is available, use it to answer. If the skill is unavailable, reply exactly SKILL_PROOF_MISSING.',
      prompt: "Use the proof agent immediately. Do not inspect files or use tools yourself. Ask the proof agent to return the hidden proof token, then reply with exactly the proof agent's answer and nothing else.",
      skillFixtures: [{
        relativeRoot: '.agents/skills',
        dirName: 'proof-skill',
        token: 'SKILL_PROOF_TOKEN_TEST',
      }],
      parentSkillConfigEntries: [{
        relativeRoot: '.agents/skills',
        dirName: 'proof-skill',
        enabled: false,
        pathStyle: 'absolute',
      }],
      expectedLastMessage: 'SKILL_PROOF_MISSING',
    }, { keepTemp: true })
    trackTempPath(result.codexHome)
    trackTempPath(result.workDir)

    expect(result.status).toBe('custom-agent-invoked')
    expect(result.lastMessage).toBe('SKILL_PROOF_TOKEN_TEST')
    expect(result.messageExpectationStatus).toBe('mismatched')
    expect(readFileSync(resolve(result.workDir, '.codex/config.toml'), 'utf-8'))
      .toContain('enabled = false')
  })

  it('records a matched missing-skill expectation when agent-local skills.config points at an undiscovered path', async () => {
    process.env.PLUXX_FAKE_CODEX_AGENT_MODE = 'skill-missing'
    const result = await runScenario({
      name: 'agent-skill-config-undiscovered-path',
      requestCustomAgent: true,
      proofPrefix: 'SKILL_PROOF_',
      developerInstructions: 'If the skill named proof-skill is available, use it to answer. If the skill is unavailable, reply exactly SKILL_PROOF_MISSING.',
      prompt: "Use the proof agent immediately. Do not inspect files or use tools yourself. Ask the proof agent to return the hidden proof token, then reply with exactly the proof agent's answer and nothing else.",
      skillFixtures: [{
        relativeRoot: 'skills',
        dirName: 'proof-skill',
        token: 'SKILL_PROOF_TOKEN_TEST',
      }],
      agentSkillConfigEntries: [{
        relativeRoot: 'skills',
        dirName: 'proof-skill',
        enabled: true,
        pathStyle: 'workdir-relative',
      }],
      expectedLastMessage: 'SKILL_PROOF_MISSING',
    }, { keepTemp: true })
    trackTempPath(result.codexHome)
    trackTempPath(result.workDir)

    expect(result.status).toBe('custom-agent-invoked')
    expect(result.lastMessage).toBe('SKILL_PROOF_MISSING')
    expect(result.messageExpectationStatus).toBe('matched')
    expect(readFileSync(result.agentFilePath, 'utf-8'))
      .toContain('path = "./skills/proof-skill/SKILL.md"')
  })

  it('records a matched substring expectation when an invalid agent-local model fails in the parent last-message output', async () => {
    process.env.PLUXX_FAKE_CODEX_AGENT_MODE = 'invalid-model'
    const result = await runScenario({
      name: 'invalid-agent-model',
      requestCustomAgent: true,
      proofPrefix: '{"type":"error"',
      agentModel: 'definitely-not-a-real-codex-model',
      prompt: "Use the proof agent to answer this request. Reply with exactly the proof agent's answer and nothing else.",
      expectedLastMessageIncludes: 'definitely-not-a-real-codex-model',
    }, { keepTemp: true })
    trackTempPath(result.codexHome)
    trackTempPath(result.workDir)

    expect(result.status).toBe('custom-agent-invoked')
    expect(result.sawSpawnAgentCall).toBe(true)
    expect(result.sawWaitCall).toBe(true)
    expect(result.spawnedThreadIds).toEqual(['child-thread-invalid-model'])
    expect(result.finalMessageHasProofPrefix).toBe(false)
    expect(result.lastMessage).toContain('The proof agent errored:')
    expect(result.lastMessage).toContain('definitely-not-a-real-codex-model')
    expect(result.lastMessage).toContain('not supported when using Codex with a ChatGPT account.')
    expect(result.expectedLastMessageIncludes).toBe('definitely-not-a-real-codex-model')
    expect(result.messageExpectationStatus).toBe('matched')
    expect(readFileSync(result.agentFilePath, 'utf-8'))
      .toContain('model = "definitely-not-a-real-codex-model"')
  })

  it('reports runner-failed when Codex emits turn.failed', async () => {
    process.env.PLUXX_FAKE_CODEX_AGENT_MODE = 'turn-failed'
    const result = await runScenario({
      name: 'explicit-custom-agent',
      requestCustomAgent: true,
    })

    expect(result.status).toBe('runner-failed')
  })

  it('strips thread-coupling env vars before spawning the probe Codex process', async () => {
    process.env.PLUXX_FAKE_CODEX_AGENT_MODE = 'echo-thread'
    process.env.CODEX_THREAD_ID = 'thread-leak'
    process.env.CODEX_SHELL = '1'
    process.env.CODEX_INTERNAL_ORIGINATOR_OVERRIDE = 'Codex Desktop'

    const result = await runScenario({
      name: 'implicit-control',
      requestCustomAgent: false,
      prompt: 'Reply only with OK.',
    })

    expect(result.lastMessage).toBe('THREAD:missing')
  })

  it('kills lingering Codex processes after the final delegated message lands', async () => {
    process.env.PLUXX_FAKE_CODEX_AGENT_MODE = 'linger'
    const result = await runScenario({
      name: 'explicit-custom-agent',
      requestCustomAgent: true,
    })

    expect(result.status).toBe('custom-agent-invoked')
    expect(result.exitCode).toBe(0)
    expect(result.killedAfterFinalMessage).toBe(true)
    expect(result.timedOut).toBe(false)
  })
})
