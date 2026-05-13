import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { realpathSync } from 'fs'
import { mkdtemp, rm } from 'fs/promises'
import { dirname, relative, resolve } from 'path'
import {
  buildCodexAgentToml,
  buildDefaultDeveloperInstructions,
  buildSandboxProofDeveloperInstructions,
  buildSkillProofDeveloperInstructions,
  classifySideEffectExpectation,
  DEFAULT_AGENT_DESCRIPTION,
  DEFAULT_AGENT_NAME,
  DEFAULT_PROOF_PREFIX,
  DEFAULT_SANDBOX_MODE,
  EXPLICIT_AGENT_PROMPT,
  IMPLICIT_CONTROL_PROMPT,
  SANDBOX_PROOF_PROMPT,
  SKILL_PROOF_MISSING,
  SKILL_PROOF_PREFIX,
  SKILL_PROOF_PROMPT,
  type CodexAgentProbeExpectationStatus,
  type CodexAgentSandboxMode,
} from './codex-agent-probe-shared'
import { executeCodexExecCommand, type CodexExecRunResult } from './codex-exec-runner'
import { buildCodexProbeEnv, resolveCodexAuthSourceHome } from './codex-probe-shared'

export interface CodexAgentProbeScenario {
  name: string
  requestCustomAgent: boolean
  agentName?: string
  agentDescription?: string
  agentModel?: string
  proofPrefix?: string
  developerInstructions?: string
  sandboxMode?: CodexAgentSandboxMode
  userAgentName?: string
  userAgentDescription?: string
  userAgentModel?: string
  userProofPrefix?: string
  userSandboxMode?: CodexAgentSandboxMode
  prompt?: string
  sideEffectRelativePath?: string
  expectedSideEffectPresent?: boolean
  expectedSideEffectOutput?: string
  expectedLastMessage?: string
  expectedLastMessageIncludes?: string
  skillFixtures?: CodexAgentProbeSkillFixture[]
  parentSkillConfigEntries?: CodexAgentProbeSkillConfigEntry[]
  agentSkillConfigEntries?: CodexAgentProbeSkillConfigEntry[]
}

export interface CodexAgentProbeSkillFixture {
  relativeRoot: '.agents/skills' | 'skills'
  dirName: string
  token: string
  description?: string
}

export interface CodexAgentProbeSkillConfigEntry {
  relativeRoot: '.agents/skills' | 'skills'
  dirName: string
  enabled: boolean
  pathStyle?: 'absolute' | 'workdir-relative'
}

export type CodexAgentProbeStatus =
  | 'custom-agent-invoked'
  | 'no-custom-agent-invocation'
  | 'runner-failed'
  | 'runner-timed-out'

export interface CodexAgentProbeResult extends CodexExecRunResult {
  scenarioName: string
  requestCustomAgent: boolean
  prompt: string
  status: CodexAgentProbeStatus
  sandboxMode: CodexAgentSandboxMode
  workDir: string
  realWorkDir: string
  codexHome: string
  agentFilePath: string
  userAgentFilePath: string | null
  sawSpawnAgentCall: boolean
  sawWaitCall: boolean
  spawnedThreadIds: string[]
  childAgentMessages: string[]
  finalMessageHasProofPrefix: boolean
  preSpawnActivityTypes: string[]
  sideEffectPath: string | null
  sideEffectPresent: boolean
  sideEffectOutput: string
  expectedSideEffectPresent: boolean | null
  expectedSideEffectOutput: string | null
  expectationStatus: CodexAgentProbeExpectationStatus
  expectedLastMessage: string | null
  expectedLastMessageIncludes: string | null
  messageExpectationStatus: CodexAgentProbeExpectationStatus
}

export interface CodexAgentProbeSuiteResult {
  generatedAt: string
  codexBinary: string
  authSourceHome: string
  timeoutMs: number
  results: CodexAgentProbeResult[]
}

export interface RunCodexAgentProbeOptions {
  codexBinary?: string
  authSourceHome?: string
  timeoutMs?: number
  keepTemp?: boolean
}

const DEFAULT_TIMEOUT_MS = 45_000

