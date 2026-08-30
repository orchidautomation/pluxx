import {
  existsSync,
  lstatSync,
  readFileSync,
  readdirSync,
  realpathSync,
  statSync,
} from 'fs'
import { createHash } from 'crypto'
import { validateHeaderName, validateHeaderValue } from 'http'
import { relative, resolve } from 'path'
import type { McpServer, PluginConfig, PluxxCompilerBucket } from './schema'
import { parseSkillMarkdown } from './skills'
import {
  getAgentPluginsNativeOverlayContractAllowlist,
  lintUndocumentedAgentPluginsExtensionEmission,
  validateAgentPluginsNativeOverlayContract,
} from './agent-plugins-native-overlay-contract'

export const AGENT_PLUGINS_VERSION = '1.0.0'
export const AGENT_PLUGINS_PLUGIN_SCHEMA = `https://agent-plugins.org/schemas/${AGENT_PLUGINS_VERSION}/plugin.schema.json`
export const AGENT_PLUGINS_MCP_SCHEMA = `https://agent-plugins.org/schemas/${AGENT_PLUGINS_VERSION}/mcp.schema.json`

const PORTABLE_NAME = /^(?!.*(?:--|\.\.))[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/
const SKILL_NAME = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const PORTABLE_PLACEHOLDER = /\$\{([^}]+)\}/g

export interface AgentPluginsPortabilityDecision {
  bucket: PluxxCompilerBucket | 'mcp' | 'metadata'
  mode: 'preserve' | 'degrade' | 'drop'
  detail: string
}

export function getAgentPluginsPortabilityDecisions(config: PluginConfig): AgentPluginsPortabilityDecision[] {
  const decisions: AgentPluginsPortabilityDecision[] = [
    { bucket: 'skills', mode: 'preserve', detail: 'Agent Skills are emitted at immediate-child skills/<name>/SKILL.md locations.' },
    { bucket: 'distribution', mode: 'preserve', detail: 'A closed Agent Plugins 1.0.0 root plugin.json is emitted.' },
  ]

  if (config.mcp && Object.keys(config.mcp).length > 0) {
    decisions.push({ bucket: 'mcp', mode: 'preserve', detail: 'Representable MCP servers are emitted in root mcp.json.' })
  }
  if (config.instructions) decisions.push({ bucket: 'instructions', mode: 'drop', detail: 'Agent Plugins 1.0.0 has no portable instructions component.' })
  if (config.commands) decisions.push({ bucket: 'commands', mode: 'drop', detail: 'Agent Plugins 1.0.0 has no portable commands component.' })
  if (config.agents) decisions.push({ bucket: 'agents', mode: 'drop', detail: 'Agent Plugins 1.0.0 has no portable agents component.' })
  if (config.hooks) decisions.push({ bucket: 'hooks', mode: 'drop', detail: 'Hooks remain native-only; no client extension is inferred.' })
  if (config.permissions) decisions.push({ bucket: 'permissions', mode: 'drop', detail: 'Agent Plugins 1.0.0 defines no portable permission policy.' })
  if (config.readiness || config.scripts || config.assets || config.passthrough?.length || config.sharedRuntime) {
    decisions.push({ bucket: 'runtime', mode: 'drop', detail: 'Readiness, scripts, assets, passthrough content, and shared runtime are not copied as portable top-level components.' })
  }
  const omittedBrandFields = Object.entries({
    displayName: config.brand?.displayName,
    shortDescription: config.brand?.shortDescription,
    longDescription: config.brand?.longDescription,
    category: config.brand?.category,
    color: config.brand?.color,
    icon: config.brand?.icon,
    logo: config.brand?.logo,
    screenshots: config.brand?.screenshots?.length ? config.brand.screenshots : undefined,
    defaultPrompts: config.brand?.defaultPrompts?.length ? config.brand.defaultPrompts : undefined,
    privacyPolicyURL: config.brand?.privacyPolicyURL,
    termsOfServiceURL: config.brand?.termsOfServiceURL,
  }).filter(([, value]) => value !== undefined).map(([field]) => field).sort()
  if (omittedBrandFields.length > 0) {
    decisions.push({ bucket: 'metadata', mode: 'degrade', detail: `Agent Plugins manifest metadata is closed; omitted brand field(s): ${omittedBrandFields.join(', ')}.` })
  }
  if (config.userConfig?.length) {
    decisions.push({ bucket: 'metadata', mode: 'drop', detail: 'Agent Plugins 1.0.0 has no portable user configuration or secret-reference surface.' })
  }

  return decisions.sort((a, b) => a.bucket.localeCompare(b.bucket) || a.mode.localeCompare(b.mode))
}

