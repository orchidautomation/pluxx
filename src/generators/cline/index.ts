import { resolve } from 'path'
import { existsSync } from 'fs'
import { Generator } from '../base'
import type { TargetPlatform } from '../../schema'

/**
 * Cline uses .clinerules for instructions, .cline/mcp.json for MCP config,
 * and .cline/skills/ for skills. No plugin manifest.
 */
export class ClineGenerator extends Generator {
  readonly platform: TargetPlatform = 'cline'

  async generate(): Promise<void> {
    await Promise.all([
      this.generateMcpConfig(),
      this.generateRules(),
    ])

    this.copyClineSkills()
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
        }
        mcpServers[name] = entry
      }
    }

    await this.writeJson('.cline/mcp.json', { mcpServers })
  }

  private async generateRules(): Promise<void> {
    if (!this.config.instructions) return
    const srcPath = resolve(this.rootDir, this.config.instructions)
    if (!existsSync(srcPath)) return

    const content = await Bun.file(srcPath).text()
    await this.writeFile('.clinerules', content)
  }

  /** Copy skills into .cline/skills/ instead of the default skills/ */
  private copyClineSkills(): void {
    this.copyDir(this.config.skills, '.cline/skills/')
  }
}
