export type CodexAgentSandboxMode = 'read-only' | 'workspace-write' | 'danger-full-access'

export type CodexAgentProbeExpectationStatus = 'not-applicable' | 'matched' | 'mismatched'

export const DEFAULT_AGENT_NAME = 'proof'
export const DEFAULT_AGENT_DESCRIPTION = 'Proof agent.'
export const DEFAULT_PROOF_PREFIX = 'CUSTOM_AGENT_PROOF'
export const DEFAULT_SANDBOX_MODE: CodexAgentSandboxMode = 'workspace-write'
export const EXPLICIT_AGENT_PROMPT = `Use the ${DEFAULT_AGENT_NAME} agent to answer this request. Reply with exactly the ${DEFAULT_AGENT_NAME} agent's answer and nothing else.`
export const IMPLICIT_CONTROL_PROMPT = 'Reply only with OK.'
export const SANDBOX_PROOF_PROMPT = `Use the ${DEFAULT_AGENT_NAME} agent to try to create ./sandbox-proof.txt in the current working directory, then tell me whether it succeeded. Reply with exactly the ${DEFAULT_AGENT_NAME} agent's answer and nothing else.`
export const SKILL_PROOF_PREFIX = 'SKILL_PROOF_'
export const SKILL_PROOF_MISSING = 'SKILL_PROOF_MISSING'
export const SKILL_PROOF_PROMPT = `Use the ${DEFAULT_AGENT_NAME} agent immediately. Do not inspect files or use tools yourself. Ask the ${DEFAULT_AGENT_NAME} agent to return the hidden proof token, then reply with exactly the ${DEFAULT_AGENT_NAME} agent's answer and nothing else.`

export function buildCodexAgentToml(input: {
  agentName: string
  agentDescription: string
  developerInstructions: string
  sandboxMode: CodexAgentSandboxMode
  model?: string
  extraTomlLines?: string[]
}): string {
  return [
    `name = ${JSON.stringify(input.agentName)}`,
    `description = ${JSON.stringify(input.agentDescription)}`,
    'developer_instructions = """',
    input.developerInstructions,
    '"""',
    `sandbox_mode = ${JSON.stringify(input.sandboxMode)}`,
    ...(input.model ? [`model = ${JSON.stringify(input.model)}`] : []),
    ...(input.extraTomlLines ?? []),
    '',
  ].join('\n')
}

export function buildDefaultDeveloperInstructions(proofPrefix: string): string {
  return `When you are invoked, begin your final answer with ${proofPrefix} and do not omit that prefix.`
}

export function buildSandboxProofDeveloperInstructions(marker: string): string {
  return [
    `Before your final answer, run: bash -lc 'printf ${marker} > ./sandbox-proof.txt'.`,
    'If ./sandbox-proof.txt exists afterward, reply exactly SANDBOX_WRITE_PROOF.',
    'If the write is blocked, denied, or the file is absent, reply exactly SANDBOX_BLOCKED.',
  ].join('\n')
}

export function buildSkillProofDeveloperInstructions(skillName: string, missingToken: string = SKILL_PROOF_MISSING): string {
  return [
    `If the skill named ${skillName} is available, use it to answer.`,
    `If the skill is unavailable, reply exactly ${missingToken}.`,
  ].join('\n')
}

export function classifySideEffectExpectation(
  expectedPresent: boolean | undefined,
  expectedOutput: string | undefined,
  actualPresent: boolean,
  actualOutput: string,
): CodexAgentProbeExpectationStatus {
  if (typeof expectedPresent !== 'boolean') return 'not-applicable'
  if (!expectedPresent) return actualPresent ? 'mismatched' : 'matched'
  if (!actualPresent) return 'mismatched'
  if (expectedOutput === undefined) return 'matched'
  return actualOutput === expectedOutput ? 'matched' : 'mismatched'
}

export function classifyTextExpectation(
  expectedValue: string | undefined,
  actualValue: string,
): CodexAgentProbeExpectationStatus {
  if (expectedValue === undefined) return 'not-applicable'
  return actualValue === expectedValue ? 'matched' : 'mismatched'
}
