import { describe, expect, it } from 'bun:test'
import { OrchestrationSchema, getOrphanRoleIds } from '../src/orchestration'
import { ceOrchestrationFixture, hyperframesOrchestrationFixture, orchestrationFixtures, superpowersOrchestrationFixture } from '../test-fixtures/orchestration-fixtures'

const clone = <T>(value: T): T => structuredClone(value)
const issuePaths = (value: unknown) => {
  const result = OrchestrationSchema.safeParse(value)
  expect(result.success).toBe(false)
  return result.success ? [] : result.error.issues.map((issue) => issue.path.join('.'))
}

describe('canonical orchestration IR', () => {
  it('accepts bounded CE, Hyperframes, and Superpowers fixtures', () => {
    for (const fixture of orchestrationFixtures) expect(OrchestrationSchema.safeParse(fixture).success).toBe(true)
  })

  it('reports optional orphan roles without rejecting them', () => {
    const parsed = OrchestrationSchema.parse(ceOrchestrationFixture)
    expect(getOrphanRoleIds(parsed)).toEqual(['historical-reviewer'])
  })

  it('keeps roles referenced only by unreachable optional nodes orphaned', () => {
    const value = clone(ceOrchestrationFixture) as any
    value.workflows[0].nodes.push({ id: 'historical-only', type: 'synthesis', role: 'historical-reviewer', inputs: [], required: false })
    const parsed = OrchestrationSchema.parse(value)
    expect(getOrphanRoleIds(parsed)).toEqual(['historical-reviewer'])
  })

  it('keeps fixtures host-neutral and secret-free', () => {
    const text = JSON.stringify(orchestrationFixtures).toLowerCase()
    for (const marker of ['claude', 'codex', 'cursor', 'api_key', 'token=', 'password']) expect(text).not.toContain(marker)
  })
})

