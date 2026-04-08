import { existsSync } from 'fs'
import { Generator } from '../base'
import type { TargetPlatform } from '../../schema'

/**
 * Roo Code uses .roo/mcp.json for MCP config, .roorules for instructions,
 * and .roo/skills/ for skills. No plugin manifest.
 */
export class RooCodeGenerator extends Generator {
  readonly platform: TargetPlatform = 'roo-code'

  async generate(): Promise<void> {
    await Promise.all([
      this.generateMcpConfig(),
      this.generateRules(),
    ])

    this.copyRooSkills()
    this.copyScripts()
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

    await this.writeJson('.roo/mcp.json', { mcpServers })
  }

  private async generateRules(): Promise<void> {
    if (!this.config.instructions) return
    const srcPath = this.resolveConfigPath(this.config.instructions, 'instructions')
    if (!existsSync(srcPath)) return

    const content = await Bun.file(srcPath).text()
    await this.writeFile('.roorules', content)
  }

  /** Copy skills into .roo/skills/ instead of the default skills/ */
  private copyRooSkills(): void {
    this.copyDir(this.config.skills, '.roo/skills/', 'skills')
  }
}
