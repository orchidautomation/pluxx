#!/usr/bin/env node
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { resolve } from 'path'
import * as readline from 'readline'

const runtimeRoot = process.env.CHANGEOPS_RUNTIME_ROOT
  ? resolve(process.env.CHANGEOPS_RUNTIME_ROOT)
  : resolve(process.cwd(), 'passthrough/runtime')
const stateDir = process.env.CHANGEOPS_STATE_DIR
  ? resolve(process.env.CHANGEOPS_STATE_DIR)
  : resolve(runtimeRoot, 'state')
const policyPath = resolve(runtimeRoot, 'policy/mutation-rules.json')
const approvalPath = resolve(runtimeRoot, 'policy/approval-rules.json')
const auditLogPath = resolve(stateDir, 'audit-log.ndjson')
const changeWindowPath = resolve(stateDir, 'change-window.json')
const rl = readline.createInterface({ input: process.stdin, crlfDelay: Infinity })

mkdirSync(stateDir, { recursive: true })

function readJson(path, fallback) {
  if (!existsSync(path)) return fallback
  return JSON.parse(readFileSync(path, 'utf-8'))
}

function write(message) {
  process.stdout.write(`${JSON.stringify(message)}\n`)
}

function readPolicy() {
  return readJson(policyPath, { version: 0, blockedMutations: [] })
}

function readApproval() {
  return readJson(approvalPath, { defaultMode: process.env.CHANGEOPS_APPROVAL_MODE ?? 'strict' })
}

function readReadinessState() {
  return {
    policyCache: readJson(resolve(stateDir, 'policy-sync.json'), { status: 'missing' }),
    serviceHealth: readJson(resolve(stateDir, 'service-health.json'), { status: 'missing' }),
  }
}

function appendAuditEvent(event) {
  appendFileSync(auditLogPath, `${JSON.stringify(event)}\n`)
}

function upsertChangeWindow(windowState) {
  writeFileSync(changeWindowPath, `${JSON.stringify(windowState, null, 2)}\n`)
}

function toolDefinitions() {
  return [
    {
      name: 'readiness_status',
      title: 'Readiness Status',
      description: 'Return the current policy-cache and service-health readiness state for change workflows.',
      inputSchema: {
        type: 'object',
        additionalProperties: false,
        properties: {},
      },
    },
    {
      name: 'open_change_window',
      title: 'Open Change Window',
      description: 'Create a local change-window record for the requested environment and reason.',
      inputSchema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          reason: { type: 'string' },
          environment: { type: 'string' },
        },
        required: ['reason'],
      },
    },
    {
      name: 'record_audit_event',
      title: 'Record Audit Event',
      description: 'Persist a local audit event for rollout review and rollback evidence.',
      inputSchema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          action: { type: 'string' },
          detail: { type: 'string' },
          actor: { type: 'string' },
        },
        required: ['action'],
      },
    },
  ]
}

function success(id, result) {
  write({
    jsonrpc: '2.0',
    id,
    result,
  })
}

function failure(id, code, message) {
  write({
    jsonrpc: '2.0',
    id,
    error: {
      code,
      message,
    },
  })
}

function handleToolCall(name, args = {}) {
  if (name === 'readiness_status') {
    const readiness = readReadinessState()
    const approval = readApproval()
    const policy = readPolicy()
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            environment: process.env.CHANGEOPS_ENVIRONMENT ?? 'unknown',
            approvalMode: approval.defaultMode,
            policyVersion: policy.version,
            readiness,
          }, null, 2),
        },
      ],
      structuredContent: {
        environment: process.env.CHANGEOPS_ENVIRONMENT ?? 'unknown',
        approvalMode: approval.defaultMode,
        policyVersion: policy.version,
        readiness,
      },
    }
  }

  if (name === 'open_change_window') {
    const windowState = {
      openedAt: new Date().toISOString(),
      environment: typeof args.environment === 'string' && args.environment.length > 0
        ? args.environment
        : process.env.CHANGEOPS_ENVIRONMENT ?? 'unknown',
      reason: typeof args.reason === 'string' ? args.reason : 'unspecified',
      approvalMode: readApproval().defaultMode,
    }
    upsertChangeWindow(windowState)
    return {
      content: [
        {
          type: 'text',
          text: `Opened local change window for ${windowState.environment}: ${windowState.reason}`,
        },
      ],
      structuredContent: windowState,
    }
  }

  if (name === 'record_audit_event') {
    const event = {
      recordedAt: new Date().toISOString(),
      action: typeof args.action === 'string' ? args.action : 'unspecified',
      detail: typeof args.detail === 'string' ? args.detail : '',
      actor: typeof args.actor === 'string' ? args.actor : 'platform-change-ops',
    }
    appendAuditEvent(event)
    return {
      content: [
        {
          type: 'text',
          text: `Recorded audit event ${event.action}`,
        },
      ],
      structuredContent: event,
    }
  }

  throw new Error(`Unknown tool: ${name}`)
}

rl.on('line', (line) => {
  if (!line.trim()) return

  let message
  try {
    message = JSON.parse(line)
  } catch {
    return
  }

  if (message.method === 'initialize') {
    success(message.id, {
      protocolVersion: '2025-03-26',
      capabilities: {
        tools: {
          listChanged: false,
        },
      },
      serverInfo: {
        name: 'changeops-local',
        title: 'Platform Change Ops Local Control Plane',
        version: '0.1.0',
        description: 'Local policy and readiness runtime for the Platform Change Ops reference plugin.',
      },
      instructions: 'Use the local change-ops tools for readiness checks, audit logging, and safe change-window coordination.',
    })
    return
  }

  if (message.method === 'notifications/initialized') {
    return
  }

  if (message.method === 'tools/list') {
    success(message.id, {
      tools: toolDefinitions(),
    })
    return
  }

  if (message.method === 'tools/call') {
    try {
      success(message.id, handleToolCall(message.params?.name, message.params?.arguments))
    } catch (error) {
      failure(message.id, -32602, error instanceof Error ? error.message : 'Unknown tool call failure')
    }
    return
  }

  if (message.method === 'ping') {
    success(message.id, {})
    return
  }

  if (typeof message.id !== 'undefined') {
    failure(message.id, -32601, `Method not implemented: ${message.method}`)
  }
})
