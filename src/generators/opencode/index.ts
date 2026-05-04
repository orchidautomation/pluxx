import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'fs'
import { basename, extname, relative, resolve } from 'path'
import { Generator } from '../base'
import type { HookEntry, TargetPlatform } from '../../schema'
import { buildOpenCodePermissionMap } from '../../permissions'
import { readInstructionsContentSync } from '../../instructions'
import { buildGeneratedReadinessScript, getRuntimeReadinessPlan } from '../../readiness'
import { getRuntimeReadinessCapability } from '../../runtime-readiness-registry'
import { getCanonicalAgentMetadata, type AgentFrontmatterMap, type AgentFrontmatterValue, readCanonicalAgentFiles } from '../../agents'
import { getCanonicalCommandMetadata, readCanonicalCommandFiles } from '../../commands'

type GeneratedHook = {
  command: string
  timeout?: number
  matcher?: HookEntry['matcher']
  failClosed?: boolean
}

interface OpenCodeMcpDefinition {
  transport: 'http' | 'sse' | 'stdio'
  url?: string
  command?: string
  args?: string[]
  env?: Record<string, string>
  auth?: {
    type: 'bearer' | 'header' | 'none'
    envVar?: string
    headerName?: string
    headerTemplate?: string
  }
}

interface OpenCodeHookPlan {
  event: Record<string, GeneratedHook[]>
  toolBefore: {
    all: GeneratedHook[]
    read: GeneratedHook[]
    mcp: GeneratedHook[]
  }
  toolAfter: {
    all: GeneratedHook[]
    edit: GeneratedHook[]
    mcp: GeneratedHook[]
  }
  shellEnv: GeneratedHook[]
  chatMessage: GeneratedHook[]
}

export class OpenCodeGenerator extends Generator {
  readonly platform: TargetPlatform = 'opencode'

  async generate(): Promise<void> {
    await Promise.all([
      this.generatePackageJson(),
      this.generatePluginWrapper(),
      this.generateReadinessRuntime(),
    ])

    this.copySkills()
    this.copyCommands()
    this.copyAgents()
    this.copyScripts()
    this.copyAssets()
    this.copyPassthrough()
    this.rewriteOpenCodeSkillAgentMentions()
  }

  private async generatePackageJson(): Promise<void> {
    const npmName = this.config.platforms?.opencode?.npmPackage
      ?? `opencode-${this.config.name}`

    const pkg = {
      name: npmName,
      version: this.config.version,
      description: `${this.config.description} (OpenCode plugin)`,
      main: 'index.ts',
      type: 'module',
      keywords: [
        'opencode-plugin',
        ...(this.config.keywords ?? []),
      ],
      author: this.config.author.name,
      license: this.config.license,
      peerDependencies: {
        '@opencode-ai/plugin': '*',
      },
    }

    await this.writeJson('package.json', pkg)
  }

