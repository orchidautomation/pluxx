import { accessSync, constants, existsSync, lstatSync, readFileSync, readdirSync } from 'fs'
import { basename, dirname, resolve } from 'path'
import { CONFIG_FILES, loadConfig } from '../config/load'
import { findInstalledBundleIntegrityIssues, listHookCommands } from './install'
import { PLATFORM_LIMITS, getCoreFourPrimitiveCapabilities, type CoreFourPlatform, type PrimitiveTranslationMode } from '../validation/platform-rules'
import { getConfiguredCompilerBuckets, type McpServer, type PluginConfig, type TargetPlatform } from '../schema'
import { PLUXX_COMPILER_INTENT_PATH, readCompilerIntent } from '../compiler-intent'
import { MCP_SCAFFOLD_METADATA_PATH, type McpScaffoldMetadata } from './init-from-mcp'
import { buildPrimitiveTranslationSummary, renderPrimitiveTranslationSummary, type PrimitiveTranslationSummary } from './primitive-summary'
import { isPlaceholderSecretValue } from '../user-config'
import { getBrandingCompletenessWarnings } from '../branding-completeness'
import { findLeakedPluginRootVars } from '../mcp-stdio-paths'

export type DoctorLevel = 'error' | 'warning' | 'info' | 'success'

export interface DoctorCheck {
  level: DoctorLevel
  code: string
  title: string
  detail: string
  fix: string
  path?: string
}

export interface DoctorReport {
  ok: boolean
  errors: number
  warnings: number
  infos: number
  checks: DoctorCheck[]
  primitiveSummary?: PrimitiveTranslationSummary
}

const CORE_FOUR = new Set<TargetPlatform>(['claude-code', 'cursor', 'codex', 'opencode'])
const ENV_VAR_NAME = /^[A-Za-z_][A-Za-z0-9_]*$/
const GENERIC_TOOL_NAME_PATTERNS = [
  /^tool[_-]?\d+$/i,
  /^function[_-]?\d+$/i,
  /^action[_-]?\d+$/i,
  /^untitled/i,
  /^mcp[-_]?tool/i,
]
const LOW_INFO_DESCRIPTION_PATTERNS = [
  /^n\/?a$/i,
  /^none$/i,
  /^todo$/i,
  /^tbd$/i,
  /^description$/i,
  /^no description provided\.?$/i,
]
const MATERIALIZED_ENV_MARKER = 'materialized required config'
const MIN_NODE_MAJOR = 18

const PRIMITIVE_MODE_LEVEL: Record<PrimitiveTranslationMode, DoctorLevel> = {
  preserve: 'success',
  translate: 'info',
  degrade: 'warning',
  drop: 'warning',
}

type ConsumerPlatform = 'claude-code' | 'cursor' | 'codex' | 'opencode'

interface ConsumerBundleLayout {
  kind: 'installed-platform'
  platform: ConsumerPlatform
  manifestPath: string
  mcpConfigPath?: string
}

type ConsumerLayoutDetection =
  | ConsumerBundleLayout
  | { kind: 'source-project' }
  | { kind: 'multi-target-dist' }
  | { kind: 'unknown' }

function addCheck(checks: DoctorCheck[], check: DoctorCheck): void {
  checks.push(check)
}

function summarizeChecks(checks: DoctorCheck[]): DoctorReport {
  const visibleChecks = checks.filter((check) => !check.code.startsWith('primitive-'))
  const errors = visibleChecks.filter((check) => check.level === 'error').length
  const warnings = visibleChecks.filter((check) => check.level === 'warning').length
  const infos = visibleChecks.filter((check) => check.level === 'info').length

  return {
    ok: errors === 0,
    errors,
    warnings,
    infos,
    checks,
  }
}

function parseMajorVersion(version: string | undefined): number | null {
  if (!version) return null
  const match = version.match(/^(\d+)/)
  return match ? Number(match[1]) : null
}

function addRuntimeChecks(checks: DoctorCheck[], mode: 'project' | 'consumer'): void {
  const nodeVersion = process.versions.node
  const nodeMajor = parseMajorVersion(nodeVersion)
  const doctorCommand = mode === 'consumer' ? 'pluxx doctor --consumer' : 'pluxx doctor'

  if (!nodeVersion || nodeMajor === null || nodeMajor < MIN_NODE_MAJOR) {
    addCheck(checks, {
      level: 'error',
      code: 'node-version-unsupported',
      title: 'Unsupported Node runtime',
      detail: nodeVersion
        ? `Detected Node ${nodeVersion}. The published pluxx CLI requires Node >= ${MIN_NODE_MAJOR}.`
        : `Could not detect a supported Node runtime. The published pluxx CLI requires Node >= ${MIN_NODE_MAJOR}.`,
      fix: `Install Node ${MIN_NODE_MAJOR}+ and rerun ${doctorCommand}.`,
    })
  } else {
    addCheck(checks, {
      level: 'success',
      code: 'node-version',
      title: 'Supported Node runtime detected',
      detail: `Node ${nodeVersion} is available for published pluxx CLI commands.`,
      fix: 'No action needed.',
    })
  }
}

function checkReadablePath(
  checks: DoctorCheck[],
  rootDir: string,
  label: string,
  configuredPath: string | undefined,
  required: boolean,
): void {
  if (!configuredPath) {
    if (required) {
      addCheck(checks, {
        level: 'error',
        code: 'path-missing',
        title: `${label} path missing`,
        detail: `The config does not define a ${label.toLowerCase()} path.`,
        fix: `Add a valid ${label.toLowerCase()} path to pluxx.config.ts.`,
        path: 'pluxx.config.ts',
      })
    }
    return
  }

  const resolvedPath = resolve(rootDir, configuredPath)
  if (!existsSync(resolvedPath)) {
    addCheck(checks, {
      level: 'error',
      code: 'path-not-found',
      title: `${label} path not found`,
      detail: `Configured ${label.toLowerCase()} path does not exist: ${configuredPath}`,
      fix: `Create ${configuredPath} or update the path in pluxx.config.ts.`,
      path: configuredPath,
    })
    return
  }

  try {
    accessSync(resolvedPath, constants.R_OK)
    addCheck(checks, {
      level: 'success',
      code: 'path-readable',
      title: `${label} path readable`,
      detail: `${configuredPath} is present and readable.`,
      fix: 'No action needed.',
      path: configuredPath,
    })
  } catch {
    addCheck(checks, {
      level: 'error',
      code: 'path-unreadable',
      title: `${label} path unreadable`,
      detail: `Configured ${label.toLowerCase()} path is not readable: ${configuredPath}`,
      fix: `Adjust permissions on ${configuredPath}.`,
      path: configuredPath,
    })
  }
}

