import type { RuntimeReadiness } from './schema'

export interface RuntimeReadinessPlan {
  hasReadiness: boolean
  dependencyIds: string[]
  needsSessionStart: boolean
  needsMcpGate: boolean
  needsPromptGate: boolean
  hasNamedMcpTools: boolean
  hasNamedPromptTargets: boolean
}

export function getRuntimeReadinessPlan(readiness: RuntimeReadiness | undefined): RuntimeReadinessPlan {
  if (!readiness || (readiness.dependencies.length === 0 && readiness.gates.length === 0)) {
    return {
      hasReadiness: false,
      dependencyIds: [],
      needsSessionStart: false,
      needsMcpGate: false,
      needsPromptGate: false,
      hasNamedMcpTools: false,
      hasNamedPromptTargets: false,
    }
  }

  return {
    hasReadiness: true,
    dependencyIds: readiness.dependencies.map((dependency) => dependency.id),
    needsSessionStart: readiness.dependencies.length > 0,
    needsMcpGate: readiness.gates.some((gate) => gate.applyTo.includes('mcp-tools')),
    needsPromptGate: readiness.gates.some((gate) => gate.applyTo.includes('skills') || gate.applyTo.includes('commands')),
    hasNamedMcpTools: readiness.gates.some((gate) => (gate.tools?.length ?? 0) > 0),
    hasNamedPromptTargets: readiness.gates.some((gate) => (gate.skills?.length ?? 0) > 0 || (gate.commands?.length ?? 0) > 0),
  }
}

