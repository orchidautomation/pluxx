import { existsSync } from 'fs'
import { resolve } from 'path'
import { warnDroppedHookFields } from '../hooks-warning'
import type { HookEntry, PluginConfig, TargetPlatform } from '../../schema'
import { mapHookEventToPascalCase } from '../../hook-events'
import { isHookFieldPreserved } from '../../hook-translation-registry'
import { buildGeneratedPermissionHookScript } from '../../permissions'
import { buildGeneratedReadinessScript, getRuntimeReadinessPlan } from '../../readiness'
import { getEnabledRuntimeReadinessBindings, getRuntimeReadinessCapability } from '../../runtime-readiness-registry'
import { readInstructionsContent, renderTitledInstructionsDocument } from '../../instructions'
import { readTextFile } from '../../text-files'
import { readCanonicalAgentFiles } from '../../agents'
import { normalizePluginOwnedStdioPathForPlatform } from '../../mcp-stdio-paths'

export interface ClaudeFamilyOptions {
  manifestPath: string
  instructionsFile: string
  pluginRootVar: string
  titleSuffix?: string
  mapEventName?: (event: string) => string
  includeStandardHooksManifest?: boolean
  agentsManifestMode?: 'directory' | 'files' | 'omit'
}

export async function generateClaudeFamilyOutputs(args: {
  config: PluginConfig
  rootDir: string
  platform: TargetPlatform
  options: ClaudeFamilyOptions
  writeJson: (relativePath: string, data: unknown) => Promise<void>
  writeFile: (relativePath: string, content: string) => Promise<void>
}): Promise<void> {
  const {
    config,
    rootDir,
    platform,
    options,
    writeJson,
    writeFile,
  } = args

  await Promise.all([
    writeManifest(config, rootDir, options, writeJson),
    writeMcpConfig(config, platform, writeJson),
    writeHooks(config, platform, options, writeJson, writeFile),
    writeInstructions(config, rootDir, options, writeFile),
  ])
}

function shellSingleQuote(value: string): string {
  return `'${value.replace(/'/g, `'\"'\"'`)}'`
}

function buildClaudeHookCommandWrapperScript(command: string): string {
  const serializedCommand = shellSingleQuote(command)
  const exportLoader = [
    'import { readFileSync } from "node:fs"',
    '',
    'const shellSingleQuote = (input) => `\'${String(input ?? "").replace(/\'/g, `\'"\'"\'`)}\'`',
    '',
    'const filepath = process.argv[1]',
    'if (!filepath) process.exit(0)',
    'const payload = JSON.parse(readFileSync(filepath, "utf8"))',
    'const env = payload && typeof payload === "object" && payload.env && typeof payload.env === "object"',
    '  ? payload.env',
    '  : {}',
    '',
    'for (const [key, value] of Object.entries(env)) {',
    '  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue',
    '  process.stdout.write(`export ${key}=${shellSingleQuote(value)}\\0`)',
    '}',
  ].join('\n')

  return [
    '#!/usr/bin/env bash',
    'set -euo pipefail',
    '',
    'PLUXX_PLUGIN_ROOT="${CLAUDE_PLUGIN_ROOT:-$(cd "$(dirname "$0")/.." && pwd)}"',
    'PLUXX_USER_CONFIG_PATH="$PLUXX_PLUGIN_ROOT/.pluxx-user.json"',
    '',
    'if [ -f "$PLUXX_USER_CONFIG_PATH" ]; then',
    '  while IFS= read -r -d \'\' pluxx_export; do',
    '    if [ -n "$pluxx_export" ]; then',
    '      eval "$pluxx_export"',
    '      if [ -n "${CLAUDE_ENV_FILE:-}" ]; then',
        '        printf \'%s\\n\' "$pluxx_export" >> "$CLAUDE_ENV_FILE"',
    '      fi',
    '    fi',
    '  done < <(',
    `    node --input-type=module -e ${shellSingleQuote(exportLoader)} "$PLUXX_USER_CONFIG_PATH"`,
    '  )',
    'fi',
    '',
    `PLUXX_HOOK_COMMAND=${serializedCommand}`,
    'eval "$PLUXX_HOOK_COMMAND"',
    '',
  ].join('\n')
}

