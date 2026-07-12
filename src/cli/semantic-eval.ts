import { existsSync, readFileSync } from 'fs'
import { resolve } from 'path'
import { readCanonicalAgentFiles } from '../agents'
import { readCanonicalCommandFiles } from '../commands'
import type { PluginConfig } from '../schema'
import { readCanonicalSkillFiles } from '../skills'
import type { McpScaffoldMetadata } from './init-from-mcp'

export const SEMANTIC_RUBRIC_IDS = [
  'tool-coverage',
  'routing-correctness',
  'taxonomy-coherence',
  'realistic-examples',
  'argument-guidance',
  'delegation',
  'setup-truth',
  'cross-file-consistency',
] as const

export type SemanticRubricId = typeof SEMANTIC_RUBRIC_IDS[number]

export interface SemanticCriterionResult {
  id: SemanticRubricId
  title: string
  applicable: boolean
  score?: number
  evidence: string[]
}

export interface SemanticEvalSummary {
  score: number
  warningThreshold: number
  failureThreshold: number
  criteria: SemanticCriterionResult[]
}

const DEFAULT_WARNING_THRESHOLD = 80
const DEFAULT_FAILURE_THRESHOLD = 60
const GENERIC_LINES = [
  /^use (the )?(plugin|workflow|tool)\.?$/i,
  /^follow the instructions\.?$/i,
  /^do the task\.?$/i,
  /^example request\.?$/i,
  /^todo\b/i,
  /^placeholder\b/i,
]

function clampScore(score: number): number {
  return Math.max(0, Math.min(100, Math.round(score)))
}

function ratioScore(passing: number, total: number): number {
  return total === 0 ? 100 : clampScore((passing / total) * 100)
}