  private async generatePluginWrapper(): Promise<void> {
    const pluginName = toPascalCase(this.config.name) + 'Plugin'
    const envVars = this.getRequiredEnvVars()
    const mcpDefinitions = this.getOpenCodeMcpDefinitions()
    const commandDefinitions = this.getOpenCodeCommandDefinitions()
    const agentDefinitions = this.getOpenCodeAgentDefinitions()
    const hookPlan = this.getOpenCodeHookPlan()
    const readinessPlan = getRuntimeReadinessPlan(this.config.readiness)
    const readinessCapability = getRuntimeReadinessCapability('opencode')
    const instructions = this.getInstructionsContent()
    const permissionMap = buildOpenCodePermissionMap(this.config.permissions)

    const lines: string[] = [
      `import type { Config, Plugin } from "@opencode-ai/plugin"`,
      `import { existsSync, readFileSync } from "fs"`,
      `import { resolve } from "path"`,
      '',
      `type GeneratedHook = {`,
      `  command: string`,
      `  timeout?: number`,
      `  matcher?: string`,
      `  failClosed?: boolean`,
      `}`,
      '',
      `const REQUIRED_ENV_VARS = ${JSON.stringify(envVars, null, 2)}`,
      '',
      `const MCP_DEFINITIONS = ${JSON.stringify(mcpDefinitions, null, 2)}`,
      '',
      `const TUI_COMMANDS = ${JSON.stringify(commandDefinitions, null, 2)}`,
      '',
      `const AGENT_DEFINITIONS = ${JSON.stringify(agentDefinitions, null, 2)}`,
      '',
      `const EVENT_HOOKS: Record<string, GeneratedHook[]> = ${JSON.stringify(hookPlan.event, null, 2)}`,
      '',
      `const TOOL_BEFORE_HOOKS = ${JSON.stringify(hookPlan.toolBefore, null, 2)}`,
      '',
      `const TOOL_AFTER_HOOKS = ${JSON.stringify(hookPlan.toolAfter, null, 2)}`,
      '',
      `const SHELL_ENV_HOOKS = ${JSON.stringify(hookPlan.shellEnv, null, 2)}`,
      '',
      `const CHAT_MESSAGE_HOOKS = ${JSON.stringify(hookPlan.chatMessage, null, 2)}`,
      '',
      `const INSTRUCTIONS = ${JSON.stringify(instructions)}`,
      '',
      `const PERMISSIONS = ${JSON.stringify(permissionMap, null, 2)}`,
      '',
      `const READINESS_SCRIPT = ${JSON.stringify(readinessPlan.hasReadiness ? readinessCapability.scriptPath : null)}`,
      '',
      `const isMcpTool = (tool: string): boolean =>`,
      `  tool === "mcp" || tool.startsWith("mcp.") || tool.startsWith("mcp_")`,
      '',
      `const loadUserConfig = (directory: string): { values?: Record<string, string | number | boolean>; env?: Record<string, string> } => {`,
      `  const filepath = resolve(directory, ".pluxx-user.json")`,
      `  if (!existsSync(filepath)) return {}`,
      `  try {`,
      `    return JSON.parse(readFileSync(filepath, "utf-8"))`,
      `  } catch {`,
      `    return {}`,
      `  }`,
      `}`,
      '',
      `const resolveRuntimeValue = (name: string, userEnv: Record<string, string>): string | undefined =>`,
      `  userEnv[name] ?? process.env[name]`,
      '',
      `const materializeEnv = (input: Record<string, string> | undefined, userEnv: Record<string, string>): Record<string, string> | undefined => {`,
      `  if (!input) return undefined`,
      `  const output: Record<string, string> = {}`,
      `  for (const [key, value] of Object.entries(input)) {`,
      `    output[key] = value.replace(/\\$\\{([A-Za-z_][A-Za-z0-9_]*)\\}/g, (_match, name) => resolveRuntimeValue(name, userEnv) ?? \`\\\${\${name}}\`)`,
      `  }`,
      `  return output`,
      `}`,
      '',
      `const buildMcpConfig = (directory: string): NonNullable<Config["mcp"]> => {`,
      `  const config: NonNullable<Config["mcp"]> = {}`,
      `  const userEnv = loadUserConfig(directory).env ?? {}`,
      '',
      `  for (const [name, definition] of Object.entries(MCP_DEFINITIONS)) {`,
      `    if (definition.transport === "stdio" && definition.command) {`,
      `      config[name] = {`,
      `        type: "local",`,
      `        command: [definition.command, ...(definition.args ?? [])],`,
      `        ...(definition.env ? { environment: materializeEnv(definition.env, userEnv) } : {}),`,
      `      }`,
      `      continue`,
      `    }`,
      '',
      `    if (!definition.url) continue`,
      '',
      `    const remote: {`,
      `      type: "remote"`,
      `      url: string`,
      `      headers?: Record<string, string>`,
      `    } = {`,
      `      type: "remote",`,
      `      url: definition.url,`,
      `    }`,
      '',
      `    if (definition.auth?.type === "bearer" && definition.auth.envVar) {`,
      `      const token = resolveRuntimeValue(definition.auth.envVar, userEnv)`,
      `      if (token) remote.headers = { Authorization: \`Bearer \${token}\` }`,
      `    }`,
      '',
      `    if (definition.auth?.type === "header" && definition.auth.envVar && definition.auth.headerName && definition.auth.headerTemplate) {`,
      `      const value = resolveRuntimeValue(definition.auth.envVar, userEnv)`,
      `      if (value) {`,
      `        remote.headers = {`,
      `          ...(remote.headers ?? {}),`,
      `          [definition.auth.headerName]: definition.auth.headerTemplate.replace("\${value}", value),`,
      `        }`,
      `      }`,
      `    }`,
      '',
      `    config[name] = remote`,
      `  }`,
      '',
      `  return config`,
      `}`,
      '',
      `const applyInstructions = (system: string[]): void => {`,
      `  if (!INSTRUCTIONS) return`,
      `  if (!system.includes(INSTRUCTIONS)) {`,
      `    system.unshift(INSTRUCTIONS)`,
      `  }`,
      `}`,
      '',
      `/**`,
      ` * ${this.config.description}`,
      ` * Generated by pluxx — do not edit manually.`,
      ` */`,
      `export const ${pluginName}: Plugin = async ({ project, client, $, directory }) => {`,
      `  const shellSingleQuote = (input: string): string => \`'\${String(input ?? "").replace(/'/g, \`'"'"'\`)}'\``,
      '',
      `  const buildHookShellCommand = (rawCommand: string): string => {`,
      `    const userEnv = loadUserConfig(directory).env ?? {}`,
      `    const exports = Object.entries(userEnv)`,
      `      .filter(([key]) => /^[A-Za-z_][A-Za-z0-9_]*$/.test(key))`,
      `      .map(([key, value]) => \`export \${key}=\${shellSingleQuote(String(value))}\`)`,
      `      .join("; ")`,
      `    const command = rawCommand.replaceAll("\${PLUGIN_ROOT}", directory)`,
      `    return exports ? \`\${exports}; \${command}\` : command`,
      `  }`,
      '',
      `  const runHook = async (hook: GeneratedHook, context: Record<string, string>): Promise<void> => {`,
      `    try {`,
      `      const command = buildHookShellCommand(hook.command)`,
      `      const execution = $\`bash -lc \${command}\``,
      `      if (hook.timeout) {`,
      `        await Promise.race([`,
      `          execution,`,
      `          new Promise((_, reject) => {`,
      `            setTimeout(() => reject(new Error(\`Hook timed out after \${hook.timeout}ms: \${command}\`)), hook.timeout)`,
      `          }),`,
      `        ])`,
      `      } else {`,
      `        await execution`,
      `      }`,
      `    } catch (error) {`,
      `      await client.app.log({`,
      `        body: {`,
      `          service: "${this.config.name}",`,
      `          level: "error",`,
      `          message: "OpenCode hook execution failed",`,
      `          extra: {`,
      `            ...context,`,
      `            hook: hook.command,`,
      `            error: error instanceof Error ? error.message : String(error),`,
      `          },`,
      `        },`,
      `      })`,
      `      if (hook.failClosed) throw error`,
      `    }`,
      `  }`,
      '',
      `  const runHooks = async (hooks: GeneratedHook[], context: Record<string, string>): Promise<void> => {`,
      `    for (const hook of hooks) {`,
      `      await runHook(hook, context)`,
      `    }`,
      `  }`,
      '',
      `  const runReadiness = async (mode: string, event: Record<string, unknown>): Promise<void> => {`,
      `    if (!READINESS_SCRIPT) return`,
      `    const payload = Buffer.from(JSON.stringify(event ?? {}), "utf-8").toString("base64")`,
      `    const scriptPath = resolve(directory, READINESS_SCRIPT)`,
      `    const command = [`,
      `      \`PLUXX_PLUGIN_ROOT=\${shellSingleQuote(directory)}\`,`,
      `      \`PLUXX_READINESS_PAYLOAD=\${shellSingleQuote(payload)}\`,`,
      `      \`node \${shellSingleQuote(scriptPath)} \${shellSingleQuote(mode)}\`,`,
      `    ].join(" ")`,
      `    await $\`bash -lc \${command}\``,
      `  }`,
      '',
      `  return {`,
      `    config: async (config) => {`,
      `      if (Object.keys(MCP_DEFINITIONS).length > 0) {`,
      `        config.mcp = {`,
      `          ...(config.mcp ?? {}),`,
      `          ...buildMcpConfig(directory),`,
      `        }`,
      `      }`,
      '',
      `      if (Object.keys(TUI_COMMANDS).length > 0) {`,
      `        config.command = {`,
      `          ...(config.command ?? {}),`,
      `          ...TUI_COMMANDS,`,
      `        }`,
      `      }`,
      '',
      `      if (Object.keys(AGENT_DEFINITIONS).length > 0) {`,
      `        config.agent = {`,
      `          ...(config.agent ?? {}),`,
      `          ...AGENT_DEFINITIONS,`,
      `        }`,
      `      }`,
      '',
      `      if (Object.keys(PERMISSIONS).length > 0) {`,
      `        config.permission = {`,
      `          ...(config.permission ?? {}),`,
      `          ...PERMISSIONS,`,
      `        }`,
      `      }`,
      `    },`,
      '',
      `    "tool.execute.before": async (input, output) => {`,
      `      if (isMcpTool(input.tool)) {`,
      `        await runReadiness("mcp-gate", { ...input, tool_name: input.tool })`,
      `      }`,
      `      await runHooks(TOOL_BEFORE_HOOKS.all, { hookType: "tool.execute.before", tool: input.tool })`,
      `      if (input.tool === "read") {`,
      `        await runHooks(TOOL_BEFORE_HOOKS.read, { hookType: "tool.execute.before", tool: input.tool })`,
      `      }`,
      `      if (isMcpTool(input.tool)) {`,
      `        await runHooks(TOOL_BEFORE_HOOKS.mcp, { hookType: "tool.execute.before", tool: input.tool })`,
      `      }`,
      `    },`,
      '',
      `    "tool.execute.after": async (input, output) => {`,
      `      await runHooks(TOOL_AFTER_HOOKS.all, { hookType: "tool.execute.after", tool: input.tool })`,
      `      if (input.tool === "edit" || input.tool === "write") {`,
      `        await runHooks(TOOL_AFTER_HOOKS.edit, { hookType: "tool.execute.after", tool: input.tool })`,
      `      }`,
      `      if (isMcpTool(input.tool)) {`,
      `        await runHooks(TOOL_AFTER_HOOKS.mcp, { hookType: "tool.execute.after", tool: input.tool })`,
      `      }`,
      `    },`,
      '',
      `    "shell.env": async (input, output) => {`,
      `      await runHooks(SHELL_ENV_HOOKS, { hookType: "shell.env", cwd: input.cwd })`,
      `    },`,
      '',
      `    "chat.message": async (input, output) => {`,
      `      await runReadiness("prompt-gate", input ?? {})`,
      `      await runHooks(CHAT_MESSAGE_HOOKS, { hookType: "chat.message", sessionID: input.sessionID })`,
      `    },`,
      '',
      `    "experimental.chat.system.transform": async (input, output) => {`,
      `      applyInstructions(output.system)`,
      `    },`,
      '',
      `    "experimental.session.compacting": async (input, output) => {`,
      `      if (INSTRUCTIONS && !output.context.includes(INSTRUCTIONS)) {`,
      `        output.context.push(INSTRUCTIONS)`,
      `      }`,
      `    },`,
      '',
      `    event: async ({ event }) => {`,
      `      if (event.type === "session.created") {`,
      `        await runReadiness("session-start", event)`,
    ]

    for (const envVar of envVars) {
      lines.push(`        if (!process.env.${envVar}) {`)
      lines.push(`          await client.app.log({`)
      lines.push(`            body: {`)
      lines.push(`              service: "${this.config.name}",`)
      lines.push(`              level: "warn",`)
      lines.push(`              message: "${envVar} is not set. ${this.config.brand?.displayName ?? this.config.name} plugin may not work correctly.",`)
      lines.push(`            },`)
      lines.push(`          })`)
      lines.push(`        }`)
    }
    lines.push(`      }`)
    lines.push(`      const hooks = EVENT_HOOKS[event.type] ?? []`)
    lines.push(`      await runHooks(hooks, { hookType: "event", event: event.type })`)
    lines.push(`    },`)

    lines.push(`  }`)
    lines.push(`}`)
    lines.push('')

    await this.writeFile('index.ts', lines.join('\n'))
  }

