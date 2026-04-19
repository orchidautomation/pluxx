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
      this.generateMcpConfig('mcp.json'),
    ])

    this.copySkills()
    this.copyScripts()
    this.copyPassthrough()
  }

  private async generateAgentsMd(): Promise<void> {
    if (!this.config.instructions) return
    const srcPath = this.resolveConfigPath(this.config.instructions, 'instructions')
    if (!existsSync(srcPath)) return

    const content = await Bun.file(srcPath).text()
    await this.writeFile('AGENTS.md', content)
  }

}