function words(value: string): Set<string> {
  return new Set(
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .split(/\s+/)
      .filter(word => word.length >= 4),
  )
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function meaningfulLines(content: string): string[] {
  return content
    .split(/\r?\n/)
    .map(line => line.replace(/^\s*(?:[-*]|\d+\.)\s*/, '').trim())
    .filter(line => line.length >= 18)
    .filter(line => !line.startsWith('#'))
    .filter(line => !GENERIC_LINES.some(pattern => pattern.test(line)))
}

function normalizedBody(content: string): string {
  return meaningfulLines(content)
    .join(' ')
    .toLowerCase()
    .replace(/`[^`]+`/g, '<code>')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function readInstructions(rootDir: string, config: PluginConfig): string {
  if (!config.instructions) return ''
  const path = resolve(rootDir, config.instructions)
  return existsSync(path) ? readFileSync(path, 'utf-8') : ''
}

function requiredToolArguments(metadata: McpScaffoldMetadata | null): Array<{ tool: string, argument: string }> {
  if (!metadata) return []
  return metadata.tools.flatMap((tool) => {
    const required = Array.isArray(tool.inputSchema?.required) ? tool.inputSchema.required : []
    return required.map(argument => ({ tool: tool.name, argument }))
  })
}

export function runSemanticEvaluation(
  rootDir: string,
  config: PluginConfig,
  metadata: McpScaffoldMetadata | null,
): SemanticEvalSummary {
  const skills = readCanonicalSkillFiles(resolve(rootDir, config.skills))
  const commands = config.commands
    ? readCanonicalCommandFiles(resolve(rootDir, config.commands))
    : []
  const agents = config.agents
    ? readCanonicalAgentFiles(resolve(rootDir, config.agents))
    : []
  const instructions = readInstructions(rootDir, config)
  const migratedBaseline = Boolean(metadata && metadata.tools.length === 0)
  const minimalManualProject = !metadata && !instructions.trim() && commands.length === 0 && skills.length <= 1
  const skillNames = new Set(skills.map(skill => skill.name ?? skill.dirName))
  const authoredSkillIds = new Set(skills.flatMap(skill => [skill.dirName, skill.name].filter((value): value is string => Boolean(value))))
  const allAuthoredContent = [
    instructions,
    ...skills.map(skill => `${skill.description ?? ''}\n${skill.body}`),
    ...commands.map(command => `${command.description ?? ''}\n${command.body}`),
  ].join('\n')
  const criteria: SemanticCriterionResult[] = []

  if (metadata?.tools.length) {
    const coveredTools = new Set(
      metadata.skills
        .filter(skill => authoredSkillIds.has(skill.dirName))
        .flatMap(skill => skill.toolNames ?? []),
    )
    const missing = metadata.tools.map(tool => tool.name).filter(tool => !coveredTools.has(tool))
    criteria.push({
      id: 'tool-coverage',
      title: 'MCP tools are assigned to authored workflows',
      applicable: true,
      score: ratioScore(metadata.tools.length - missing.length, metadata.tools.length),
      evidence: missing.length === 0
        ? [`All ${metadata.tools.length} MCP tools are assigned to at least one skill.`]
        : [`Unassigned tools: ${missing.join(', ')}`],
    })
  } else {
    criteria.push({
      id: 'tool-coverage',
      title: 'MCP tools are assigned to authored workflows',
      applicable: false,
      evidence: ['No MCP tool inventory is present; manual projects are not penalized.'],
    })
  }

  const routedCommands = commands.filter(command => {
    const links = new Set([command.skill, ...command.skills].filter((value): value is string => Boolean(value)))
    return [...links].some(link => skillNames.has(link))
  })
  const routingApplicable = commands.length > 0 && (!migratedBaseline || routedCommands.length > 0)
  criteria.push({
    id: 'routing-correctness',
    title: 'Commands route to existing skills',
    applicable: routingApplicable,
    score: routingApplicable ? ratioScore(routedCommands.length, commands.length) : undefined,
    evidence: commands.length === 0
      ? ['No commands are configured.']
      : migratedBaseline && routedCommands.length === 0
        ? ['Legacy migrated commands do not carry canonical routing metadata; the migrated baseline is not penalized.']
      : [`${routedCommands.length} of ${commands.length} commands route to an existing skill.`],
  })

  const skillBodies = skills.map(skill => normalizedBody(skill.body)).filter(Boolean)
  const uniqueBodies = new Set(skillBodies)
  const descriptiveSkills = skills.filter(skill => (skill.description?.trim().length ?? 0) >= 24)
  const contradictorySkills = skills.filter((skill) => {
    const vocabulary = words(`${skill.name ?? skill.dirName} ${skill.description ?? ''}`)
    return meaningfulLines(skill.body).some(line => [...vocabulary].some(word =>
      new RegExp(`\\b(?:must not|do not|never)(?:\\s+\\w+){0,2}\\s+${escapeRegExp(word)}\\b`, 'i').test(line),
    ))
  })
  const alignedSkills = skills.length - contradictorySkills.length
  const taxonomyScore = skills.length === 0
    ? 0
    : contradictorySkills.length > 0
      ? ratioScore(alignedSkills, skills.length)
    : Math.round((
        ratioScore(uniqueBodies.size, skills.length)
        + ratioScore(descriptiveSkills.length, skills.length)
        + ratioScore(alignedSkills, skills.length)
      ) / 3)
  const minimalManualSkillValid = minimalManualProject
    && skills.length === 1
    && (skills[0]?.description?.trim().length ?? 0) >= 8
    && Boolean(skills[0]?.firstHeading)
    && !/\b(?:todo|placeholder|example skill)\b/i.test(skills[0]?.description ?? '')
  criteria.push({
    id: 'taxonomy-coherence',
    title: 'Skills form distinct, product-shaped workflows',
    applicable: !migratedBaseline,
    score: migratedBaseline ? undefined : minimalManualProject ? (minimalManualSkillValid ? 100 : 0) : taxonomyScore,
    evidence: minimalManualProject
      ? [minimalManualSkillValid
          ? 'The single manual skill has a valid identity, description, and workflow heading.'
          : 'The single manual skill is missing a meaningful identity, description, or workflow heading.']
      : migratedBaseline
      ? ['Legacy migrated content is preserved for a later refinement pass; source brevity is not scored during baseline migration.']
      : [`${uniqueBodies.size} distinct workflow bodies, ${descriptiveSkills.length} descriptive summaries, and ${alignedSkills} contradiction-free workflows across ${skills.length} skills.`],
  })

  const realisticSkills = skills.filter((skill) => {
    const lines = meaningfulLines(skill.body)
    const vocabulary = words(`${skill.name ?? skill.dirName} ${skill.description ?? ''}`)
    const hasStructuredWorkflow = /^##\s+(?:Workflow|Typical flow|What To Do|Example Requests|Usage|Process)\b/im.test(skill.body)
    return hasStructuredWorkflow
      && lines.length >= 3
      && lines.some(line => [...vocabulary].some(word => line.toLowerCase().includes(word)))
      && !contradictorySkills.includes(skill)
  })
  criteria.push({
    id: 'realistic-examples',
    title: 'Workflow guidance contains concrete, product-shaped examples',
    applicable: !migratedBaseline && !minimalManualProject && skills.length > 0,
    score: !migratedBaseline && !minimalManualProject && skills.length > 0 ? ratioScore(realisticSkills.length, skills.length) : undefined,
    evidence: minimalManualProject
      ? ['The project has no command or instruction surface on which to judge workflow examples.']
      : migratedBaseline
      ? ['Legacy migrated examples are preserved for a later refinement pass and are not scored during baseline migration.']
      : [`${realisticSkills.length} of ${skills.length} skills contain multiple concrete lines tied to their workflow vocabulary.`],
  })

  const requiredArguments = requiredToolArguments(metadata)
  const commandsWithArguments = commands.filter(command =>
    command.arguments.length > 0 || Boolean(command.argumentHint) || /\$ARGUMENTS/.test(command.body),
  )
  const documentedRequiredArguments = requiredArguments.filter(({ argument }) =>
    allAuthoredContent.toLowerCase().includes(argument.toLowerCase()),
  )
  const argumentTotal = requiredArguments.length > 0 ? requiredArguments.length : commands.length
  const argumentPassing = requiredArguments.length > 0 ? documentedRequiredArguments.length : commandsWithArguments.length
  criteria.push({
    id: 'argument-guidance',
    title: 'Required inputs are carried into workflow guidance',
    applicable: !migratedBaseline && argumentTotal > 0,
    score: !migratedBaseline && argumentTotal > 0 ? ratioScore(argumentPassing, argumentTotal) : undefined,
    evidence: migratedBaseline
      ? ['Legacy migrated command arguments are preserved for later normalization and are not scored during baseline migration.']
      : requiredArguments.length > 0
      ? [`${documentedRequiredArguments.length} of ${requiredArguments.length} required MCP arguments appear in authored guidance.`]
      : [`${commandsWithArguments.length} of ${commands.length} commands declare or consume arguments.`],
  })

  const delegatedSkills = skills.filter(skill => Boolean(skill.agent))
  const delegatedCommands = commands.filter(command => Boolean(command.agent) || command.subtask === true)
  const delegationSurfaces = delegatedSkills.length + delegatedCommands.length
  const healthyAgents = agents.filter(agent =>
    (agent.description?.trim().length ?? 0) >= 12 && meaningfulLines(agent.body).length >= 2,
  )
  const delegationApplicable = !migratedBaseline && (delegationSurfaces > 0 || Boolean(config.agents))
  const configuredAgentIds = new Set(agents.flatMap(agent => [agent.name, agent.fileStem]))
  const declaredAgentReferences = [
    ...delegatedSkills.map(skill => skill.agent).filter((value): value is string => Boolean(value)),
    ...delegatedCommands.map(command => command.agent).filter((value): value is string => Boolean(value)),
  ]
  const resolvedAgentReferences = config.agents
    ? declaredAgentReferences.filter(agent => configuredAgentIds.has(agent))
    : declaredAgentReferences
  const genericSubtasks = delegatedCommands.filter(command => command.subtask === true && !command.agent).length
  const delegationScore = !delegationApplicable
    ? undefined
    : config.agents
      ? ratioScore(
          healthyAgents.length + resolvedAgentReferences.length + genericSubtasks,
          Math.max(agents.length + declaredAgentReferences.length + genericSubtasks, 1),
        )
      : 100
  criteria.push({
    id: 'delegation',
    title: 'Delegated workflows identify their execution surface',
    applicable: delegationApplicable,
    score: delegationScore,
    evidence: migratedBaseline
      ? ['Legacy migrated agent files are preserved as source artifacts; missing frontmatter routing is not scored.']
      : config.agents
        ? [`${healthyAgents.length} of ${agents.length} configured agents are substantive; ${resolvedAgentReferences.length} of ${declaredAgentReferences.length} named delegation references resolve.`]
      : delegationSurfaces > 0
      ? [`${delegationSurfaces} skill or command surfaces declare delegation metadata.`]
      : ['No delegated workflow surface is configured; the project is not penalized.'],
  })

  const setupTerms = new Set<string>()
  for (const entry of config.userConfig ?? []) {
    setupTerms.add(entry.key)
    if (entry.envVar) setupTerms.add(entry.envVar)
  }
  for (const server of Object.values(config.mcp ?? {})) {
    if (server.auth && server.auth.type !== 'none' && 'envVar' in server.auth) setupTerms.add(server.auth.envVar)
  }
  if (metadata?.source.auth && metadata.source.auth.type !== 'none' && 'envVar' in metadata.source.auth) {
    setupTerms.add(metadata.source.auth.envVar)
  }
  const documentedSetupTerms = [...setupTerms].filter(term => allAuthoredContent.includes(term))
  criteria.push({
    id: 'setup-truth',
    title: 'Setup guidance matches configured runtime inputs',
    applicable: !migratedBaseline && setupTerms.size > 0,
    score: !migratedBaseline && setupTerms.size > 0 ? ratioScore(documentedSetupTerms.length, setupTerms.size) : undefined,
    evidence: migratedBaseline
      ? ['Legacy migrated setup identifiers remain source truth and are not scored until refinement.']
      : setupTerms.size > 0
      ? [`${documentedSetupTerms.length} of ${setupTerms.size} configured setup identifiers appear in authored guidance.`]
      : ['No configured runtime inputs require setup guidance.'],
  })

  const metadataSkillNames = new Set(metadata?.skills.map(skill => skill.dirName) ?? [])
  const authoredDirNames = new Set(skills.map(skill => skill.dirName))
  const missingAuthoredSkills = [...metadataSkillNames].filter(name => !authoredDirNames.has(name))
  const commandTargets = commands.flatMap(command => [command.skill, ...command.skills].filter((value): value is string => Boolean(value)))
  const missingCommandTargets = commandTargets.filter(name => !skillNames.has(name))
  const missingAgentTargets = config.agents
    ? declaredAgentReferences.filter(name => !configuredAgentIds.has(name))
    : []
  const configuredInstructionsMissing = config.instructions && !instructions.trim() ? 1 : 0
  const consistencyProblems = missingAuthoredSkills.length + missingCommandTargets.length + missingAgentTargets.length + configuredInstructionsMissing
  const consistencyTotal = metadataSkillNames.size + commandTargets.length + declaredAgentReferences.length + (config.instructions ? 1 : 0)
  criteria.push({
    id: 'cross-file-consistency',
    title: 'Instructions, skills, commands, and metadata agree',
    applicable: !minimalManualProject,
    score: minimalManualProject ? undefined : ratioScore(Math.max(0, consistencyTotal - consistencyProblems), consistencyTotal),
    evidence: minimalManualProject
      ? ['The minimal manual project has no cross-file routing surface to compare.']
      : consistencyProblems === 0
      ? ['Instructions are present and all metadata/command skill references resolve.']
      : [`Found ${consistencyProblems} missing or unresolved cross-file reference(s).`],
  })

  const applicable = criteria.filter(criterion => criterion.applicable && criterion.score !== undefined)
  const weights: Partial<Record<SemanticRubricId, number>> = {
    'taxonomy-coherence': 2,
    'realistic-examples': 2,
  }
  const totalWeight = applicable.reduce((sum, criterion) => sum + (weights[criterion.id] ?? 1), 0)
  const score = applicable.length === 0
    ? 100
    : clampScore(applicable.reduce(
        (sum, criterion) => sum + (criterion.score ?? 0) * (weights[criterion.id] ?? 1),
        0,
      ) / totalWeight)

  return {
    score,
    warningThreshold: config.eval?.warningThreshold ?? DEFAULT_WARNING_THRESHOLD,
    failureThreshold: config.eval?.failureThreshold ?? DEFAULT_FAILURE_THRESHOLD,
    criteria,
  }
}