  private async generateReadinessRuntime(): Promise<void> {
    if (!this.config.readiness) return
    await this.writeFile('runtime/pluxx-readiness.mjs', buildGeneratedReadinessScript(this.config.readiness))
  }

  private getRequiredEnvVars(): string[] {
    const vars = new Set<string>()
    if (this.config.mcp) {
      for (const server of Object.values(this.config.mcp)) {
        if (server.auth && 'envVar' in server.auth && server.auth.envVar) {
          vars.add(server.auth.envVar)
        }
      }
    }
    return [...vars]
  }

  private getOpenCodeMcpDefinitions(): Record<string, OpenCodeMcpDefinition> {
    if (!this.config.mcp) return {}

    const output: Record<string, OpenCodeMcpDefinition> = {}
    for (const [name, server] of Object.entries(this.config.mcp)) {
      const auth = server.auth?.type === 'platform'
        ? undefined
        : server.auth

      output[name] = {
        transport: server.transport,
        ...(server.url ? { url: server.url } : {}),
        ...(server.command ? { command: server.command } : {}),
        ...(server.args ? { args: server.args } : {}),
        ...(server.env ? { env: server.env } : {}),
        ...(auth ? { auth } : {}),
      }
    }
    return output
  }

  private getOpenCodeCommandDefinitions(): Record<string, {
    template: string
    description?: string
    whenToUse?: string
    argumentHint?: string
    arguments?: string[]
    examples?: string[]
    skill?: string
    skills?: string[]
    agent?: string
    subtask?: boolean
    model?: string
    context?: string
  }> {
    if (!this.config.commands) return {}

    const commandsDir = this.resolveConfigPath(this.config.commands, 'commands')
    const commands = readCanonicalCommandFiles(commandsDir)
    const output: Record<string, {
      template: string
      description?: string
      whenToUse?: string
      argumentHint?: string
      arguments?: string[]
      examples?: string[]
      skill?: string
      skills?: string[]
      agent?: string
      subtask?: boolean
      model?: string
      context?: string
    }> = {}

    for (const command of commands) {
      const metadata = getCanonicalCommandMetadata(command)
      output[metadata.commandId] = {
        template: metadata.template,
        ...(metadata.description ? { description: metadata.description } : {}),
        ...(metadata.whenToUse ? { whenToUse: metadata.whenToUse } : {}),
        ...(metadata.argumentHint ? { argumentHint: metadata.argumentHint } : {}),
        ...(metadata.arguments.length > 0 ? { arguments: metadata.arguments } : {}),
        ...(metadata.examples.length > 0 ? { examples: metadata.examples } : {}),
        ...(metadata.skill ? { skill: metadata.skill } : {}),
        ...(metadata.skills.length > 0 ? { skills: metadata.skills } : {}),
        ...(metadata.agent ? { agent: metadata.agent } : {}),
        ...(typeof metadata.subtask === 'boolean' ? { subtask: metadata.subtask } : {}),
        ...(metadata.model ? { model: metadata.model } : {}),
        ...(metadata.context ? { context: metadata.context } : {}),
      }
    }

    return output
  }

