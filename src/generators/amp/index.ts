import { existsSync } from 'fs'
import { Generator } from '../base'
import { warnDroppedHookFields } from '../hooks-warning'
import type { TargetPlatform } from '../../schema'

/**
 * Amp uses AGENT.md for instructions, .amp/settings.json for hooks,
 * MCP config, and skills/ for skills. No plugin manifest.
 */
export class AmpGenerator extends Generator {
  readonly platform: TargetPlatform = 'amp'

  async generate(): Promise<void> {
    await Promise.all([
      this.generateAgentMd(),
      this.generateSettings(),
      this.generateMcpConfig('mcp.json'),
    ])

    this.copySkills()
    this.copyScripts()
  }

  private async generateAgentMd(): Promise<void> {
    if (!this.config.instructions) return
    const srcPath = this.resolveConfigPath(this.config.instructions, 'instructions')
    if (!existsSync(srcPath)) return

    const content = await Bun.file(srcPath).text()

    const agentMd = [
      `# ${this.config.brand?.displayName ?? this.config.name}`,
      '',
      this.config.brand?.shortDescription ?? this.config.description,
      '',
      content,
    ].join('\n')

    await this.writeFile('AGENT.md', agentMd)
  }

  private async generateSettings(): Promise<void> {
    if (!this.config.hooks) return

    // Amp hooks use a post-execute format
    const hooks: Record<string, unknown[]> = {}

    for (const [event, entries] of Object.entries(this.config.hooks)) {
      if (!entries) continue
      warnDroppedHookFields(this.platform, event, entries)
      const commandEntries = entries.filter(entry => entry.type !== 'prompt' && entry.command)
      if (commandEntries.length === 0) continue
      hooks[event] = commandEntries.map(entry => ({
        type: 'post-execute',
        command: entry.command!.replace('${PLUGIN_ROOT}', '.'),
        ...(entry.timeout ? { timeout: entry.timeout } : {}),
      }))
    }

    await this.writeJson('.amp/settings.json', { hooks })
  }

}