describe('orchestration semantic validation', () => {
  it('attaches dangling role and context failures to actionable paths', () => {
    const value = clone(ceOrchestrationFixture) as any
    value.workflows[0].nodes[0].role = 'missing-role'
    value.workflows[0].nodes[0].context = 'missing-context'
    expect(issuePaths(value)).toEqual(expect.arrayContaining([
      'workflows.0.nodes.0.role', 'workflows.0.nodes.0.context',
    ]))
  })

  it('attaches dangling edge, artifact, gate, repair, and synthesis failures to their references', () => {
    const value = clone(ceOrchestrationFixture) as any
    value.workflows[0].edges[0].to = 'missing-node'
    value.workflows[0].nodes[2].inputs = ['missing-artifact']
    value.workflows[0].nodes[1].gate = 'missing-gate'
    value.workflows[0].nodes.splice(2, 0, { id: 'repair', type: 'repair', targetNode: 'missing-target', maxAttempts: 1, resumeNode: 'missing-resume' })
    const paths = issuePaths(value)
    expect(paths).toEqual(expect.arrayContaining([
      'workflows.0.edges.0.to', 'workflows.0.nodes.3.inputs.0',
      'workflows.0.nodes.1.gate', 'workflows.0.nodes.2.targetNode', 'workflows.0.nodes.2.resumeNode',
    ]))
  })

  it('rejects unreachable required nodes and entrypoints without a completion path', () => {
    const value = clone(ceOrchestrationFixture) as any
    value.workflows[0].nodes.push({ id: 'required-orphan', type: 'state', produces: [], required: true })
    value.workflows[0].edges = value.workflows[0].edges.slice(0, 2)
    expect(issuePaths(value)).toEqual(expect.arrayContaining([
      'workflows.0.nodes.4.id', 'workflows.0.entryNodes.0',
    ]))
  })

  it('rejects a mandatory gate that can be bypassed', () => {
    const value = clone(ceOrchestrationFixture) as any
    value.workflows[0].edges.push({ from: 'dispatch-implementer', to: 'complete' })
    expect(issuePaths(value)).toContain('workflows.0.requiredGates.0')
  })

  it('rejects conflicting exclusive ownership', () => {
    const value = clone(ceOrchestrationFixture) as any
    value.artifacts[1].ownership.paths = ['implementation']
    expect(issuePaths(value)).toContain('artifacts.1.ownership.paths.0')
  })

  it('rejects overlapping and non-normalized ownership paths', () => {
    const overlap = clone(ceOrchestrationFixture) as any
    overlap.artifacts[1].ownership.paths = ['implementation/result']
    expect(issuePaths(overlap)).toContain('artifacts.1.ownership.paths.0')

    const traversal = clone(ceOrchestrationFixture) as any
    traversal.artifacts[1].ownership.paths = ['../report']
    expect(issuePaths(traversal)).toContain('artifacts.1.ownership.paths.0')
  })

  it('rejects barrier dependencies and artifact consumers that cannot reach their declared destination', () => {
    const value = clone(hyperframesOrchestrationFixture) as any
    value.workflows[0].nodes[4].waitForNodes = ['finalize']
    value.artifacts[0].consumers.push('record-progress')
    expect(issuePaths(value)).toEqual(expect.arrayContaining([
      'workflows.0.nodes.4.waitForNodes.0', 'artifacts.0.consumers.4',
    ]))
  })

  it('requires durable resume state with matching idempotency', () => {
    const value = clone(superpowersOrchestrationFixture) as any
    value.resume.dedupeKey = 'different-task-key'
    value.states[0].durability = 'workflow'
    expect(issuePaths(value)).toEqual(expect.arrayContaining(['resume.ledgerState', 'resume.dedupeKey']))
  })

  it('requires authorization for overrides and monotonic child budgets', () => {
    const value = clone(ceOrchestrationFixture) as any
    const dispatch = value.workflows[0].nodes[0]
    delete dispatch.childEnvironment.authorizationGate
    dispatch.childEnvironment.dimensions.permissions.mode = 'override'
    dispatch.childEnvironment.budgets.maxParallel = 3
    expect(issuePaths(value)).toEqual(expect.arrayContaining([
      'workflows.0.nodes.0.childEnvironment.authorizationGate',
      'workflows.0.nodes.0.childEnvironment.budgets.maxParallel',
    ]))
  })

  it('requires override authorization to resolve to an approval gate', () => {
    const value = clone(ceOrchestrationFixture) as any
    value.workflows[0].nodes[0].childEnvironment.dimensions.sandbox.mode = 'override'
    expect(issuePaths(value)).toContain('workflows.0.nodes.0.childEnvironment.authorizationGate')
  })

  it('requires approval to be unavoidable before an overridden dispatch', () => {
    const afterDispatch = clone(ceOrchestrationFixture) as any
    afterDispatch.gates[0].kind = 'approval'
    afterDispatch.workflows[0].nodes[0].childEnvironment.dimensions.sandbox.mode = 'override'
    expect(issuePaths(afterDispatch)).toContain('workflows.0.nodes.0.childEnvironment.authorizationGate')

    const beforeDispatch = clone(ceOrchestrationFixture) as any
    beforeDispatch.gates.push({ id: 'override-approved', kind: 'approval', required: true, evidence: {} })
    beforeDispatch.workflows[0].requiredGates.unshift('override-approved')
    beforeDispatch.workflows[0].nodes.unshift({ id: 'approve-override', type: 'gate', gate: 'override-approved' })
    beforeDispatch.workflows[0].entryNodes = ['approve-override']
    beforeDispatch.activations[0].entryNode = 'approve-override'
    beforeDispatch.workflows[0].edges.unshift({ from: 'approve-override', to: 'dispatch-implementer' })
    beforeDispatch.workflows[0].nodes[1].childEnvironment.authorizationGate = 'override-approved'
    beforeDispatch.workflows[0].nodes[1].childEnvironment.dimensions.sandbox.mode = 'override'
    expect(OrchestrationSchema.safeParse(beforeDispatch).success).toBe(true)
  })

  it('rejects contradictory typed resource producers and consumers', () => {
    const value = clone(ceOrchestrationFixture) as any
    value.workflows[0].nodes[0].outputs = []
    value.workflows[0].nodes[2].inputs = []
    expect(issuePaths(value)).toEqual(expect.arrayContaining([
      'artifacts.0.producer', 'artifacts.0.consumers.1',
    ]))
  })

  it('rejects duplicate explicit and derived workflow transitions', () => {
    const explicit = clone(ceOrchestrationFixture) as any
    explicit.workflows[0].edges.push({ ...explicit.workflows[0].edges[0] })
    expect(issuePaths(explicit)).toContain('workflows.0.edges.3')

    const derived = clone(superpowersOrchestrationFixture) as any
    derived.workflows[0].edges.push({ from: 'review-task', to: 'repair-task', when: 'review-failed' })
    expect(issuePaths(derived)).toContain('workflows.0.fallbacks.0')
  })

  it('rejects unbounded explicit cycles and outgoing completion transitions', () => {
    const value = clone(ceOrchestrationFixture) as any
    value.workflows[0].edges.push({ from: 'complete', to: 'dispatch-implementer' })
    const paths = issuePaths(value)
    expect(paths).toEqual(expect.arrayContaining([
      'workflows.0.edges.3', 'workflows.0.edges.3.from',
    ]))
  })

  it('requires node flow to match its bound role contract', () => {
    const dispatch = clone(ceOrchestrationFixture) as any
    dispatch.roles[0].outputs = []
    expect(issuePaths(dispatch)).toContain('workflows.0.nodes.0.outputs')

    const repair = clone(hyperframesOrchestrationFixture) as any
    repair.roles[1].inputs = []
    expect(issuePaths(repair)).toContain('workflows.0.nodes.3.role')
  })

  it('rejects duplicate references that could mask role-contract drift', () => {
    const value = clone(ceOrchestrationFixture) as any
    value.roles[0].outputs = ['implementation-result', 'final-report']
    value.workflows[0].nodes[0].outputs = ['implementation-result', 'implementation-result']
    expect(issuePaths(value)).toContain('workflows.0.nodes.0.outputs.1')
  })

  it('rejects resource consumers that can bypass their producers', () => {
    const value = clone(ceOrchestrationFixture) as any
    value.workflows[0].edges.push({ from: 'validate-result', to: 'complete' })
    expect(issuePaths(value)).toContain('artifacts.1.consumers.0')
  })

  it('rejects self-dependent and unreachable barrier dependencies', () => {
    const self = clone(hyperframesOrchestrationFixture) as any
    self.workflows[0].nodes[4].waitForNodes = ['frame-barrier']
    expect(issuePaths(self)).toContain('workflows.0.nodes.4.waitForNodes.0')

    const unreachable = clone(hyperframesOrchestrationFixture) as any
    unreachable.workflows[0].nodes.push({ id: 'optional-state', type: 'state', produces: [], required: false })
    unreachable.workflows[0].edges.push({ from: 'optional-state', to: 'frame-barrier' })
    unreachable.workflows[0].nodes[4].waitForNodes = ['optional-state']
    expect(issuePaths(unreachable)).toContain('workflows.0.nodes.4.waitForNodes.0')
  })

  it('requires durable checkpoint state for cancellation and resume', () => {
    const cancellation = clone(ceOrchestrationFixture) as any
    cancellation.workflows[0].cancellation = { action: 'checkpoint' }
    expect(issuePaths(cancellation)).toContain('workflows.0.cancellation.checkpointState')

    const resume = clone(superpowersOrchestrationFixture) as any
    resume.states[1].durability = 'workflow'
    expect(issuePaths(resume)).toContain('resume.checkpointState')
  })

  it('enforces declared context item bounds', () => {
    const value = clone(ceOrchestrationFixture) as any
    value.contexts[0].limits.maxItems = 1
    value.contexts[0].items.push({ source: 'instruction', ref: 'extra-context' })
    expect(issuePaths(value)).toContain('contexts.0.limits.maxItems')
  })

  it('ties repair artifacts and timeout actions to repair targets', () => {
    const value = clone(hyperframesOrchestrationFixture) as any
    value.workflows[0].nodes[3].targetNode = 'finalize'
    value.workflows[0].nodes[2].onTimeout.targetNode = 'build-frames'
    expect(issuePaths(value)).toEqual(expect.arrayContaining([
      'workflows.0.nodes.3.targetArtifact', 'workflows.0.nodes.2.onTimeout.targetNode',
    ]))
  })

  it('rejects self and indirect cycles in unbounded timeout fallback routing', () => {
    const self = clone(hyperframesOrchestrationFixture) as any
    self.workflows[0].nodes[2].onTimeout = { action: 'fallback', targetNode: 'wait-frames' }
    expect(issuePaths(self)).toContain('workflows.0.nodes.2.onTimeout.targetNode')

    const indirect = clone(hyperframesOrchestrationFixture) as any
    indirect.workflows[0].nodes[2].onTimeout = { action: 'fallback', targetNode: 'build-frames' }
    expect(issuePaths(indirect)).toContain('workflows.0.nodes.2.onTimeout.targetNode')
  })

  it('requires successful completion to consume authoritative artifacts', () => {
    const value = clone(ceOrchestrationFixture) as any
    value.artifacts[1].authoritativeForCompletion = false
    expect(issuePaths(value)).toContain('workflows.0.nodes.3.requires.artifacts')
  })

  it('validates both ends of bounded fallback routing', () => {
    const value = clone(superpowersOrchestrationFixture) as any
    value.workflows[0].fallbacks[0].fromNode = 'missing-source'
    value.workflows[0].fallbacks[0].targetNode = 'missing-target'
    expect(issuePaths(value)).toEqual(expect.arrayContaining([
      'workflows.0.fallbacks.0.fromNode', 'workflows.0.fallbacks.0.targetNode',
    ]))
  })

  it('rejects unbounded dispatch and repair policies', () => {
    const value = clone(ceOrchestrationFixture) as any
    value.workflows[0].nodes[0].policy.maxParallel = 0
    value.workflows[0].nodes.splice(2, 0, { id: 'repair', type: 'repair', targetNode: 'dispatch-implementer', maxAttempts: 0, resumeNode: 'validate-result' })
    expect(issuePaths(value)).toEqual(expect.arrayContaining([
      'workflows.0.nodes.0.policy.maxParallel', 'workflows.0.nodes.2.maxAttempts',
    ]))
  })

  it('makes secret material structurally invalid without echoing it', () => {
    const value = clone(ceOrchestrationFixture) as any
    const marker = 'do-not-echo-secret-123'
    value.workflows[0].nodes[0].childEnvironment.dimensions.credentials.requirements = [
      { ref: 'build-signing', availability: 'required', value: marker },
    ]
    const result = OrchestrationSchema.safeParse(value)
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error.message).not.toContain(marker)
  })
})
