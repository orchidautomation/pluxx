import { resolve } from 'path'
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
      this.generateMcpConfig(),
    ])

    this.copySkills()
    this.copyScripts()
  }

  private async generateAgentMd(): Promise<void> {
    if (!this.config.instructions) return
    const srcPath = resolve(this.rootDir, this.config.instructions)
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
      hooks[event] = entries.map(entry => ({
        type: 'post-execute',
        command: entry.command.replace('${PLUGIN_ROOT}', '.'),
        ...(entry.timeout ? { timeout: entry.timeout } : {}),
      }))
    }

    await this.writeJson('.amp/settings.json', { hooks })
  }

  private async generateMcpConfig(): Promise<void> {
    if (!this.config.mcp) return

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

    await this.writeJson('mcp.json', { mcpServers })
  }
}