export function buildAgentPluginsManifest(config: PluginConfig): Record<string, unknown> {
  if (config.name.length > 64 || !PORTABLE_NAME.test(config.name)) {
    throw new Error(`Agent Plugins plugin name "${config.name}" does not satisfy the 1.0.0 name constraints.`)
  }

  const manifest: Record<string, unknown> = {
    $schema: AGENT_PLUGINS_PLUGIN_SCHEMA,
    name: config.name,
    version: config.version,
    description: config.description,
    author: {
      name: config.author.name,
      ...(config.author.email ? { email: config.author.email } : {}),
      ...(config.author.url ? { url: config.author.url } : {}),
    },
    ...(config.brand?.websiteURL ? { homepage: config.brand.websiteURL } : {}),
    ...(config.repository ? { repository: config.repository } : {}),
    ...(config.license ? { license: config.license } : {}),
    ...(config.keywords ? { keywords: config.keywords } : {}),
  }

  assertClosedAgentPluginsManifest(manifest)
  return manifest
}

function assertNoUnknownPlaceholders(value: string, context: string): void {
  const unknown = [...value.matchAll(PORTABLE_PLACEHOLDER)]
    .map(match => match[1])
    .filter(name => name !== 'PLUGIN_ROOT' && name !== 'PLUGIN_DATA')
  if (unknown.length > 0) {
    throw new Error(`${context} uses unsupported Agent Plugins placeholder(s): ${[...new Set(unknown)].sort().join(', ')}.`)
  }
}

function assertPortableRemoteUrl(value: string, context: string): void {
  let url: URL
  try {
    url = new URL(value)
  } catch {
    throw new Error(`${context} must be an absolute HTTP or HTTPS URL.`)
  }
  if (url.username || url.password || url.hash) {
    throw new Error(`${context} must not include user information or a fragment.`)
  }
  const loopback = url.hostname === 'localhost'
    || /^127(?:\.\d{1,3}){3}$/.test(url.hostname)
    || url.hostname === '::1'
    || url.hostname === '[::1]'
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && loopback)) {
    throw new Error(`${context} must use HTTPS unless its host is exactly localhost or a loopback IP literal.`)
  }
}