interface ParsedAgentInvocation {
  sawSpawnAgentCall: boolean
  sawWaitCall: boolean
  spawnedThreadIds: string[]
  childAgentMessages: string[]
  preSpawnActivityTypes: string[]
}

export function getDefaultCodexAgentProbeScenarios(): CodexAgentProbeScenario[] {
  return [
    {
      name: 'explicit-custom-agent',
      requestCustomAgent: true,
      prompt: EXPLICIT_AGENT_PROMPT,
    },
    {
      name: 'implicit-control',
      requestCustomAgent: false,
      prompt: IMPLICIT_CONTROL_PROMPT,
    },
    {
      name: 'built-in-explorer-override',
      requestCustomAgent: true,
      agentName: 'explorer',
      agentDescription: 'Explorer override proof agent.',
      proofPrefix: 'CUSTOM_EXPLORER_OVERRIDE',
      prompt: `Use the explorer agent to answer this request. Reply with exactly the explorer agent's answer and nothing else.`,
    },
    {
      name: 'project-overrides-user-local',
      requestCustomAgent: true,
      agentName: 'proof',
      agentDescription: 'Project-local proof agent.',
      proofPrefix: 'PROJECT_AGENT_PROOF',
      userAgentName: 'proof',
      userAgentDescription: 'User-local proof agent.',
      userProofPrefix: 'USER_AGENT_PROOF',
      prompt: EXPLICIT_AGENT_PROMPT,
    },
    {
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
      prompt: EXPLICIT_AGENT_PROMPT,
      expectedLastMessage: 'PROJECT_NO_MODEL_PROOF',
    },
    {
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
      prompt: EXPLICIT_AGENT_PROMPT,
      expectedLastMessage: 'PROJECT_VALID_MODEL_PROOF',
    },
    {
      name: 'sandbox-readonly',
      requestCustomAgent: true,
      proofPrefix: 'SANDBOX_',
      developerInstructions: buildSandboxProofDeveloperInstructions('readonly'),
      sandboxMode: 'read-only',
      prompt: SANDBOX_PROOF_PROMPT,
      sideEffectRelativePath: 'sandbox-proof.txt',
      expectedSideEffectPresent: false,
    },
    {
      name: 'sandbox-workspace-write',
      requestCustomAgent: true,
      proofPrefix: 'SANDBOX_',
      developerInstructions: buildSandboxProofDeveloperInstructions('writable'),
      sandboxMode: 'workspace-write',
      prompt: SANDBOX_PROOF_PROMPT,
      sideEffectRelativePath: 'sandbox-proof.txt',
      expectedSideEffectPresent: true,
      expectedSideEffectOutput: 'writable',
    },
    {
      name: 'project-skill-discovery',
      requestCustomAgent: true,
      proofPrefix: SKILL_PROOF_PREFIX,
      developerInstructions: buildSkillProofDeveloperInstructions('proof-skill'),
      prompt: SKILL_PROOF_PROMPT,
      skillFixtures: [{
        relativeRoot: '.agents/skills',
        dirName: 'proof-skill',
        token: 'SKILL_PROOF_TOKEN_PROJECT_DISCOVERY',
      }],
      expectedLastMessage: 'SKILL_PROOF_TOKEN_PROJECT_DISCOVERY',
    },
    {
      name: 'project-skill-disable-ignored',
      requestCustomAgent: true,
      proofPrefix: SKILL_PROOF_PREFIX,
      developerInstructions: buildSkillProofDeveloperInstructions('proof-skill'),
      prompt: SKILL_PROOF_PROMPT,
      skillFixtures: [{
        relativeRoot: '.agents/skills',
        dirName: 'proof-skill',
        token: 'SKILL_PROOF_TOKEN_DISABLED_IGNORED',
      }],
      parentSkillConfigEntries: [{
        relativeRoot: '.agents/skills',
        dirName: 'proof-skill',
        enabled: false,
        pathStyle: 'absolute',
      }],
      expectedLastMessage: SKILL_PROOF_MISSING,
    },
    {
      name: 'agent-skill-config-undiscovered-path',
      requestCustomAgent: true,
      proofPrefix: SKILL_PROOF_PREFIX,
      developerInstructions: buildSkillProofDeveloperInstructions('proof-skill'),
      prompt: SKILL_PROOF_PROMPT,
      skillFixtures: [{
        relativeRoot: 'skills',
        dirName: 'proof-skill',
        token: 'SKILL_PROOF_TOKEN_UNDISCOVERED',
      }],
      agentSkillConfigEntries: [{
        relativeRoot: 'skills',
        dirName: 'proof-skill',
        enabled: true,
        pathStyle: 'workdir-relative',
      }],
      expectedLastMessage: SKILL_PROOF_MISSING,
    },
    {
      name: 'invalid-agent-model',
      requestCustomAgent: true,
      proofPrefix: '{"type":"error"',
      agentModel: 'definitely-not-a-real-codex-model',
      prompt: EXPLICIT_AGENT_PROMPT,
      expectedLastMessageIncludes: 'definitely-not-a-real-codex-model',
    },
  ]
}