  private getOpenCodeAgentDefinitions(): Record<string, Record<string, unknown>> {
    if (!this.config.agents) return {}

    const agentsDir = this.resolveConfigPath(this.config.agents, 'agents')
    const agents = readCanonicalAgentFiles(agentsDir)
    const output: Record<string, Record<string, unknown>> = {}

    for (const agent of agents) {
      const metadata = getCanonicalAgentMetadata(agent)
      const definition: Record<string, unknown> = {
        description: metadata.description,
      }

      if (metadata.body) {
        definition.prompt = metadata.body
      }

      if (metadata.mode) {
        definition.mode = metadata.mode
      }
      if (metadata.model) {
        definition.model = metadata.model
      }
      if (typeof metadata.temperature === 'number') {
        definition.temperature = metadata.temperature
      }
      if (typeof metadata.steps === 'number') {
        definition.steps = metadata.steps
      }
      if (typeof metadata.disabled === 'boolean') {
        definition.disable = metadata.disabled
      }
      if (metadata.hidden) {
        definition.hidden = metadata.hidden
      }
      if (metadata.color) {
        definition.color = metadata.color
      }
      if (typeof metadata.topP === 'number') {
        definition.topP = metadata.topP
      }
      const legacyToolTranslation = translateLegacyOpenCodeTools(agent.frontmatter.tools)
      const permission = mergeOpenCodeMaps(
        legacyToolTranslation.permission,
        asOpenCodeMap(agent.frontmatter.permission),
      )
      if (permission) {
        definition.permission = permission
      }
      const tools = legacyToolTranslation.untranslated
      if (tools) {
        definition.tools = tools
      }

      output[metadata.name] = definition
    }

    return output
  }