function checkTargetPlatforms(checks: DoctorCheck[], config: PluginConfig): void {
  const betaTargets = config.targets.filter((target) => !CORE_FOUR.has(target))

  if (betaTargets.length === 0) {
    addCheck(checks, {
      level: 'success',
      code: 'targets-core-four',
      title: 'Core-four target set',
      detail: `Configured targets stay within the primary launch path: ${config.targets.join(', ')}`,
      fix: 'No action needed.',
      path: 'pluxx.config.ts',
    })
    return
  }

  addCheck(checks, {
    level: 'warning',
    code: 'targets-beta',
    title: 'Beta targets configured',
    detail: `These targets are generated but less validated: ${betaTargets.join(', ')}`,
    fix: 'Prefer claude-code, cursor, codex, and opencode for prime-time support.',
    path: 'pluxx.config.ts',
  })
}

function isCoreFourPlatform(target: TargetPlatform): target is CoreFourPlatform {
  return CORE_FOUR.has(target)
}

function describePrimitiveTranslation(
  target: CoreFourPlatform,
  bucket: ReturnType<typeof getConfiguredCompilerBuckets>[number],
  mode: PrimitiveTranslationMode,
  nativeSurfaces: string[],
): { title: string; detail: string; fix: string } {
  const surfaceList = nativeSurfaces.join(', ')

  switch (mode) {
    case 'preserve':
      return {
        title: `${bucket} preserves on ${target}`,
        detail: `The active ${bucket} bucket maps directly to native ${target} surfaces: ${surfaceList}.`,
        fix: 'No action needed.',
      }
    case 'translate':
      return {
        title: `${bucket} translates on ${target}`,
        detail: `The active ${bucket} bucket is re-expressed for ${target} through native surfaces such as ${surfaceList}.`,
        fix: 'Review generated output if you rely on host-specific behavior in this bucket.',
      }
    case 'degrade':
      return {
        title: `${bucket} degrades on ${target}`,
        detail: `The active ${bucket} bucket only has a weaker ${target} equivalent. Pluxx falls back to native surfaces such as ${surfaceList}.`,
        fix: 'Expect reduced fidelity on this target and verify the generated output before shipping.',
      }
    case 'drop':
      return {
        title: `${bucket} drops on ${target}`,
        detail: `The active ${bucket} bucket has no truthful ${target} equivalent and may be omitted during compilation.`,
        fix: 'Redesign this bucket for portability or remove the target if this behavior is required.',
      }
  }
}

function checkPrimitiveTranslations(checks: DoctorCheck[], config: PluginConfig): void {
  const configuredBuckets = getConfiguredCompilerBuckets(config)

  for (const target of config.targets) {
    if (!isCoreFourPlatform(target)) continue

    const capabilities = getCoreFourPrimitiveCapabilities(target)
    for (const bucket of configuredBuckets) {
      const capability = capabilities.buckets[bucket]
      const description = describePrimitiveTranslation(
        target,
        bucket,
        capability.mode,
        capability.nativeSurfaces,
      )

      addCheck(checks, {
        level: PRIMITIVE_MODE_LEVEL[capability.mode],
        code: `primitive-${capability.mode}`,
        title: description.title,
        detail: description.detail,
        fix: description.fix,
        path: 'pluxx.config.ts',
      })
    }
  }
}

function checkMcpServer(checks: DoctorCheck[], serverName: string, server: McpServer): void {
  const basePath = 'pluxx.config.ts'

  if (server.transport === 'stdio') {
    if (!server.command.trim()) {
      addCheck(checks, {
        level: 'error',
        code: 'mcp-stdio-command-empty',
        title: `MCP stdio command missing for ${serverName}`,
        detail: `The stdio MCP server "${serverName}" does not define a command.`,
        fix: `Set mcp.${serverName}.command to the executable used to start the server.`,
        path: basePath,
      })
    } else {
      addCheck(checks, {
        level: 'success',
        code: 'mcp-stdio-command',
        title: `MCP stdio command configured for ${serverName}`,
        detail: `The stdio MCP server "${serverName}" starts with "${server.command}".`,
        fix: 'No action needed.',
        path: basePath,
      })
    }

    for (const key of Object.keys(server.env ?? {})) {
      if (!ENV_VAR_NAME.test(key)) {
        addCheck(checks, {
          level: 'warning',
          code: 'mcp-env-key-invalid',
          title: `Invalid env var name for ${serverName}`,
          detail: `The env key "${key}" is not a shell-safe environment variable name.`,
          fix: `Rename ${key} to a shell-safe env var such as ${key.replace(/[^A-Za-z0-9_]/g, '_').toUpperCase()}.`,
          path: basePath,
        })
      }
    }
  } else {
    addCheck(checks, {
      level: 'success',
      code: 'mcp-remote-url',
      title: `Remote MCP URL configured for ${serverName}`,
      detail: `The ${server.transport.toUpperCase()} MCP server "${serverName}" points to ${server.url}.`,
      fix: 'No action needed.',
      path: basePath,
    })
  }

  if (server.auth?.type && server.auth.type !== 'none') {
    if (server.auth.type === 'platform') {
      addCheck(checks, {
        level: 'info',
        code: 'mcp-auth-platform',
        title: `Platform-managed auth declared for ${serverName}`,
        detail: `${serverName} expects native platform auth at runtime (${server.auth.mode}).`,
        fix: 'Complete the platform auth flow in Claude Code or Cursor before calling authenticated tools.',
        path: basePath,
      })
      return
    }

    if (!ENV_VAR_NAME.test(server.auth.envVar)) {
      addCheck(checks, {
        level: 'error',
        code: 'mcp-auth-env-invalid',
        title: `Invalid auth env var for ${serverName}`,
        detail: `Auth env var "${server.auth.envVar}" is not a valid shell environment variable name.`,
        fix: `Rename the env var for ${serverName} to a shell-safe name like ${server.auth.envVar.replace(/[^A-Za-z0-9_]/g, '_').toUpperCase()}.`,
        path: basePath,
      })
    } else {
      addCheck(checks, {
        level: 'info',
        code: 'mcp-auth-env',
        title: `Auth env var declared for ${serverName}`,
        detail: `${serverName} expects ${server.auth.envVar} to be provided at runtime.`,
        fix: `Export ${server.auth.envVar} before linting, building, or installing the generated plugin.`,
        path: basePath,
      })
    }
  }
}

function checkMcpConfig(checks: DoctorCheck[], config: PluginConfig): void {
  const servers = Object.entries(config.mcp ?? {})
  if (servers.length === 0) {
    addCheck(checks, {
      level: 'info',
      code: 'mcp-none-configured',
      title: 'No MCP servers configured',
      detail: 'This plugin does not currently define any MCP servers.',
      fix: 'No action needed unless this plugin should wrap an MCP server.',
      path: 'pluxx.config.ts',
    })
    return
  }

  for (const [serverName, server] of servers) {
    checkMcpServer(checks, serverName, server)
  }
}

