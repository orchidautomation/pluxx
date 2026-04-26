import { rmSync, mkdirSync } from 'fs'
import { resolve, relative } from 'path'
import type { PluginConfig, TargetPlatform } from '../schema'
import { Generator } from './base'
import { ClaudeCodeGenerator } from './claude-code'
import { CursorGenerator } from './cursor'
import { CodexGenerator } from './codex'
import { OpenCodeGenerator } from './opencode'
import { GitHubCopilotGenerator } from './github-copilot'
import { OpenHandsGenerator } from './openhands'
import { WarpGenerator } from './warp'
import { GeminiCliGenerator } from './gemini-cli'
import { RooCodeGenerator } from './roo-code'
import { ClineGenerator } from './cline'
import { AmpGenerator } from './amp'

const GENERATORS: Record<TargetPlatform, new (config: PluginConfig, rootDir: string) => Generator> = {
  'claude-code': ClaudeCodeGenerator,
  cursor: CursorGenerator,
  codex: CodexGenerator,
  opencode: OpenCodeGenerator,
  'github-copilot': GitHubCopilotGenerator,
  openhands: OpenHandsGenerator,
  warp: WarpGenerator,
  'gemini-cli': GeminiCliGenerator,
  'roo-code': RooCodeGenerator,
  cline: ClineGenerator,
  amp: AmpGenerator,
}

export interface BuildOptions {
  /** Override targets from config */
  targets?: TargetPlatform[]
  /** Clean output directory before building */
  clean?: boolean
}

function assertPathWithinRoot(rootDir: string, configPath: string, configKey: string): void {
  const resolvedPath = resolve(rootDir, configPath)
  const rel = relative(rootDir, resolvedPath)
  if (rel.startsWith('..')) {
    throw new Error(`${configKey} path "${configPath}" resolves outside the project root.`)
  }
}

function validateConfiguredPaths(config: PluginConfig, rootDir: string): void {
  assertPathWithinRoot(rootDir, config.skills, 'skills')

  if (config.commands) {
    assertPathWithinRoot(rootDir, config.commands, 'commands')
  }

  if (config.agents) {
    assertPathWithinRoot(rootDir, config.agents, 'agents')
  }

  if (config.scripts) {
    assertPathWithinRoot(rootDir, config.scripts, 'scripts')
  }

  if (config.assets) {
    assertPathWithinRoot(rootDir, config.assets, 'assets')
  }

  if (config.instructions) {
    assertPathWithinRoot(rootDir, config.instructions, 'instructions')
  }

  for (const passthroughPath of config.passthrough ?? []) {
    assertPathWithinRoot(rootDir, passthroughPath, 'passthrough')
  }

  if (config.brand?.icon) {
    assertPathWithinRoot(rootDir, config.brand.icon, 'brand.icon')
  }

  for (const screenshot of config.brand?.screenshots ?? []) {
    assertPathWithinRoot(rootDir, screenshot, 'brand.screenshots')
  }
}

export async function build(
  config: PluginConfig,
  rootDir: string,
  options: BuildOptions = {},
): Promise<void> {
  const targets = options.targets ?? config.targets
  const outDir = resolve(rootDir, config.outDir)

  // CRITICAL: Guard against path traversal — outDir must stay within rootDir
  const rel = relative(rootDir, outDir)
  if (rel.startsWith('..') || resolve(outDir) === resolve(rootDir)) {
    throw new Error(
      `outDir "${config.outDir}" resolves outside the project root. Refusing to delete.`
    )
  }

  validateConfiguredPaths(config, rootDir)

  if (options.clean !== false) {
    rmSync(outDir, { recursive: true, force: true })
  }
  mkdirSync(outDir, { recursive: true })

  const generators = targets.map(target => {
    const GeneratorClass = GENERATORS[target]
    if (!GeneratorClass) {
      throw new Error(`Unknown target platform: ${target}`)
    }
    return new GeneratorClass(config, rootDir)
  })

  // Build all targets in parallel
  await Promise.all(generators.map(g => g.generate()))
}

export { Generator }
