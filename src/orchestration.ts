import { z } from 'zod'
import { ProofTierSchema } from './proof-freshness'

const IdentifierSchema = z.string().min(1).max(128).regex(/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/, 'Use a kebab-case identifier.')
const ReferenceSchema = IdentifierSchema
const ReferenceListSchema = z.array(ReferenceSchema).superRefine((references, ctx) => {
  const seen = new Set<string>()
  references.forEach((reference, index) => {
    if (seen.has(reference)) ctx.addIssue({ code: z.ZodIssueCode.custom, path: [index], message: `Duplicate reference "${reference}".` })
    seen.add(reference)
  })
}).default([])
const PositiveBoundSchema = z.number().int().positive()
const NonNegativeBoundSchema = z.number().int().nonnegative()

const ActivationTriggerSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('intent'), intent: IdentifierSchema }).strict(),
  z.object({ type: z.literal('manual') }).strict(),
  z.object({
    type: z.literal('lifecycle'),
    events: z.array(z.enum(['session-start', 'session-clear', 'context-compaction', 'workflow-resume'])).min(1),
  }).strict(),
])

export const OrchestrationActivationSchema = z.object({
  id: IdentifierSchema,
  trigger: ActivationTriggerSchema,
  workflow: ReferenceSchema,
  entryNode: ReferenceSchema,
  guarantee: z.enum(['required', 'best-effort']),
  authorization: z.enum(['user-authorized', 'policy-authorized', 'implicit']),
  conditions: z.array(IdentifierSchema).optional(),
  reentry: z.object({
    reinject: z.boolean(),
    idempotencyKey: ReferenceSchema,
    maxApplicationsPerEvent: PositiveBoundSchema,
  }).strict().optional(),
}).strict()

export const OrchestrationRoleSchema = z.object({
  id: IdentifierSchema,
  prompt: z.object({
    kind: z.enum(['skill-support', 'standalone-agent']),
    ref: ReferenceSchema,
  }).strict(),
  binding: z.discriminatedUnion('kind', [
    z.object({ kind: z.literal('generic-dispatch') }).strict(),
    z.object({ kind: z.literal('standalone-agent'), ref: ReferenceSchema }).strict(),
  ]),
  required: z.boolean().default(true),
  modelTier: IdentifierSchema.optional(),
  inputs: ReferenceListSchema,
  outputs: ReferenceListSchema,
}).strict()

const ContextItemSchema = z.object({
  source: z.enum(['artifact', 'state', 'instruction', 'dispatch-input']),
  ref: ReferenceSchema,
}).strict()

export const OrchestrationContextSchema = z.object({
  id: IdentifierSchema,
  items: z.array(ContextItemSchema).min(1),
  limits: z.object({
    maxItems: PositiveBoundSchema,
    maxBytes: PositiveBoundSchema,
  }).strict(),
}).strict()

const OwnershipSchema = z.object({
  mode: z.enum(['shared', 'exclusive']),
  ownerRole: ReferenceSchema.optional(),
  paths: z.array(z.string().min(1).max(512)).default([]),
}).strict().superRefine((ownership, ctx) => {
  if (ownership.mode === 'exclusive' && !ownership.ownerRole) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['ownerRole'], message: 'Exclusive ownership requires an owner role.' })
  }
})

export const OrchestrationArtifactSchema = z.object({
  id: IdentifierSchema,
  kind: z.enum(['document', 'report', 'json', 'directory', 'file', 'diff', 'ledger', 'checkpoint', 'generic']),
  producer: ReferenceSchema,
  consumers: ReferenceListSchema,
  durability: z.enum(['ephemeral', 'workflow', 'durable']),
  authoritativeForCompletion: z.boolean().default(false),
  ownership: OwnershipSchema,
  cleanup: z.object({
    policy: z.enum(['retain', 'on-completion', 'on-cancel', 'always']),
    ownerRole: ReferenceSchema.optional(),
  }).strict().optional(),
}).strict()

export const OrchestrationStateSchema = z.object({
  id: IdentifierSchema,
  kind: z.enum(['progress-ledger', 'checkpoint', 'shared-resource', 'generic']),
  producer: ReferenceSchema,
  consumers: ReferenceListSchema,
  durability: z.enum(['ephemeral', 'workflow', 'durable']),
  idempotencyKey: ReferenceSchema.optional(),
}).strict()

export const OrchestrationGateSchema = z.object({
  id: IdentifierSchema,
  kind: z.enum(['validation', 'review', 'approval', 'artifact']),
  required: z.boolean().default(true),
  evidence: z.object({
    artifacts: ReferenceListSchema,
    states: ReferenceListSchema,
  }).strict(),
}).strict()

const DispatchPolicySchema = z.object({
  maxParallel: PositiveBoundSchema,
  maxBatch: PositiveBoundSchema,
  maxDelegationDepth: NonNegativeBoundSchema,
  maxRetries: NonNegativeBoundSchema,
  maxRepairs: NonNegativeBoundSchema,
  isolation: z.enum(['shared', 'workspace', 'process']),
}).strict()

function inheritanceListSchema<T extends z.ZodTypeAny>(itemSchema: T) {
  return z.object({
    mode: z.enum(['inherit', 'override']),
    required: z.array(itemSchema),
  }).strict()
}

const InheritanceListSchema = inheritanceListSchema(IdentifierSchema)
const ConfiguredInheritanceListSchema = inheritanceListSchema(
  z.string().min(1).max(128).regex(/^[A-Za-z0-9._-]+$/, 'Use a configured reference identifier.'),
)
const PermissionInheritanceSchema = inheritanceListSchema(z.string().min(1).max(512))

const CredentialRequirementSchema = z.object({
  ref: ReferenceSchema,
  availability: z.enum(['required', 'optional']),
}).strict()

