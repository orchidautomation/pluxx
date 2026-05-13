import { afterEach, describe, expect, it } from 'bun:test'
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { resolve } from 'path'
import { runCodexMcpProbeSuite, type CodexMcpProbeScenario } from '../src/codex-mcp-probe'

const TMP_ROOTS: string[] = []
const ORIGINAL_THREAD_ID = process.env.CODEX_THREAD_ID
const ORIGINAL_SHELL = process.env.CODEX_SHELL
const ORIGINAL_ORIGINATOR = process.env.CODEX_INTERNAL_ORIGINATOR_OVERRIDE
const ORIGINAL_FAKE_MODE = process.env.PLUXX_FAKE_CODEX_MCP_MODE

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
    delete process.env.PLUXX_FAKE_CODEX_MCP_MODE
  } else {
    process.env.PLUXX_FAKE_CODEX_MCP_MODE = ORIGINAL_FAKE_MODE
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
MODE="\${PLUXX_FAKE_CODEX_MCP_MODE:-user-root-available}"
CMD="$1"
SUB="$2"
if [ "$CMD" = "mcp" ] && [ "$SUB" = "list" ]; then
  if [ "$MODE" = "project-root-cancelled" ] || [ "$MODE" = "agent-inline-missing" ]; then
    printf 'No MCP servers configured yet. Try \`codex mcp add my-tool -- my-command\`.\\n'
  else
    printf 'Name   Command  Args      Env  Cwd  Status   Auth\\n'
    printf 'probe  node     ./server  -    -    enabled  Unsupported\\n'
  fi
  exit 0
fi
if [ "$CMD" != "exec" ]; then
  printf 'unexpected command\\n' >&2
  exit 1
fi
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
if [ "$MODE" = "user-root-available" ]; then
  printf 'initialize\\nnotifications/initialized\\ntools/list\\n' > mcp-methods.txt
  printf '{"type":"item.started","item":{"type":"mcp_tool_call","server":"probe","tool":"get_allowed_marker","status":"in_progress"}}\\n'
  printf '{"type":"item.completed","item":{"type":"mcp_tool_call","server":"probe","tool":"get_allowed_marker","status":"completed","result":{"content":[{"type":"text","text":"MCP_PROOF_MARKER_ALLOWED"}]}}}\\n'
  printf 'get_allowed_marker\\n' > mcp-proof.txt
  printf 'MCP_PROOF_MARKER_ALLOWED\\n' > "$OUT"
  printf '{"type":"item.completed","item":{"type":"agent_message","text":"MCP_PROOF_MARKER_ALLOWED"}}\\n'
  printf '{"type":"turn.completed"}\\n'
elif [ "$MODE" = "user-root-cancelled" ] || [ "$MODE" = "project-root-cancelled" ]; then
  printf 'initialize\\nnotifications/initialized\\ntools/list\\n' > mcp-methods.txt
  printf '{"type":"item.started","item":{"type":"mcp_tool_call","server":"probe","tool":"get_allowed_marker","status":"in_progress"}}\\n'
  printf '{"type":"item.completed","item":{"type":"mcp_tool_call","server":"probe","tool":"get_allowed_marker","status":"failed","error":{"message":"user cancelled MCP tool call"}}}\\n'
  printf 'user cancelled MCP tool call\\n' > "$OUT"
  printf '{"type":"item.completed","item":{"type":"agent_message","text":"user cancelled MCP tool call"}}\\n'
  printf '{"type":"turn.completed"}\\n'
elif [ "$MODE" = "agent-inline-missing" ]; then
  printf 'initialize\\nnotifications/initialized\\ntools/list\\n' > mcp-methods.txt
  printf '{"type":"item.started","item":{"type":"collab_tool_call","tool":"spawn_agent","status":"in_progress"}}\\n'
  printf '{"type":"item.completed","item":{"type":"collab_tool_call","tool":"spawn_agent","receiver_thread_ids":["child-thread-1"],"agents_states":{"child-thread-1":{"status":"pending_init","message":null}},"status":"completed"}}\\n'
  printf '{"type":"item.started","item":{"type":"collab_tool_call","tool":"wait","receiver_thread_ids":["child-thread-1"],"status":"in_progress"}}\\n'
  printf '{"type":"item.completed","item":{"type":"collab_tool_call","tool":"wait","receiver_thread_ids":["child-thread-1"],"agents_states":{"child-thread-1":{"status":"completed","message":"MCP_PROOF_MARKER_MISSING"}},"status":"completed"}}\\n'
  printf 'MCP_PROOF_MARKER_MISSING\\n' > "$OUT"
  printf '{"type":"item.completed","item":{"type":"agent_message","text":"MCP_PROOF_MARKER_MISSING"}}\\n'
  printf '{"type":"turn.completed"}\\n'
elif [ "$MODE" = "agent-approved" ]; then
  printf 'initialize\\nnotifications/initialized\\ntools/list\\n' > mcp-methods.txt
  printf '{"type":"item.started","item":{"type":"collab_tool_call","tool":"spawn_agent","status":"in_progress"}}\\n'
  printf '{"type":"item.completed","item":{"type":"collab_tool_call","tool":"spawn_agent","receiver_thread_ids":["child-thread-1"],"agents_states":{"child-thread-1":{"status":"pending_init","message":null}},"status":"completed"}}\\n'
  printf 'get_allowed_marker\\n' > mcp-proof.txt
  printf '{"type":"item.started","item":{"type":"collab_tool_call","tool":"wait","receiver_thread_ids":["child-thread-1"],"status":"in_progress"}}\\n'
  printf '{"type":"item.completed","item":{"type":"collab_tool_call","tool":"wait","receiver_thread_ids":["child-thread-1"],"agents_states":{"child-thread-1":{"status":"completed","message":"MCP_PROOF_MARKER_ALLOWED"}},"status":"completed"}}\\n'
  printf 'MCP_PROOF_MARKER_ALLOWED\\n' > "$OUT"
  printf '{"type":"item.completed","item":{"type":"agent_message","text":"MCP_PROOF_MARKER_ALLOWED"}}\\n'
  printf '{"type":"turn.completed"}\\n'
elif [ "$MODE" = "turn-failed" ]; then
  printf '{"type":"turn.failed"}\\n'
  exit 1
fi
`)
  return binary
}

async function runScenario(
  scenario: CodexMcpProbeScenario,
  options: { keepTemp?: boolean } = {},
) {
  const rootDir = makeTempDir('pluxx-codex-mcp-probe-')
  const authHome = makeAuthHome(rootDir)
  const codexBinary = makeFakeCodex(rootDir)

  const suite = await runCodexMcpProbeSuite([scenario], {
    codexBinary,
    authSourceHome: authHome,
    timeoutMs: 2000,
    keepTemp: options.keepTemp,
  })

  expect(suite.results).toHaveLength(1)
  return suite.results[0]!
}

describe('codex mcp probe', () => {
  it('records a matched MCP observation when user-configured MCP is listed and called successfully', async () => {
    process.env.PLUXX_FAKE_CODEX_MCP_MODE = 'user-root-available'
    const result = await runScenario({
      name: 'user-config-root',
      configScope: 'user',
      requestCustomAgent: false,
      expectedLastMessage: 'MCP_PROOF_MARKER_ALLOWED',
      expectedMcpCall: true,
      extraServerTomlLines: [
        '[mcp_servers.probe.tools.get_allowed_marker]',
        'approval_mode = "approve"',
      ],
    }, { keepTemp: true })
    trackTempPath(result.codexHome)
    trackTempPath(result.workDir)

    expect(result.status).toBe('mcp-observed')
    expect(result.mcpListSawServerName).toBe(true)
    expect(result.mcpCallObserved).toBe(true)
    expect(result.mcpMethodsObserved).toEqual(['initialize', 'notifications/initialized', 'tools/list'])
    expect(result.calledMcpTools).toEqual(['get_allowed_marker'])
    expect(result.sawMcpToolCallItem).toBe(true)
    expect(result.mcpToolCallTools).toEqual(['get_allowed_marker'])
    expect(result.mcpToolCallStatuses).toEqual(['in_progress', 'completed'])
    expect(result.mcpToolCallErrorMessages).toEqual([])
    expect(result.lastMessage).toBe('MCP_PROOF_MARKER_ALLOWED')
    expect(result.messageExpectationStatus).toBe('matched')
    expect(result.mcpExpectationStatus).toBe('matched')
    expect(readFileSync(result.userConfigPath!, 'utf-8')).toContain('[mcp_servers.probe]')
    expect(readFileSync(result.userConfigPath!, 'utf-8')).toContain('[mcp_servers.probe.tools.get_allowed_marker]')
    expect(readFileSync(result.userConfigPath!, 'utf-8')).toContain('approval_mode = "approve"')
  })

  it('records a cancelled MCP tool-call attempt when project config reaches startup but Codex cancels before tools/call', async () => {
    process.env.PLUXX_FAKE_CODEX_MCP_MODE = 'project-root-cancelled'
    const result = await runScenario({
      name: 'project-config-root',
      configScope: 'project',
      requestCustomAgent: false,
      expectedLastMessage: 'MCP_PROOF_MARKER_ALLOWED',
      expectedMcpCall: true,
    }, { keepTemp: true })
    trackTempPath(result.codexHome)
    trackTempPath(result.workDir)

    expect(result.status).toBe('mcp-startup-no-tool-call')
    expect(result.mcpListSawServerName).toBe(false)
    expect(result.mcpCallObserved).toBe(false)
    expect(result.mcpMethodsObserved).toEqual(['initialize', 'notifications/initialized', 'tools/list'])
    expect(result.sawMcpToolCallItem).toBe(true)
    expect(result.mcpToolCallTools).toEqual(['get_allowed_marker'])
    expect(result.mcpToolCallStatuses).toEqual(['in_progress', 'failed'])
    expect(result.mcpToolCallErrorMessages).toEqual(['user cancelled MCP tool call'])
    expect(result.lastMessage).toBe('user cancelled MCP tool call')
    expect(result.messageExpectationStatus).toBe('mismatched')
    expect(result.mcpExpectationStatus).toBe('mismatched')
    expect(readFileSync(result.projectConfigPath!, 'utf-8')).toContain('[mcp_servers.probe]')
  })

  it('records a matched MCP observation when user-configured approvals unlock root MCP calls', async () => {
    process.env.PLUXX_FAKE_CODEX_MCP_MODE = 'user-root-available'
    const result = await runScenario({
      name: 'user-config-root-approve',
      configScope: 'user',
      requestCustomAgent: false,
      expectedLastMessage: 'MCP_PROOF_MARKER_ALLOWED',
      expectedMcpCall: true,
      extraServerTomlLines: [
        '[mcp_servers.probe.tools.get_allowed_marker]',
        'approval_mode = "approve"',
      ],
    }, { keepTemp: true })
    trackTempPath(result.codexHome)
    trackTempPath(result.workDir)

    expect(result.status).toBe('mcp-observed')
    expect(result.mcpCallObserved).toBe(true)
    expect(result.sawMcpToolCallItem).toBe(true)
    expect(result.mcpToolCallStatuses).toEqual(['in_progress', 'completed'])
    expect(result.lastMessage).toBe('MCP_PROOF_MARKER_ALLOWED')
    expect(result.messageExpectationStatus).toBe('matched')
    expect(result.mcpExpectationStatus).toBe('matched')
    expect(readFileSync(result.userConfigPath!, 'utf-8')).toContain('[mcp_servers.probe.tools.get_allowed_marker]')
    expect(readFileSync(result.userConfigPath!, 'utf-8')).toContain('approval_mode = "approve"')
  })

  it('records an inline custom-agent MCP miss while still proving delegated invocation', async () => {
    process.env.PLUXX_FAKE_CODEX_MCP_MODE = 'agent-inline-missing'
    const result = await runScenario({
      name: 'agent-inline',
      configScope: 'agent-inline',
      requestCustomAgent: true,
      expectedLastMessage: 'MCP_PROOF_MARKER_ALLOWED',
      expectedMcpCall: true,
    }, { keepTemp: true })
    trackTempPath(result.codexHome)
    trackTempPath(result.workDir)

    expect(result.status).toBe('mcp-startup-no-tool-call')
    expect(result.sawSpawnAgentCall).toBe(true)
    expect(result.sawWaitCall).toBe(true)
    expect(result.spawnedThreadIds).toEqual(['child-thread-1'])
    expect(result.childAgentStatuses).toEqual(['pending_init', 'completed'])
    expect(result.childAgentMessages).toContain('MCP_PROOF_MARKER_MISSING')
    expect(result.mcpMethodsObserved).toEqual(['initialize', 'notifications/initialized', 'tools/list'])
    expect(result.mcpCallObserved).toBe(false)
    expect(result.sawMcpToolCallItem).toBe(false)
    expect(result.mcpToolCallTools).toEqual([])
    expect(result.mcpToolCallStatuses).toEqual([])
    expect(result.mcpToolCallErrorMessages).toEqual([])
    expect(result.lastMessage).toBe('MCP_PROOF_MARKER_MISSING')
    expect(result.messageExpectationStatus).toBe('mismatched')
    expect(result.mcpExpectationStatus).toBe('mismatched')
    expect(readFileSync(result.agentFilePath!, 'utf-8')).toContain('[mcp_servers.probe]')
  })

  it('records a matched inline custom-agent MCP observation when the agent-local config carries per-tool approval', async () => {
    process.env.PLUXX_FAKE_CODEX_MCP_MODE = 'agent-approved'
    const result = await runScenario({
      name: 'agent-inline-approve',
      configScope: 'agent-inline',
      requestCustomAgent: true,
      expectedLastMessage: 'MCP_PROOF_MARKER_ALLOWED',
      expectedMcpCall: true,
      extraServerTomlLines: [
        '[mcp_servers.probe.tools.get_allowed_marker]',
        'approval_mode = "approve"',
      ],
    }, { keepTemp: true })
    trackTempPath(result.codexHome)
    trackTempPath(result.workDir)

    expect(result.status).toBe('mcp-observed')
    expect(result.sawSpawnAgentCall).toBe(true)
    expect(result.sawWaitCall).toBe(true)
    expect(result.childAgentStatuses).toEqual(['pending_init', 'completed'])
    expect(result.mcpCallObserved).toBe(true)
    expect(result.sawMcpToolCallItem).toBe(false)
    expect(result.mcpToolCallTools).toEqual([])
    expect(result.mcpToolCallStatuses).toEqual([])
    expect(result.mcpToolCallErrorMessages).toEqual([])
    expect(result.lastMessage).toBe('MCP_PROOF_MARKER_ALLOWED')
    expect(result.messageExpectationStatus).toBe('matched')
    expect(result.mcpExpectationStatus).toBe('matched')
    expect(readFileSync(result.agentFilePath!, 'utf-8')).toContain('[mcp_servers.probe.tools.get_allowed_marker]')
    expect(readFileSync(result.agentFilePath!, 'utf-8')).toContain('approval_mode = "approve"')
  })

  it('records a matched delegated MCP observation when the custom agent inherits approved project-level MCP config', async () => {
    process.env.PLUXX_FAKE_CODEX_MCP_MODE = 'agent-approved'
    const result = await runScenario({
      name: 'project-config-agent-inherit-approve',
      configScope: 'project',
      requestCustomAgent: true,
      expectedLastMessage: 'MCP_PROOF_MARKER_ALLOWED',
      expectedMcpCall: true,
      extraServerTomlLines: [
        '[mcp_servers.probe.tools.get_allowed_marker]',
        'approval_mode = "approve"',
      ],
      inlineAgentMcpEnabled: false,
    }, { keepTemp: true })
    trackTempPath(result.codexHome)
    trackTempPath(result.workDir)

    expect(result.status).toBe('mcp-observed')
    expect(result.sawSpawnAgentCall).toBe(true)
    expect(result.sawWaitCall).toBe(true)
    expect(result.childAgentStatuses).toEqual(['pending_init', 'completed'])
    expect(result.mcpCallObserved).toBe(true)
    expect(result.sawMcpToolCallItem).toBe(false)
    expect(result.mcpToolCallTools).toEqual([])
    expect(result.mcpToolCallStatuses).toEqual([])
    expect(result.mcpToolCallErrorMessages).toEqual([])
    expect(result.lastMessage).toBe('MCP_PROOF_MARKER_ALLOWED')
    expect(result.messageExpectationStatus).toBe('matched')
    expect(result.mcpExpectationStatus).toBe('matched')
    expect(readFileSync(result.projectConfigPath!, 'utf-8')).toContain('[mcp_servers.probe.tools.get_allowed_marker]')
    expect(readFileSync(result.projectConfigPath!, 'utf-8')).toContain('approval_mode = "approve"')
    expect(readFileSync(result.agentFilePath!, 'utf-8')).not.toContain('[mcp_servers.probe]')
  })

  it('records the same delegated MCP success even when the custom agent explicitly sets mcp_servers = {}', async () => {
    process.env.PLUXX_FAKE_CODEX_MCP_MODE = 'agent-approved'
    const result = await runScenario({
      name: 'project-config-agent-empty-mcp-override-approve',
      configScope: 'project',
      requestCustomAgent: true,
      expectedLastMessage: 'MCP_PROOF_MARKER_ALLOWED',
      expectedMcpCall: true,
      extraServerTomlLines: [
        '[mcp_servers.probe.tools.get_allowed_marker]',
        'approval_mode = "approve"',
      ],
      inlineAgentMcpEnabled: false,
      inlineAgentExtraTomlLines: ['mcp_servers = {}'],
    }, { keepTemp: true })
    trackTempPath(result.codexHome)
    trackTempPath(result.workDir)

    expect(result.status).toBe('mcp-observed')
    expect(result.sawSpawnAgentCall).toBe(true)
    expect(result.sawWaitCall).toBe(true)
    expect(result.childAgentStatuses).toEqual(['pending_init', 'completed'])
    expect(result.mcpCallObserved).toBe(true)
    expect(result.sawMcpToolCallItem).toBe(false)
    expect(result.lastMessage).toBe('MCP_PROOF_MARKER_ALLOWED')
    expect(result.messageExpectationStatus).toBe('matched')
    expect(result.mcpExpectationStatus).toBe('matched')
    expect(readFileSync(result.projectConfigPath!, 'utf-8')).toContain('[mcp_servers.probe.tools.get_allowed_marker]')
    expect(readFileSync(result.agentFilePath!, 'utf-8')).toContain('mcp_servers = {}')
    expect(readFileSync(result.agentFilePath!, 'utf-8')).not.toContain('[mcp_servers.probe]')
  })

  it('records a matched delegated MCP observation when the custom agent inherits approved user-level MCP config', async () => {
    process.env.PLUXX_FAKE_CODEX_MCP_MODE = 'agent-approved'
    const result = await runScenario({
      name: 'user-config-agent-inherit-approve',
      configScope: 'user',
      requestCustomAgent: true,
      expectedLastMessage: 'MCP_PROOF_MARKER_ALLOWED',
      expectedMcpCall: true,
      extraServerTomlLines: [
        '[mcp_servers.probe.tools.get_allowed_marker]',
        'approval_mode = "approve"',
      ],
      inlineAgentMcpEnabled: false,
    }, { keepTemp: true })
    trackTempPath(result.codexHome)
    trackTempPath(result.workDir)

    expect(result.status).toBe('mcp-observed')
    expect(result.sawSpawnAgentCall).toBe(true)
    expect(result.sawWaitCall).toBe(true)
    expect(result.childAgentStatuses).toEqual(['pending_init', 'completed'])
    expect(result.mcpCallObserved).toBe(true)
    expect(result.sawMcpToolCallItem).toBe(false)
    expect(result.mcpToolCallTools).toEqual([])
    expect(result.mcpToolCallStatuses).toEqual([])
    expect(result.mcpToolCallErrorMessages).toEqual([])
    expect(result.lastMessage).toBe('MCP_PROOF_MARKER_ALLOWED')
    expect(result.messageExpectationStatus).toBe('matched')
    expect(result.mcpExpectationStatus).toBe('matched')
    expect(readFileSync(result.userConfigPath!, 'utf-8')).toContain('[mcp_servers.probe.tools.get_allowed_marker]')
    expect(readFileSync(result.userConfigPath!, 'utf-8')).toContain('approval_mode = "approve"')
    expect(readFileSync(result.agentFilePath!, 'utf-8')).not.toContain('[mcp_servers.probe]')
  })
})
