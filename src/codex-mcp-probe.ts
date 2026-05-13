import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { realpathSync } from 'fs'
import { mkdtemp, rm } from 'fs/promises'
import { spawn, spawnSync } from 'child_process'
import { dirname, resolve } from 'path'
import { buildCodexAgentToml, DEFAULT_AGENT_DESCRIPTION, DEFAULT_AGENT_NAME, DEFAULT_SANDBOX_MODE } from './codex-agent-probe-shared'
import { executeCodexExecCommand, type CodexExecRunResult } from './codex-exec-runner'
import { buildCodexProbeEnv, resolveCodexAuthSourceHome } from './codex-probe-shared'

export type CodexMcpProbeConfigScope = 'project' | 'user' | 'agent-inline'

export interface CodexMcpProbeScenario {
  name: string
  configScope: CodexMcpProbeConfigScope
  requestCustomAgent: boolean
  prompt?: string
  expectedLastMessage?: string
  expectedMcpCall?: boolean
  extraServerTomlLines?: string[]
  inlineAgentMcpEnabled?: boolean
  inlineAgentExtraServerTomlLines?: string[]
  inlineAgentExtraTomlLines?: string[]
}

export type CodexMcpProbeStatus =
  | 'mcp-observed'
  | 'mcp-startup-no-tool-call'
  | 'mcp-unavailable'
  | 'runner-failed'
  | 'runner-timed-out'

export interface CodexMcpListResult {
  exitCode: number
  stdout: string
  stderr: string
  timedOut: boolean
}

export interface CodexMcpProbeResult extends CodexExecRunResult {
  scenarioName: string
  configScope: CodexMcpProbeConfigScope
  requestCustomAgent: boolean
  prompt: string
  status: CodexMcpProbeStatus
  workDir: string
  realWorkDir: string
  codexHome: string
  projectConfigPath: string | null
  userConfigPath: string | null
  agentFilePath: string | null
  mcpServerScriptPath: string
  mcpSideEffectPath: string
  mcpMethodsLogPath: string
  mcpCallObserved: boolean
  mcpMethodsObserved: string[]
  mcpSessionObserved: boolean
  calledMcpTools: string[]
  expectedMcpCall: boolean | null
  mcpExpectationStatus: CodexMcpProbeExpectationStatus
  expectedLastMessage: string | null
  messageExpectationStatus: CodexMcpProbeExpectationStatus
  mcpListExitCode: number
  mcpListStdout: string
  mcpListStderr: string
  mcpListTimedOut: boolean
  mcpListSawServerName: boolean
  sawSpawnAgentCall: boolean
  sawWaitCall: boolean
  spawnedThreadIds: string[]
  childAgentStatuses: string[]
  childAgentMessages: string[]
  sawMcpToolCallItem: boolean
  mcpToolCallTools: string[]
  mcpToolCallStatuses: string[]
  mcpToolCallErrorMessages: string[]
}

export interface CodexMcpProbeSuiteResult {
  generatedAt: string
  codexBinary: string
  authSourceHome: string
  timeoutMs: number
  results: CodexMcpProbeResult[]
}

export interface RunCodexMcpProbeOptions {
  codexBinary?: string
  authSourceHome?: string
  timeoutMs?: number
  keepTemp?: boolean
}

type CodexMcpProbeExpectationStatus = 'not-applicable' | 'matched' | 'mismatched'

interface ParsedAgentInvocation {
  sawSpawnAgentCall: boolean
  sawWaitCall: boolean
  spawnedThreadIds: string[]
  childAgentStatuses: string[]
  childAgentMessages: string[]
  sawMcpToolCallItem: boolean
  mcpToolCallTools: string[]
  mcpToolCallStatuses: string[]
  mcpToolCallErrorMessages: string[]
}