async function writeManifest(
  config: PluginConfig,
  rootDir: string,
  options: ClaudeFamilyOptions,
  writeJson: (relativePath: string, data: unknown) => Promise<void>,
): Promise<void> {
  const manifest: Record<string, unknown> = {
    name: config.name,
    version: config.version,
    description: config.description,
    author: config.author,
    license: config.license,
  }

  if (config.repository) {
    manifest.repository = config.repository
  }
  if (config.keywords) {
    manifest.keywords = config.keywords
  }
  if (config.commands) {
    manifest.commands = './commands/'
  }
  const agentsManifestMode = options.agentsManifestMode ?? 'directory'
  if (config.agents && agentsManifestMode === 'directory') {
    manifest.agents = './agents/'
  } else if (config.agents && agentsManifestMode === 'files') {
    const agentsDir = resolve(rootDir, config.agents)
    const agents = readCanonicalAgentFiles(agentsDir)
    if (agents.length > 0) {
      manifest.agents = agents.map((agent) => `./agents/${agent.fileStem}.md`)
    }
  }
  manifest.skills = './skills/'
  if ((config.hooks || config.permissions) && options.includeStandardHooksManifest !== false) {
    manifest.hooks = './hooks/hooks.json'
  }
  if (config.mcp) {
    manifest.mcpServers = './.mcp.json'
  }

  await writeJson(options.manifestPath, manifest)
}

async function writeMcpConfig(
  config: PluginConfig,
  platform: TargetPlatform,
  writeJson: (relativePath: string, data: unknown) => Promise<void>,
): Promise<void> {
  if (!config.mcp) return

  const mcpServers: Record<string, unknown> = {}
  const usesPlatformManagedAuth = platform === 'claude-code'
    && config.platforms?.['claude-code']?.mcpAuth === 'platform'

  for (const [name, server] of Object.entries(config.mcp)) {
    if (server.transport === 'stdio' && server.command) {
      mcpServers[name] = {
        command: normalizePluginOwnedStdioPathForPlatform(server.command, platform),
        args: (server.args ?? []).map((value) => normalizePluginOwnedStdioPathForPlatform(value, platform)),
        env: server.env ?? {},
      }
    } else {
      const entry: Record<string, unknown> = {
        type: server.transport === 'sse' ? 'sse' : 'http',
        url: server.url,
      }

      if (usesPlatformManagedAuth || server.auth?.type === 'platform') {
        mcpServers[name] = entry
        continue
      }

      if (server.auth?.type === 'bearer' && server.auth.envVar) {
        entry.headers = {
          Authorization: `Bearer \${${server.auth.envVar}}`,
        }
      } else if (server.auth?.type === 'header' && server.auth.envVar) {
        entry.headers = {
          [server.auth.headerName]: server.auth.headerTemplate.replace(
            '${value}',
            `\${${server.auth.envVar}}`,
          ),
        }
      }

      mcpServers[name] = entry
    }
  }

  await writeJson('.mcp.json', { mcpServers })
}

async function writeHooks(
  config: PluginConfig,
  platform: TargetPlatform,
  options: ClaudeFamilyOptions,
  writeJson: (relativePath: string, data: unknown) => Promise<void>,
  writeFile: (relativePath: string, content: string) => Promise<void>,
): Promise<void> {
  const hooks: Record<string, unknown[]> = {}
  const mapEventName = options.mapEventName ?? defaultMapEventName
  const usesPlatformManagedAuth = platform === 'claude-code'
    && config.platforms?.['claude-code']?.mcpAuth === 'platform'
  const shouldWrapClaudeHookCommands = platform === 'claude-code'
  const readinessPlan = getRuntimeReadinessPlan(config.readiness)
  const readinessCapability = getRuntimeReadinessCapability('claude-code', options.pluginRootVar)
  const permissionScript = buildGeneratedPermissionHookScript(config.permissions)
  let generatedClaudeHookCommandCount = 0

  if (readinessPlan.hasReadiness && config.readiness) {
    await writeFile('hooks/pluxx-readiness.mjs', buildGeneratedReadinessScript(config.readiness))

    for (const binding of getEnabledRuntimeReadinessBindings(readinessCapability, readinessPlan)) {
      if (binding.event === 'SessionStart') {
        hooks.SessionStart = [{
          hooks: [{
            type: 'command',
            command: binding.command,
          }],
        }]
        continue
      }

      if (binding.event === 'PreToolUse') {
        hooks.PreToolUse = [
          ...(hooks.PreToolUse ?? []),
          {
            ...(binding.matcher ? { matcher: binding.matcher } : {}),
            hooks: [{
              type: 'command',
              command: binding.command,
            }],
          },
        ]
        continue
      }

      if (binding.event === 'UserPromptSubmit') {
        hooks.UserPromptSubmit = [{
          hooks: [{
            type: 'command',
            command: binding.command,
          }],
        }]
      }
    }
  }

  if (permissionScript) {
    await writeFile('hooks/pluxx-permissions.mjs', permissionScript)
    hooks.PreToolUse = [
      ...(hooks.PreToolUse ?? []),
      {
        hooks: [{
          type: 'command',
          command: `node \${${options.pluginRootVar}}/hooks/pluxx-permissions.mjs claude-pretool`,
        }],
      },
    ]
  }

  if (!config.hooks) {
    if (Object.keys(hooks).length > 0) {
      await writeJson('hooks/hooks.json', { hooks })
    }
    return
  }

  for (const [event, entries] of Object.entries(config.hooks)) {
    if (!entries) continue

    const mappedEvent = mapEventName(event)
    warnDroppedHookFields(platform, mappedEvent, entries)
    const translatedEntries = (
      await Promise.all(entries.map(async (entry) =>
        mapClaudeHookEntry({
          entry,
          mappedEvent,
          options,
          shouldWrapClaudeHookCommands,
          usesPlatformManagedAuth,
          writeFile,
          nextWrapperIndex: () => {
            generatedClaudeHookCommandCount += 1
            return generatedClaudeHookCommandCount
          },
        })))
    ).filter((entry): entry is Record<string, unknown> => entry !== null)
    if (translatedEntries.length === 0) continue

    hooks[mappedEvent] = [
      ...(hooks[mappedEvent] ?? []),
      ...translatedEntries,
    ]
  }

  await writeJson('hooks/hooks.json', { hooks })
}

