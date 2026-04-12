import { existsSync } from 'fs'
import { resolve } from 'path'
import { warnDroppedHookFields } from '../hooks-warning'
import type { PluginConfig, TargetPlatform } from '../../schema'
import { mapHookEventToPascalCase } from '../../hook-events'

export interface ClaudeFamilyOptions {
  manifestPath: string
  instructionsFile: string
  pluginRootVar: string
  titleSuffix?: string
  mapEventName?: (event: string) => string
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
    writeManifest(config, options.manifestPath, writeJson),
    writeMcpConfig(config, writeJson),
    writeHooks(config, platform, options, writeJson),
    writeInstructions(config, rootDir, options, writeFile),
  ])
}

async function writeManifest(
  config: PluginConfig,
  manifestPath: string,
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
  manifest.skills = './skills/'

  await writeJson(manifestPath, manifest)
}

async function writeMcpConfig(
  config: PluginConfig,
  writeJson: (relativePath: string, data: unknown) => Promise<void>,
): Promise<void> {
  if (!config.mcp) return

  const mcpServers: Record<string, unknown> = {}

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
): Promise<void> {
  if (!config.hooks) return

  const hooks: Record<string, unknown[]> = {}
  const mapEventName = options.mapEventName ?? defaultMapEventName

  for (const [event, entries] of Object.entries(config.hooks)) {
    if (!entries) continue

    warnDroppedHookFields(platform, event, entries)
    const mappedEvent = mapEventName(event)
    const commandEntries = entries.filter(entry => entry.type !== 'prompt' && entry.command)
    if (commandEntries.length === 0) continue

    hooks[mappedEvent] = commandEntries.map(entry => ({
      hooks: [{
        type: 'command',
        command: entry.command!.replace('${PLUGIN_ROOT}', `\${${options.pluginRootVar}}`),
      }],
    }))
  }

  await writeJson('hooks.json', { hooks })
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

  const content = await Bun.file(srcPath).text()
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
