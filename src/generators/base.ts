import { resolve, join, relative } from 'path'
import { mkdirSync, existsSync, cpSync } from 'fs'
import type { PluginConfig, TargetPlatform } from '../schema'

export abstract class Generator {
  abstract readonly platform: TargetPlatform

  constructor(
    protected config: PluginConfig,
    protected rootDir: string,
  ) {}

  /** The output directory for this platform */
  get outDir(): string {
    return resolve(this.rootDir, this.config.outDir, this.platform)
  }

  /** Generate all platform-specific files */
  abstract generate(): Promise<void>

  /** Write a file to the output directory */
  protected async writeFile(relativePath: string, content: string): Promise<void> {
    const filepath = join(this.outDir, relativePath)
    const dir = filepath.substring(0, filepath.lastIndexOf('/'))
    mkdirSync(dir, { recursive: true })
    await Bun.write(filepath, content)
  }

  /** Write JSON to the output directory */
  protected async writeJson(relativePath: string, data: unknown): Promise<void> {
    await this.writeFile(relativePath, JSON.stringify(data, null, 2) + '\n')
  }

  /** Copy a directory from source to output */
  protected copyDir(srcRelative: string, destRelative: string, configKey: string): void {
    const src = this.resolveConfigPath(srcRelative, configKey)
    if (!existsSync(src)) return
    const dest = join(this.outDir, destRelative)
    mkdirSync(dest, { recursive: true })
    cpSync(src, dest, { recursive: true })
  }

  /** Resolve a user-configured path and ensure it stays within the project root. */
  protected resolveConfigPath(configPath: string, configKey: string): string {
    const resolvedPath = resolve(this.rootDir, configPath)
    const rel = relative(this.rootDir, resolvedPath)
    if (rel.startsWith('..')) {
      throw new Error(
        `${configKey} path "${configPath}" resolves outside the project root.`
      )
    }
    return resolvedPath
  }

  /** Copy skills directory, applying any platform-specific frontmatter */
  protected copySkills(): void {
    this.copyDir(this.config.skills, 'skills/', 'skills')
  }

  /** Copy commands directory if it exists */
  protected copyCommands(): void {
    if (this.config.commands) {
      this.copyDir(this.config.commands, 'commands/', 'commands')
    }
  }

  /** Copy agents directory if it exists */
  protected copyAgents(): void {
    if (this.config.agents) {
      this.copyDir(this.config.agents, 'agents/', 'agents')
    }
  }

  /** Copy scripts directory if it exists */
  protected copyScripts(): void {
    if (this.config.scripts) {
      this.copyDir(this.config.scripts, 'scripts/', 'scripts')
    }
  }

  /** Copy assets directory if it exists */
  protected copyAssets(): void {
    if (this.config.assets) {
      this.copyDir(this.config.assets, 'assets/', 'assets')
    }
  }
}