const DEFAULT_TIMEOUT_MS = 45_000
const DEFAULT_MCP_LIST_TIMEOUT_MS = 10_000
const MCP_SERVER_NAME = 'probe'
const MCP_TOOL_NAME = 'get_allowed_marker'
const MCP_MARKER_ALLOWED = 'MCP_PROOF_MARKER_ALLOWED'
const MCP_MARKER_MISSING = 'MCP_PROOF_MARKER_MISSING'
const ROOT_MCP_PROMPT = `Call the MCP tool ${MCP_TOOL_NAME} if it is available, and reply exactly with the returned marker. If it is unavailable, reply exactly ${MCP_MARKER_MISSING}.`
const AGENT_MCP_PROMPT = `Use the ${DEFAULT_AGENT_NAME} agent immediately. The only valid answer is the exact marker returned by the ${DEFAULT_AGENT_NAME} agent after it calls its MCP tool ${MCP_TOOL_NAME}. If the tool is unavailable, the ${DEFAULT_AGENT_NAME} agent must reply exactly ${MCP_MARKER_MISSING}. Reply with exactly the ${DEFAULT_AGENT_NAME} agent's answer and nothing else.`
const APPROVE_MCP_TOOL_TOML_LINES = [
  `[mcp_servers.${MCP_SERVER_NAME}.tools.${MCP_TOOL_NAME}]`,
  'approval_mode = "approve"',
]

export function getDefaultCodexMcpProbeScenarios(): CodexMcpProbeScenario[] {
  return [
    {
      name: 'project-config-root',
      configScope: 'project',
      requestCustomAgent: false,
      prompt: ROOT_MCP_PROMPT,
      expectedLastMessage: MCP_MARKER_ALLOWED,
      expectedMcpCall: true,
    },
    {
      name: 'user-config-root',
      configScope: 'user',
      requestCustomAgent: false,
      prompt: ROOT_MCP_PROMPT,
      expectedLastMessage: MCP_MARKER_ALLOWED,
      expectedMcpCall: true,
    },
    {
      name: 'user-config-root-approve',
      configScope: 'user',
      requestCustomAgent: false,
      prompt: ROOT_MCP_PROMPT,
      expectedLastMessage: MCP_MARKER_ALLOWED,
      expectedMcpCall: true,
      extraServerTomlLines: APPROVE_MCP_TOOL_TOML_LINES,
    },
    {
      name: 'agent-inline',
      configScope: 'agent-inline',
      requestCustomAgent: true,
      prompt: AGENT_MCP_PROMPT,
      expectedLastMessage: MCP_MARKER_ALLOWED,
      expectedMcpCall: true,
    },
    {
      name: 'agent-inline-approve',
      configScope: 'agent-inline',
      requestCustomAgent: true,
      prompt: AGENT_MCP_PROMPT,
      expectedLastMessage: MCP_MARKER_ALLOWED,
      expectedMcpCall: true,
      extraServerTomlLines: APPROVE_MCP_TOOL_TOML_LINES,
    },
    {
      name: 'project-config-root-approve',
      configScope: 'project',
      requestCustomAgent: false,
      prompt: ROOT_MCP_PROMPT,
      expectedLastMessage: MCP_MARKER_ALLOWED,
      expectedMcpCall: true,
      extraServerTomlLines: APPROVE_MCP_TOOL_TOML_LINES,
    },
    {
      name: 'project-config-agent-inherit-approve',
      configScope: 'project',
      requestCustomAgent: true,
      prompt: AGENT_MCP_PROMPT,
      expectedLastMessage: MCP_MARKER_ALLOWED,
      expectedMcpCall: true,
      extraServerTomlLines: APPROVE_MCP_TOOL_TOML_LINES,
      inlineAgentMcpEnabled: false,
    },
    {
      name: 'project-config-agent-empty-mcp-override-approve',
      configScope: 'project',
      requestCustomAgent: true,
      prompt: AGENT_MCP_PROMPT,
      expectedLastMessage: MCP_MARKER_ALLOWED,
      expectedMcpCall: true,
      extraServerTomlLines: APPROVE_MCP_TOOL_TOML_LINES,
      inlineAgentMcpEnabled: false,
      inlineAgentExtraTomlLines: ['mcp_servers = {}'],
    },
    {
      name: 'user-config-agent-inherit-approve',
      configScope: 'user',
      requestCustomAgent: true,
      prompt: AGENT_MCP_PROMPT,
      expectedLastMessage: MCP_MARKER_ALLOWED,
      expectedMcpCall: true,
      extraServerTomlLines: APPROVE_MCP_TOOL_TOML_LINES,
      inlineAgentMcpEnabled: false,
    },
  ]
}