export const OrchestrationChildEnvironmentSchema = z.object({
  authorizationGate: ReferenceSchema.optional(),
  dimensions: z.object({
    capabilities: InheritanceListSchema,
    tools: InheritanceListSchema.default({ mode: 'inherit', required: [] }),
    mcp: ConfiguredInheritanceListSchema,
    permissions: PermissionInheritanceSchema,
    sandbox: z.object({
      mode: z.enum(['inherit', 'override']),
      minimum: z.enum(['read-only', 'workspace-write', 'unrestricted']),
    }).strict(),
    credentials: z.object({
      mode: z.enum(['inherit', 'override']),
      requirements: z.array(CredentialRequirementSchema),
    }).strict(),
  }).strict(),
  budgets: z.object({
    maxDelegationDepth: NonNegativeBoundSchema,
    maxParallel: PositiveBoundSchema,
    maxRetries: NonNegativeBoundSchema,
    maxRepairs: NonNegativeBoundSchema,
  }).strict(),
}).strict()

const NodeBase = {
  id: IdentifierSchema,
  required: z.boolean().default(true),
}

const DispatchNodeSchema = z.object({
  ...NodeBase,
  type: z.literal('dispatch'),
  role: ReferenceSchema,
  context: ReferenceSchema.optional(),
  inputs: ReferenceListSchema,
  outputs: ReferenceListSchema,
  policy: DispatchPolicySchema,
  childEnvironment: OrchestrationChildEnvironmentSchema.optional(),
}).strict()

const StateNodeSchema = z.object({ ...NodeBase, type: z.literal('state'), produces: ReferenceListSchema }).strict()
const GateNodeSchema = z.object({ ...NodeBase, type: z.literal('gate'), gate: ReferenceSchema }).strict()
const BarrierNodeSchema = z.object({
  ...NodeBase,
  type: z.literal('barrier'),
  waitForNodes: z.array(ReferenceSchema).min(1),
  artifacts: ReferenceListSchema,
  states: ReferenceListSchema,
}).strict()

const WaitConditionSchema = z.object({
  mode: z.enum(['all', 'any']),
  artifacts: ReferenceListSchema,
  states: ReferenceListSchema,
  gates: ReferenceListSchema,
}).strict().superRefine((condition, ctx) => {
  if (condition.artifacts.length + condition.states.length + condition.gates.length === 0) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'WAIT requires at least one artifact, state, or gate condition.' })
  }
})

const WaitNodeSchema = z.object({
  ...NodeBase,
  type: z.literal('wait'),
  condition: WaitConditionSchema,
  timeoutMs: PositiveBoundSchema,
  onTimeout: z.discriminatedUnion('action', [
    z.object({ action: z.literal('fail') }).strict(),
    z.object({ action: z.literal('repair'), targetNode: ReferenceSchema }).strict(),
    z.object({ action: z.literal('fallback'), targetNode: ReferenceSchema }).strict(),
  ]),
}).strict()

const RepairNodeSchema = z.object({
  ...NodeBase,
  type: z.literal('repair'),
  targetNode: ReferenceSchema,
  targetArtifact: ReferenceSchema.optional(),
  role: ReferenceSchema.optional(),
  context: ReferenceSchema.optional(),
  maxAttempts: PositiveBoundSchema,
  resumeNode: ReferenceSchema,
}).strict()

const SynthesisNodeSchema = z.object({
  ...NodeBase,
  type: z.literal('synthesis'),
  role: ReferenceSchema.optional(),
  inputs: ReferenceListSchema,
  output: ReferenceSchema.optional(),
}).strict()

const CompletionNodeSchema = z.object({
  ...NodeBase,
  type: z.literal('completion'),
  ownerRole: ReferenceSchema.optional(),
  status: z.enum(['succeeded', 'failed', 'cancelled']),
  requires: z.object({
    artifacts: ReferenceListSchema,
    states: ReferenceListSchema,
    gates: ReferenceListSchema,
  }).strict(),
}).strict()

export const OrchestrationNodeSchema = z.discriminatedUnion('type', [
  DispatchNodeSchema,
  StateNodeSchema,
  GateNodeSchema,
  BarrierNodeSchema,
  WaitNodeSchema,
  RepairNodeSchema,
  SynthesisNodeSchema,
  CompletionNodeSchema,
])

export const OrchestrationWorkflowSchema = z.object({
  id: IdentifierSchema,
  mode: z.enum(['interactive', 'headless', 'pipeline', 'autonomous', 'return-to-caller']),
  entryNodes: z.array(ReferenceSchema).min(1),
  requiredGates: ReferenceListSchema,
  completionOwners: z.array(ReferenceSchema).min(1),
  cancellation: z.discriminatedUnion('action', [
    z.object({ action: z.literal('fail') }).strict(),
    z.object({ action: z.literal('cleanup'), cleanupArtifacts: z.array(ReferenceSchema).min(1) }).strict(),
    z.object({
      action: z.literal('checkpoint'),
      checkpointState: ReferenceSchema,
      cleanupArtifacts: ReferenceListSchema,
    }).strict(),
  ]),
  fallbacks: z.array(z.object({
    when: IdentifierSchema,
    fromNode: ReferenceSchema,
    targetNode: ReferenceSchema,
    maxUses: PositiveBoundSchema,
  }).strict()).default([]),
  proof: z.object({
    requiredTier: ProofTierSchema,
    validators: z.array(z.object({ id: IdentifierSchema, gate: ReferenceSchema.optional() }).strict()).min(1),
  }).strict(),
  nodes: z.array(OrchestrationNodeSchema).min(1),
  edges: z.array(z.object({ from: ReferenceSchema, to: ReferenceSchema, when: IdentifierSchema.optional() }).strict()),
}).strict()

const OrchestrationShapeSchema = z.object({
  version: z.literal(1),
  activations: z.array(OrchestrationActivationSchema).min(1),
  roles: z.array(OrchestrationRoleSchema),
  contexts: z.array(OrchestrationContextSchema),
  artifacts: z.array(OrchestrationArtifactSchema),
  states: z.array(OrchestrationStateSchema),
  gates: z.array(OrchestrationGateSchema),
  resume: z.object({
    ledgerState: ReferenceSchema,
    checkpointState: ReferenceSchema.optional(),
    dedupeKey: ReferenceSchema,
    onMissing: z.enum(['restart', 'fail']),
  }).strict().optional(),
  workflows: z.array(OrchestrationWorkflowSchema).min(1),
}).strict()

type IssueContext = z.RefinementCtx

function addReferenceIssue(ctx: IssueContext, path: (string | number)[], kind: string, ref: string): void {
  ctx.addIssue({ code: z.ZodIssueCode.custom, path, message: `Unknown ${kind} reference "${ref}".` })
}