function checkUserConfig(checks: DoctorCheck[], config: PluginConfig): void {
  const entries = config.userConfig ?? []
  if (entries.length === 0) {
    addCheck(checks, {
      level: 'info',
      code: 'user-config-none',
      title: 'No userConfig entries declared',
      detail: 'This plugin does not currently declare install-time config entries.',
      fix: 'No action needed unless this plugin needs install-time config or secret handling.',
      path: 'pluxx.config.ts',
    })
    return
  }

  const invalidEnvEntries = entries.filter((entry) => entry.envVar && !ENV_VAR_NAME.test(entry.envVar))
  if (invalidEnvEntries.length > 0) {
    addCheck(checks, {
      level: 'warning',
      code: 'user-config-env-invalid',
      title: 'Invalid userConfig env var name',
      detail: `${invalidEnvEntries.length} userConfig entr${invalidEnvEntries.length === 1 ? 'y' : 'ies'} use invalid env var names.`,
      fix: 'Rename the env var to a shell-safe name and keep userConfig aligned with the install/runtime config contract.',
      path: 'pluxx.config.ts',
    })
  }

  const secretEntriesWithoutEnv = entries.filter((entry) => entry.type === 'secret' && !entry.envVar)
  if (secretEntriesWithoutEnv.length > 0) {
    addCheck(checks, {
      level: 'warning',
      code: 'user-config-secret-missing-env',
      title: 'Secret userConfig entries should declare envVar',
      detail: `${secretEntriesWithoutEnv.length} secret userConfig entr${secretEntriesWithoutEnv.length === 1 ? 'y' : 'ies'} are missing envVar bindings.`,
      fix: 'Bind secret entries to env vars so Pluxx can persist and validate install-time config safely.',
      path: 'pluxx.config.ts',
    })
  }

  addCheck(checks, {
    level: 'info',
    code: 'user-config-declared',
    title: 'userConfig entries declared',
    detail: `${entries.length} install-time config entr${entries.length === 1 ? 'y' : 'ies'} are declared.`,
    fix: 'No action needed.',
    path: 'pluxx.config.ts',
  })
}

function checkHookTrust(checks: DoctorCheck[], config: PluginConfig): void {
  const commands = listHookCommands(config.hooks)
  if (commands.length === 0) {
    addCheck(checks, {
      level: 'success',
      code: 'hooks-no-commands',
      title: 'No command hooks configured',
      detail: 'This plugin does not define hook commands that execute shell code locally.',
      fix: 'No action needed.',
      path: 'pluxx.config.ts',
    })
    return
  }

  addCheck(checks, {
    level: 'warning',
    code: 'hooks-trust-required',
    title: 'Hook commands require install trust',
    detail: `This plugin defines local hook commands: ${commands.map((command) => `${command.event} -> ${command.command}`).join('; ')}`,
    fix: 'Review the commands carefully. Users will need to opt in with pluxx install --trust.',
    path: 'pluxx.config.ts',
  })
}

function checkBrandMetadataCompleteness(checks: DoctorCheck[], config: PluginConfig): void {
  for (const warning of getBrandingCompletenessWarnings(config)) {
    addCheck(checks, {
      level: 'warning',
      code: warning.code,
      title: warning.title,
      detail: warning.message,
      fix: warning.fix,
      path: 'pluxx.config.ts',
    })
  }
}

function isSafeManagedPath(path: string): boolean {
  return path !== '' && !path.startsWith('/') && !path.includes('..')
}

function formatSampleNames(values: string[]): string {
  if (values.length === 0) return 'none'
  const sample = values.slice(0, 3)
  return values.length > sample.length
    ? `${sample.join(', ')} (+${values.length - sample.length} more)`
    : sample.join(', ')
}

function normalizeMetadataText(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
}

function isLowInfoDescription(description: string): boolean {
  const normalizedDescription = normalizeMetadataText(description)
  return LOW_INFO_DESCRIPTION_PATTERNS.some((pattern) => pattern.test(normalizedDescription))
}

function checkMcpMetadataQuality(checks: DoctorCheck[], metadata: McpScaffoldMetadata): void {
  const tools = metadata.tools ?? []
  if (tools.length === 0) {
    return
  }

  const missingDescription = tools
    .filter((tool) => !tool.description || tool.description.trim() === '')
    .map((tool) => tool.name)
  const lowInfoDescription = tools
    .filter((tool) => {
      const description = tool.description?.trim()
      if (!description) return false
      return isLowInfoDescription(description)
    })
    .map((tool) => tool.name)
  const genericNames = tools
    .filter((tool) => GENERIC_TOOL_NAME_PATTERNS.some((pattern) => pattern.test(tool.name.trim())))
    .map((tool) => tool.name)

  const findings: string[] = []
  if (missingDescription.length > 0) {
    findings.push(`missing descriptions: ${formatSampleNames(missingDescription)}`)
  }
  if (lowInfoDescription.length > 0) {
    findings.push(`low-information descriptions: ${formatSampleNames(lowInfoDescription)}`)
  }
  if (genericNames.length > 0) {
    findings.push(`generic tool names: ${formatSampleNames(genericNames)}`)
  }

  if (findings.length === 0) {
    addCheck(checks, {
      level: 'success',
      code: 'mcp-metadata-quality-ok',
      title: 'MCP metadata quality looks strong',
      detail: `Tool metadata quality checks passed for ${tools.length} tool(s).`,
      fix: 'No action needed.',
      path: MCP_SCAFFOLD_METADATA_PATH,
    })
    return
  }

  addCheck(checks, {
    level: 'warning',
    code: 'mcp-metadata-quality-weak',
    title: 'MCP metadata quality is weak in scaffold source',
    detail: `Weak metadata signals detected across ${tools.length} tool(s): ${findings.join('; ')}`,
    fix: 'Before publishing, run `pluxx agent run review` and refine generated sections with concrete tool descriptions and product-shaped naming.',
    path: MCP_SCAFFOLD_METADATA_PATH,
  })
}

