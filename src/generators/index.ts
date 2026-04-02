import { rmSync, mkdirSync } from 'fs'
import { resolve } from 'path'
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

export async function build(
  config: PluginConfig,
  rootDir: string,
  options: BuildOptions = {},
): Promise<void> {
  const targets = options.targets ?? config.targets
  const outDir = resolve(rootDir, config.outDir)

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