export function buildGeneratedReadinessScript(readiness: RuntimeReadiness): string {
  const serializedReadiness = JSON.stringify(readiness, null, 2)

  return `import { existsSync, readFileSync } from "node:fs"
import { resolve } from "node:path"
import { spawn } from "node:child_process"

const READINESS = ${serializedReadiness}

function sleep(ms) {
  return new Promise((resolvePromise) => setTimeout(resolvePromise, ms))
}

function firstValue(...values) {
  return values.find((value) => typeof value === "string" && value.trim() !== "")
}

function shellSingleQuote(value) {
  return "'" + String(value ?? "").replace(/'/g, "'\\"'\\"'") + "'"
}

function parseMcpName(raw) {
  if (!raw) return undefined
  if (raw.startsWith("mcp__")) {
    const match = raw.match(/^mcp__([^_]+)__(.+)$/)
    if (match) return match[1] + "." + match[2].replace(/__/g, ".")
  }
  return raw
}

function getNestedValue(input, dottedPath) {
  return dottedPath.split(".").reduce((value, segment) => {
    if (!value || typeof value !== "object" || !(segment in value)) return undefined
    return value[segment]
  }, input)
}

function resolvePluginPath(input, pluginRoot) {
  if (!input) return pluginRoot
  return resolve(
    pluginRoot,
    String(input)
      .replaceAll("\${PLUGIN_ROOT}", pluginRoot)
      .replaceAll("\${CLAUDE_PLUGIN_ROOT}", pluginRoot)
      .replaceAll("\${CURSOR_PLUGIN_ROOT}", pluginRoot)
      .replaceAll("\${CODEX_PLUGIN_ROOT}", pluginRoot)
      .replaceAll("\${OPENCODE_PLUGIN_ROOT}", pluginRoot),
  )
}

function loadUserEnv(pluginRoot) {
  const filepath = resolve(pluginRoot, ".pluxx-user.json")
  if (!existsSync(filepath)) return {}
  try {
    const parsed = JSON.parse(readFileSync(filepath, "utf-8"))
    const env = parsed && typeof parsed === "object" && parsed.env && typeof parsed.env === "object"
      ? parsed.env
      : {}
    return Object.fromEntries(
      Object.entries(env).filter(([key]) => /^[A-Za-z_][A-Za-z0-9_]*$/.test(key)),
    )
  } catch {
    return {}
  }
}

function parsePayloadFromEnvironment() {
  const encoded = process.env.PLUXX_READINESS_PAYLOAD
  if (!encoded) return null
  try {
    return JSON.parse(Buffer.from(encoded, "base64").toString("utf-8"))
  } catch {
    return null
  }
}

function parseJsonInput() {
  const inlinePayload = parsePayloadFromEnvironment()
  if (inlinePayload) return Promise.resolve(inlinePayload)

  const chunks = []
  process.stdin.setEncoding("utf8")
  return new Promise((resolvePromise, reject) => {
    process.stdin.on("data", (chunk) => chunks.push(chunk))
    process.stdin.on("end", () => {
      const raw = chunks.join("").trim()
      if (!raw) return resolvePromise({})
      try {
        resolvePromise(JSON.parse(raw))
      } catch (error) {
        reject(error)
      }
    })
    process.stdin.on("error", reject)
  })
}

function inferToolName(event) {
  return firstValue(event.tool_name, event.toolName, event.tool, event.matcher)
}

function inferPromptText(event) {
  return firstValue(
    event.prompt,
    event.message,
    event.text,
    event.user_message,
    event.userMessage,
    event.query,
    event.input,
  )
}

function appliesToNamedPromptTargets(gate, promptText) {
  const prompt = String(promptText ?? "").toLowerCase()
  if (!prompt) return false

  const commandMatches = (gate.commands ?? []).some((command) => prompt.includes("/" + String(command).toLowerCase()))
  const skillMatches = (gate.skills ?? []).some((skill) => {
    const normalized = String(skill).toLowerCase()
    return (
      prompt.includes(normalized)
      || prompt.includes("@" + normalized)
      || prompt.includes(":" + normalized)
      || prompt.includes("/" + normalized)
    )
  })

  return commandMatches || skillMatches
}

function gateApplies(mode, gate, event) {
  if (mode === "mcp-gate") {
    if (!gate.applyTo.includes("mcp-tools")) return false
    if (!gate.tools || gate.tools.length === 0) return true
    const toolName = parseMcpName(inferToolName(event))
    if (!toolName) return true
    return gate.tools.includes(toolName)
  }

  if (mode === "prompt-gate") {
    if (!gate.applyTo.includes("skills") && !gate.applyTo.includes("commands")) return false
    const hasNamedTargets = (gate.skills?.length ?? 0) > 0 || (gate.commands?.length ?? 0) > 0
    if (!hasNamedTargets) return true
    return appliesToNamedPromptTargets(gate, inferPromptText(event))
  }

  return false
}

function readDependencyStatus(dependency, pluginRoot) {
  const filepath = resolvePluginPath(dependency.path, pluginRoot)
  if (!existsSync(filepath)) return { status: undefined, reason: "missing" }
  try {
    const parsed = JSON.parse(readFileSync(filepath, "utf-8"))
    const value = getNestedValue(parsed, dependency.statusField)
    return { status: typeof value === "string" ? value : undefined, reason: "ok" }
  } catch (error) {
    return {
      status: undefined,
      reason: error instanceof Error ? error.message : String(error),
    }
  }
}

function buildGateMessage(dependency, gate, detail) {
  if (gate.message) return gate.message + (detail ? " " + detail : "")
  return "Runtime readiness gate for " + dependency.id + " blocked: " + detail
}

async function waitForDependency(dependency, gate, pluginRoot) {
  const startedAt = Date.now()
  while (true) {
    const observed = readDependencyStatus(dependency, pluginRoot)
    const status = observed.status

    if (typeof status === "string" && dependency.readyValues.includes(status)) {
      return
    }

    if (typeof status === "string" && dependency.failedValues.includes(status)) {
      throw new Error(buildGateMessage(dependency, gate, 'observed failed status "' + status + '"'))
    }

    if (Date.now() - startedAt >= gate.timeoutMs) {
      const detail = typeof status === "string"
        ? 'timed out waiting for ready status; last status was "' + status + '"'
        : "timed out waiting for status file readiness"

      if (gate.onTimeout === "continue") return
      if (gate.onTimeout === "warn") {
        process.stderr.write(buildGateMessage(dependency, gate, detail) + "\\n")
        return
      }
      throw new Error(buildGateMessage(dependency, gate, detail))
    }

    await sleep(gate.pollMs)
  }
}

function buildCommandEnv(pluginRoot, userEnv) {
  return {
    ...process.env,
    ...userEnv,
    PLUXX_PLUGIN_ROOT: pluginRoot,
  }
}

function triggerRefresh(dependency, pluginRoot, userEnv) {
  const command = String(dependency.refresh.command)
    .replaceAll("\${PLUGIN_ROOT}", pluginRoot)
    .replaceAll("\${CLAUDE_PLUGIN_ROOT}", pluginRoot)
    .replaceAll("\${CURSOR_PLUGIN_ROOT}", pluginRoot)
    .replaceAll("\${CODEX_PLUGIN_ROOT}", pluginRoot)
    .replaceAll("\${OPENCODE_PLUGIN_ROOT}", pluginRoot)

  const child = spawn("bash", ["-lc", command], {
    cwd: pluginRoot,
    env: buildCommandEnv(pluginRoot, userEnv),
    detached: dependency.refresh.detached,
    stdio: dependency.refresh.detached ? "ignore" : "inherit",
  })

  if (dependency.refresh.detached) {
    child.unref()
    return
  }

  const timeoutMs = dependency.refresh.timeoutMs
  return new Promise((resolvePromise, reject) => {
    const timer = setTimeout(() => {
      child.kill("SIGTERM")
      reject(new Error('Readiness refresh command timed out after ' + timeoutMs + 'ms for dependency "' + dependency.id + '".'))
    }, timeoutMs)

    child.on("error", (error) => {
      clearTimeout(timer)
      reject(error)
    })

    child.on("close", (code) => {
      clearTimeout(timer)
      if (code === 0) {
        resolvePromise(undefined)
        return
      }
      reject(new Error('Readiness refresh command exited with code ' + code + ' for dependency "' + dependency.id + '".'))
    })
  })
}

async function main() {
  const mode = process.argv[2]
  const pluginRoot = process.env.PLUXX_PLUGIN_ROOT
    ? resolve(process.env.PLUXX_PLUGIN_ROOT)
    : resolve(process.cwd())
  const event = await parseJsonInput()
  const userEnv = loadUserEnv(pluginRoot)

  if (mode === "session-start") {
    for (const dependency of READINESS.dependencies) {
      await triggerRefresh(dependency, pluginRoot, userEnv)
    }
    return
  }

  const dependencyMap = new Map(READINESS.dependencies.map((dependency) => [dependency.id, dependency]))
  for (const gate of READINESS.gates) {
    if (!gateApplies(mode, gate, event)) continue
    const dependency = dependencyMap.get(gate.dependency)
    if (!dependency) continue
    await waitForDependency(dependency, gate, pluginRoot)
  }
}

main().catch((error) => {
  process.stderr.write(String(error instanceof Error ? error.message : error) + "\\n")
  process.exit(1)
})
`
}