function checkCompilerIntent(checks: DoctorCheck[], rootDir: string): void {
  try {
    const compilerIntent = readCompilerIntent(rootDir)
    if (!compilerIntent) return

    if ((compilerIntent.skillPolicies?.length ?? 0) === 0) {
      addCheck(checks, {
        level: 'info',
        code: 'compiler-intent-empty',
        title: 'Compiler intent file present',
        detail: `${PLUXX_COMPILER_INTENT_PATH} exists but does not currently carry migrated source-host policy rows.`,
        fix: 'No action needed unless you expected migrated source-host policy to survive into generated outputs.',
        path: PLUXX_COMPILER_INTENT_PATH,
      })
      return
    }

    const sourceLabels = [...new Set(
      compilerIntent.skillPolicies.map((policy) => `${policy.source.platform}:${policy.source.kind}`),
    )]

    addCheck(checks, {
      level: 'info',
      code: 'compiler-intent-source-host',
      title: 'Imported source-host intent still influences compilation',
      detail: `${PLUXX_COMPILER_INTENT_PATH} preserves ${compilerIntent.skillPolicies.length} migrated skill polic${compilerIntent.skillPolicies.length === 1 ? 'y' : 'ies'} from ${sourceLabels.join(', ')} so Pluxx can translate that source-host intent into native target surfaces.`,
      fix: 'Review the generated permissions, agents, and host companions to confirm the migrated source-host assumptions still match the plugin you want to ship.',
      path: PLUXX_COMPILER_INTENT_PATH,
    })
  } catch (error) {
    addCheck(checks, {
      level: 'warning',
      code: 'compiler-intent-invalid',
      title: 'Compiler intent file could not be parsed',
      detail: error instanceof Error ? error.message : String(error),
      fix: `Repair or remove ${PLUXX_COMPILER_INTENT_PATH} and rerun pluxx doctor.`,
      path: PLUXX_COMPILER_INTENT_PATH,
    })
  }
}

function checkScaffoldMetadata(checks: DoctorCheck[], rootDir: string, config: PluginConfig): void {
  const metadataPath = resolve(rootDir, MCP_SCAFFOLD_METADATA_PATH)
  if (!existsSync(metadataPath)) {
    addCheck(checks, {
      level: 'info',
      code: 'mcp-metadata-missing',
      title: 'No MCP scaffold metadata found',
      detail: `No ${MCP_SCAFFOLD_METADATA_PATH} file was found in this project.`,
      fix: 'No action needed unless this project was created with pluxx init --from-mcp.',
      path: MCP_SCAFFOLD_METADATA_PATH,
    })
    return
  }

  try {
    const metadata = JSON.parse(readFileSync(metadataPath, 'utf-8')) as McpScaffoldMetadata
    const invalidManaged = metadata.managedFiles.filter((path) => !isSafeManagedPath(path))
    if (metadata.version !== 1) {
      addCheck(checks, {
        level: 'warning',
        code: 'mcp-metadata-version',
        title: 'Unexpected MCP scaffold metadata version',
        detail: `Found scaffold metadata version ${String(metadata.version)}.`,
        fix: 'Re-run pluxx sync --from-mcp to refresh the scaffold metadata.',
        path: MCP_SCAFFOLD_METADATA_PATH,
      })
    } else if (invalidManaged.length > 0) {
      addCheck(checks, {
        level: 'error',
        code: 'mcp-metadata-managed-paths',
        title: 'Unsafe managed file paths in MCP metadata',
        detail: `Managed file list contains unsafe relative paths: ${invalidManaged.join(', ')}`,
        fix: 'Re-run pluxx init --from-mcp or pluxx sync --from-mcp to regenerate the metadata.',
        path: MCP_SCAFFOLD_METADATA_PATH,
      })
    } else {
      addCheck(checks, {
        level: 'success',
        code: 'mcp-metadata-valid',
        title: 'MCP scaffold metadata parsed successfully',
        detail: `Managed scaffold metadata is present with ${metadata.managedFiles.length} managed files.`,
        fix: 'No action needed.',
        path: MCP_SCAFFOLD_METADATA_PATH,
      })
    }

    if (metadata.settings.pluginName !== config.name) {
      addCheck(checks, {
        level: 'warning',
        code: 'mcp-metadata-plugin-mismatch',
        title: 'MCP scaffold metadata name mismatch',
        detail: `Metadata was generated for "${metadata.settings.pluginName}" but the config name is "${config.name}".`,
        fix: 'If this plugin was renamed, run pluxx sync --from-mcp to refresh generated metadata.',
        path: MCP_SCAFFOLD_METADATA_PATH,
      })
    }

    checkMcpMetadataQuality(checks, metadata)
  } catch (error) {
    addCheck(checks, {
      level: 'error',
      code: 'mcp-metadata-invalid',
      title: 'MCP scaffold metadata is not parseable',
      detail: error instanceof Error ? error.message : String(error),
      fix: `Repair or delete ${MCP_SCAFFOLD_METADATA_PATH}, then re-run pluxx init --from-mcp or pluxx sync --from-mcp.`,
      path: MCP_SCAFFOLD_METADATA_PATH,
    })
  }
}

function detectConsumerLayout(rootDir: string): ConsumerLayoutDetection {
  if (existsSync(resolve(rootDir, '.claude-plugin/plugin.json'))) {
    return {
      kind: 'installed-platform',
      platform: 'claude-code',
      manifestPath: '.claude-plugin/plugin.json',
      mcpConfigPath: '.mcp.json',
    }
  }

  if (existsSync(resolve(rootDir, '.cursor-plugin/plugin.json'))) {
    return {
      kind: 'installed-platform',
      platform: 'cursor',
      manifestPath: '.cursor-plugin/plugin.json',
      mcpConfigPath: 'mcp.json',
    }
  }

  if (existsSync(resolve(rootDir, '.codex-plugin/plugin.json'))) {
    return {
      kind: 'installed-platform',
      platform: 'codex',
      manifestPath: '.codex-plugin/plugin.json',
      mcpConfigPath: '.mcp.json',
    }
  }

  const packagePath = resolve(rootDir, 'package.json')
  const indexPath = resolve(rootDir, 'index.ts')
  if (existsSync(packagePath) && existsSync(indexPath)) {
    try {
      const pkg = JSON.parse(readFileSync(packagePath, 'utf-8')) as {
        peerDependencies?: Record<string, string>
        keywords?: string[]
      }
      if (pkg.peerDependencies?.['@opencode-ai/plugin'] || pkg.keywords?.includes('opencode-plugin')) {
        return {
          kind: 'installed-platform',
          platform: 'opencode',
          manifestPath: 'package.json',
        }
      }
    } catch {
      return {
        kind: 'installed-platform',
        platform: 'opencode',
        manifestPath: 'package.json',
      }
    }
  }

  if (CONFIG_FILES.some((filename) => existsSync(resolve(rootDir, filename)))) {
    return { kind: 'source-project' }
  }

  if (['claude-code', 'cursor', 'codex', 'opencode'].some((dir) => existsSync(resolve(rootDir, dir)))) {
    return { kind: 'multi-target-dist' }
  }

  return { kind: 'unknown' }
}

function readJsonFile<T>(rootDir: string, relativePath: string): T {
  return JSON.parse(readFileSync(resolve(rootDir, relativePath), 'utf-8')) as T
}