function buildPortableMcpServer(name: string, server: McpServer): Record<string, unknown> {
  if (server.auth && server.auth.type !== 'none') {
    throw new Error(`MCP server "${name}" uses ${server.auth.type} auth, which Agent Plugins 1.0.0 cannot represent portably.`)
  }

  if (server.transport !== 'stdio' && ((server.args?.length ?? 0) > 0 || (server.env && Object.keys(server.env).length > 0))) {
    throw new Error(`Remote MCP server "${name}" carries args/env that Agent Plugins 1.0.0 remote transports cannot represent.`)
  }

  if (server.transport === 'stdio') {
    const command = server.command.replace(/^\$\{PLUGIN_ROOT\}\//, './')
    if (!command || (!command.startsWith('./') && /\s/.test(command))) {
      throw new Error(`MCP server "${name}" command must be a bare executable token or a contained ./ path.`)
    }
    if (command.includes('\\') || command.startsWith('/') || command.startsWith('../')) {
      throw new Error(`MCP server "${name}" command must be a bare executable or a contained ./ plugin path.`)
    }
    if (command.includes('/') && !command.startsWith('./')) {
      throw new Error(`MCP server "${name}" command path must begin with ./ when it is not a bare executable.`)
    }
    if (command.includes('${')) {
      throw new Error(`MCP server "${name}" command cannot contain placeholders.`)
    }
    for (const [index, value] of (server.args ?? []).entries()) {
      assertNoUnknownPlaceholders(value, `MCP server "${name}" args[${index}]`)
    }
    for (const [key, value] of Object.entries(server.env ?? {})) {
      if (key === 'PLUGIN_ROOT' || key === 'PLUGIN_DATA') {
        throw new Error(`MCP server "${name}" env must not override ${key}.`)
      }
      assertNoUnknownPlaceholders(value, `MCP server "${name}" env.${key}`)
    }
    return {
      type: 'stdio',
      command,
      ...(server.args?.length ? { args: server.args } : {}),
      ...(server.env && Object.keys(server.env).length > 0 ? { env: server.env } : {}),
    }
  }

  assertPortableRemoteUrl(server.url, `MCP server "${name}" url`)
  return {
    type: server.transport === 'sse' ? 'sse' : 'streamable-http',
    url: server.url,
  }
}

export function buildAgentPluginsMcpConfig(config: PluginConfig): Record<string, unknown> | undefined {
  if (!config.mcp) return undefined
  const entries = Object.entries(config.mcp)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, server]) => [name, buildPortableMcpServer(name, server)] as const)
  return {
    $schema: AGENT_PLUGINS_MCP_SCHEMA,
    mcpServers: Object.fromEntries(entries),
  }
}

export function getAgentPluginsMcpPortabilityErrors(config: PluginConfig): string[] {
  return Object.entries(config.mcp ?? {})
    .sort(([a], [b]) => a.localeCompare(b))
    .flatMap(([name, server]) => {
      try {
        buildPortableMcpServer(name, server)
        return []
      } catch (error) {
        return [error instanceof Error ? error.message : String(error)]
      }
    })
}

function assertContained(root: string, candidate: string, context: string): void {
  const rel = relative(root, candidate)
  if (rel === '..' || rel.startsWith(`..${process.platform === 'win32' ? '\\' : '/'}`) || rel.startsWith('../') || rel.startsWith('..\\')) {
    throw new Error(`${context} resolves outside the Agent Plugins package root.`)
  }
}

function walkRegularTree(root: string, current: string, files: string[]): void {
  assertContained(root, current, current)
  const details = lstatSync(current)
  if (details.isSymbolicLink()) throw new Error(`Agent Plugins package refuses symlink: ${relative(root, current) || '.'}.`)
  if (details.isFile()) {
    files.push(relative(root, current).replace(/\\/g, '/'))
    return
  }
  if (!details.isDirectory()) throw new Error(`Agent Plugins package contains unsupported filesystem entry: ${relative(root, current)}.`)
  for (const entry of readdirSync(current).sort()) walkRegularTree(root, resolve(current, entry), files)
}

