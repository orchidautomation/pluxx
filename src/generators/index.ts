import { existsSync, rmSync, mkdirSync, mkdtempSync, writeFileSync } from 'fs'
import { basename, dirname, resolve, relative } from 'path'
import type { PluginConfig, TargetPlatform } from '../schema'
import { assertGeneratedBundlesCurrent } from '../bundle-check'
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
import { copyDirectoryForStaging, publishStagedDirectory, type MutationHooks } from '../fs-transaction'

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
  /** Internal reliability seam used to inject publication failures in tests. */
  mutationHooks?: MutationHooks
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

  for (const [key, configuredPath] of Object.entries({
    bootstrap: config.sharedRuntime?.bootstrap,
    output: config.sharedRuntime?.output,
    ...Object.fromEntries((config.sharedRuntime?.inputs ?? []).map((value, index) => [`inputs[${index}]`, value])),
  })) {
    if (!configuredPath) continue
    const normalized = configuredPath.replace(/\\/g, '/')
    if (normalized.startsWith('/') || normalized.split('/').includes('..')) {
      throw new Error(`sharedRuntime.${key} path "${configuredPath}" must be bundle-relative.`)
    }
  }

  if (config.sharedRuntime) {
    const outputPath = config.sharedRuntime.output.replace(/\\/g, '/')
    const normalizedOutput = outputPath.split('/').filter((segment) => segment !== '.').join('/')
    if (!normalizedOutput) {
      throw new Error('sharedRuntime.output must not resolve to the bundle root.')
    }
    for (const runtimeInput of [config.sharedRuntime.bootstrap, ...config.sharedRuntime.inputs]) {
      const normalizedInput = runtimeInput.replace(/\\/g, '/').split('/').filter((segment) => segment !== '.').join('/')
      if (normalizedInput === normalizedOutput || normalizedInput.startsWith(normalizedOutput + '/')) {
        throw new Error(`sharedRuntime.output "${config.sharedRuntime.output}" must not contain runtime input "${runtimeInput}".`)
      }
    }
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

  mkdirSync(dirname(outDir), { recursive: true })
  const stageDir = mkdtempSync(resolve(dirname(outDir), `.${basename(outDir)}.pluxx-stage-`))
  if (options.clean === false) {
    rmSync(stageDir, { recursive: true, force: true })
    copyDirectoryForStaging(outDir, stageDir)
  }
  mkdirSync(stageDir, { recursive: true })
  const stagedConfig: PluginConfig = {
    ...config,
    outDir: relative(rootDir, stageDir),
  }

  try {
    const generators = targets.map(target => {
      const GeneratorClass = GENERATORS[target]
      if (!GeneratorClass) {
        throw new Error(`Unknown target platform: ${target}`)
      }
      return new GeneratorClass(stagedConfig, rootDir)
    })
    // Build all targets in parallel, validate the complete staged tree, then publish.
    await Promise.all(generators.map(g => g.generate()))

    if (config.sharedRuntime) {
      const manifest = {
        schema: 'pluxx.shared-runtime-config.v1',
        namespace: config.name,
        bootstrap: config.sharedRuntime.bootstrap,
        inputs: [...config.sharedRuntime.inputs].sort(),
        output: config.sharedRuntime.output,
      }
      for (const platform of targets) {
        const targetRoot = resolve(stageDir, platform)
        for (const relativePath of [manifest.bootstrap, ...manifest.inputs]) {
          if (!existsSync(resolve(targetRoot, relativePath))) {
            throw new Error(`sharedRuntime input "${relativePath}" is missing from the ${platform} bundle.`)
          }
        }
        writeFileSync(resolve(targetRoot, '.pluxx-runtime.json'), JSON.stringify(manifest, null, 2) + '\n')
      }
    }

    assertGeneratedBundlesCurrent(stagedConfig, rootDir, targets)
    publishStagedDirectory(outDir, stageDir, options.mutationHooks)
  } catch (error) {
    rmSync(stageDir, { recursive: true, force: true })
    throw error
  }
}

export { Generator }
