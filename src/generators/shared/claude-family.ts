import { existsSync } from 'fs'
import { resolve } from 'path'
import { warnDroppedHookFields } from '../hooks-warning'
import type { PluginConfig, TargetPlatform } from '../../schema'
import { mapHookEventToPascalCase } from '../../hook-events'
import { buildGeneratedPermissionHookScript } from '../../permissions'
import { readTextFile } from '../../text-files'
import { readCanonicalAgentFiles } from '../../agents'

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
        command: server.command,
        args: server.args ?? [],
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
  const permissionScript = buildGeneratedPermissionHookScript(config.permissions)

  if (permissionScript) {
    await writeFile('hooks/pluxx-permissions.mjs', permissionScript)
    hooks.PreToolUse = [{
      hooks: [{
        type: 'command',
        command: `node \${${options.pluginRootVar}}/hooks/pluxx-permissions.mjs claude-pretool`,
      }],
    }]
  }

  if (!config.hooks) {
    if (Object.keys(hooks).length > 0) {
      await writeJson('hooks/hooks.json', { hooks })
    }
    return
  }

  for (const [event, entries] of Object.entries(config.hooks)) {
    if (!entries) continue

    warnDroppedHookFields(platform, event, entries)
    const mappedEvent = mapEventName(event)
    const commandEntries = entries.filter((entry) => {
      if (entry.type === 'prompt' || !entry.command) return false
      if (
        usesPlatformManagedAuth
        && entry.command.includes('check-env.sh')
      ) {
        return false
      }
      return true
    })
    if (commandEntries.length === 0) continue

    hooks[mappedEvent] = [
      ...(hooks[mappedEvent] ?? []),
      ...commandEntries.map(entry => ({
      ...(entry.matcher !== undefined ? { matcher: entry.matcher } : {}),
      hooks: [{
        type: 'command',
        command: entry.command!.replace('${PLUGIN_ROOT}', `\${${options.pluginRootVar}}`),
      }],
      })),
    ]
  }

  await writeJson('hooks/hooks.json', { hooks })
}

async function writeInstructions(
  config: PluginConfig,
  rootDir: string,
  options: ClaudeFamilyOptions,
  writeFile: (relativePath: string, content: string) => Promise<void>,
): Promise<void> {
  if (!config.instructions) return

  const srcPath = resolve(rootDir, config.instructions)
  if (!existsSync(srcPath)) return

  const content = await readTextFile(srcPath)
  const titleSuffix = options.titleSuffix ?? 'Plugin'
  const instructions = [
    `# ${config.brand?.displayName ?? config.name} ${titleSuffix}`,
    '',
    config.brand?.shortDescription ?? config.description,
    '',
    content,
  ].join('\n')

  await writeFile(options.instructionsFile, instructions)
}

function defaultMapEventName(event: string): string {
  return mapHookEventToPascalCase(event)
}