function checkConsumerBundlePath(checks: DoctorCheck[], rootDir: string): void {
  try {
    accessSync(rootDir, constants.R_OK)
    const details = lstatSync(rootDir)
    addCheck(checks, {
      level: 'success',
      code: 'consumer-path-readable',
      title: 'Consumer bundle path readable',
      detail: `${rootDir} is present and readable${details.isSymbolicLink() ? ' (symlinked install)' : ''}.`,
      fix: 'No action needed.',
      path: rootDir,
    })
  } catch {
    addCheck(checks, {
      level: 'error',
      code: 'consumer-path-unreadable',
      title: 'Consumer bundle path unreadable',
      detail: `The installed plugin path is not readable: ${rootDir}`,
      fix: 'Fix the path or permissions and rerun pluxx doctor --consumer.',
      path: rootDir,
    })
  }
}

function checkConsumerManifest(checks: DoctorCheck[], rootDir: string, layout: ConsumerBundleLayout): void {
  try {
    const manifest = readJsonFile<Record<string, unknown>>(rootDir, layout.manifestPath)
    const name = typeof manifest.name === 'string' && manifest.name.trim() !== ''
      ? manifest.name
      : layout.platform
    const version = typeof manifest.version === 'string' && manifest.version.trim() !== ''
      ? manifest.version
      : 'unknown'

    addCheck(checks, {
      level: 'success',
      code: 'consumer-manifest-valid',
      title: 'Installed plugin manifest parsed successfully',
      detail: `Detected ${name}@${version} for ${layout.platform}.`,
      fix: 'No action needed.',
      path: layout.manifestPath,
    })
  } catch (error) {
    addCheck(checks, {
      level: 'error',
      code: 'consumer-manifest-invalid',
      title: 'Installed plugin manifest is not parseable',
      detail: error instanceof Error ? error.message : String(error),
      fix: 'Rebuild or reinstall this plugin bundle and rerun pluxx doctor --consumer.',
      path: layout.manifestPath,
    })
  }
}

function checkInstalledUserConfig(checks: DoctorCheck[], rootDir: string): void {
  const userConfigPath = '.pluxx-user.json'
  const resolvedPath = resolve(rootDir, userConfigPath)
  if (!existsSync(resolvedPath)) {
    addCheck(checks, {
      level: 'info',
      code: 'consumer-user-config-missing',
      title: 'No local install config materialized',
      detail: 'This bundle does not include a .pluxx-user.json file.',
      fix: 'If tools require secrets or install-time config, reinstall the plugin and provide the requested values.',
      path: userConfigPath,
    })
    return
  }

  try {
    const payload = JSON.parse(readFileSync(resolvedPath, 'utf-8')) as {
      values?: Record<string, unknown>
      env?: Record<string, string>
    }
    const valueCount = Object.keys(payload.values ?? {}).length
    const envCount = Object.keys(payload.env ?? {}).length
    const placeholderKeys = [
      ...Object.entries(payload.values ?? {})
        .filter(([, value]) => isPlaceholderSecretValue(value))
        .map(([key]) => key),
      ...Object.entries(payload.env ?? {})
        .filter(([, value]) => isPlaceholderSecretValue(value))
        .map(([key]) => key),
    ]
    addCheck(checks, {
      level: 'success',
      code: 'consumer-user-config-valid',
      title: 'Local install config parsed successfully',
      detail: `.pluxx-user.json contains ${valueCount} saved value entr${valueCount === 1 ? 'y' : 'ies'} and ${envCount} env binding${envCount === 1 ? '' : 's'}.`,
      fix: 'No action needed.',
      path: userConfigPath,
    })
    if (placeholderKeys.length > 0) {
      addCheck(checks, {
        level: 'warning',
        code: 'consumer-user-config-placeholder-secret',
        title: 'Local install config contains placeholder-looking secret values',
        detail: `.pluxx-user.json contains placeholder-looking value${placeholderKeys.length === 1 ? '' : 's'} for ${placeholderKeys.join(', ')}.`,
        fix: 'Reinstall the plugin with real secret values, or edit .pluxx-user.json and refresh/restart the host.',
        path: userConfigPath,
      })
    }
  } catch (error) {
    addCheck(checks, {
      level: 'error',
      code: 'consumer-user-config-invalid',
      title: 'Local install config is not parseable',
      detail: error instanceof Error ? error.message : String(error),
      fix: 'Delete or repair .pluxx-user.json, then reinstall the plugin if needed.',
      path: userConfigPath,
    })
  }
}

function checkInstalledEnvValidation(checks: DoctorCheck[], rootDir: string): void {
  const envScriptPath = 'scripts/check-env.sh'
  const resolvedPath = resolve(rootDir, envScriptPath)
  if (!existsSync(resolvedPath)) {
    addCheck(checks, {
      level: 'info',
      code: 'consumer-env-script-missing',
      title: 'No install-time env validation script found',
      detail: 'This bundle does not ship a scripts/check-env.sh file.',
      fix: 'No action needed unless this plugin is expected to validate runtime secrets on install.',
      path: envScriptPath,
    })
    return
  }

  const content = readFileSync(resolvedPath, 'utf-8')
  if (content.includes(MATERIALIZED_ENV_MARKER)) {
    addCheck(checks, {
      level: 'success',
      code: 'consumer-env-script-materialized',
      title: 'Install-time env validation was disabled after materialization',
      detail: 'This local install already materialized required config, so the env validation hook is bypassed.',
      fix: 'No action needed.',
      path: envScriptPath,
    })
    return
  }

  addCheck(checks, {
    level: 'warning',
    code: 'consumer-env-script-active',
    title: 'Install-time env validation is still active',
    detail: 'This bundle still runs scripts/check-env.sh, which usually means required config was not materialized into the installed plugin.',
    fix: 'If authenticated tools fail, reinstall the plugin and provide the requested userConfig values or required env vars.',
    path: envScriptPath,
  })
}

