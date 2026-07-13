import { mkdirSync, readFileSync } from 'fs'
import { rename, rm, writeFile } from 'fs/promises'
import { randomUUID } from 'crypto'
import { dirname, resolve } from 'path'
import * as readline from 'readline'
import type { Readable, Writable } from 'stream'
import { createMcpClient, McpIntrospectionError, type McpClient } from '../mcp/introspect'
import { parseMcpSourceInput } from './init-from-mcp'

interface ProxyTapeNotification {
  kind: 'notify'
  method: string
  params?: Record<string, unknown>
}

interface ProxyTapeSuccessfulRequest {
  kind: 'request'
  method: string
  params?: Record<string, unknown>
  result: unknown
}

interface ProxyTapeFailedRequest {
  kind: 'request'
  method: string
  params?: Record<string, unknown>
  error: {
    code: number
    message: string
  }
}

type ProxyTapeInteraction = ProxyTapeNotification | ProxyTapeSuccessfulRequest | ProxyTapeFailedRequest

interface ProxyTapeV1 {
  version: 1
  source?: string
  interactions: ProxyTapeInteraction[]
}

interface ProxyTapeV2 {
  version: 2
  redaction: {
    policy: 'pluxx-default'
    version: 1
    marker: typeof REDACTION_MARKER
  }
  source?: string
  interactions: ProxyTapeInteraction[]
}

type ProxyTape = ProxyTapeV1 | ProxyTapeV2

interface McpProxyOptions {
  source?: string
  recordPath?: string
  replayPath?: string
}

interface ProxyIo {
  input: Readable
  output: Writable
  error: Writable
}

const REDACTION_MARKER = '[REDACTED]'
const TAPE_SCHEMA_VERSION = 2
const REDACTION_POLICY_VERSION = 1
const SENSITIVE_KEY_PATTERN = /(?:^|[^a-z])(auth(?:orization)?|api[-_ ]?key|bearer|client[-_ ]?secret|cookie|credential|password|passwd|private[-_ ]?key|refresh[-_ ]?token|secret|session[-_ ]?id|token)(?:$|[^a-z])/i
const SENSITIVE_COMPACT_KEYS = new Set([
  'apikey',
  'auth',
  'authorization',
  'clientsecret',
  'cookie',
  'credentials',
  'password',
  'passwd',
  'privatekey',
  'refreshtoken',
  'secret',
  'sessionid',
  'token',
])

function usage(): string {
  return [
    'Usage: pluxx mcp proxy --from-mcp <source> [--record <tape.json>]',
    '       pluxx mcp proxy --replay <tape.json>',
    '',
    'Acts as a local stdio MCP proxy for development and CI.',
    '- --record stores a schema-versioned replay tape with default recursive credential redaction.',
    '- Raw recording is not supported; review tapes before sharing because arbitrary private content may remain.',
    '- --replay validates the tape strictly and serves a deterministic stdio MCP session.',
  ].join('\n')
}

function readOption(rawArgs: string[], flag: string): string | undefined {
  const index = rawArgs.indexOf(flag)
  if (index === -1) return undefined

  const value = rawArgs[index + 1]
  if (!value || value.startsWith('-')) {
    return undefined
  }

  return value
}

