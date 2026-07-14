const role = (id: string, required = true, inputs: string[] = [], outputs: string[] = []) => ({
  id,
  required,
  prompt: { kind: 'skill-support' as const, ref: `${id}-support` },
  binding: { kind: 'generic-dispatch' as const },
  inputs,
  outputs,
})

export const ceOrchestrationFixture = {
  version: 1 as const,
  activations: [{
    id: 'implement-request',
    trigger: { type: 'intent' as const, intent: 'implement-approved-plan' },
    workflow: 'ce-work',
    entryNode: 'dispatch-implementer',
    guarantee: 'required' as const,
    authorization: 'user-authorized' as const,
  }],
  roles: [role('implementer', true, [], ['implementation-result']), role('synthesizer', true, ['implementation-result'], ['final-report']), role('historical-reviewer', false)],
  contexts: [{
    id: 'implementation-context',
    items: [{ source: 'instruction' as const, ref: 'approved-plan' }],
    limits: { maxItems: 12, maxBytes: 64000 },
  }],
  artifacts: [{
    id: 'implementation-result', kind: 'report' as const, producer: 'dispatch-implementer',
    consumers: ['validate-result', 'synthesize-result'], durability: 'workflow' as const,
    ownership: { mode: 'exclusive' as const, ownerRole: 'implementer', paths: ['implementation'] },
  }, {
    id: 'final-report', kind: 'report' as const, producer: 'synthesize-result', consumers: ['complete'],
    durability: 'durable' as const, authoritativeForCompletion: true,
    ownership: { mode: 'exclusive' as const, ownerRole: 'synthesizer', paths: ['report'] },
  }],
  states: [],
  gates: [{ id: 'implementation-valid', kind: 'validation' as const, required: true, evidence: { artifacts: ['implementation-result'] } }],
  workflows: [{
    id: 'ce-work', mode: 'pipeline' as const, entryNodes: ['dispatch-implementer'],
    requiredGates: ['implementation-valid'], completionOwners: ['synthesizer'],
    proof: { requiredTier: 'unit' as const, validators: [{ id: 'fixture-schema', gate: 'implementation-valid' }] },
    cancellation: { action: 'fail' as const },
    nodes: [{
      id: 'dispatch-implementer', type: 'dispatch' as const, role: 'implementer', context: 'implementation-context',
      inputs: [], outputs: ['implementation-result'],
      policy: { maxParallel: 2, maxBatch: 4, maxDelegationDepth: 1, maxRetries: 1, maxRepairs: 1, isolation: 'workspace' as const },
      childEnvironment: {
        authorizationGate: 'implementation-valid',
        dimensions: {
          capabilities: { mode: 'inherit' as const, required: ['code-edit'] },
          mcp: { mode: 'inherit' as const, required: [] },
          permissions: { mode: 'inherit' as const, required: [] },
          sandbox: { mode: 'inherit' as const, minimum: 'workspace-write' as const },
          credentials: { mode: 'inherit' as const, requirements: [] },
        },
        budgets: { maxDelegationDepth: 1, maxParallel: 2, maxRetries: 1, maxRepairs: 1 },
      },
    }, { id: 'validate-result', type: 'gate' as const, gate: 'implementation-valid' },
    { id: 'synthesize-result', type: 'synthesis' as const, role: 'synthesizer', inputs: ['implementation-result'], output: 'final-report' },
    { id: 'complete', type: 'completion' as const, ownerRole: 'synthesizer', status: 'succeeded' as const, requires: { artifacts: ['final-report'], gates: ['implementation-valid'] } }],
    edges: [{ from: 'dispatch-implementer', to: 'validate-result' }, { from: 'validate-result', to: 'synthesize-result' }, { from: 'synthesize-result', to: 'complete' }],
  }],
}