function checkInstalledMcpConfig(checks: DoctorCheck[], rootDir: string, layout: ConsumerBundleLayout): void {
  if (!layout.mcpConfigPath) {
    addCheck(checks, {
      level: 'info',
      code: 'consumer-mcp-config-not-applicable',
      title: 'No static MCP config file for this platform',
      detail: `${layout.platform} builds runtime MCP wiring inside the plugin wrapper rather than a standalone JSON file.`,
      fix: 'No action needed.',
      path: layout.manifestPath,
    })
    return
  }

  const resolvedPath = resolve(rootDir, layout.mcpConfigPath)
  if (!existsSync(resolvedPath)) {
    addCheck(checks, {
      level: 'info',
      code: 'consumer-mcp-config-missing',
      title: 'No MCP config file emitted in this bundle',
      detail: `This ${layout.platform} bundle does not include ${layout.mcpConfigPath}.`,
      fix: 'No action needed unless this plugin should expose MCP servers on this platform.',
      path: layout.mcpConfigPath,
    })
    return
  }

  try {
    const payload = readJsonFile<{ mcpServers?: Record<string, Record<string, unknown>> }>(rootDir, layout.mcpConfigPath)
    const servers = Object.values(payload.mcpServers ?? {})
    addCheck(checks, {
      level: 'success',
      code: 'consumer-mcp-config-valid',
      title: 'Installed MCP config parsed successfully',
      detail: `${layout.mcpConfigPath} defines ${servers.length} MCP server${servers.length === 1 ? '' : 's'}.`,
      fix: 'No action needed.',
      path: layout.mcpConfigPath,
    })

    if (servers.length === 0) {
      return
    }

    if (layout.platform === 'codex') {
      addCheck(checks, {
        level: 'info',
        code: 'consumer-codex-mcp-bundled-visibility',
        title: 'Codex plugin-bundled MCP visibility clarified',
        detail: `This Codex plugin bundle includes ${servers.length} MCP server${servers.length === 1 ? '' : 's'} through ${layout.mcpConfigPath}. Codex may show this on the plugin detail page without listing it on the global MCP servers settings page.`,
        fix: 'Use the plugin detail page, tool availability in chat, and `pluxx verify-install --target codex` as the source of truth for plugin-bundled MCP wiring. If the MCP remains unavailable after install, use Plugins > Refresh if present or restart Codex.',
        path: layout.mcpConfigPath,
      })
    }

    const remoteEntries = servers.filter((server) => 'url' in server)
    const stdioEntries = servers.filter((server) => 'command' in server)
    const inlineHeaderEntries = servers.filter((server) => {
      if ('headers' in server && server.headers && typeof server.headers === 'object') return true
      if ('http_headers' in server && server.http_headers && typeof server.http_headers === 'object') return true
      return false
    })

    if (stdioEntries.length > 0) {
      addCheck(checks, {
        level: 'info',
        code: 'consumer-mcp-stdio',
        title: 'Local MCP servers configured',
        detail: `${stdioEntries.length} MCP server${stdioEntries.length === 1 ? '' : 's'} run via local stdio commands in this bundle.`,
        fix: 'If tools fail, verify the bundled command or its runtime dependencies on this machine.',
        path: layout.mcpConfigPath,
      })

      const missingRuntimePaths = findMissingInstalledStdioRuntimePaths(rootDir, stdioEntries)
      if (missingRuntimePaths.length > 0) {
        addCheck(checks, {
          level: 'warning',
          code: 'consumer-mcp-stdio-runtime-missing',
          title: 'Bundled stdio MCP runtime files are missing',
          detail: `This installed MCP config references local runtime path${missingRuntimePaths.length === 1 ? '' : 's'} that do not exist in the bundle: ${missingRuntimePaths.join(', ')}.`,
          fix: 'Rebuild the plugin with the MCP runtime directory included in passthrough, then reinstall the host bundle.',
          path: layout.mcpConfigPath,
        })
      }

      const leakedPluginRootVars = [...new Set(
        stdioEntries.flatMap((server) => {
          const values = [
            typeof server.command === 'string' ? server.command : '',
            ...(Array.isArray(server.args) ? server.args.filter((value): value is string => typeof value === 'string') : []),
          ]
          return findLeakedPluginRootVars(layout.platform, values)
        }),
      )].sort()
      if (leakedPluginRootVars.length > 0) {
        addCheck(checks, {
          level: 'warning',
          code: 'consumer-mcp-stdio-host-root-leak',
          title: 'Installed stdio MCP config contains the wrong host root contract',
          detail: `This installed ${layout.platform} MCP config still contains plugin root variable${leakedPluginRootVars.length === 1 ? '' : 's'} that do not belong in this host bundle: ${leakedPluginRootVars.map((pluginRootVar) => `\${${pluginRootVar}}`).join(', ')}.`,
          fix: 'Author global stdio MCP paths as `./...` or `${PLUGIN_ROOT}/...`, then rebuild and reinstall so Pluxx can normalize the correct host-specific path.',
          path: layout.mcpConfigPath,
        })
      }
    }

    if (remoteEntries.length > 0 && inlineHeaderEntries.length > 0) {
      addCheck(checks, {
        level: 'success',
        code: 'consumer-mcp-inline-auth',
        title: 'Remote MCP auth was materialized into this install',
        detail: `${inlineHeaderEntries.length} remote MCP server${inlineHeaderEntries.length === 1 ? '' : 's'} include inline auth headers in the installed bundle.`,
        fix: 'No action needed.',
        path: layout.mcpConfigPath,
      })
      return
    }

    if (remoteEntries.length > 0) {
      const fix = layout.platform === 'claude-code' || layout.platform === 'cursor'
        ? 'If authenticated tools fail, complete the platform auth flow in the host or reinstall with any required userConfig values.'
        : 'If authenticated tools fail, reinstall the plugin and provide any required userConfig or runtime env vars.'
      addCheck(checks, {
        level: 'info',
        code: 'consumer-mcp-remote-auth-runtime',
        title: 'Remote MCP auth is expected at runtime',
        detail: `${remoteEntries.length} remote MCP server${remoteEntries.length === 1 ? '' : 's'} are configured without inline auth headers in this installed bundle.`,
        fix,
        path: layout.mcpConfigPath,
      })
    }
  } catch (error) {
    addCheck(checks, {
      level: 'error',
      code: 'consumer-mcp-config-invalid',
      title: 'Installed MCP config is not parseable',
      detail: error instanceof Error ? error.message : String(error),
      fix: 'Rebuild or reinstall this platform bundle and rerun pluxx doctor --consumer.',
      path: layout.mcpConfigPath,
    })
  }
}

function checkInstalledBundleIntegrity(checks: DoctorCheck[], rootDir: string, layout: ConsumerBundleLayout): void {
  const issues = findInstalledBundleIntegrityIssues(rootDir, layout.platform)
  const details: string[] = []

  if (issues.manifestIssue) {
    details.push(issues.manifestIssue)
  }
  if (issues.missingManifestPaths.length > 0) {
    details.push(`manifest references missing path${issues.missingManifestPaths.length === 1 ? '' : 's'}: ${issues.missingManifestPaths.join(', ')}`)
  }
  if (issues.missingHookTargets.length > 0) {
    details.push(`hook commands reference missing bundle target${issues.missingHookTargets.length === 1 ? '' : 's'}: ${issues.missingHookTargets.join(', ')}`)
  }

  if (details.length === 0) {
    addCheck(checks, {
      level: 'success',
      code: 'consumer-bundle-integrity-valid',
      title: 'Installed bundle references resolve inside the plugin',
      detail: 'Every manifest-declared path and bundle-relative hook target exists in this installed bundle.',
      fix: 'No action needed.',
      path: layout.manifestPath,
    })
    return
  }

  addCheck(checks, {
    level: 'error',
    code: 'consumer-bundle-integrity-invalid',
    title: 'Installed bundle is missing referenced files',
    detail: details.join('; '),
    fix: 'Reinstall the plugin or rebuild the bundle so every manifest path and hook target exists in the installed plugin.',
    path: layout.manifestPath,
  })
}