function parseOptions(rawArgs: string[]): McpProxyOptions {
  const source = readOption(rawArgs, '--from-mcp')
  const recordPath = readOption(rawArgs, '--record')
  const replayPath = readOption(rawArgs, '--replay')

  if (recordPath && replayPath) {
    throw new Error('Choose either --record or --replay, not both.')
  }

  if (!source && !replayPath) {
    throw new Error('Expected --from-mcp <source> for live proxying, or --replay <tape.json>.')
  }

  if ((recordPath || source) && replayPath && source) {
    throw new Error('Replay mode does not accept --from-mcp.')
  }

  return {
    source,
    recordPath,
    replayPath,
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function assertOnlyKeys(value: Record<string, unknown>, allowed: string[], path: string): void {
  const unexpected = Object.keys(value).filter((key) => !allowed.includes(key))
  if (unexpected.length > 0) {
    throw new Error(`${path} contains unsupported field ${JSON.stringify(unexpected[0])}.`)
  }
}

function validateInteraction(value: unknown, index: number): ProxyTapeInteraction {
  const path = `interactions[${index}]`
  if (!isRecord(value)) throw new Error(`${path} must be an object.`)
  assertOnlyKeys(value, ['kind', 'method', 'params', 'result', 'error'], path)

  if (value.kind !== 'request' && value.kind !== 'notify') {
    throw new Error(`${path}.kind must be "request" or "notify".`)
  }
  if (typeof value.method !== 'string' || value.method.length === 0) {
    throw new Error(`${path}.method must be a non-empty string.`)
  }
  if (Object.hasOwn(value, 'params') && !isRecord(value.params)) {
    throw new Error(`${path}.params must be an object when present.`)
  }

  const hasResult = Object.hasOwn(value, 'result')
  const hasError = Object.hasOwn(value, 'error')
  if (value.kind === 'notify') {
    if (hasResult || hasError) {
      throw new Error(`${path} notification cannot contain result or error.`)
    }
  } else if (hasResult === hasError) {
    throw new Error(`${path} request must contain exactly one of result or error.`)
  }

  if (hasError) {
    if (!isRecord(value.error)) throw new Error(`${path}.error must be an object.`)
    assertOnlyKeys(value.error, ['code', 'message'], `${path}.error`)
    if (!Number.isInteger(value.error.code)) {
      throw new Error(`${path}.error.code must be an integer.`)
    }
    if (typeof value.error.message !== 'string') {
      throw new Error(`${path}.error.message must be a string.`)
    }
  }

  const common = {
    method: value.method,
    ...(isRecord(value.params) ? { params: value.params } : {}),
  }
  if (value.kind === 'notify') return { kind: 'notify', ...common }
  if (hasError) {
    const error = value.error as { code: number; message: string }
    return { kind: 'request', ...common, error }
  }
  return { kind: 'request', ...common, result: value.result }
}

function validateReplayTape(value: unknown, filepath: string): ProxyTape {
  if (!isRecord(value)) {
    throw new Error(`Replay tape must contain a JSON object: ${filepath}`)
  }
  if (value.version !== 1 && value.version !== 2) {
    const shownVersion = Object.hasOwn(value, 'version') ? String(value.version) : 'missing'
    throw new Error(
      `Unsupported MCP replay tape schema version ${shownVersion}. `
      + 'Pluxx supports schema versions 1 and 2; recreate or migrate this tape.',
    )
  }

  const allowedTapeKeys = value.version === 2
    ? ['version', 'redaction', 'source', 'interactions']
    : ['version', 'source', 'interactions']
  assertOnlyKeys(value, allowedTapeKeys, 'Replay tape')
  if (Object.hasOwn(value, 'source') && typeof value.source !== 'string') {
    throw new Error('Replay tape source must be a string when present.')
  }
  if (!Array.isArray(value.interactions)) {
    throw new Error('Replay tape interactions must be an array.')
  }

  if (value.version === 2) {
    if (!isRecord(value.redaction)) {
      throw new Error('Replay tape schema version 2 requires redaction metadata.')
    }
    assertOnlyKeys(value.redaction, ['policy', 'version', 'marker'], 'Replay tape redaction')
    if (
      value.redaction.policy !== 'pluxx-default'
      || value.redaction.version !== REDACTION_POLICY_VERSION
      || value.redaction.marker !== REDACTION_MARKER
    ) {
      throw new Error(
        'Replay tape redaction metadata is unsupported; expected pluxx-default policy version 1.',
      )
    }
  }

  return {
    ...value,
    interactions: value.interactions.map((entry, index) => validateInteraction(entry, index)),
  } as unknown as ProxyTape
}

function isSensitiveKey(key: string): boolean {
  const compact = key.toLowerCase().replace(/[^a-z0-9]/g, '')
  const words = key
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
  const wordSet = new Set(words)
  return SENSITIVE_COMPACT_KEYS.has(compact)
    || wordSet.has('auth')
    || wordSet.has('authentication')
    || wordSet.has('authorization')
    || wordSet.has('cookie')
    || wordSet.has('credential')
    || wordSet.has('credentials')
    || wordSet.has('password')
    || wordSet.has('passwd')
    || wordSet.has('secret')
    || wordSet.has('token')
    || (wordSet.has('api') && wordSet.has('key'))
    || (wordSet.has('access') && wordSet.has('key'))
    || (wordSet.has('private') && wordSet.has('key'))
    || (wordSet.has('session') && wordSet.has('id'))
    || compact.endsWith('apikey')
    || compact.endsWith('password')
    || compact.endsWith('privatekey')
    || compact.endsWith('secret')
    || compact.endsWith('sessionid')
    || compact.endsWith('token')
    || SENSITIVE_KEY_PATTERN.test(key)
}

function collectSensitiveValues(value: unknown, output: Set<string>, parentKey?: string): void {
  if (parentKey && isSensitiveKey(parentKey)) {
    if (typeof value === 'string' && value.length >= 4) output.add(value)
    if (typeof value === 'number' || typeof value === 'bigint') output.add(String(value))
  }

  if (Array.isArray(value)) {
    for (const entry of value) collectSensitiveValues(entry, output, parentKey)
    return
  }
  if (!isRecord(value)) return
  for (const [key, nested] of Object.entries(value)) collectSensitiveValues(nested, output, key)
}

function redactUrl(rawUrl: string): string {
  try {
    const url = new URL(rawUrl)
    let changed = false
    if (url.username) {
      url.username = REDACTION_MARKER
      changed = true
    }
    if (url.password) {
      url.password = REDACTION_MARKER
      changed = true
    }
    for (const key of [...url.searchParams.keys()]) {
      if (isSensitiveKey(key)) {
        url.searchParams.set(key, REDACTION_MARKER)
        changed = true
      }
    }
    return changed ? url.toString() : rawUrl
  } catch {
    return rawUrl
  }
}

interface RedactionContext {
  sensitiveValues: Set<string>
  orderedSensitiveValues: string[]
}

function buildRedactionContext(sensitiveValues: Set<string>): RedactionContext {
  return {
    sensitiveValues,
    orderedSensitiveValues: [...sensitiveValues]
      .filter((entry) => entry.length >= 4 && entry !== REDACTION_MARKER)
      .sort((left, right) => right.length - left.length),
  }
}

function redactString(value: string, context: RedactionContext): string {
  const trimmed = value.trim()
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed) as unknown
      if (typeof parsed === 'object' && parsed !== null) {
        const embeddedSensitiveValues = new Set(context.sensitiveValues)
        collectSensitiveValues(parsed, embeddedSensitiveValues)
        const serializedBeforeRedaction = JSON.stringify(parsed)
        const redactedValue = redactValue(parsed, buildRedactionContext(embeddedSensitiveValues))
        const serializedAfterRedaction = JSON.stringify(redactedValue)
        return serializedAfterRedaction === serializedBeforeRedaction ? value : serializedAfterRedaction
      }
    } catch {
      // Not every source string beginning with a brace is intended to be JSON.
    }
  }

  let redacted = value
  for (const sensitiveValue of context.orderedSensitiveValues) {
    redacted = redacted.replaceAll(sensitiveValue, REDACTION_MARKER)
  }

  redacted = redacted.replace(
    /\b(Bearer|Basic)\s+[A-Za-z0-9._~+/=-]+/gi,
    `$1 ${REDACTION_MARKER}`,
  )
  redacted = redacted.replace(
    /(["']?authorization["']?\s*[:=]\s*["']?)(?:Bearer|Basic)?\s*[^\s,"';]+/gi,
    `$1${REDACTION_MARKER}`,
  )
  redacted = redacted.replace(
    /((?:--header|-H)(?:=|\s+))(["'])([A-Za-z0-9_-]+)\s*:\s*([\s\S]*?)\2/g,
    (whole, prefix: string, quote: string, headerName: string) => isSensitiveKey(headerName)
      ? `${prefix}${quote}${headerName}: ${REDACTION_MARKER}${quote}`
      : whole,
  )
  redacted = redacted.replace(
    /((?:--header|-H)(?:=|\s+))([A-Za-z0-9_-]+)\s*:\s*([^\s]+)/g,
    (whole, prefix: string, headerName: string) => isSensitiveKey(headerName)
      ? `${prefix}${headerName}: ${REDACTION_MARKER}`
      : whole,
  )
  redacted = redacted.replace(
    /(^|\s)([A-Za-z_][A-Za-z0-9_]*)=(?:"[^"]*"|'[^']*'|[^\s]+)/g,
    (whole, prefix: string, variableName: string) => isSensitiveKey(variableName)
      ? `${prefix}${variableName}=${REDACTION_MARKER}`
      : whole,
  )
  redacted = redacted.replace(
    /(--[A-Za-z][A-Za-z0-9_-]*)(=|\s+)(?:"[^"]*"|'[^']*'|[^\s]+)/g,
    (whole, flag: string, separator: string) => isSensitiveKey(flag.slice(2))
      ? `${flag}${separator}${REDACTION_MARKER}`
      : whole,
  )
  redacted = redacted.replace(/https?:\/\/[^\s"'<>]+/gi, (url) => redactUrl(url))
  return redacted
}

function redactValue(value: unknown, context: RedactionContext, parentKey?: string): unknown {
  if (parentKey && isSensitiveKey(parentKey)) return REDACTION_MARKER
  if (typeof value === 'string') return redactString(value, context)
  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) {
      value[index] = redactValue(value[index], context)
    }
    return value
  }
  if (!isRecord(value)) return value

  for (const [key, nested] of Object.entries(value)) {
    value[key] = redactValue(nested, context, key)
  }
  return value
}

function redactRecordedTape(tape: ProxyTapeV2): ProxyTapeV2 {
  const sensitiveValues = new Set<string>()
  collectSensitiveValues(tape, sensitiveValues)
  return redactValue(tape, buildRedactionContext(sensitiveValues)) as ProxyTapeV2
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value)
  }

  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableStringify(entry)).join(',')}]`
  }

  const entries = Object.entries(value as Record<string, unknown>)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, nested]) => `${JSON.stringify(key)}:${stableStringify(nested)}`)
  return `{${entries.join(',')}}`
}

function matchesRedactedString(expected: string, actual: string): boolean {
  const segments = expected.split(REDACTION_MARKER)
  if (segments.length === 1) return expected === actual
  if (!actual.startsWith(segments[0]!)) return false

  let cursor = segments[0]!.length
  for (let index = 1; index < segments.length - 1; index += 1) {
    const segment = segments[index]!
    const segmentIndex = actual.indexOf(segment, cursor)
    if (segmentIndex === -1) return false
    cursor = segmentIndex + segment.length
  }
  return actual.slice(cursor).endsWith(segments.at(-1)!)
}

function matchesRedactedValue(expected: unknown, actual: unknown): boolean {
  if (expected === REDACTION_MARKER) return true
  if (typeof expected === 'string' && typeof actual === 'string') {
    return matchesRedactedString(expected, actual)
  }
  if (Array.isArray(expected)) {
    return Array.isArray(actual)
      && expected.length === actual.length
      && expected.every((entry, index) => matchesRedactedValue(entry, actual[index]))
  }
  if (isRecord(expected)) {
    if (!isRecord(actual)) return false
    const expectedKeys = Object.keys(expected).sort()
    const actualKeys = Object.keys(actual).sort()
    return expectedKeys.length === actualKeys.length
      && expectedKeys.every((key, index) => key === actualKeys[index])
      && expectedKeys.every((key) => matchesRedactedValue(expected[key], actual[key]))
  }
  return Object.is(expected, actual)
}

function sameParams(
  left: Record<string, unknown> | undefined,
  right: Record<string, unknown> | undefined,
  redacted = false,
): boolean {
  if (redacted) return matchesRedactedValue(left ?? null, right ?? null)
  return stableStringify(left ?? null) === stableStringify(right ?? null)
}

function sendEnvelope(output: Writable, envelope: Record<string, unknown>): void {
  output.write(`${JSON.stringify(envelope)}\n`)
}

function sendError(output: Writable, id: number | string | null, code: number, message: string): void {
  sendEnvelope(output, {
    jsonrpc: '2.0',
    id,
    error: {
      code,
      message,
    },
  })
}

async function loadReplayTape(filepath: string): Promise<ProxyTape> {
  const absolutePath = resolve(process.cwd(), filepath)
  let parsed: unknown
  try {
    parsed = JSON.parse(readFileSync(absolutePath, 'utf-8'))
  } catch (error) {
    throw new Error(
      `Replay tape could not be parsed as JSON: ${filepath}. ${error instanceof Error ? error.message : String(error)}`,
    )
  }
  return validateReplayTape(parsed, filepath)
}

async function writeTape(filepath: string, tape: ProxyTapeV2): Promise<void> {
  const absolutePath = resolve(process.cwd(), filepath)
  mkdirSync(dirname(absolutePath), { recursive: true })
  const temporaryPath = `${absolutePath}.${randomUUID()}.tmp`
  const content = `${JSON.stringify(redactRecordedTape(tape), null, 2)}\n`
  try {
    await writeFile(temporaryPath, content, { encoding: 'utf-8', flag: 'wx', mode: 0o600 })
    await rename(temporaryPath, absolutePath)
  } catch (error) {
    await rm(temporaryPath, { force: true }).catch(() => {})
    throw error
  }
}

function serializeError(error: unknown): { code: number; message: string } {
  if (error instanceof McpIntrospectionError) {
    return {
      code: error.rpcCode ?? -32000,
      message: error.message,
    }
  }

  return {
    code: -32000,
    message: error instanceof Error ? error.message : String(error),
  }
}

async function proxyLiveSession(client: McpClient, options: McpProxyOptions, io: ProxyIo): Promise<void> {
  const tape: ProxyTapeV2 | null = options.recordPath
    ? {
        version: TAPE_SCHEMA_VERSION,
        redaction: {
          policy: 'pluxx-default',
          version: REDACTION_POLICY_VERSION,
          marker: REDACTION_MARKER,
        },
        source: options.source,
        interactions: [],
      }
    : null

  const rl = readline.createInterface({
    input: io.input,
    crlfDelay: Infinity,
  })

  try {
    for await (const line of rl) {
      if (!line.trim()) continue

      let message: Record<string, unknown>
      try {
        message = JSON.parse(line) as Record<string, unknown>
      } catch {
        continue
      }

      const method = typeof message.method === 'string' ? message.method : undefined
      if (!method) continue

      const params = (typeof message.params === 'object' && message.params !== null)
        ? message.params as Record<string, unknown>
        : undefined
      const id = typeof message.id === 'number' || typeof message.id === 'string'
        ? message.id
        : null

      if (id === null) {
        await client.notify(method, params)
        tape?.interactions.push({
          kind: 'notify',
          method,
          ...(params ? { params } : {}),
        })
        continue
      }

      try {
        const result = await client.request<unknown>(method, params)
        sendEnvelope(io.output, {
          jsonrpc: '2.0',
          id,
          result,
        })
        tape?.interactions.push({
          kind: 'request',
          method,
          ...(params ? { params } : {}),
          result: result ?? null,
        })
      } catch (error) {
        const serialized = serializeError(error)
        sendError(io.output, id, serialized.code, serialized.message)
        tape?.interactions.push({
          kind: 'request',
          method,
          ...(params ? { params } : {}),
          error: serialized,
        })
      }
    }
  } finally {
    rl.close()
    let closeError: unknown
    try {
      await client.close()
    } catch (error) {
      closeError = error
    }
    if (tape && options.recordPath) {
      await writeTape(options.recordPath, tape)
    }
    if (closeError) throw closeError
  }
}

async function replaySession(filepath: string, io: ProxyIo): Promise<void> {
  const tape = await loadReplayTape(filepath)
  let interactionIndex = 0
  let replayWasExhausted = false
  const rl = readline.createInterface({
    input: io.input,
    crlfDelay: Infinity,
  })

  try {
    for await (const line of rl) {
      if (!line.trim()) continue

      let message: Record<string, unknown>
      try {
        message = JSON.parse(line) as Record<string, unknown>
      } catch {
        continue
      }

      const method = typeof message.method === 'string' ? message.method : undefined
      if (!method) continue

      const params = (typeof message.params === 'object' && message.params !== null)
        ? message.params as Record<string, unknown>
        : undefined
      const id = typeof message.id === 'number' || typeof message.id === 'string'
        ? message.id
        : null
      const expected = tape.interactions[interactionIndex]

      if (!expected) {
        replayWasExhausted = true
        const message = `Replay tape exhausted before handling ${method}.`
        if (id !== null) {
          sendError(io.output, id, -32001, message)
        } else {
          io.error.write(`${message}\n`)
        }
        continue
      }

      const actualKind = id === null ? 'notify' : 'request'
      const kindAndMethodMatch = expected.kind === actualKind && expected.method === method
      let comparableParams = params
      if (kindAndMethodMatch && tape.version === 2) {
        const sensitiveValues = new Set<string>()
        collectSensitiveValues(params, sensitiveValues)
        comparableParams = redactValue(
          params,
          buildRedactionContext(sensitiveValues),
        ) as Record<string, unknown> | undefined
      }
      const paramsMatch = kindAndMethodMatch
        && sameParams(expected.params, comparableParams, tape.version === 2)
      if (!kindAndMethodMatch || !paramsMatch) {
        const message = kindAndMethodMatch
          ? `Replay parameter mismatch for ${actualKind} ${method}.`
          : `Replay mismatch. Expected ${expected.kind} ${expected.method}, received ${actualKind} ${method}.`
        if (id !== null) {
          sendError(io.output, id, -32002, message)
        } else {
          io.error.write(`${message}\n`)
        }
        continue
      }

      interactionIndex += 1
      if (id === null) {
        continue
      }
      if (expected.kind === 'notify') {
        continue
      }

      if ('error' in expected) {
        sendError(io.output, id, expected.error.code, expected.error.message)
        continue
      }

      sendEnvelope(io.output, {
        jsonrpc: '2.0',
        id,
        result: expected.result ?? null,
      })
    }
  } finally {
    rl.close()
  }

  if (replayWasExhausted) {
    throw new Error('Replay input contained interactions after the tape was exhausted.')
  }

  const unusedCount = tape.interactions.length - interactionIndex
  if (unusedCount > 0) {
    const summary = tape.interactions
      .slice(interactionIndex, interactionIndex + 3)
      .map((entry) => `${entry.kind} ${entry.method}`)
      .join(', ')
    const message = `Replay tape has ${unusedCount} unused interaction${unusedCount === 1 ? '' : 's'}: ${summary}${unusedCount > 3 ? ', ...' : ''}.`
    io.error.write(`${message}\n`)
    throw new Error(message)
  }
}

export async function runMcpProxy(rawArgs: string[]): Promise<void> {
  return await runMcpProxyWithIo(rawArgs, {
    input: process.stdin,
    output: process.stdout,
    error: process.stderr,
  })
}

export async function runMcpProxyWithIo(rawArgs: string[], io: ProxyIo): Promise<void> {
  let options: McpProxyOptions
  try {
    options = parseOptions(rawArgs)
  } catch (error) {
    io.error.write(`${error instanceof Error ? error.message : String(error)}\n\n${usage()}\n`)
    throw new Error('Invalid MCP proxy arguments.')
  }

  if (options.replayPath) {
    await replaySession(options.replayPath, io)
    return
  }

  const source = parseMcpSourceInput(options.source!)
  const client = await createMcpClient(source)
  await proxyLiveSession(client, options, io)
}