  private getInstructionsContent(): string | null {
    return readInstructionsContentSync(this.rootDir, this.config)?.trim() ?? null
  }

  private getOpenCodeHookPlan(): OpenCodeHookPlan {
    const plan: OpenCodeHookPlan = {
      event: {},
      toolBefore: { all: [], read: [], mcp: [] },
      toolAfter: { all: [], edit: [], mcp: [] },
      shellEnv: [],
      chatMessage: [],
    }

    if (!this.config.hooks) return plan

    for (const [event, entries] of Object.entries(this.config.hooks)) {
      if (!entries || entries.length === 0) continue

      const hooks = entries
        .filter(entry => entry.type !== 'prompt' && entry.command)
        .map(entry => ({
          command: entry.command!,
          ...(entry.timeout ? { timeout: entry.timeout } : {}),
          ...(entry.matcher ? { matcher: entry.matcher } : {}),
          ...(entry.failClosed !== undefined ? { failClosed: entry.failClosed } : {}),
        }))

      if (hooks.length === 0) continue

      switch (event) {
        case 'preToolUse':
          plan.toolBefore.all.push(...hooks)
          break
        case 'beforeReadFile':
          plan.toolBefore.read.push(...hooks)
          break
        case 'beforeMCPExecution':
          plan.toolBefore.mcp.push(...hooks)
          break
        case 'postToolUse':
          plan.toolAfter.all.push(...hooks)
          break
        case 'afterFileEdit':
          plan.toolAfter.edit.push(...hooks)
          break
        case 'afterMCPExecution':
          plan.toolAfter.mcp.push(...hooks)
          break
        case 'beforeShellExecution':
          plan.shellEnv.push(...hooks)
          break
        case 'beforeSubmitPrompt':
          plan.chatMessage.push(...hooks)
          break
        default: {
          const opencodeEvent = mapHookEventName(event)
          if (!plan.event[opencodeEvent]) {
            plan.event[opencodeEvent] = []
          }
          plan.event[opencodeEvent].push(...hooks)
        }
      }
    }

    return plan
  }

