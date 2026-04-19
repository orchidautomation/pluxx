import { resolve, join, relative } from 'path'
import { mkdirSync, existsSync, cpSync } from 'fs'
import type { PluginConfig, TargetPlatform, McpServer } from '../schema'

type McpRemoteServer = Exclude<McpServer, { transport: 'stdio' }>

interface McpConfigOptions {
  includeDefaultAuthHeaders?: boolean
  transformRemoteEntry?: (context: {
    name: string
    server: McpRemoteServer
    entry: Record<string, unknown>
  }) => Record<string, unknown>
}

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

  /** Copy additional runtime directories to the target root, preserving their basename. */
  protected copyPassthrough(): void {
    for (const configPath of this.config.passthrough ?? []) {
      const src = this.resolveConfigPath(configPath, 'passthrough')
      if (!existsSync(src)) continue
      const basename = src.split('/').filter(Boolean).pop()
      if (!basename) continue
      this.copyDir(configPath, `${basename}/`, 'passthrough')
    }
  }

  /** Build canonical MCP server configs for target-specific output shaping. */
  protected buildMcpServers(options: McpConfigOptions = {}): Record<string, unknown> | undefined {
    if (!this.config.mcp) return undefined

    const {
      includeDefaultAuthHeaders = true,
      transformRemoteEntry,
    } = options

    const mcpServers: Record<string, unknown> = {}

    for (const [name, server] of Object.entries(this.config.mcp)) {
      if (server.transport === 'stdio') {
        mcpServers[name] = {
          command: server.command,
          args: server.args ?? [],
          env: server.env ?? {},
        }
        continue
      }

      const remoteServer: McpRemoteServer = server

      let entry: Record<string, unknown> = {
        url: remoteServer.url,
      }

      if (includeDefaultAuthHeaders) {
        const headers = this.getMcpAuthHeaders(remoteServer)
        if (headers) {
          entry.headers = headers
        }
      }

      if (transformRemoteEntry) {
        entry = transformRemoteEntry({ name, server: remoteServer, entry })
      }

      mcpServers[name] = entry
    }

    return mcpServers
  }

  protected getMcpAuthMode(): 'inline' | 'platform' {
    if (this.platform === 'claude-code') {
      return this.config.platforms?.['claude-code']?.mcpAuth ?? 'inline'
    }

    if (this.platform === 'cursor') {
      return this.config.platforms?.cursor?.mcpAuth ?? 'inline'
    }

    return 'inline'
  }

  /** Generate MCP config JSON in the common `{ mcpServers }` shape. */
  protected async generateMcpConfig(relativePath: string, options: McpConfigOptions = {}): Promise<void> {
    const mcpServers = this.buildMcpServers(options)
    if (!mcpServers) return
    await this.writeJson(relativePath, { mcpServers })
  }

  private getMcpAuthHeaders(server: McpRemoteServer): Record<string, string> | undefined {
    if (this.getMcpAuthMode() === 'platform' || server.auth?.type === 'platform') {
      return undefined
    }

    if (server.auth?.type === 'bearer' && server.auth.envVar) {
      return {
        Authorization: `Bearer ${this.getEnvVarReference(server.auth.envVar)}`,
      }
    }

    if (server.auth?.type === 'header' && server.auth.envVar) {
      return {
        [server.auth.headerName]: server.auth.headerTemplate.replace(
          '${value}',
          this.getEnvVarReference(server.auth.envVar),
        ),
      }
    }

    return undefined
  }

  private getEnvVarReference(envVar: string): string {
    return `\${${envVar}}`
  }
}