function findMissingInstalledStdioRuntimePaths(
  rootDir: string,
  stdioEntries: Array<Record<string, unknown>>,
): string[] {
  const missing = new Set<string>()

  for (const server of stdioEntries) {
    const command = typeof server.command === 'string' ? server.command : undefined
    const args = Array.isArray(server.args) ? server.args.filter((value): value is string => typeof value === 'string') : []

    for (const candidate of [command, ...args]) {
      if (!candidate || !isLikelyLocalRuntimePath(candidate)) continue
      const resolvedPath = resolve(rootDir, candidate)
      if (!existsSync(resolvedPath)) {
        missing.add(candidate)
      }
    }
  }

  return [...missing].sort()
}

function isLikelyLocalRuntimePath(value: string): boolean {
  return value.startsWith('./')
    || value.startsWith('../')
    || value.startsWith('.\\')
    || value.startsWith('..\\')
}

function isLikelyOpenCodeInstallPath(rootDir: string): boolean {
  const parent = dirname(rootDir)
  const grandparent = dirname(parent)
  return basename(parent) === 'plugins' && basename(grandparent) === 'opencode'
}

function checkInstalledOpenCodeHostBridge(checks: DoctorCheck[], rootDir: string): void {
  if (!isLikelyOpenCodeInstallPath(rootDir)) {
    addCheck(checks, {
      level: 'info',
      code: 'consumer-opencode-host-bridge-not-applicable',
      title: 'No OpenCode host bridge check for this path',
      detail: 'This OpenCode bundle is not located under ~/.config/opencode/plugins, so host-visible wrapper checks are skipped.',
      fix: 'Point --consumer at the installed OpenCode plugin directory to validate host-visible wiring.',
      path: 'package.json',
    })
    return
  }

  const pluginName = basename(rootDir)
  const entryPath = `${rootDir}.ts`
  const entryRelativePath = `${pluginName}.ts`
  if (!existsSync(entryPath)) {
    addCheck(checks, {
      level: 'error',
      code: 'consumer-opencode-entry-missing',
      title: 'OpenCode host entry file missing',
      detail: `OpenCode auto-loads top-level plugin files, but ${entryPath} does not exist for this installed bundle.`,
      fix: 'Reinstall the plugin so Pluxx can recreate the top-level OpenCode entry file.',
      path: entryRelativePath,
    })
    return
  }

  const entryContent = readFileSync(entryPath, 'utf-8')
  const expectedImport = `import * as PluginModule from "./${pluginName}/index.ts"`
  const expectedBridge = `directory: join(context.directory, "${pluginName}")`

  if (!entryContent.includes(expectedImport) || !entryContent.includes(expectedBridge)) {
    addCheck(checks, {
      level: 'error',
      code: 'consumer-opencode-entry-invalid',
      title: 'OpenCode host entry file does not match the installed bundle',
      detail: `${entryPath} exists, but it does not proxy into ./${pluginName}/index.ts with the expected plugin-root bridge.`,
      fix: 'Reinstall the plugin so Pluxx can rewrite the OpenCode entry wrapper.',
      path: entryRelativePath,
    })
  } else {
    addCheck(checks, {
      level: 'success',
      code: 'consumer-opencode-entry-valid',
      title: 'OpenCode host entry file is present',
      detail: `${entryRelativePath} proxies into the installed ${pluginName} bundle.`,
      fix: 'No action needed.',
      path: entryRelativePath,
    })
  }
}