function checkUnique<T extends { id: string }>(items: T[], path: (string | number)[], ctx: IssueContext): void {
  const seen = new Set<string>()
  items.forEach((item, index) => {
    if (seen.has(item.id)) ctx.addIssue({ code: z.ZodIssueCode.custom, path: [...path, index, 'id'], message: `Duplicate identifier "${item.id}".` })
    seen.add(item.id)
  })
}

function workflowControlEdges(workflow: z.infer<typeof OrchestrationWorkflowSchema>): Array<{ from: string; to: string }> {
  return [
    ...workflow.edges,
    ...workflow.fallbacks.map((fallback) => ({ from: fallback.fromNode, to: fallback.targetNode })),
    ...workflow.nodes.flatMap((node) => {
      if (node.type === 'wait' && node.onTimeout.action !== 'fail') return [{ from: node.id, to: node.onTimeout.targetNode }]
      if (node.type === 'repair') return [{ from: node.id, to: node.resumeNode }]
      return []
    }),
  ]
}

interface WorkflowGraphContext {
  reachable: (entries: string[], excluded?: Set<string>) => Set<string>
}

function createWorkflowGraphContext(workflow: z.infer<typeof OrchestrationWorkflowSchema>): WorkflowGraphContext {
  const adjacency = new Map<string, string[]>()
  for (const edge of workflowControlEdges(workflow)) {
    const targets = adjacency.get(edge.from) ?? []
    targets.push(edge.to)
    adjacency.set(edge.from, targets)
  }
  const cache = new Map<string, Set<string>>()
  return {
    reachable(entries, excluded = new Set<string>()) {
      const cacheKey = excluded.size === 0 ? entries.join('\0') : undefined
      const cached = cacheKey === undefined ? undefined : cache.get(cacheKey)
      if (cached) return cached
      const reachable = new Set<string>()
      const queue = entries.filter((entry) => !excluded.has(entry))
      for (let head = 0; head < queue.length; head += 1) {
        const current = queue[head]
        if (reachable.has(current) || excluded.has(current)) continue
        reachable.add(current)
        for (const target of adjacency.get(current) ?? []) if (!reachable.has(target)) queue.push(target)
      }
      if (cacheKey !== undefined) cache.set(cacheKey, reachable)
      return reachable
    },
  }
}

function getNodeRoleIds(node: OrchestrationNode): string[] {
  if (node.type === 'dispatch') return [node.role]
  if ((node.type === 'repair' || node.type === 'synthesis') && node.role) return [node.role]
  if (node.type === 'completion' && node.ownerRole) return [node.ownerRole]
  return []
}

function nodeConsumesArtifact(node: OrchestrationNode, artifactId: string, gates: Map<string, OrchestrationGate>): boolean {
  if (node.type === 'dispatch') return node.inputs.includes(artifactId)
  if (node.type === 'gate') return gates.get(node.gate)?.evidence.artifacts.includes(artifactId) ?? false
  if (node.type === 'barrier') return node.artifacts.includes(artifactId)
  if (node.type === 'wait') return node.condition.artifacts.includes(artifactId)
  if (node.type === 'repair') return node.targetArtifact === artifactId
  if (node.type === 'synthesis') return node.inputs.includes(artifactId)
  if (node.type === 'completion') return node.requires.artifacts.includes(artifactId)
  return false
}

function nodeConsumesState(node: OrchestrationNode, stateId: string, gates: Map<string, OrchestrationGate>): boolean {
  if (node.type === 'dispatch') return node.inputs.includes(stateId)
  if (node.type === 'gate') return gates.get(node.gate)?.evidence.states.includes(stateId) ?? false
  if (node.type === 'barrier') return node.states.includes(stateId)
  if (node.type === 'wait') return node.condition.states.includes(stateId)
  if (node.type === 'completion') return node.requires.states.includes(stateId)
  return false
}

function sameReferences(actual: string[], expected: string[]): boolean {
  return actual.length === expected.length && actual.every((ref) => expected.includes(ref))
}

function normalizeOwnershipPath(path: string): string | undefined {
  if (path.startsWith('/') || path.includes('\\')) return undefined
  const segments = path.split('/')
  if (segments.some((segment) => segment === '' || segment === '.' || segment === '..')) return undefined
  return segments.join('/')
}