export function validateAgentPluginsSkillSource(skillsRoot: string): string[] {
  if (!existsSync(skillsRoot) || lstatSync(skillsRoot).isSymbolicLink() || !lstatSync(skillsRoot).isDirectory()) {
    throw new Error('Agent Plugins skills source must be a real directory.')
  }
  const resolvedRoot = realpathSync(skillsRoot)
  const skillNames: string[] = []
  for (const entry of readdirSync(skillsRoot, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const entryPath = resolve(skillsRoot, entry.name)
    if (lstatSync(entryPath).isSymbolicLink()) throw new Error(`Agent Plugins skill entry "${entry.name}" must not be a symlink.`)
    if (!entry.isDirectory()) throw new Error(`Agent Plugins skills root may contain only immediate child skill directories; found "${entry.name}".`)
    const skillPath = resolve(entryPath, 'SKILL.md')
    if (!existsSync(skillPath) || !lstatSync(skillPath).isFile() || lstatSync(skillPath).isSymbolicLink()) {
      throw new Error(`Agent Plugins skill directory "${entry.name}" requires a regular immediate-child SKILL.md.`)
    }
    assertContained(resolvedRoot, realpathSync(skillPath), `Skill ${entry.name}/SKILL.md`)
    const parsed = parseSkillMarkdown(readFileSync(skillPath, 'utf-8'))
    if (!parsed.hasValidFrontmatter || parsed.frontmatterDiagnostics.length > 0 || !parsed.name || !parsed.description) {
      throw new Error(`Agent Plugins skill "${entry.name}" requires valid YAML frontmatter with name and description.`)
    }
    if (!SKILL_NAME.test(parsed.name) || parsed.name.length > 64 || parsed.name !== entry.name) {
      throw new Error(`Agent Plugins skill "${entry.name}" must have a matching lowercase kebab-case name up to 64 characters.`)
    }
    if (parsed.description.length > 1024) {
      throw new Error(`Agent Plugins skill "${entry.name}" description exceeds 1024 characters.`)
    }
    const portableFields = new Set(['name', 'description', 'license', 'compatibility', 'metadata', 'allowed-tools'])
    const unsupportedFields = [...parsed.frontmatterNodes.keys()].filter(key => !portableFields.has(key)).sort()
    if (unsupportedFields.length > 0) {
      throw new Error(`Agent Plugins skill "${entry.name}" contains non-portable frontmatter field(s): ${unsupportedFields.join(', ')}.`)
    }
    const compatibility = parsed.frontmatterNodes.get('compatibility')?.value
    if (compatibility !== undefined && (typeof compatibility !== 'string' || compatibility.length < 1 || compatibility.length > 500)) {
      throw new Error(`Agent Plugins skill "${entry.name}" compatibility must be a non-empty string up to 500 characters.`)
    }
    const metadata = parsed.frontmatterNodes.get('metadata')?.value
    if (metadata !== undefined && (
      !metadata
      || typeof metadata !== 'object'
      || Array.isArray(metadata)
      || Object.values(metadata as Record<string, unknown>).some(value => typeof value !== 'string')
    )) {
      throw new Error(`Agent Plugins skill "${entry.name}" metadata must map string keys to string values.`)
    }
    const allowedTools = parsed.frontmatterNodes.get('allowed-tools')?.value
    if (allowedTools !== undefined && typeof allowedTools !== 'string') {
      throw new Error(`Agent Plugins skill "${entry.name}" allowed-tools must be a space-separated string.`)
    }
    const license = parsed.frontmatterNodes.get('license')?.value
    if (license !== undefined && typeof license !== 'string') {
      throw new Error(`Agent Plugins skill "${entry.name}" license must be a string.`)
    }
    const files: string[] = []
    walkRegularTree(entryPath, entryPath, files)
    if (files.some(path => path !== 'SKILL.md' && path.endsWith('/SKILL.md'))) {
      throw new Error(`Agent Plugins skill "${entry.name}" contains a nested SKILL.md; only immediate children of skills/ are discoverable.`)
    }
    skillNames.push(entry.name)
  }
  return skillNames
}

export function assertClosedAgentPluginsManifest(manifest: Record<string, unknown>): void {
  const allowed = new Set(['$schema', 'name', 'version', 'description', 'author', 'homepage', 'repository', 'license', 'keywords', 'extensions'])
  const unknown = Object.keys(manifest).filter(key => !allowed.has(key))
  if (unknown.length > 0) throw new Error(`Agent Plugins plugin.json contains unknown field(s): ${unknown.sort().join(', ')}.`)
  if (manifest.$schema !== AGENT_PLUGINS_PLUGIN_SCHEMA) throw new Error('Agent Plugins plugin.json has an unsupported $schema.')
  if (typeof manifest.name !== 'string' || manifest.name.length > 64 || !PORTABLE_NAME.test(manifest.name)) throw new Error('Agent Plugins plugin.json has an invalid name.')
  for (const field of ['version', 'description', 'homepage', 'repository', 'license'] as const) {
    if (manifest[field] !== undefined && typeof manifest[field] !== 'string') throw new Error(`Agent Plugins plugin.json ${field} must be a string.`)
  }
  if (manifest.keywords !== undefined && (!Array.isArray(manifest.keywords) || manifest.keywords.some(value => typeof value !== 'string'))) {
    throw new Error('Agent Plugins plugin.json keywords must be an array of strings.')
  }
  if (manifest.author !== undefined) {
    if (!manifest.author || typeof manifest.author !== 'object' || Array.isArray(manifest.author)) throw new Error('Agent Plugins plugin.json author must be an object.')
    const author = manifest.author as Record<string, unknown>
    const unknownAuthor = Object.keys(author).filter(key => !['name', 'email', 'url'].includes(key))
    if (unknownAuthor.length > 0 || Object.values(author).some(value => typeof value !== 'string')) throw new Error('Agent Plugins plugin.json author may contain only string name, email, and url fields.')
  }
  if (manifest.extensions !== undefined) {
    const extensions = manifest.extensions
    if (!extensions || typeof extensions !== 'object' || Array.isArray(extensions)) throw new Error('Agent Plugins extensions must be an object.')
    for (const [namespace, value] of Object.entries(extensions as Record<string, unknown>)) {
      if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`Agent Plugins extension ${namespace} must be an object.`)
      if (!/^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.){2,}[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(namespace)) {
        throw new Error(`Agent Plugins extension namespace "${namespace}" is not a valid reverse-domain name.`)
      }
      const parts = namespace.split('.')
      const diagnostic = validateAgentPluginsNativeOverlayContract({
        namespaceOwner: parts.at(-1) as 'cursor' | 'openai' | 'anthropic' | 'opencode' | 'agent-plugins',
        directory: 'manifest',
        paths: Object.keys(value as Record<string, unknown>),
      }, getAgentPluginsNativeOverlayContractAllowlist())
      if (diagnostic.length > 0) throw new Error(diagnostic.map(item => item.message).join(' '))
    }
  }
}

