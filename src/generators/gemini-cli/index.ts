import { existsSync } from 'fs'
import { Generator } from '../base'
import { warnDroppedHookFields } from '../hooks-warning'
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
    const mcpServers = this.buildMcpServers({
      transformRemoteEntry: ({ server, entry }) => ({
        type: server.transport === 'sse' ? 'sse' : 'http',
        ...entry,
      }),
    })
    if (mcpServers) {
      manifest.mcpServers = mcpServers
    }

    // Skills paths
    manifest.skills = ['./skills/']

    // Hooks block
    if (this.config.hooks) {
      const hooks: Record<string, unknown[]> = {}

      for (const [event, entries] of Object.entries(this.config.hooks)) {
        if (!entries) continue
        warnDroppedHookFields(this.platform, event, entries)
        const commandEntries = entries.filter(entry => entry.type !== 'prompt' && entry.command)
        if (commandEntries.length === 0) continue
        hooks[event] = commandEntries.map(entry => ({
          command: entry.command!.replace('${PLUGIN_ROOT}', '.'),
        }))
      }

      manifest.hooks = hooks
    }

    await this.writeJson('gemini-extension.json', manifest)
  }

  private async generateInstructions(): Promise<void> {
    if (!this.config.instructions) return
    const srcPath = this.resolveConfigPath(this.config.instructions, 'instructions')
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
