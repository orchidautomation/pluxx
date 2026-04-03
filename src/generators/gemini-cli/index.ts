import { resolve } from 'path'
import { existsSync } from 'fs'
import { Generator } from '../base'
import type { TargetPlatform } from '../../schema'

/**
 * Gemini CLI uses gemini-extension.json for the plugin manifest,
 * GEMINI.md for instructions, and mcpServers in the same format as Claude Code.
 */
export class GeminiCliGenerator extends Generator {
  readonly platform: TargetPlatform = 'gemini-cli'

  async generate(): Promise<void> {
    await Promise.all([
      this.generateManifest(),
      this.generateInstructions(),
    ])

    this.copySkills()
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

    // MCP servers block
    if (this.config.mcp) {
      const mcpServers: Record<string, unknown> = {}

      for (const [name, server] of Object.entries(this.config.mcp)) {
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
                `\${${server.auth.envVar}}`
              ),
            }
          }

          mcpServers[name] = entry
        }
      }

      manifest.mcpServers = mcpServers
    }

    // Skills paths
    manifest.skills = ['./skills/']

    // Hooks block
    if (this.config.hooks) {
      const hooks: Record<string, unknown[]> = {}

      for (const [event, entries] of Object.entries(this.config.hooks)) {
        if (!entries) continue
        hooks[event] = entries.map(entry => ({
          command: entry.command.replace('${PLUGIN_ROOT}', '.'),
        }))
      }

      manifest.hooks = hooks
    }

    await this.writeJson('gemini-extension.json', manifest)
  }

  private async generateInstructions(): Promise<void> {
    if (!this.config.instructions) return
    const srcPath = resolve(this.rootDir, this.config.instructions)
    if (!existsSync(srcPath)) return

    const content = await Bun.file(srcPath).text()

    const geminiMd = [
      `# ${this.config.brand?.displayName ?? this.config.name}`,
      '',
      this.config.brand?.shortDescription ?? this.config.description,
      '',
      content,
    ].join('\n')

    await this.writeFile('GEMINI.md', geminiMd)
  }
}
