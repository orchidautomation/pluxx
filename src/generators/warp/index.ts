import { resolve } from 'path'
import { existsSync } from 'fs'
import { Generator } from '../base'
import type { TargetPlatform } from '../../schema'

/**
 * Warp reads skills from .agents/skills/ and .warp/skills/.
 * Uses AGENTS.md for instructions. MCP via config.
 * No formal plugin manifest — generates skills + AGENTS.md + MCP config.
 */
export class WarpGenerator extends Generator {
  readonly platform: TargetPlatform = 'warp'

  async generate(): Promise<void> {
    await Promise.all([
      this.generateAgentsMd(),
      this.generateMcpConfig(),
    ])

    this.copySkills()
    this.copyScripts()
  }

  private async generateAgentsMd(): Promise<void> {
    if (!this.config.instructions) return
    const srcPath = resolve(this.rootDir, this.config.instructions)
    if (!existsSync(srcPath)) return

    const content = await Bun.file(srcPath).text()
    await this.writeFile('AGENTS.md', content)
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

    await this.writeJson('mcp.json', { mcpServers })
  }
}