function assertPortablePackagePath(packageRoot: string, value: string, context: string): void {
  const relativePath = value.startsWith('./')
    ? value.slice(2)
    : value.startsWith('${PLUGIN_ROOT}/')
      ? value.slice('${PLUGIN_ROOT}/'.length)
      : undefined
  if (value.includes('\\')) throw new Error(`${context} must use forward slashes.`)
  const pluginDataPath = value === '${PLUGIN_DATA}'
    ? ''
    : value.startsWith('${PLUGIN_DATA}/')
      ? value.slice('${PLUGIN_DATA}/'.length)
      : undefined
  if (pluginDataPath !== undefined) {
    if (pluginDataPath.split('/').some(part => part === '..' || part === '.')) throw new Error(`${context} escapes or ambiguously traverses PLUGIN_DATA.`)
    if (pluginDataPath !== '' && pluginDataPath.split('/').some(part => part === '')) throw new Error(`${context} contains an empty PLUGIN_DATA path segment.`)
    return
  }
  if (relativePath === undefined) return
  if (!relativePath || relativePath.split('/').some(part => part === '..' || part === '.' || part === '')) {
    throw new Error(`${context} contains an unsafe plugin-relative path.`)
  }
  const candidate = resolve(packageRoot, relativePath)
  assertContained(packageRoot, candidate, context)
}