async function mapClaudeHookEntry(args: {
  entry: HookEntry
  mappedEvent: string
  options: ClaudeFamilyOptions
  shouldWrapClaudeHookCommands: boolean
  usesPlatformManagedAuth: boolean
  writeFile: (relativePath: string, content: string) => Promise<void>
  nextWrapperIndex: () => number
}): Promise<Record<string, unknown> | null> {
  const {
    entry,
    mappedEvent,
    options,
    shouldWrapClaudeHookCommands,
    usesPlatformManagedAuth,
    writeFile,
    nextWrapperIndex,
  } = args

  const entryType = entry.type ?? 'command'

  if (
    entryType === 'prompt'
    && !isHookFieldPreserved('claude-code', 'prompt', mappedEvent)
  ) {
    return null
  }

  if (entryType === 'command') {
    if (!entry.command) return null
    if (usesPlatformManagedAuth && entry.command.includes('check-env.sh')) {
      return null
    }

    const command = entry.command.replace('${PLUGIN_ROOT}', `\${${options.pluginRootVar}}`)
    const finalCommand = shouldWrapClaudeHookCommands
      ? await (async () => {
        const relativePath = `hooks/pluxx-hook-command-${nextWrapperIndex()}.sh`
        await writeFile(relativePath, buildClaudeHookCommandWrapperScript(command))
        return `bash "\${${options.pluginRootVar}}/${relativePath}"`
      })()
      : command

    return {
      ...(entry.matcher !== undefined ? { matcher: entry.matcher } : {}),
      hooks: [{
        type: 'command',
        command: finalCommand,
        ...(entry.if !== undefined ? { if: entry.if } : {}),
        ...(entry.timeout !== undefined ? { timeout: entry.timeout } : {}),
        ...(entry.async !== undefined ? { async: entry.async } : {}),
        ...(entry.asyncRewake !== undefined ? { asyncRewake: entry.asyncRewake } : {}),
        ...(entry.shell !== undefined ? { shell: entry.shell } : {}),
      }],
    }
  }

  if (entryType === 'http') {
    if (!entry.url) return null
    return {
      ...(entry.matcher !== undefined ? { matcher: entry.matcher } : {}),
      hooks: [{
        type: 'http',
        url: entry.url,
        ...(entry.if !== undefined ? { if: entry.if } : {}),
        ...(entry.timeout !== undefined ? { timeout: entry.timeout } : {}),
        ...(entry.headers !== undefined ? { headers: entry.headers } : {}),
        ...(entry.allowedEnvVars !== undefined ? { allowedEnvVars: entry.allowedEnvVars } : {}),
      }],
    }
  }

  if (entryType === 'mcp_tool') {
    if (!entry.server || !entry.tool) return null
    return {
      ...(entry.matcher !== undefined ? { matcher: entry.matcher } : {}),
      hooks: [{
        type: 'mcp_tool',
        server: entry.server,
        tool: entry.tool,
        ...(entry.if !== undefined ? { if: entry.if } : {}),
        ...(entry.input !== undefined ? { input: entry.input } : {}),
      }],
    }
  }

  if (entryType === 'prompt' || entryType === 'agent') {
    if (!entry.prompt) return null
    return {
      ...(entry.matcher !== undefined ? { matcher: entry.matcher } : {}),
      hooks: [{
        type: entryType,
        prompt: entry.prompt,
        ...(entry.if !== undefined ? { if: entry.if } : {}),
        ...(entry.model !== undefined ? { model: entry.model } : {}),
      }],
    }
  }

  return null
}

async function writeInstructions(
  config: PluginConfig,
  rootDir: string,
  options: ClaudeFamilyOptions,
  writeFile: (relativePath: string, content: string) => Promise<void>,
): Promise<void> {
  const content = await readInstructionsContent(rootDir, config)
  if (!content) return
  const titleSuffix = options.titleSuffix ?? 'Plugin'
  const instructions = renderTitledInstructionsDocument(config, content, titleSuffix)

  await writeFile(options.instructionsFile, instructions)
}

function defaultMapEventName(event: string): string {
  return mapHookEventToPascalCase(event)
}
