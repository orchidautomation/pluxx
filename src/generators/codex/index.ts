import { resolve } from 'path'
import { existsSync } from 'fs'
import { Generator } from '../base'
import { warnDroppedHookFields } from '../hooks-warning'
import type { TargetPlatform } from '../../schema'

export class CodexGenerator extends Generator {
  readonly platform: TargetPlatform = 'codex'

  async generate(): Promise<void> {
    await Promise.all([
      this.generateManifest(),
      this.generateMcpConfig(),
      this.generateHooks(),
      this.generateAgentsMd(),
    ])

    this.copySkills()
    this.copyCommands()
    this.copyAgents()
    this.copyScripts()
    this.copyAssets()
  }

  private async generateManifest(): Promise<void> {
    const manifest: Record<string, unknown> = {
      name: this.config.name,
      version: this.config.version,
      description: this.config.description,
      author: this.config.author,
    }

    if (this.config.repository) manifest.homepage = this.config.repository
    if (this.config.repository) manifest.repository = this.config.repository
    if (this.config.license) manifest.license = this.config.license
    if (this.config.keywords) manifest.keywords = this.config.keywords

    manifest.skills = './skills/'
    if (this.config.hooks) manifest.hooks = './hooks.json'
    if (this.config.mcp) manifest.mcpServers = './.mcp.json'

    // Codex supports rich interface metadata
    if (this.config.brand) {
      const iface: Record<string, unknown> = {
        displayName: this.config.brand.displayName,
        shortDescription: this.config.brand.shortDescription ?? this.config.description,
        category: this.config.brand.category,
      }

      if (this.config.brand.longDescription) {
        iface.longDescription = this.config.brand.longDescription
      }
      if (this.config.brand.color) {
        iface.brandColor = this.config.brand.color
      }
      if (this.config.brand.icon) {
        iface.composerIcon = this.config.brand.icon
        iface.logo = this.config.brand.icon
      }
      if (this.config.brand.defaultPrompts) {
        iface.defaultPrompt = this.config.brand.defaultPrompts
      }
      if (this.config.brand.websiteURL) {
        iface.websiteURL = this.config.brand.websiteURL
      }
      if (this.config.brand.screenshots) {
        iface.screenshots = this.config.brand.screenshots
      }

      // Merge Codex-specific interface overrides
      const codexOverrides = this.config.platforms?.codex?.interface
      if (codexOverrides) {
        Object.assign(iface, codexOverrides)
      }

      iface.developerName = this.config.author.name

      manifest.interface = iface
    }

    await this.writeJson('.codex-plugin/plugin.json', manifest)
  }

  private async generateMcpConfig(): Promise<void> {
    await this.writeMcpConfig('.mcp.json', {
      includeDefaultAuthHeaders: false,
      transformRemoteEntry: ({ name, server }) => {
        const entry: Record<string, unknown> = {
          url: server.url,
        }

        // Codex uses bearer_token_env_var pattern.
        if (server.auth?.type === 'bearer' && server.auth.envVar) {
          entry.bearer_token_env_var = server.auth.envVar
        } else if (server.auth?.type === 'header' && server.auth.envVar) {
          const isBearerAuthorizationHeader =
            server.auth.headerName === 'Authorization'
            && server.auth.headerTemplate === 'Bearer ${value}'

          if (isBearerAuthorizationHeader) {
            entry.bearer_token_env_var = server.auth.envVar
          } else {
            console.warn(
              `[pluxx] codex generator: MCP server "${name}" uses auth.type "header" with unsupported custom header settings. `
              + 'Codex only supports bearer_token_env_var; custom headers were omitted.'
            )
          }
        }

        return entry
      },
    })
  }

  private async generateHooks(): Promise<void> {
    if (!this.config.hooks) return

    const hooks: Record<string, unknown[]> = {}

    for (const [event, entries] of Object.entries(this.config.hooks)) {
      if (!entries) continue
      warnDroppedHookFields(this.platform, event, entries)
      // Codex uses PascalCase event names like Claude Code
      const codexEvent = event.charAt(0).toUpperCase() + event.slice(1)
      const commandEntries = entries.filter(entry => entry.type !== 'prompt' && entry.command)
      if (commandEntries.length === 0) continue
      hooks[codexEvent] = commandEntries.map(entry => ({
        hooks: [{
          type: 'command',
          command: entry.command!.replace('${PLUGIN_ROOT}', '.'),
        }],
      }))
    }

    await this.writeJson('hooks.json', { hooks })
  }

  private async generateAgentsMd(): Promise<void> {
    if (!this.config.instructions) return
    const srcPath = resolve(this.rootDir, this.config.instructions)
    if (!existsSync(srcPath)) return

    const content = await Bun.file(srcPath).text()
    await this.writeFile('AGENTS.md', content)
  }
}
