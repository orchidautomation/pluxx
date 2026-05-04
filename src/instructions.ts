import { existsSync, readFileSync } from 'fs'
import { resolve } from 'path'
import type { PluginConfig } from './schema'
import { readTextFile } from './text-files'

export function resolveInstructionsPath(
  rootDir: string,
  config: Pick<PluginConfig, 'instructions'>,
): string | null {
  if (!config.instructions) return null
  const instructionsPath = resolve(rootDir, config.instructions)
  return existsSync(instructionsPath) ? instructionsPath : null
}

export async function readInstructionsContent(
  rootDir: string,
  config: Pick<PluginConfig, 'instructions'>,
): Promise<string | null> {
  const instructionsPath = resolveInstructionsPath(rootDir, config)
  if (!instructionsPath) return null
  return readTextFile(instructionsPath)
}

export function readInstructionsContentSync(
  rootDir: string,
  config: Pick<PluginConfig, 'instructions'>,
): string | null {
  const instructionsPath = resolveInstructionsPath(rootDir, config)
  if (!instructionsPath) return null
  return readFileSync(instructionsPath, 'utf-8')
}

export function renderTitledInstructionsDocument(config: Pick<PluginConfig, 'name' | 'description' | 'brand'>, content: string, titleSuffix = 'Plugin'): string {
  return [
    `# ${config.brand?.displayName ?? config.name} ${titleSuffix}`,
    '',
    config.brand?.shortDescription ?? config.description,
    '',
    content,
  ].join('\n')
}