  private walkFiles(dir: string): string[] {
    const entries = readdirSync(dir)
    const files: string[] = []

    for (const entry of entries) {
      const fullPath = resolve(dir, entry)
      const stat = statSync(fullPath)
      if (stat.isDirectory()) {
        files.push(...this.walkFiles(fullPath))
      } else if (stat.isFile()) {
        files.push(fullPath)
      }
    }

    return files
  }

  private rewriteOpenCodeSkillAgentMentions(): void {
    if (!this.config.agents || !this.config.skills) return

    const skillsDir = resolve(this.outDir, 'skills')
    if (!existsSync(skillsDir)) return

    const agentsDir = this.resolveConfigPath(this.config.agents, 'agents')
    const agentNames = readCanonicalAgentFiles(agentsDir).map((agent) => agent.name).filter(Boolean)
    if (agentNames.length === 0) return

    for (const filePath of this.walkFiles(skillsDir)) {
      if (basename(filePath) !== 'SKILL.md') continue

      const source = readFileSync(filePath, 'utf-8')
      let rewritten = source

      for (const agentName of agentNames) {
        const escaped = escapeRegExp(agentName)
        rewritten = rewritten.replace(new RegExp(`\`(${escaped})\``, 'g'), '`@$1`')
      }

      if (rewritten !== source) {
        writeFileSync(filePath, rewritten)
      }
    }
  }
}