export async function runCodexMcpProbeSuite(
  scenarios: CodexMcpProbeScenario[] = getDefaultCodexMcpProbeScenarios(),
  options: RunCodexMcpProbeOptions = {},
): Promise<CodexMcpProbeSuiteResult> {
  const codexBinary = options.codexBinary ?? 'codex'
  const authSourceHome = resolveCodexAuthSourceHome(options.authSourceHome)
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS
  const results: CodexMcpProbeResult[] = []

  for (const scenario of scenarios) {
    results.push(await runCodexMcpProbeScenario(scenario, {
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

async function runCodexMcpProbeScenario(
  scenario: CodexMcpProbeScenario,
  options: Required<Pick<RunCodexMcpProbeOptions, 'codexBinary' | 'authSourceHome' | 'timeoutMs'>> & Pick<RunCodexMcpProbeOptions, 'keepTemp'>,
): Promise<CodexMcpProbeResult> {
  const codexHome = await mkdtemp('/tmp/pluxx-codex-mcp-probe-home-')
  const workDir = await mkdtemp('/tmp/pluxx-codex-mcp-probe-work-')
  const realWorkDir = realpathSync(workDir)
  const projectConfigPath = scenario.configScope === 'project'
    ? resolve(workDir, '.codex/config.toml')
    : null
  const userConfigPath = scenario.configScope === 'user'
    ? resolve(codexHome, 'config.toml')
    : null
  const agentFilePath = scenario.requestCustomAgent
    ? resolve(workDir, `.codex/agents/${DEFAULT_AGENT_NAME}.toml`)
    : null
  const mcpServerScriptPath = resolve(workDir, 'probe-mcp/server.mjs')
  const mcpSideEffectPath = resolve(workDir, 'mcp-proof.txt')
  const mcpMethodsLogPath = resolve(workDir, 'mcp-methods.txt')

  try {
    mkdirSync(resolve(workDir, '.codex'), { recursive: true })
    mkdirSync(resolve(workDir, 'probe-mcp'), { recursive: true })
    writeFileSync(mcpServerScriptPath, buildProbeMcpServerScript())
    initGitRepo(workDir)

    const authPath = resolve(options.authSourceHome, 'auth.json')
    if (!existsSync(authPath)) {
      throw new Error(`Codex auth source is missing ${authPath}.`)
    }
    copyFileSync(authPath, resolve(codexHome, 'auth.json'))

    if (projectConfigPath) {
      writeFileSync(projectConfigPath, `${buildMcpServerToml(workDir, scenario.extraServerTomlLines)}\n`)
    }
    if (userConfigPath) {
      writeFileSync(userConfigPath, `${buildMcpServerToml(workDir, scenario.extraServerTomlLines)}\n`)
    }
    if (agentFilePath) {
      mkdirSync(dirname(agentFilePath), { recursive: true })
      const inlineAgentMcpEnabled = scenario.inlineAgentMcpEnabled ?? true
      writeFileSync(agentFilePath, buildCodexAgentToml({
        agentName: DEFAULT_AGENT_NAME,
        agentDescription: DEFAULT_AGENT_DESCRIPTION,
        developerInstructions: [
          `The only acceptable success response is ${MCP_MARKER_ALLOWED}.`,
          `Get that marker by calling the MCP tool ${MCP_TOOL_NAME}.`,
          `If that tool is unavailable or you cannot call it, reply exactly ${MCP_MARKER_MISSING}.`,
        ].join('\n'),
        sandboxMode: DEFAULT_SANDBOX_MODE,
        extraTomlLines: inlineAgentMcpEnabled
          ? [
              ...buildInlineAgentMcpTomlLines(
                workDir,
                scenario.inlineAgentExtraServerTomlLines ?? scenario.extraServerTomlLines,
              ),
              ...(scenario.inlineAgentExtraTomlLines ?? []),
            ]
          : [
              ...(scenario.inlineAgentExtraTomlLines ?? []),
            ],
      }))
    }

    const env = buildCodexProbeEnv(codexHome)
    const mcpList = await runCodexMcpListCommand(
      [options.codexBinary, 'mcp', 'list'],
      { cwd: workDir, env, timeoutMs: Math.min(options.timeoutMs, DEFAULT_MCP_LIST_TIMEOUT_MS) },
    )

    const prompt = scenario.prompt?.trim() || ROOT_MCP_PROMPT
    const execution = await executeCodexExecCommand([
      options.codexBinary,
      'exec',
      '-c',
      'approval_policy="never"',
      '--skip-git-repo-check',
      '--sandbox',
      'workspace-write',
      prompt,
    ], {
      cwd: workDir,
      timeoutMs: options.timeoutMs,
      env,
      outputDirPrefix: 'pluxx-codex-mcp-probe-last-message-',
    })

    const mcpMethodsObserved = existsSync(mcpMethodsLogPath)
      ? readFileSync(mcpMethodsLogPath, 'utf-8').split(/\r?\n/).map((line) => line.trim()).filter(Boolean)
      : []
    const calledMcpTools = existsSync(mcpSideEffectPath)
      ? readFileSync(mcpSideEffectPath, 'utf-8').split(/\r?\n/).map((line) => line.trim()).filter(Boolean)
      : []
    const mcpCallObserved = calledMcpTools.length > 0
    const mcpSessionObserved = mcpMethodsObserved.length > 0
    const parsed = parseAgentInvocation(execution.stdout)
    const mcpExpectationStatus = classifyExpectation(
      typeof scenario.expectedMcpCall === 'boolean' ? String(scenario.expectedMcpCall) : undefined,
      String(mcpCallObserved),
    )
    const messageExpectationStatus = classifyExpectation(
      scenario.expectedLastMessage,
      execution.lastMessage,
    )

    return {
      ...execution,
      scenarioName: scenario.name,
      configScope: scenario.configScope,
      requestCustomAgent: scenario.requestCustomAgent,
      prompt,
      status: classifyMcpProbeStatus(execution, mcpSessionObserved, mcpCallObserved),
      workDir,
      realWorkDir,
      codexHome,
      projectConfigPath,
      userConfigPath,
      agentFilePath,
      mcpServerScriptPath,
      mcpSideEffectPath,
      mcpMethodsLogPath,
      mcpCallObserved,
      mcpMethodsObserved,
      mcpSessionObserved,
      calledMcpTools,
      expectedMcpCall: typeof scenario.expectedMcpCall === 'boolean' ? scenario.expectedMcpCall : null,
      mcpExpectationStatus,
      expectedLastMessage: scenario.expectedLastMessage ?? null,
      messageExpectationStatus,
      mcpListExitCode: mcpList.exitCode,
      mcpListStdout: mcpList.stdout,
      mcpListStderr: mcpList.stderr,
      mcpListTimedOut: mcpList.timedOut,
      mcpListSawServerName: mcpList.stdout.includes(MCP_SERVER_NAME),
      sawSpawnAgentCall: parsed.sawSpawnAgentCall,
      sawWaitCall: parsed.sawWaitCall,
      spawnedThreadIds: parsed.spawnedThreadIds,
      childAgentStatuses: parsed.childAgentStatuses,
      childAgentMessages: parsed.childAgentMessages,
      sawMcpToolCallItem: parsed.sawMcpToolCallItem,
      mcpToolCallTools: parsed.mcpToolCallTools,
      mcpToolCallStatuses: parsed.mcpToolCallStatuses,
      mcpToolCallErrorMessages: parsed.mcpToolCallErrorMessages,
    }
  } finally {
    if (!options.keepTemp) {
      await rm(codexHome, { recursive: true, force: true })
      await rm(workDir, { recursive: true, force: true })
    }
  }
}

function buildProbeMcpServerScript(): string {
  return [
    "import * as readline from 'node:readline'",
    "import { appendFileSync } from 'node:fs'",
    "import { resolve } from 'node:path'",
    '',
    "const proofPath = resolve(process.cwd(), 'mcp-proof.txt')",
    "const methodsPath = resolve(process.cwd(), 'mcp-methods.txt')",
    "const rl = readline.createInterface({ input: process.stdin, crlfDelay: Infinity })",
    '',
    'function send(message) {',
    "  process.stdout.write(JSON.stringify(message) + '\\n')",
    '}',
    '',
    "rl.on('line', (line) => {",
    '  const message = JSON.parse(line)',
    "  if (typeof message.method === 'string') {",
    "    appendFileSync(methodsPath, String(message.method) + '\\n')",
    '  }',
    '',
    "  if (message.method === 'initialize') {",
    '    send({',
    "      jsonrpc: '2.0',",
    '      id: message.id,',
    '      result: {',
    "        protocolVersion: '2025-03-26',",
    '        capabilities: {',
    '          tools: { listChanged: false },',
    '        },',
    '        serverInfo: {',
    `          name: ${JSON.stringify(MCP_SERVER_NAME)},`,
    "          version: '1.0.0',",
    '        },',
    '      },',
    '    })',
    '    return',
    '  }',
    '',
    "  if (message.method === 'notifications/initialized') return",
    '',
    "  if (message.method === 'tools/list') {",
    '    send({',
    "      jsonrpc: '2.0',",
    '      id: message.id,',
    '      result: {',
    '        tools: [{',
    `          name: ${JSON.stringify(MCP_TOOL_NAME)},`,
    "          description: 'Return the harmless proof marker.',",
    "          inputSchema: {",
    "            type: 'object',",
    "            properties: {},",
    "            additionalProperties: false,",
    '          },',
    '        }],',
    '      },',
    '    })',
    '    return',
    '  }',
    '',
    "  if (message.method === 'tools/call') {",
    "    const name = message.params?.name ?? 'unknown'",
    "    appendFileSync(proofPath, String(name) + '\\n')",
    '    send({',
    "      jsonrpc: '2.0',",
    '      id: message.id,',
    '      result: {',
    '        content: [{',
    "          type: 'text',",
    `          text: ${JSON.stringify(MCP_MARKER_ALLOWED)},`,
    '        }],',
    '      },',
    '    })',
    '  }',
    '})',
    '',
  ].join('\n')
}

function buildMcpServerToml(workDir: string, extraTomlLines: string[] = []): string {
  return [
    `[mcp_servers.${MCP_SERVER_NAME}]`,
    'command = "node"',
    `args = [${JSON.stringify(resolve(workDir, 'probe-mcp/server.mjs'))}]`,
    ...extraTomlLines,
  ].join('\n')
}

function buildInlineAgentMcpTomlLines(workDir: string, extraTomlLines: string[] = []): string[] {
  return buildMcpServerToml(workDir, extraTomlLines).split('\n')
}

function initGitRepo(workDir: string): void {
  const result = spawnSync('git', ['init', '-q'], {
    cwd: workDir,
    stdio: 'pipe',
  })
  if (result.status !== 0) {
    throw new Error(`Failed to initialize temporary git repo for Codex MCP probe: ${result.stderr?.toString('utf-8') || 'unknown git error'}`)
  }
}

async function runCodexMcpListCommand(
  command: string[],
  options: { cwd: string; env: NodeJS.ProcessEnv; timeoutMs: number },
): Promise<CodexMcpListResult> {
  return await new Promise((resolvePromise, reject) => {
    const child = spawn(command[0], command.slice(1), {
      cwd: options.cwd,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: options.env,
    })

    const stdoutChunks: Buffer[] = []
    const stderrChunks: Buffer[] = []
    let settled = false
    let timedOut = false
    const timeout = setTimeout(() => {
      timedOut = true
      try {
        child.kill('SIGKILL')
      } catch {
        // Ignore kill errors after exit.
      }
    }, options.timeoutMs)

    child.stdout?.on('data', (chunk) => stdoutChunks.push(Buffer.from(chunk)))
    child.stderr?.on('data', (chunk) => stderrChunks.push(Buffer.from(chunk)))
    child.on('error', (error) => {
      if (settled) return
      settled = true
      clearTimeout(timeout)
      reject(error)
    })
    child.on('close', (code) => {
      if (settled) return
      settled = true
      clearTimeout(timeout)
      resolvePromise({
        exitCode: timedOut ? 124 : (code ?? 1),
        stdout: Buffer.concat(stdoutChunks).toString('utf-8'),
        stderr: Buffer.concat(stderrChunks).toString('utf-8'),
        timedOut,
      })
    })
  })
}

function classifyMcpProbeStatus(
  execution: CodexExecRunResult,
  mcpSessionObserved: boolean,
  mcpCallObserved: boolean,
): CodexMcpProbeStatus {
  if (execution.timedOut) return 'runner-timed-out'
  if (execution.exitCode !== 0 || execution.sawTurnFailed) return 'runner-failed'
  if (mcpCallObserved && execution.lastMessage === MCP_MARKER_ALLOWED) return 'mcp-observed'
  if (mcpSessionObserved) return 'mcp-startup-no-tool-call'
  return 'mcp-unavailable'
}

function classifyExpectation(
  expectedValue: string | undefined,
  actualValue: string,
): CodexMcpProbeExpectationStatus {
  if (expectedValue === undefined) return 'not-applicable'
  return expectedValue === actualValue ? 'matched' : 'mismatched'
}

function parseAgentInvocation(stdout: string): ParsedAgentInvocation {
  const spawnedThreadIds = new Set<string>()
  const childAgentStatuses = new Set<string>()
  const childAgentMessages = new Set<string>()
  const mcpToolCallTools = new Set<string>()
  const mcpToolCallStatuses = new Set<string>()
  const mcpToolCallErrorMessages = new Set<string>()
  let sawSpawnAgentCall = false
  let sawWaitCall = false
  let sawMcpToolCallItem = false

  for (const line of stdout.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed) continue

    let event: unknown
    try {
      event = JSON.parse(trimmed)
    } catch {
      continue
    }

    if (!event || typeof event !== 'object') continue
    const item = readRecordProperty(event, 'item')
    if (!item) continue
    const itemType = readStringProperty(item, 'type')
    if (itemType === 'collab_tool_call') {
      const toolName = findToolName(item)
      if (toolName === 'spawn_agent') sawSpawnAgentCall = true
      if (toolName === 'wait') sawWaitCall = true
    }
    if (itemType === 'mcp_tool_call') {
      sawMcpToolCallItem = true
      const toolName = findToolName(item)
      if (toolName) mcpToolCallTools.add(toolName)
      const status = readStringProperty(item, 'status')
      if (status) mcpToolCallStatuses.add(status)
      const errorMessage = readNestedStringProperty(item, ['error', 'message'])
      if (errorMessage) mcpToolCallErrorMessages.add(errorMessage)
    }

    for (const threadId of collectStringArrayByKey(item, 'receiver_thread_ids')) {
      if (threadId.trim()) spawnedThreadIds.add(threadId)
    }
    for (const agentsStates of collectNestedValuesByKey(item, 'agents_states')) {
      for (const status of collectStringsByExactKey(agentsStates, 'status')) {
        if (status.trim()) childAgentStatuses.add(status)
      }
    }
    for (const message of collectStringsWithPrefix(item, 'MCP_PROOF_MARKER_')) {
      childAgentMessages.add(message)
    }
  }

  return {
    sawSpawnAgentCall,
    sawWaitCall,
    spawnedThreadIds: [...spawnedThreadIds],
    childAgentStatuses: [...childAgentStatuses],
    childAgentMessages: [...childAgentMessages],
    sawMcpToolCallItem,
    mcpToolCallTools: [...mcpToolCallTools],
    mcpToolCallStatuses: [...mcpToolCallStatuses],
    mcpToolCallErrorMessages: [...mcpToolCallErrorMessages],
  }
}

function readRecordProperty(value: unknown, key: string): Record<string, unknown> | null {
  if (!value || typeof value !== 'object') return null
  const record = value as Record<string, unknown>
  const property = record[key]
  return property && typeof property === 'object' ? property as Record<string, unknown> : null
}

function readStringProperty(value: unknown, key: string): string | null {
  if (!value || typeof value !== 'object') return null
  const property = (value as Record<string, unknown>)[key]
  return typeof property === 'string' ? property : null
}

function readNestedStringProperty(value: unknown, path: string[]): string | null {
  let current: unknown = value
  for (const key of path) {
    if (!current || typeof current !== 'object') return null
    current = (current as Record<string, unknown>)[key]
  }
  return typeof current === 'string' ? current : null
}

function findToolName(value: unknown): string | null {
  if (!value || typeof value !== 'object') return null
  const record = value as Record<string, unknown>
  for (const key of ['tool', 'tool_name', 'toolName', 'name'] as const) {
    const property = record[key]
    if (typeof property === 'string' && property.length > 0) return property
  }
  for (const nestedKey of ['call', 'payload', 'raw_item', 'output'] as const) {
    const nested = record[nestedKey]
    if (!nested || typeof nested !== 'object') continue
    const candidate = findToolName(nested)
    if (candidate) return candidate
  }
  return null
}

function collectStringArrayByKey(value: unknown, key: string): string[] {
  const results: string[] = []
  collectStringArrayByKeyInto(value, key, results)
  return results
}

function collectStringArrayByKeyInto(value: unknown, key: string, results: string[]): void {
  if (!value || typeof value !== 'object') return
  if (Array.isArray(value)) {
    for (const entry of value) {
      collectStringArrayByKeyInto(entry, key, results)
    }
    return
  }

  const record = value as Record<string, unknown>
  const property = record[key]
  if (Array.isArray(property)) {
    for (const entry of property) {
      if (typeof entry === 'string') results.push(entry)
    }
  }

  for (const nested of Object.values(record)) {
    collectStringArrayByKeyInto(nested, key, results)
  }
}

function collectNestedValuesByKey(value: unknown, key: string): unknown[] {
  const results: unknown[] = []
  collectNestedValuesByKeyInto(value, key, results)
  return results
}

function collectNestedValuesByKeyInto(value: unknown, key: string, results: unknown[]): void {
  if (!value || typeof value !== 'object') return
  if (Array.isArray(value)) {
    for (const entry of value) {
      collectNestedValuesByKeyInto(entry, key, results)
    }
    return
  }

  const record = value as Record<string, unknown>
  if (key in record) results.push(record[key])
  for (const nested of Object.values(record)) {
    collectNestedValuesByKeyInto(nested, key, results)
  }
}

function collectStringsByExactKey(value: unknown, key: string): string[] {
  const results: string[] = []
  collectStringsByExactKeyInto(value, key, results)
  return results
}

function collectStringsByExactKeyInto(value: unknown, key: string, results: string[]): void {
  if (!value || typeof value !== 'object') return
  if (Array.isArray(value)) {
    for (const entry of value) {
      collectStringsByExactKeyInto(entry, key, results)
    }
    return
  }

  const record = value as Record<string, unknown>
  const property = record[key]
  if (typeof property === 'string') results.push(property)
  for (const nested of Object.values(record)) {
    collectStringsByExactKeyInto(nested, key, results)
  }
}

function collectStringsWithPrefix(value: unknown, prefix: string): string[] {
  const results: string[] = []
  collectStringsWithPrefixInto(value, prefix, results)
  return results
}

function collectStringsWithPrefixInto(value: unknown, prefix: string, results: string[]): void {
  if (typeof value === 'string') {
    if (value.startsWith(prefix)) results.push(value)
    return
  }
  if (!value || typeof value !== 'object') return
  if (Array.isArray(value)) {
    for (const entry of value) {
      collectStringsWithPrefixInto(entry, prefix, results)
    }
    return
  }

  for (const nested of Object.values(value as Record<string, unknown>)) {
    collectStringsWithPrefixInto(nested, prefix, results)
  }
}