function validateOrchestration(value: z.infer<typeof OrchestrationShapeSchema>, ctx: IssueContext): void {
  checkUnique(value.activations, ['activations'], ctx)
  checkUnique(value.roles, ['roles'], ctx)
  checkUnique(value.contexts, ['contexts'], ctx)
  checkUnique(value.artifacts, ['artifacts'], ctx)
  checkUnique(value.states, ['states'], ctx)
  checkUnique(value.gates, ['gates'], ctx)
  checkUnique(value.workflows, ['workflows'], ctx)

  const roles = new Set(value.roles.map((item) => item.id))
  const roleDefinitions = new Map(value.roles.map((item) => [item.id, item]))
  const contexts = new Set(value.contexts.map((item) => item.id))
  const artifacts = new Set(value.artifacts.map((item) => item.id))
  const states = new Set(value.states.map((item) => item.id))
  const gates = new Set(value.gates.map((item) => item.id))
  const gateDefinitions = new Map(value.gates.map((item) => [item.id, item]))
  const workflows = new Map(value.workflows.map((item) => [item.id, item]))
  const workflowGraphs = value.workflows.map(createWorkflowGraphContext)
  value.states.forEach((state, index) => {
    if (artifacts.has(state.id)) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['states', index, 'id'], message: `State identifier "${state.id}" conflicts with an artifact identifier.` })
  })
  const allNodes = new Set<string>()
  const nodeLocations = new Map<string, [number, number]>()
  const nodeDefinitions = new Map<string, OrchestrationNode>()
  value.workflows.forEach((workflow, workflowIndex) => workflow.nodes.forEach((node, nodeIndex) => {
    if (allNodes.has(node.id)) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['workflows', workflowIndex, 'nodes', nodeIndex, 'id'], message: `Duplicate node identifier "${node.id}".` })
    allNodes.add(node.id)
    nodeLocations.set(node.id, [workflowIndex, nodeIndex])
    nodeDefinitions.set(node.id, node)
  }))

  value.activations.forEach((activation, index) => {
    const workflow = workflows.get(activation.workflow)
    if (!workflow) addReferenceIssue(ctx, ['activations', index, 'workflow'], 'workflow', activation.workflow)
    else if (!workflow.entryNodes.includes(activation.entryNode)) addReferenceIssue(ctx, ['activations', index, 'entryNode'], 'workflow entry node', activation.entryNode)
    if (activation.trigger.type === 'lifecycle' && !activation.reentry) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['activations', index, 'reentry'], message: 'Lifecycle activation requires a bounded re-entry policy.' })
    }
    if (activation.trigger.type !== 'lifecycle' && activation.reentry) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['activations', index, 'reentry'], message: 'Re-entry policy is only valid for lifecycle activation.' })
    }
  })

  value.contexts.forEach((context, contextIndex) => context.items.forEach((item, itemIndex) => {
    if (item.source === 'artifact' && !artifacts.has(item.ref)) addReferenceIssue(ctx, ['contexts', contextIndex, 'items', itemIndex, 'ref'], 'artifact', item.ref)
    if (item.source === 'state' && !states.has(item.ref)) addReferenceIssue(ctx, ['contexts', contextIndex, 'items', itemIndex, 'ref'], 'state', item.ref)
  }))
  value.contexts.forEach((context, contextIndex) => {
    if (context.items.length > context.limits.maxItems) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['contexts', contextIndex, 'limits', 'maxItems'], message: `Context contains ${context.items.length} items, exceeding maxItems ${context.limits.maxItems}.` })
  })

  value.roles.forEach((role, roleIndex) => {
    role.inputs.forEach((ref, index) => { if (!artifacts.has(ref) && !states.has(ref)) addReferenceIssue(ctx, ['roles', roleIndex, 'inputs', index], 'artifact or state', ref) })
    role.outputs.forEach((ref, index) => { if (!artifacts.has(ref) && !states.has(ref)) addReferenceIssue(ctx, ['roles', roleIndex, 'outputs', index], 'artifact or state', ref) })
  })

  const ownership: Array<{ path: string; artifactIndex: number }> = []
  value.artifacts.forEach((artifact, artifactIndex) => {
    if (!allNodes.has(artifact.producer)) addReferenceIssue(ctx, ['artifacts', artifactIndex, 'producer'], 'node', artifact.producer)
    artifact.consumers.forEach((ref, index) => { if (!allNodes.has(ref)) addReferenceIssue(ctx, ['artifacts', artifactIndex, 'consumers', index], 'node', ref) })
    if (artifact.ownership.ownerRole && !roles.has(artifact.ownership.ownerRole)) addReferenceIssue(ctx, ['artifacts', artifactIndex, 'ownership', 'ownerRole'], 'role', artifact.ownership.ownerRole)
    if (artifact.cleanup?.ownerRole && !roles.has(artifact.cleanup.ownerRole)) addReferenceIssue(ctx, ['artifacts', artifactIndex, 'cleanup', 'ownerRole'], 'role', artifact.cleanup.ownerRole)
    const producer = nodeDefinitions.get(artifact.producer)
    const producerOutputs = producer?.type === 'dispatch' ? producer.outputs : producer?.type === 'synthesis' && producer.output ? [producer.output] : []
    if (producer && !producerOutputs.includes(artifact.id)) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['artifacts', artifactIndex, 'producer'], message: `Producer "${artifact.producer}" does not emit artifact "${artifact.id}".` })
    artifact.consumers.forEach((consumerId, consumerIndex) => {
      const consumer = nodeDefinitions.get(consumerId)
      if (consumer && !nodeConsumesArtifact(consumer, artifact.id, gateDefinitions)) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['artifacts', artifactIndex, 'consumers', consumerIndex], message: `Consumer "${consumerId}" does not consume artifact "${artifact.id}".` })
    })
    if (artifact.ownership.mode === 'exclusive') artifact.ownership.paths.forEach((path, pathIndex) => {
      const normalized = normalizeOwnershipPath(path)
      if (!normalized) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['artifacts', artifactIndex, 'ownership', 'paths', pathIndex], message: 'Ownership paths must be normalized, relative, host-neutral paths.' })
        return
      }
      const prior = ownership.find((claim) => normalized === claim.path || normalized.startsWith(`${claim.path}/`) || claim.path.startsWith(`${normalized}/`))
      if (prior) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['artifacts', artifactIndex, 'ownership', 'paths', pathIndex], message: `Exclusive ownership path "${path}" overlaps artifacts.${prior.artifactIndex}.` })
      else ownership.push({ path: normalized, artifactIndex })
    })
  })

  value.states.forEach((state, stateIndex) => {
    if (!allNodes.has(state.producer)) addReferenceIssue(ctx, ['states', stateIndex, 'producer'], 'node', state.producer)
    state.consumers.forEach((ref, index) => { if (!allNodes.has(ref)) addReferenceIssue(ctx, ['states', stateIndex, 'consumers', index], 'node', ref) })
    const producer = nodeDefinitions.get(state.producer)
    const producerOutputs = producer?.type === 'dispatch' ? producer.outputs : producer?.type === 'state' ? producer.produces : []
    if (producer && !producerOutputs.includes(state.id)) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['states', stateIndex, 'producer'], message: `Producer "${state.producer}" does not emit state "${state.id}".` })
    state.consumers.forEach((consumerId, consumerIndex) => {
      const consumer = nodeDefinitions.get(consumerId)
      if (consumer && !nodeConsumesState(consumer, state.id, gateDefinitions)) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['states', stateIndex, 'consumers', consumerIndex], message: `Consumer "${consumerId}" does not consume state "${state.id}".` })
    })
  })

  value.gates.forEach((gate, gateIndex) => {
    gate.evidence.artifacts.forEach((ref, index) => { if (!artifacts.has(ref)) addReferenceIssue(ctx, ['gates', gateIndex, 'evidence', 'artifacts', index], 'artifact', ref) })
    gate.evidence.states.forEach((ref, index) => { if (!states.has(ref)) addReferenceIssue(ctx, ['gates', gateIndex, 'evidence', 'states', index], 'state', ref) })
  })

  if (value.resume) {
    if (!states.has(value.resume.ledgerState)) addReferenceIssue(ctx, ['resume', 'ledgerState'], 'state', value.resume.ledgerState)
    if (value.resume.checkpointState && !states.has(value.resume.checkpointState)) addReferenceIssue(ctx, ['resume', 'checkpointState'], 'state', value.resume.checkpointState)
    const ledger = value.states.find((state) => state.id === value.resume?.ledgerState)
    if (ledger && (ledger.kind !== 'progress-ledger' || ledger.durability !== 'durable')) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['resume', 'ledgerState'], message: 'Resume requires a durable progress-ledger state.' })
    if (ledger?.idempotencyKey !== value.resume.dedupeKey) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['resume', 'dedupeKey'], message: 'Resume dedupeKey must match the ledger state idempotencyKey.' })
    if (value.resume.checkpointState) {
      const checkpoint = value.states.find((state) => state.id === value.resume?.checkpointState)
      if (checkpoint && (checkpoint.kind !== 'checkpoint' || checkpoint.durability !== 'durable')) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['resume', 'checkpointState'], message: 'Resume checkpointState must reference durable checkpoint state.' })
    }
  }

  value.workflows.forEach((workflow, workflowIndex) => {
    const nodes = new Set(workflow.nodes.map((node) => node.id))
    const completionIds = new Set(workflow.nodes.filter((node) => node.type === 'completion').map((node) => node.id))
    workflow.entryNodes.forEach((ref, index) => { if (!nodes.has(ref)) addReferenceIssue(ctx, ['workflows', workflowIndex, 'entryNodes', index], 'node', ref) })
    workflow.edges.forEach((edge, edgeIndex) => {
      if (!nodes.has(edge.from)) addReferenceIssue(ctx, ['workflows', workflowIndex, 'edges', edgeIndex, 'from'], 'node', edge.from)
      if (!nodes.has(edge.to)) addReferenceIssue(ctx, ['workflows', workflowIndex, 'edges', edgeIndex, 'to'], 'node', edge.to)
    })
    const transitionKeys = new Set<string>()
    const checkTransition = (from: string, to: string, when: string, path: (string | number)[]) => {
      const key = `${from}\0${to}\0${when}`
      if (transitionKeys.has(key)) ctx.addIssue({ code: z.ZodIssueCode.custom, path, message: `Duplicate workflow transition "${from}" -> "${to}"${when ? ` when "${when}"` : ''}.` })
      transitionKeys.add(key)
    }
    workflow.edges.forEach((edge, edgeIndex) => checkTransition(edge.from, edge.to, edge.when ?? '', ['workflows', workflowIndex, 'edges', edgeIndex]))
    workflow.fallbacks.forEach((fallback, fallbackIndex) => checkTransition(fallback.fromNode, fallback.targetNode, fallback.when, ['workflows', workflowIndex, 'fallbacks', fallbackIndex]))
    workflow.nodes.forEach((node, nodeIndex) => {
      if (node.type === 'repair') checkTransition(node.id, node.resumeNode, '', ['workflows', workflowIndex, 'nodes', nodeIndex, 'resumeNode'])
      if (node.type === 'wait' && node.onTimeout.action !== 'fail') checkTransition(node.id, node.onTimeout.targetNode, 'timeout', ['workflows', workflowIndex, 'nodes', nodeIndex, 'onTimeout', 'targetNode'])
    })
    const explicitAdjacency = new Map<string, string[]>()
    workflow.edges.forEach((edge) => explicitAdjacency.set(edge.from, [...(explicitAdjacency.get(edge.from) ?? []), edge.to]))
    const explicitlyReachable = (entry: string) => {
      const seen = new Set<string>()
      const queue = [entry]
      for (let head = 0; head < queue.length; head += 1) {
        const current = queue[head]
        if (seen.has(current)) continue
        seen.add(current)
        queue.push(...(explicitAdjacency.get(current) ?? []))
      }
      return seen
    }
    workflow.edges.forEach((edge, edgeIndex) => {
      if (edge.from === edge.to || explicitlyReachable(edge.to).has(edge.from)) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['workflows', workflowIndex, 'edges', edgeIndex], message: 'Explicit workflow edges must be acyclic; loops require bounded repair or fallback control.' })
      if (completionIds.has(edge.from)) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['workflows', workflowIndex, 'edges', edgeIndex, 'from'], message: 'Completion nodes cannot have outgoing transitions.' })
    })
    workflow.fallbacks.forEach((fallback, fallbackIndex) => {
      if (completionIds.has(fallback.fromNode)) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['workflows', workflowIndex, 'fallbacks', fallbackIndex, 'fromNode'], message: 'Completion nodes cannot have outgoing transitions.' })
    })
    const graph = workflowGraphs[workflowIndex]
    const reachable = graph.reachable(workflow.entryNodes)
    workflow.nodes.forEach((node, nodeIndex) => {
      if (node.required && !reachable.has(node.id)) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['workflows', workflowIndex, 'nodes', nodeIndex, 'id'], message: `Required node "${node.id}" is unreachable.` })
      const roleRefs: Array<{ ref: string; path: (string | number)[] }> = []
      const artifactRefs: Array<{ ref: string; path: (string | number)[] }> = []
      const stateRefs: Array<{ ref: string; path: (string | number)[] }> = []
      const gateRefs: Array<{ ref: string; path: (string | number)[] }> = []
      if (node.type === 'dispatch') {
        roleRefs.push({ ref: node.role, path: ['role'] })
        const role = roleDefinitions.get(node.role)
        if (role && !sameReferences(node.inputs, role.inputs)) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['workflows', workflowIndex, 'nodes', nodeIndex, 'inputs'], message: `Dispatch inputs must match role "${node.role}" inputs.` })
        if (role && !sameReferences(node.outputs, role.outputs)) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['workflows', workflowIndex, 'nodes', nodeIndex, 'outputs'], message: `Dispatch outputs must match role "${node.role}" outputs.` })
        if (node.context && !contexts.has(node.context)) addReferenceIssue(ctx, ['workflows', workflowIndex, 'nodes', nodeIndex, 'context'], 'context', node.context)
        node.inputs.forEach((ref, i) => {
          if (artifacts.has(ref) || !states.has(ref)) artifactRefs.push({ ref, path: ['inputs', i] })
          else stateRefs.push({ ref, path: ['inputs', i] })
        })
        node.outputs.forEach((ref, i) => {
          if (artifacts.has(ref) || !states.has(ref)) {
            artifactRefs.push({ ref, path: ['outputs', i] })
            const declaration = value.artifacts.find((artifact) => artifact.id === ref)
            if (declaration && declaration.producer !== node.id) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['workflows', workflowIndex, 'nodes', nodeIndex, 'outputs', i], message: `Artifact "${ref}" declares producer "${declaration.producer}", not "${node.id}".` })
          } else {
            stateRefs.push({ ref, path: ['outputs', i] })
            const declaration = value.states.find((state) => state.id === ref)
            if (declaration && declaration.producer !== node.id) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['workflows', workflowIndex, 'nodes', nodeIndex, 'outputs', i], message: `State "${ref}" declares producer "${declaration.producer}", not "${node.id}".` })
          }
        })
        const child = node.childEnvironment
        if (child) {
          const hasOverride = Object.values(child.dimensions).some((dimension) => dimension.mode === 'override')
          if (hasOverride && !child.authorizationGate) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['workflows', workflowIndex, 'nodes', nodeIndex, 'childEnvironment', 'authorizationGate'], message: 'Child-environment overrides require an authorization gate.' })
          if (child.authorizationGate && !gates.has(child.authorizationGate)) addReferenceIssue(ctx, ['workflows', workflowIndex, 'nodes', nodeIndex, 'childEnvironment', 'authorizationGate'], 'gate', child.authorizationGate)
          if (hasOverride && child.authorizationGate && gateDefinitions.get(child.authorizationGate)?.kind !== 'approval') ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['workflows', workflowIndex, 'nodes', nodeIndex, 'childEnvironment', 'authorizationGate'], message: 'Child-environment overrides require an approval gate.' })
          if (hasOverride && child.authorizationGate && gateDefinitions.get(child.authorizationGate)?.kind === 'approval') {
            const gateNodes = new Set(workflow.nodes.filter((candidate) => candidate.type === 'gate' && candidate.gate === child.authorizationGate).map((candidate) => candidate.id))
            const gatePrecedesDispatch = [...gateNodes].some((gateNode) => graph.reachable([gateNode]).has(node.id))
            const dispatchBypassesGate = workflow.entryNodes.some((entry) => graph.reachable([entry], gateNodes).has(node.id))
            if (!workflow.requiredGates.includes(child.authorizationGate) || !gateDefinitions.get(child.authorizationGate)?.required || !gatePrecedesDispatch || dispatchBypassesGate) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['workflows', workflowIndex, 'nodes', nodeIndex, 'childEnvironment', 'authorizationGate'], message: 'Override approval gate must be required and unavoidable before dispatch.' })
          }
          const budgetKeys = ['maxDelegationDepth', 'maxParallel', 'maxRetries', 'maxRepairs'] as const
          for (const key of budgetKeys) if (child.budgets[key] > node.policy[key]) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['workflows', workflowIndex, 'nodes', nodeIndex, 'childEnvironment', 'budgets', key], message: `Child ${key} cannot exceed the dispatch policy.` })
        }
      } else if (node.type === 'state') node.produces.forEach((ref, i) => {
        stateRefs.push({ ref, path: ['produces', i] })
        const declaration = value.states.find((state) => state.id === ref)
        if (declaration && declaration.producer !== node.id) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['workflows', workflowIndex, 'nodes', nodeIndex, 'produces', i], message: `State "${ref}" declares producer "${declaration.producer}", not "${node.id}".` })
      })
      else if (node.type === 'gate') gateRefs.push({ ref: node.gate, path: ['gate'] })
      else if (node.type === 'barrier') {
        const seenDependencies = new Set<string>()
        node.waitForNodes.forEach((ref, i) => {
          if (!nodes.has(ref)) addReferenceIssue(ctx, ['workflows', workflowIndex, 'nodes', nodeIndex, 'waitForNodes', i], 'node', ref)
          else if (ref === node.id) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['workflows', workflowIndex, 'nodes', nodeIndex, 'waitForNodes', i], message: 'Barrier cannot wait for itself.' })
          else if (seenDependencies.has(ref)) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['workflows', workflowIndex, 'nodes', nodeIndex, 'waitForNodes', i], message: `Duplicate barrier dependency "${ref}".` })
          else if (!reachable.has(ref)) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['workflows', workflowIndex, 'nodes', nodeIndex, 'waitForNodes', i], message: `Barrier dependency "${ref}" is unreachable from the workflow entry.` })
          else if (!graph.reachable([ref]).has(node.id)) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['workflows', workflowIndex, 'nodes', nodeIndex, 'waitForNodes', i], message: `Barrier dependency "${ref}" cannot reach barrier "${node.id}".` })
          seenDependencies.add(ref)
        })
        node.artifacts.forEach((ref, i) => artifactRefs.push({ ref, path: ['artifacts', i] }))
        node.states.forEach((ref, i) => stateRefs.push({ ref, path: ['states', i] }))
      } else if (node.type === 'wait') {
        node.condition.artifacts.forEach((ref, i) => artifactRefs.push({ ref, path: ['condition', 'artifacts', i] }))
        node.condition.states.forEach((ref, i) => stateRefs.push({ ref, path: ['condition', 'states', i] }))
        node.condition.gates.forEach((ref, i) => gateRefs.push({ ref, path: ['condition', 'gates', i] }))
        if (node.onTimeout.action !== 'fail' && !nodes.has(node.onTimeout.targetNode)) addReferenceIssue(ctx, ['workflows', workflowIndex, 'nodes', nodeIndex, 'onTimeout', 'targetNode'], 'node', node.onTimeout.targetNode)
        if (node.onTimeout.action === 'repair' && nodeDefinitions.get(node.onTimeout.targetNode)?.type !== 'repair') ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['workflows', workflowIndex, 'nodes', nodeIndex, 'onTimeout', 'targetNode'], message: 'Repair timeout action must target a repair node.' })
      } else if (node.type === 'repair') {
        if (!nodes.has(node.targetNode)) addReferenceIssue(ctx, ['workflows', workflowIndex, 'nodes', nodeIndex, 'targetNode'], 'node', node.targetNode)
        if (!nodes.has(node.resumeNode)) addReferenceIssue(ctx, ['workflows', workflowIndex, 'nodes', nodeIndex, 'resumeNode'], 'node', node.resumeNode)
        if (node.targetArtifact) artifactRefs.push({ ref: node.targetArtifact, path: ['targetArtifact'] })
        const targetArtifact = node.targetArtifact ? value.artifacts.find((artifact) => artifact.id === node.targetArtifact) : undefined
        if (targetArtifact && targetArtifact.producer !== node.targetNode) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['workflows', workflowIndex, 'nodes', nodeIndex, 'targetArtifact'], message: `Repair artifact "${targetArtifact.id}" is not produced by target node "${node.targetNode}".` })
        const targetNode = nodeDefinitions.get(node.targetNode)
        if (targetNode?.type === 'dispatch' && node.maxAttempts > targetNode.policy.maxRepairs) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['workflows', workflowIndex, 'nodes', nodeIndex, 'maxAttempts'], message: 'Repair attempts cannot exceed the target dispatch repair budget.' })
        if (node.role) roleRefs.push({ ref: node.role, path: ['role'] })
        const role = node.role ? roleDefinitions.get(node.role) : undefined
        const repairFlow = node.targetArtifact ? [node.targetArtifact] : []
        if (role && (!sameReferences(role.inputs, repairFlow) || !sameReferences(role.outputs, repairFlow))) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['workflows', workflowIndex, 'nodes', nodeIndex, 'role'], message: `Repair role "${node.role}" must consume and emit the target artifact.` })
        if (node.context && !contexts.has(node.context)) addReferenceIssue(ctx, ['workflows', workflowIndex, 'nodes', nodeIndex, 'context'], 'context', node.context)
      } else if (node.type === 'synthesis') {
        if (node.role) roleRefs.push({ ref: node.role, path: ['role'] })
        const role = node.role ? roleDefinitions.get(node.role) : undefined
        if (role && !sameReferences(role.inputs, node.inputs)) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['workflows', workflowIndex, 'nodes', nodeIndex, 'inputs'], message: `Synthesis inputs must match role "${node.role}" inputs.` })
        if (role && !sameReferences(role.outputs, node.output ? [node.output] : [])) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['workflows', workflowIndex, 'nodes', nodeIndex, 'output'], message: `Synthesis output must match role "${node.role}" outputs.` })
        node.inputs.forEach((ref, i) => artifactRefs.push({ ref, path: ['inputs', i] }))
        if (node.output) {
          artifactRefs.push({ ref: node.output, path: ['output'] })
          const declaration = value.artifacts.find((artifact) => artifact.id === node.output)
          if (declaration && declaration.producer !== node.id) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['workflows', workflowIndex, 'nodes', nodeIndex, 'output'], message: `Artifact "${node.output}" declares producer "${declaration.producer}", not "${node.id}".` })
        }
      } else if (node.type === 'completion') {
        if (node.ownerRole) roleRefs.push({ ref: node.ownerRole, path: ['ownerRole'] })
        if (node.status === 'succeeded' && !node.ownerRole) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['workflows', workflowIndex, 'nodes', nodeIndex, 'ownerRole'], message: 'Successful completion requires an owner role.' })
        if (node.ownerRole && !workflow.completionOwners.includes(node.ownerRole)) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['workflows', workflowIndex, 'nodes', nodeIndex, 'ownerRole'], message: `Completion owner "${node.ownerRole}" is not declared by the workflow.` })
        node.requires.artifacts.forEach((ref, i) => artifactRefs.push({ ref, path: ['requires', 'artifacts', i] }))
        node.requires.states.forEach((ref, i) => stateRefs.push({ ref, path: ['requires', 'states', i] }))
        node.requires.gates.forEach((ref, i) => gateRefs.push({ ref, path: ['requires', 'gates', i] }))
      }
      roleRefs.forEach(({ ref, path }) => { if (!roles.has(ref)) addReferenceIssue(ctx, ['workflows', workflowIndex, 'nodes', nodeIndex, ...path], 'role', ref) })
      artifactRefs.forEach(({ ref, path }) => { if (!artifacts.has(ref)) addReferenceIssue(ctx, ['workflows', workflowIndex, 'nodes', nodeIndex, ...path], 'artifact', ref) })
      stateRefs.forEach(({ ref, path }) => { if (!states.has(ref)) addReferenceIssue(ctx, ['workflows', workflowIndex, 'nodes', nodeIndex, ...path], 'state', ref) })
      gateRefs.forEach(({ ref, path }) => { if (!gates.has(ref)) addReferenceIssue(ctx, ['workflows', workflowIndex, 'nodes', nodeIndex, ...path], 'gate', ref) })
      value.artifacts.forEach((artifact) => {
        if (nodeConsumesArtifact(node, artifact.id, gateDefinitions) && !artifact.consumers.includes(node.id)) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['workflows', workflowIndex, 'nodes', nodeIndex, 'id'], message: `Node consumes artifact "${artifact.id}" but is absent from its consumers declaration.` })
      })
      value.states.forEach((state) => {
        if (nodeConsumesState(node, state.id, gateDefinitions) && !state.consumers.includes(node.id)) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['workflows', workflowIndex, 'nodes', nodeIndex, 'id'], message: `Node consumes state "${state.id}" but is absent from its consumers declaration.` })
      })
    })
    workflow.entryNodes.forEach((entry, entryIndex) => {
      const fromEntry = graph.reachable([entry])
      if (![...completionIds].some((completion) => fromEntry.has(completion))) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['workflows', workflowIndex, 'entryNodes', entryIndex], message: `Entry node "${entry}" has no completion path.` })
    })
    const authoritativeArtifacts = value.artifacts.filter((artifact) => artifact.authoritativeForCompletion && nodeLocations.get(artifact.producer)?.[0] === workflowIndex)
    workflow.nodes.forEach((node, nodeIndex) => {
      if (node.type !== 'completion' || node.status !== 'succeeded') return
      if (authoritativeArtifacts.length === 0) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['workflows', workflowIndex, 'nodes', nodeIndex, 'requires', 'artifacts'], message: 'Successful completion requires an authoritative completion artifact.' })
      for (const artifact of authoritativeArtifacts) if (!node.requires.artifacts.includes(artifact.id)) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['workflows', workflowIndex, 'nodes', nodeIndex, 'requires', 'artifacts'], message: `Successful completion must require authoritative artifact "${artifact.id}".` })
    })
    workflow.requiredGates.forEach((gateId, gateIndex) => {
      if (!gates.has(gateId)) addReferenceIssue(ctx, ['workflows', workflowIndex, 'requiredGates', gateIndex], 'gate', gateId)
      else if (!gateDefinitions.get(gateId)?.required) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['workflows', workflowIndex, 'requiredGates', gateIndex], message: `Workflow-required gate "${gateId}" must be marked required.` })
      const gateNodes = new Set(workflow.nodes.filter((node) => node.type === 'gate' && node.gate === gateId).map((node) => node.id))
      if (gateNodes.size === 0 || workflow.entryNodes.some((entry) => [...completionIds].some((completion) => graph.reachable([entry], gateNodes).has(completion)))) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['workflows', workflowIndex, 'requiredGates', gateIndex], message: `Required gate "${gateId}" can be bypassed.` })
      }
    })
    workflow.completionOwners.forEach((ref, index) => { if (!roles.has(ref)) addReferenceIssue(ctx, ['workflows', workflowIndex, 'completionOwners', index], 'role', ref) })
    if (workflow.cancellation.action === 'checkpoint') {
      const checkpointState = workflow.cancellation.checkpointState
      if (!states.has(checkpointState)) addReferenceIssue(ctx, ['workflows', workflowIndex, 'cancellation', 'checkpointState'], 'state', checkpointState)
      const checkpoint = value.states.find((state) => state.id === checkpointState)
      if (checkpoint && (checkpoint.kind !== 'checkpoint' || checkpoint.durability !== 'durable')) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['workflows', workflowIndex, 'cancellation', 'checkpointState'], message: 'Checkpoint cancellation requires durable checkpoint state.' })
    }
    if (workflow.cancellation.action !== 'fail') workflow.cancellation.cleanupArtifacts.forEach((ref, index) => { if (!artifacts.has(ref)) addReferenceIssue(ctx, ['workflows', workflowIndex, 'cancellation', 'cleanupArtifacts', index], 'artifact', ref) })
    workflow.fallbacks.forEach((fallback, index) => {
      if (!nodes.has(fallback.fromNode)) addReferenceIssue(ctx, ['workflows', workflowIndex, 'fallbacks', index, 'fromNode'], 'node', fallback.fromNode)
      if (!nodes.has(fallback.targetNode)) addReferenceIssue(ctx, ['workflows', workflowIndex, 'fallbacks', index, 'targetNode'], 'node', fallback.targetNode)
    })
    workflow.proof.validators.forEach((validator, index) => { if (validator.gate && !gates.has(validator.gate)) addReferenceIssue(ctx, ['workflows', workflowIndex, 'proof', 'validators', index, 'gate'], 'gate', validator.gate) })
  })

  const validateFlow = (producer: string, consumers: string[], path: (string | number)[]) => {
    const producerLocation = nodeLocations.get(producer)
    if (!producerLocation) return
    const [producerWorkflowIndex] = producerLocation
    const reachable = workflowGraphs[producerWorkflowIndex].reachable([producer])
    consumers.forEach((consumer, consumerIndex) => {
      const consumerLocation = nodeLocations.get(consumer)
      if (!consumerLocation) return
      if (consumerLocation[0] !== producerWorkflowIndex || !reachable.has(consumer)) ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: [...path, 'consumers', consumerIndex],
        message: `Consumer "${consumer}" is not reachable from producer "${producer}" in the same workflow.`,
      })
      else {
        const workflow = value.workflows[producerWorkflowIndex]
        const bypassesProducer = workflow.entryNodes.some((entry) => workflowGraphs[producerWorkflowIndex].reachable([entry], new Set([producer])).has(consumer))
        if (bypassesProducer) ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [...path, 'consumers', consumerIndex],
          message: `Consumer "${consumer}" can be reached without producer "${producer}".`,
        })
      }
    })
  }
  value.artifacts.forEach((artifact, index) => validateFlow(artifact.producer, artifact.consumers, ['artifacts', index]))
  value.states.forEach((state, index) => validateFlow(state.producer, state.consumers, ['states', index]))

  const usedRoles = new Set<string>()
  value.workflows.forEach((workflow, workflowIndex) => {
    const reachable = workflowGraphs[workflowIndex].reachable(workflow.entryNodes)
    workflow.nodes.forEach((node) => {
      if (!reachable.has(node.id)) return
      getNodeRoleIds(node).forEach((role) => usedRoles.add(role))
    })
  })
  value.roles.forEach((role, index) => { if (role.required && !usedRoles.has(role.id)) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['roles', index, 'id'], message: `Required role "${role.id}" is unreachable.` }) })
}