function asOpenCodeMap(value: unknown): AgentFrontmatterMap | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined
  return value as AgentFrontmatterMap
}

function mergeOpenCodeMaps(
  base: AgentFrontmatterMap | undefined,
  override: AgentFrontmatterMap | undefined,
): AgentFrontmatterMap | undefined {
  if (!base) return override
  if (!override) return base

  const merged: AgentFrontmatterMap = { ...base }
  for (const [key, value] of Object.entries(override)) {
    if (isOpenCodeMap(merged[key]) && isOpenCodeMap(value)) {
      merged[key] = {
        ...(merged[key] as AgentFrontmatterMap),
        ...value,
      }
      continue
    }
    merged[key] = value
  }
  return merged
}

function translateLegacyOpenCodeTools(value: unknown): {
  permission?: AgentFrontmatterMap
  untranslated?: AgentFrontmatterMap
} {
  const tools = asOpenCodeMap(value)
  if (!tools) return {}

  const permission: AgentFrontmatterMap = {}
  const untranslated: AgentFrontmatterMap = {}

  for (const [rawKey, rawValue] of Object.entries(tools)) {
    const key = normalizeLegacyOpenCodeToolKey(rawKey)
    const translated = translateLegacyOpenCodeToolValue(rawValue)
    if (translated === undefined) {
      untranslated[rawKey] = rawValue
      continue
    }
    permission[key] = translated
  }

  return {
    ...(Object.keys(permission).length > 0 ? { permission } : {}),
    ...(Object.keys(untranslated).length > 0 ? { untranslated } : {}),
  }
}

function normalizeLegacyOpenCodeToolKey(key: string): string {
  switch (key) {
    case 'write':
    case 'patch':
    case 'multiedit':
      return 'edit'
    case 'shell':
      return 'bash'
    default:
      return key
  }
}

function translateLegacyOpenCodeToolValue(value: unknown): AgentFrontmatterValue | undefined {
  if (typeof value === 'boolean') {
    return value ? 'allow' : 'deny'
  }

  if (typeof value === 'string' && ['allow', 'ask', 'deny'].includes(value)) {
    return value
  }

  if (!isOpenCodeMap(value)) return undefined

  const nested: AgentFrontmatterMap = {}
  for (const [key, rawNested] of Object.entries(value)) {
    const translated = translateLegacyOpenCodeToolValue(rawNested)
    if (translated === undefined || typeof translated === 'object') {
      return undefined
    }
    nested[key] = translated
  }

  return nested
}

function isOpenCodeMap(value: unknown): value is AgentFrontmatterMap {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}


function mapHookEventName(event: string): string {
  const map: Record<string, string> = {
    sessionStart: 'session.created',
    sessionEnd: 'session.idle',
    stop: 'session.idle',
    beforeShellExecution: 'shell.env',
    afterShellExecution: 'command.executed',
    preToolUse: 'tool.execute.before',
    postToolUse: 'tool.execute.after',
    beforeMCPExecution: 'tool.execute.before',
    afterMCPExecution: 'tool.execute.after',
    afterFileEdit: 'file.edited',
    beforeReadFile: 'tool.execute.before',
    beforeSubmitPrompt: 'chat.message',
  }
  return map[event] ?? event
}

function toPascalCase(str: string): string {
  return str
    .split('-')
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join('')
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