export const hyperframesOrchestrationFixture = {
  version: 1 as const,
  activations: [{ id: 'render-sequence', trigger: { type: 'intent' as const, intent: 'render-sequence' }, workflow: 'render-workflow', entryNode: 'record-progress', guarantee: 'required' as const, authorization: 'user-authorized' as const }],
  roles: [role('frame-builder', true, [], ['frame-set']), role('frame-repairer', true, ['frame-set'], ['frame-set']), role('finalizer', true, ['frame-set'], ['final-render'])],
  contexts: ceOrchestrationFixture.contexts,
  artifacts: [{ id: 'frame-set', kind: 'directory' as const, producer: 'build-frames', consumers: ['wait-frames', 'repair-frames', 'frame-barrier', 'finalize'], durability: 'workflow' as const, ownership: { mode: 'exclusive' as const, ownerRole: 'frame-builder', paths: ['frames'] } }, { id: 'final-render', kind: 'file' as const, producer: 'finalize', consumers: ['validate-render', 'complete-render'], durability: 'durable' as const, authoritativeForCompletion: true, ownership: { mode: 'exclusive' as const, ownerRole: 'finalizer', paths: ['render'] } }],
  states: [{ id: 'render-progress', kind: 'progress-ledger' as const, producer: 'record-progress', consumers: ['wait-frames', 'frame-barrier'], durability: 'durable' as const, idempotencyKey: 'sequence-id' }, { id: 'render-checkpoint', kind: 'checkpoint' as const, producer: 'record-progress', consumers: [], durability: 'durable' as const }],
  gates: [{ id: 'render-valid', kind: 'validation' as const, required: true, evidence: { artifacts: ['final-render'] } }],
  workflows: [{
    id: 'render-workflow', mode: 'pipeline' as const, entryNodes: ['record-progress'], requiredGates: ['render-valid'], completionOwners: ['finalizer'], cancellation: { action: 'checkpoint' as const, checkpointState: 'render-checkpoint' }, proof: { requiredTier: 'unit' as const, validators: [{ id: 'render-contract', gate: 'render-valid' }] },
    nodes: [{ id: 'record-progress', type: 'state' as const, produces: ['render-progress', 'render-checkpoint'] },
      { id: 'build-frames', type: 'dispatch' as const, role: 'frame-builder', context: 'implementation-context', inputs: [], outputs: ['frame-set'], policy: { maxParallel: 4, maxBatch: 8, maxDelegationDepth: 0, maxRetries: 2, maxRepairs: 2, isolation: 'workspace' as const } },
      { id: 'wait-frames', type: 'wait' as const, condition: { mode: 'all' as const, artifacts: ['frame-set'], states: ['render-progress'] }, timeoutMs: 30000, onTimeout: { action: 'repair' as const, targetNode: 'repair-frames' } },
      { id: 'repair-frames', type: 'repair' as const, targetNode: 'build-frames', targetArtifact: 'frame-set', role: 'frame-repairer', maxAttempts: 2, resumeNode: 'wait-frames' },
      { id: 'frame-barrier', type: 'barrier' as const, waitForNodes: ['build-frames'], artifacts: ['frame-set'], states: ['render-progress'] },
      { id: 'finalize', type: 'synthesis' as const, role: 'finalizer', inputs: ['frame-set'], output: 'final-render' },
      { id: 'validate-render', type: 'gate' as const, gate: 'render-valid' },
      { id: 'complete-render', type: 'completion' as const, ownerRole: 'finalizer', status: 'succeeded' as const, requires: { artifacts: ['final-render'], gates: ['render-valid'] } }],
    edges: [{ from: 'record-progress', to: 'build-frames' }, { from: 'build-frames', to: 'wait-frames' }, { from: 'wait-frames', to: 'frame-barrier' }, { from: 'frame-barrier', to: 'finalize' }, { from: 'finalize', to: 'validate-render' }, { from: 'validate-render', to: 'complete-render' }],
  }],
}

export const superpowersOrchestrationFixture = {
  version: 1 as const,
  contexts: ceOrchestrationFixture.contexts,
  activations: [{ id: 'session-activation', trigger: { type: 'lifecycle' as const, events: ['session-start' as const, 'context-compaction' as const, 'workflow-resume' as const] }, workflow: 'review-loop', entryNode: 'dispatch-task', guarantee: 'best-effort' as const, authorization: 'policy-authorized' as const, reentry: { reinject: true, idempotencyKey: 'session-task', maxApplicationsPerEvent: 1 } }],
  roles: [role('task-implementer', true, [], ['task-result', 'task-ledger', 'task-checkpoint']), role('task-repairer', true, ['task-result'], ['task-result']), role('task-reviewer')],
  artifacts: [{ id: 'task-result', kind: 'diff' as const, producer: 'dispatch-task', consumers: ['review-task', 'repair-task', 'complete-task'], durability: 'workflow' as const, authoritativeForCompletion: true, ownership: { mode: 'exclusive' as const, ownerRole: 'task-implementer', paths: ['task'] } }],
  states: [{ id: 'task-ledger', kind: 'progress-ledger' as const, producer: 'dispatch-task', consumers: ['complete-task'], durability: 'durable' as const, idempotencyKey: 'session-task' }, { id: 'task-checkpoint', kind: 'checkpoint' as const, producer: 'dispatch-task', consumers: [], durability: 'durable' as const }],
  gates: [{ id: 'task-reviewed', kind: 'review' as const, required: true, evidence: { artifacts: ['task-result'] } }],
  resume: { ledgerState: 'task-ledger', checkpointState: 'task-checkpoint', dedupeKey: 'session-task', onMissing: 'restart' as const },
  workflows: [{ id: 'review-loop', mode: 'interactive' as const, entryNodes: ['dispatch-task'], requiredGates: ['task-reviewed'], completionOwners: ['task-reviewer'], cancellation: { action: 'checkpoint' as const, checkpointState: 'task-checkpoint' }, fallbacks: [{ when: 'review-failed', fromNode: 'review-task', targetNode: 'repair-task', maxUses: 2 }], proof: { requiredTier: 'unit' as const, validators: [{ id: 'review-contract', gate: 'task-reviewed' }] }, nodes: [
    { id: 'dispatch-task', type: 'dispatch' as const, role: 'task-implementer', inputs: [], outputs: ['task-result', 'task-ledger', 'task-checkpoint'], policy: { maxParallel: 1, maxBatch: 1, maxDelegationDepth: 1, maxRetries: 1, maxRepairs: 2, isolation: 'workspace' as const } },
    { id: 'review-task', type: 'gate' as const, gate: 'task-reviewed' },
    { id: 'repair-task', type: 'repair' as const, targetNode: 'dispatch-task', targetArtifact: 'task-result', role: 'task-repairer', maxAttempts: 2, resumeNode: 'review-task' },
    { id: 'complete-task', type: 'completion' as const, ownerRole: 'task-reviewer', status: 'succeeded' as const, requires: { artifacts: ['task-result'], states: ['task-ledger'], gates: ['task-reviewed'] } },
  ], edges: [{ from: 'dispatch-task', to: 'review-task' }, { from: 'review-task', to: 'complete-task' }] }],
}

export const orchestrationFixtures = [ceOrchestrationFixture, hyperframesOrchestrationFixture, superpowersOrchestrationFixture]