export const OrchestrationSchema = OrchestrationShapeSchema.superRefine(validateOrchestration)

export type OrchestrationActivation = z.infer<typeof OrchestrationActivationSchema>
export type OrchestrationRole = z.infer<typeof OrchestrationRoleSchema>
export type OrchestrationContext = z.infer<typeof OrchestrationContextSchema>
export type OrchestrationArtifact = z.infer<typeof OrchestrationArtifactSchema>
export type OrchestrationState = z.infer<typeof OrchestrationStateSchema>
export type OrchestrationGate = z.infer<typeof OrchestrationGateSchema>
export type OrchestrationNode = z.infer<typeof OrchestrationNodeSchema>
export type OrchestrationWorkflow = z.infer<typeof OrchestrationWorkflowSchema>
export type Orchestration = z.infer<typeof OrchestrationSchema>

export function getOrphanRoleIds(orchestration: Orchestration): string[] {
  const used = new Set<string>()
  for (const workflow of orchestration.workflows) {
    const reachable = createWorkflowGraphContext(workflow).reachable(workflow.entryNodes)
    for (const node of workflow.nodes) if (reachable.has(node.id)) getNodeRoleIds(node).forEach((role) => used.add(role))
  }
  return orchestration.roles.filter((role) => !role.required && !used.has(role.id)).map((role) => role.id)
}