function checkInstalledOpenCodeSkills(checks: DoctorCheck[], rootDir: string): void {
  if (!isLikelyOpenCodeInstallPath(rootDir)) {
    return
  }

  const pluginName = basename(rootDir)
  const sourceSkillsDir = resolve(rootDir, 'skills')
  if (!existsSync(sourceSkillsDir)) {
    addCheck(checks, {
      level: 'info',
      code: 'consumer-opencode-skill-sync-not-applicable',
      title: 'No OpenCode skills exported from this bundle',
      detail: 'This installed OpenCode bundle does not include a skills directory, so no global skill sync is required.',
      fix: 'No action needed.',
      path: 'skills',
    })
    return
  }

  const skillRoot = resolve(dirname(dirname(rootDir)), 'skills')
  const missingSkills: string[] = []
  const malformedSkills: string[] = []
  let expectedSkillCount = 0

  for (const entry of readdirSync(sourceSkillsDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue

    const sourceSkillPath = resolve(sourceSkillsDir, entry.name, 'SKILL.md')
    if (!existsSync(sourceSkillPath)) continue
    expectedSkillCount++

    const installedSkillPath = resolve(skillRoot, `${pluginName}-${entry.name}`, 'SKILL.md')
    if (!existsSync(installedSkillPath)) {
      missingSkills.push(`${pluginName}-${entry.name}`)
      continue
    }

    const installedContent = readFileSync(installedSkillPath, 'utf-8')
    if (!installedContent.includes(`${pluginName}/`)) {
      malformedSkills.push(`${pluginName}-${entry.name}`)
    }
  }

  if (expectedSkillCount === 0) {
    addCheck(checks, {
      level: 'info',
      code: 'consumer-opencode-skill-sync-not-applicable',
      title: 'No OpenCode skills exported from this bundle',
      detail: 'This installed OpenCode bundle does not define any skill directories with SKILL.md files.',
      fix: 'No action needed.',
      path: 'skills',
    })
    return
  }

  if (missingSkills.length > 0 || malformedSkills.length > 0) {
    const missingDetail = missingSkills.length > 0
      ? `missing exported skills: ${missingSkills.join(', ')}`
      : undefined
    const malformedDetail = malformedSkills.length > 0
      ? `malformed exported skills: ${malformedSkills.join(', ')}`
      : undefined
    addCheck(checks, {
      level: 'warning',
      code: 'consumer-opencode-skill-sync-incomplete',
      title: 'OpenCode exported skills are incomplete',
      detail: [missingDetail, malformedDetail].filter(Boolean).join('; '),
      fix: 'Reinstall the plugin so Pluxx can resync OpenCode skills into ~/.config/opencode/skills.',
      path: 'skills',
    })
    return
  }

  addCheck(checks, {
    level: 'success',
    code: 'consumer-opencode-skill-sync-valid',
    title: 'OpenCode exported skills are synced',
    detail: `Found ${expectedSkillCount} synced OpenCode skill${expectedSkillCount === 1 ? '' : 's'} under ~/.config/opencode/skills.`,
    fix: 'No action needed.',
    path: 'skills',
  })
}

export async function doctorConsumer(rootDir: string = process.cwd()): Promise<DoctorReport> {
  const checks: DoctorCheck[] = []
  addRuntimeChecks(checks, 'consumer')

  checkConsumerBundlePath(checks, rootDir)
  const layout = detectConsumerLayout(rootDir)

  if (layout.kind === 'source-project') {
    addCheck(checks, {
      level: 'error',
      code: 'consumer-source-project',
      title: 'Consumer doctor expects an installed or built platform bundle',
      detail: `Found a pluxx source project at ${rootDir}, not a built platform directory.`,
      fix: 'Run `pluxx doctor` in the source project, or run `pluxx doctor --consumer <dist/platform>` against an installed or built bundle.',
    })
    return summarizeChecks(checks)
  }

  if (layout.kind === 'multi-target-dist') {
    addCheck(checks, {
      level: 'error',
      code: 'consumer-dist-root',
      title: 'Consumer doctor expects one platform directory at a time',
      detail: `Found a multi-target dist root at ${rootDir}.`,
      fix: 'Point --consumer at one built platform directory such as dist/cursor or an installed plugin path.',
    })
    return summarizeChecks(checks)
  }

  if (layout.kind === 'unknown') {
    addCheck(checks, {
      level: 'error',
      code: 'consumer-platform-unknown',
      title: 'Could not detect an installed plugin layout',
      detail: `No known installed plugin markers were found in ${rootDir}.`,
      fix: 'Pass the root of a built platform bundle or installed plugin directory to pluxx doctor --consumer.',
    })
    return summarizeChecks(checks)
  }

  addCheck(checks, {
    level: 'success',
    code: 'consumer-platform-detected',
    title: 'Installed platform bundle detected',
    detail: `Detected a ${layout.platform} plugin bundle.`,
    fix: 'No action needed.',
    path: layout.manifestPath,
  })

  checkConsumerManifest(checks, rootDir, layout)
  checkInstalledBundleIntegrity(checks, rootDir, layout)
  checkInstalledUserConfig(checks, rootDir)
  checkInstalledEnvValidation(checks, rootDir)
  checkInstalledMcpConfig(checks, rootDir, layout)
  if (layout.platform === 'opencode') {
    checkInstalledOpenCodeHostBridge(checks, rootDir)
    checkInstalledOpenCodeSkills(checks, rootDir)
  }

  return summarizeChecks(checks)
}

export async function doctorProject(rootDir: string = process.cwd()): Promise<DoctorReport> {
  const checks: DoctorCheck[] = []
  const configPath = CONFIG_FILES.find((filename) => existsSync(resolve(rootDir, filename)))
  addRuntimeChecks(checks, 'project')

  if (!configPath) {
    addCheck(checks, {
      level: 'error',
      code: 'config-not-found',
      title: 'pluxx config not found',
      detail: `Expected one of ${CONFIG_FILES.join(', ')} in ${rootDir}.`,
      fix: 'Create a pluxx.config.ts, pluxx.config.js, or pluxx.config.json file in the project root.',
    })
    return summarizeChecks(checks)
  }

  addCheck(checks, {
    level: 'success',
    code: 'config-found',
    title: 'pluxx config found',
    detail: `Detected ${configPath} in the project root.`,
    fix: 'No action needed.',
    path: configPath,
  })

  let config: PluginConfig
  try {
    config = await loadConfig(rootDir)
    addCheck(checks, {
      level: 'success',
      code: 'config-valid',
      title: 'Config parsed successfully',
      detail: `Loaded ${config.name}@${config.version} for ${config.targets.length} target(s).`,
      fix: 'No action needed.',
      path: configPath,
    })
  } catch (error) {
    addCheck(checks, {
      level: 'error',
      code: 'config-invalid',
      title: 'Config could not be loaded',
      detail: error instanceof Error ? error.message : String(error),
      fix: 'Fix the config error and rerun pluxx doctor.',
      path: configPath,
    })
    return summarizeChecks(checks)
  }

  checkReadablePath(checks, rootDir, 'Skills', config.skills, true)
  checkReadablePath(checks, rootDir, 'Instructions', config.instructions, false)
  checkReadablePath(checks, rootDir, 'Agents', config.agents, false)
  checkReadablePath(checks, rootDir, 'Commands', config.commands, false)
  checkReadablePath(checks, rootDir, 'Scripts', config.scripts, false)
  checkReadablePath(checks, rootDir, 'Assets', config.assets, false)
  checkTargetPlatforms(checks, config)
  checkPrimitiveTranslations(checks, config)
  checkMcpConfig(checks, config)
  checkUserConfig(checks, config)
  checkScaffoldMetadata(checks, rootDir, config)
  checkCompilerIntent(checks, rootDir)
  checkHookTrust(checks, config)
  checkBrandMetadataCompleteness(checks, config)

  for (const target of config.targets) {
    const limits = PLATFORM_LIMITS[target]
    if (!CORE_FOUR.has(target) && limits) {
      addCheck(checks, {
        level: 'info',
        code: 'target-caveat',
        title: `Platform caveat for ${target}`,
        detail: `${target} is supported, but it is currently less validated than the core four targets.`,
        fix: 'Use pluxx lint and pluxx test before relying on beta targets in production.',
        path: 'pluxx.config.ts',
      })
    }
  }

  return {
    ...summarizeChecks(checks),
    primitiveSummary: buildPrimitiveTranslationSummary(config, config.targets),
  }
}

export function printDoctorReport(report: DoctorReport): void {
  const visibleChecks = report.checks.filter((check) => !check.code.startsWith('primitive-'))

  for (const check of visibleChecks) {
    const prefix = check.level.toUpperCase().padEnd(7, ' ')
    const pathLabel = check.path ? ` [${check.path}]` : ''
    console.log(`${prefix} ${check.code}${pathLabel} ${check.title}`)
    console.log(`         ${check.detail}`)
    console.log(`         Fix: ${check.fix}`)
  }

  const primitiveLines = renderPrimitiveTranslationSummary(report.primitiveSummary)
  if (primitiveLines.length > 0) {
    if (visibleChecks.length > 0) {
      console.log('')
    }
    for (const line of primitiveLines) {
      console.log(line)
    }
  }

  console.log('')
  console.log(
    `Doctor summary: ${report.errors} error(s), ${report.warnings} warning(s), ${report.infos} info message(s)`,
  )
}