export async function runCodexAgentProbeSuite(
  scenarios: CodexAgentProbeScenario[] = getDefaultCodexAgentProbeScenarios(),
  options: RunCodexAgentProbeOptions = {},
): Promise<CodexAgentProbeSuiteResult> {
  const codexBinary = options.codexBinary ?? 'codex'
  const authSourceHome = resolveCodexAuthSourceHome(options.authSourceHome)
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS
  const results: CodexAgentProbeResult[] = []

  for (const scenario of scenarios) {
    results.push(await runCodexAgentProbeScenario(scenario, {
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

async function runCodexAgentProbeScenario(
  scenario: CodexAgentProbeScenario,
  options: Required<Pick<RunCodexAgentProbeOptions, 'codexBinary' | 'authSourceHome' | 'timeoutMs'>> & Pick<RunCodexAgentProbeOptions, 'keepTemp'>,
): Promise<CodexAgentProbeResult> {
  const codexHome = await mkdtemp('/tmp/pluxx-codex-agent-probe-home-')
  const workDir = await mkdtemp('/tmp/pluxx-codex-agent-probe-work-')
  const realWorkDir = realpathSync(workDir)
  const agentName = scenario.agentName?.trim() || DEFAULT_AGENT_NAME
  const agentDescription = scenario.agentDescription?.trim() || DEFAULT_AGENT_DESCRIPTION
  const proofPrefix = scenario.proofPrefix?.trim() || DEFAULT_PROOF_PREFIX
  const developerInstructions = scenario.developerInstructions?.trim() || buildDefaultDeveloperInstructions(proofPrefix)
  const sandboxMode = scenario.sandboxMode ?? DEFAULT_SANDBOX_MODE
  const userAgentName = scenario.userAgentName?.trim() || (scenario.userProofPrefix ? agentName : '')
  const userAgentDescription = scenario.userAgentDescription?.trim() || DEFAULT_AGENT_DESCRIPTION
  const userAgentModel = scenario.userAgentModel?.trim() || undefined
  const userProofPrefix = scenario.userProofPrefix?.trim() || ''
  const userSandboxMode = scenario.userSandboxMode ?? DEFAULT_SANDBOX_MODE
  const agentFilePath = resolve(workDir, `.codex/agents/${agentName}.toml`)
  const skillFixtures = scenario.skillFixtures ?? []
  const userAgentFilePath = userProofPrefix
    ? resolve(codexHome, `agents/${userAgentName}.toml`)
    : null

  try {
    mkdirSync(resolve(workDir, '.codex/agents'), { recursive: true })
    writeSkillFixtures(workDir, skillFixtures)
    writeProjectSkillConfig(workDir, skillFixtures, scenario.parentSkillConfigEntries ?? [])

    const authPath = resolve(options.authSourceHome, 'auth.json')
    if (!existsSync(authPath)) {
      throw new Error(`Codex auth source is missing ${authPath}.`)
    }
    copyFileSync(authPath, resolve(codexHome, 'auth.json'))

    writeFileSync(agentFilePath, buildCodexAgentToml({
      agentName,
      agentDescription,
      developerInstructions,
      sandboxMode,
      model: scenario.agentModel?.trim() || undefined,
      extraTomlLines: buildSkillConfigTomlLines(workDir, skillFixtures, scenario.agentSkillConfigEntries ?? []),
    }))
    if (userAgentFilePath) {
      mkdirSync(resolve(codexHome, 'agents'), { recursive: true })
      writeFileSync(userAgentFilePath, buildCodexAgentToml({
        agentName: userAgentName,
        agentDescription: userAgentDescription,
        developerInstructions: buildDefaultDeveloperInstructions(userProofPrefix),
        sandboxMode: userSandboxMode,
        model: userAgentModel,
      }))
    }

    const prompt = scenario.prompt?.trim() || (scenario.requestCustomAgent ? EXPLICIT_AGENT_PROMPT : IMPLICIT_CONTROL_PROMPT)
    const execution = await executeCodexExecCommand([
      options.codexBinary,
      'exec',
      '--skip-git-repo-check',
      '--sandbox',
      'workspace-write',
      prompt,
    ], {
      cwd: workDir,
      timeoutMs: options.timeoutMs,
      env: buildCodexProbeEnv(codexHome),
      outputDirPrefix: 'pluxx-codex-agent-probe-last-message-',
    })

    const parsed = parseAgentInvocation(execution.stdout, proofPrefix)
    const finalMessageHasProofPrefix = execution.lastMessage.startsWith(proofPrefix)
    const sideEffectPath = scenario.sideEffectRelativePath
      ? resolve(workDir, scenario.sideEffectRelativePath)
      : null
    const sideEffectPresent = sideEffectPath ? existsSync(sideEffectPath) : false
    const sideEffectOutput = sideEffectPresent && sideEffectPath
      ? readFileSync(sideEffectPath, 'utf-8').trim()
      : ''
    const expectationStatus = classifySideEffectExpectation(
      scenario.expectedSideEffectPresent,
      scenario.expectedSideEffectOutput,
      sideEffectPresent,
      sideEffectOutput,
    )
    const messageExpectationStatus = classifyTextExpectation(
      scenario.expectedLastMessage,
      execution.lastMessage,
      scenario.expectedLastMessageIncludes,
    )

    return {
      ...execution,
      scenarioName: scenario.name,
      requestCustomAgent: scenario.requestCustomAgent,
      prompt,
      status: classifyAgentProbeStatus(execution, parsed),
      sandboxMode,
      workDir,
      realWorkDir,
      codexHome,
      agentFilePath,
      userAgentFilePath,
      sawSpawnAgentCall: parsed.sawSpawnAgentCall,
      sawWaitCall: parsed.sawWaitCall,
      spawnedThreadIds: parsed.spawnedThreadIds,
      childAgentMessages: parsed.childAgentMessages,
      finalMessageHasProofPrefix,
      preSpawnActivityTypes: parsed.preSpawnActivityTypes,
      sideEffectPath,
      sideEffectPresent,
      sideEffectOutput,
      expectedSideEffectPresent: typeof scenario.expectedSideEffectPresent === 'boolean'
        ? scenario.expectedSideEffectPresent
        : null,
      expectedSideEffectOutput: scenario.expectedSideEffectOutput ?? null,
      expectationStatus,
      expectedLastMessage: scenario.expectedLastMessage ?? null,
      expectedLastMessageIncludes: scenario.expectedLastMessageIncludes ?? null,
      messageExpectationStatus,
    }
  } finally {
    if (!options.keepTemp) {
      await rm(codexHome, { recursive: true, force: true })
      await rm(workDir, { recursive: true, force: true })
    }
  }
}

function writeSkillFixtures(
  workDir: string,
  skillFixtures: CodexAgentProbeSkillFixture[],
): void {
  for (const fixture of skillFixtures) {
    const skillPath = resolve(workDir, fixture.relativeRoot, fixture.dirName, 'SKILL.md')
    mkdirSync(dirname(skillPath), { recursive: true })
    writeFileSync(skillPath, buildProbeSkillMarkdown(fixture))
  }
}

function writeProjectSkillConfig(
  workDir: string,
  skillFixtures: CodexAgentProbeSkillFixture[],
  entries: CodexAgentProbeSkillConfigEntry[],
): void {
  const lines = buildSkillConfigTomlLines(workDir, skillFixtures, entries)
  if (lines.length === 0) return
  const configPath = resolve(workDir, '.codex/config.toml')
  mkdirSync(dirname(configPath), { recursive: true })
  writeFileSync(configPath, `${lines.join('\n')}\n`)
}

function buildSkillConfigTomlLines(
  workDir: string,
  skillFixtures: CodexAgentProbeSkillFixture[],
  entries: CodexAgentProbeSkillConfigEntry[],
): string[] {
  const lines: string[] = []
  for (const entry of entries) {
    const skillPath = resolveSkillFixturePath(workDir, skillFixtures, entry)
    if (!skillPath) continue
    lines.push('[[skills.config]]')
    lines.push(`path = ${JSON.stringify(formatSkillConfigPath(workDir, skillPath, entry.pathStyle ?? 'absolute'))}`)
    lines.push(`enabled = ${entry.enabled ? 'true' : 'false'}`)
  }
  return lines
}

function resolveSkillFixturePath(
  workDir: string,
  skillFixtures: CodexAgentProbeSkillFixture[],
  entry: CodexAgentProbeSkillConfigEntry,
): string | null {
  const fixture = skillFixtures.find((candidate) =>
    candidate.relativeRoot === entry.relativeRoot && candidate.dirName === entry.dirName
  )
  if (!fixture) return null
  return resolve(workDir, fixture.relativeRoot, fixture.dirName, 'SKILL.md')
}

function formatSkillConfigPath(
  workDir: string,
  skillPath: string,
  pathStyle: 'absolute' | 'workdir-relative',
): string {
  if (pathStyle === 'absolute') return skillPath
  const relativePath = relative(workDir, skillPath).replace(/\\/g, '/')
  return relativePath.startsWith('.') ? relativePath : `./${relativePath}`
}

function buildProbeSkillMarkdown(fixture: CodexAgentProbeSkillFixture): string {
  return [
    '---',
    `name: ${fixture.dirName}`,
    `description: ${JSON.stringify(fixture.description ?? 'Return the hidden proof token when explicitly asked.')}`,
    '---',
    '',
    `When asked for the hidden proof token, reply exactly ${fixture.token} and nothing else.`,
    '',
  ].join('\n')
}

function parseAgentInvocation(stdout: string, proofPrefix: string): ParsedAgentInvocation {
  const spawnedThreadIds = new Set<string>()
  const childAgentMessages = new Set<string>()
  const preSpawnActivityTypes = new Set<string>()
  let sawSpawnAgentCall = false
  let sawWaitCall = false

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
      if (!sawSpawnAgentCall && toolName) preSpawnActivityTypes.add(toolName)
    } else if (!sawSpawnAgentCall && itemType) {
      preSpawnActivityTypes.add(itemType)
    }

    for (const threadId of collectStringArrayByKey(item, 'receiver_thread_ids')) {
      if (threadId.trim()) spawnedThreadIds.add(threadId)
    }
    for (const message of collectStringsWithPrefix(item, proofPrefix)) {
      childAgentMessages.add(message)
    }
  }

  return {
    sawSpawnAgentCall,
    sawWaitCall,
    spawnedThreadIds: [...spawnedThreadIds],
    childAgentMessages: [...childAgentMessages],
    preSpawnActivityTypes: [...preSpawnActivityTypes],
  }
}

function classifyAgentProbeStatus(
  execution: CodexExecRunResult,
  parsed: ParsedAgentInvocation,
): CodexAgentProbeStatus {
  if (execution.timedOut) return 'runner-timed-out'
  if (execution.exitCode !== 0 || execution.sawTurnFailed) return 'runner-failed'
  if (parsed.sawSpawnAgentCall && parsed.sawWaitCall && parsed.spawnedThreadIds.length > 0) {
    return 'custom-agent-invoked'
  }
  return 'no-custom-agent-invocation'
}

function classifyTextExpectation(
  expectedValue: string | undefined,
  actualValue: string,
  expectedIncludes?: string,
): CodexAgentProbeExpectationStatus {
  if (expectedValue !== undefined) {
    return actualValue === expectedValue ? 'matched' : 'mismatched'
  }
  if (expectedIncludes !== undefined) {
    return actualValue.includes(expectedIncludes) ? 'matched' : 'mismatched'
  }
  return 'not-applicable'
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