function validatePortableMcpServer(packageRoot: string, name: string, value: unknown): void {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`Agent Plugins MCP server "${name}" must be an object.`)
  const server = value as Record<string, unknown>
  if (server.type === 'stdio') {
    const allowed = new Set(['type', 'command', 'args', 'env', 'cwd'])
    const unknown = Object.keys(server).filter(key => !allowed.has(key))
    if (unknown.length > 0) throw new Error(`Agent Plugins MCP server "${name}" contains unknown field(s): ${unknown.sort().join(', ')}.`)
    if (typeof server.command !== 'string' || !server.command || (!server.command.startsWith('./') && /\s/.test(server.command)) || server.command.includes('${')) {
      throw new Error(`Agent Plugins MCP server "${name}" command must be a bare executable token or one non-interpolated contained ./ path.`)
    }
    if (server.command.includes('\\') || server.command.startsWith('/') || server.command.startsWith('../') || (server.command.includes('/') && !server.command.startsWith('./'))) {
      throw new Error(`Agent Plugins MCP server "${name}" command must be a bare executable or a contained ./ plugin path.`)
    }
    if (server.args !== undefined && (!Array.isArray(server.args) || server.args.some(item => typeof item !== 'string'))) throw new Error(`Agent Plugins MCP server "${name}" args must be strings.`)
    for (const [index, arg] of ((server.args ?? []) as string[]).entries()) assertNoUnknownPlaceholders(arg, `MCP server "${name}" args[${index}]`)
    if (server.env !== undefined) {
      if (!server.env || typeof server.env !== 'object' || Array.isArray(server.env)) throw new Error(`Agent Plugins MCP server "${name}" env must be an object of strings.`)
      for (const [key, entry] of Object.entries(server.env as Record<string, unknown>)) {
        if (key === 'PLUGIN_ROOT' || key === 'PLUGIN_DATA' || typeof entry !== 'string') throw new Error(`Agent Plugins MCP server "${name}" env contains an invalid ${key} entry.`)
        assertNoUnknownPlaceholders(entry, `MCP server "${name}" env.${key}`)
      }
    }
    if (server.cwd !== undefined) {
      if (typeof server.cwd !== 'string' || !/^(?:\.\/|\$\{PLUGIN_ROOT\}(?:\/|$)|\$\{PLUGIN_DATA\}(?:\/|$))/.test(server.cwd)) throw new Error(`Agent Plugins MCP server "${name}" cwd is invalid.`)
      assertNoUnknownPlaceholders(server.cwd, `MCP server "${name}" cwd`)
      assertPortablePackagePath(packageRoot, server.cwd, `MCP server "${name}" cwd`)
    }
    if (server.command.startsWith('./')) {
      assertPortablePackagePath(packageRoot, server.command, `MCP server "${name}" command`)
      const executable = resolve(packageRoot, server.command.slice(2))
      if (!existsSync(executable) || !lstatSync(executable).isFile() || lstatSync(executable).isSymbolicLink()) {
        throw new Error(`Agent Plugins MCP server "${name}" references missing regular command path ${server.command}.`)
      }
    }
    return
  }
  if (server.type === 'streamable-http' || server.type === 'sse') {
    const allowed = new Set(['type', 'url', 'headers'])
    const unknown = Object.keys(server).filter(key => !allowed.has(key))
    if (unknown.length > 0) throw new Error(`Agent Plugins MCP server "${name}" contains unknown field(s): ${unknown.sort().join(', ')}.`)
    if (typeof server.url !== 'string') throw new Error(`Agent Plugins MCP server "${name}" url must be a string.`)
    assertPortableRemoteUrl(server.url, `MCP server "${name}" url`)
    if (server.headers !== undefined && (!server.headers || typeof server.headers !== 'object' || Array.isArray(server.headers) || Object.values(server.headers as Record<string, unknown>).some(item => typeof item !== 'string'))) {
      throw new Error(`Agent Plugins MCP server "${name}" headers must be an object of literal strings.`)
    }
    if (server.headers && typeof server.headers === 'object' && !Array.isArray(server.headers)) {
      const seen = new Set<string>()
      for (const [headerName, headerValue] of Object.entries(server.headers as Record<string, string>)) {
        try {
          validateHeaderName(headerName)
          validateHeaderValue(headerName, headerValue)
        } catch {
          throw new Error(`Agent Plugins MCP server "${name}" has an invalid HTTP header name or value for "${headerName}".`)
        }
        const normalized = headerName.toLowerCase()
        if (seen.has(normalized)) throw new Error(`Agent Plugins MCP server "${name}" contains duplicate case-insensitive header name "${headerName}".`)
        seen.add(normalized)
      }
    }
    return
  }
  throw new Error(`Agent Plugins MCP server "${name}" has unsupported type ${String(server.type)}.`)
}

export function validateAgentPluginsPackage(packageRoot: string): string[] {
  if (!existsSync(packageRoot) || lstatSync(packageRoot).isSymbolicLink() || !statSync(packageRoot).isDirectory()) throw new Error('Agent Plugins package root must be a real directory, not a symlink.')
  const files: string[] = []
  walkRegularTree(packageRoot, packageRoot, files)
  const overlayDiagnostics = lintUndocumentedAgentPluginsExtensionEmission(
    files,
    getAgentPluginsNativeOverlayContractAllowlist(),
  )
  if (overlayDiagnostics.some(diagnostic => diagnostic.level === 'error')) {
    throw new Error(overlayDiagnostics.map(diagnostic => diagnostic.message).join(' '))
  }
  const topLevel = new Set(readdirSync(packageRoot))
  for (const entry of topLevel) {
    if (!['plugin.json', 'mcp.json', 'skills'].includes(entry) && !entry.match(/^(?:com|org|io|dev)\./)) {
      throw new Error(`Agent Plugins package contains undocumented top-level entry: ${entry}.`)
    }
    if (entry.match(/^(?:com|org|io|dev)\./)) {
      throw new Error(`Agent Plugins package refuses unproven client extension directory: ${entry}.`)
    }
  }
  const manifestPath = resolve(packageRoot, 'plugin.json')
  if (!existsSync(manifestPath) || !lstatSync(manifestPath).isFile()) throw new Error('Agent Plugins package is missing root plugin.json.')
  assertClosedAgentPluginsManifest(JSON.parse(readFileSync(manifestPath, 'utf-8')) as Record<string, unknown>)
  if (topLevel.has('skills')) validateAgentPluginsSkillSource(resolve(packageRoot, 'skills'))
  if (topLevel.has('mcp.json')) {
    const mcp = JSON.parse(readFileSync(resolve(packageRoot, 'mcp.json'), 'utf-8')) as Record<string, unknown>
    if (mcp.$schema !== AGENT_PLUGINS_MCP_SCHEMA || !mcp.mcpServers || typeof mcp.mcpServers !== 'object' || Array.isArray(mcp.mcpServers)) {
      throw new Error('Agent Plugins mcp.json must contain the 1.0.0 $schema and mcpServers object.')
    }
    const unknown = Object.keys(mcp).filter(key => key !== '$schema' && key !== 'mcpServers')
    if (unknown.length > 0) throw new Error(`Agent Plugins mcp.json contains unknown field(s): ${unknown.sort().join(', ')}.`)
    for (const [name, server] of Object.entries(mcp.mcpServers as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b))) {
      validatePortableMcpServer(packageRoot, name, server)
    }
  }
  return files.sort()
}

export interface AgentPluginsDiscoveryReceipt {
  schema: 'pluxx.agent-plugins-discovery.v1'
  client: 'cursor' | 'codex'
  clientVersion: string
  artifactSha256: string
  skills: string[]
  mcpServers: string[]
}

/**
 * Deterministic compatible-client discovery seam for isolated fixtures.
 * This proves package discovery semantics only; callers must not label it a
 * real-host receipt unless a real client supplied the client/version identity.
 */
export function inspectAgentPluginsDiscovery(
  packageRoot: string,
  client: 'cursor' | 'codex',
  clientVersion: string,
): AgentPluginsDiscoveryReceipt {
  const files = validateAgentPluginsPackage(packageRoot)
  const hash = createHash('sha256')
  for (const file of files) {
    hash.update(file).update('\0').update(readFileSync(resolve(packageRoot, file))).update('\0')
  }
  const skillsRoot = resolve(packageRoot, 'skills')
  const skills = existsSync(skillsRoot) ? validateAgentPluginsSkillSource(skillsRoot) : []
  const mcpPath = resolve(packageRoot, 'mcp.json')
  const mcpServers = existsSync(mcpPath)
    ? Object.keys((JSON.parse(readFileSync(mcpPath, 'utf-8')) as { mcpServers: Record<string, unknown> }).mcpServers).sort()
    : []
  return {
    schema: 'pluxx.agent-plugins-discovery.v1',
    client,
    clientVersion,
    artifactSha256: hash.digest('hex'),
    skills,
    mcpServers,
  }
}
