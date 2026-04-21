import { existsSync } from 'fs'
import { Generator } from '../base'
import type { TargetPlatform } from '../../schema'
import { readTextFile } from '../../text-files'

/**
 * Cline uses .clinerules for instructions, .cline/mcp.json for MCP config,
 * and .cline/skills/ for skills. No plugin manifest.
 */
export class ClineGenerator extends Generator {
  readonly platform: TargetPlatform = 'cline'

  async generate(): Promise<void> {
    await Promise.all([
      this.generateMcpConfig('.cline/mcp.json'),
      this.generateRules(),
    ])

    this.copyClineSkills()
    this.copyScripts()
    this.copyPassthrough()
  }

  private async generateRules(): Promise<void> {
    if (!this.config.instructions) return
    const srcPath = this.resolveConfigPath(this.config.instructions, 'instructions')
    if (!existsSync(srcPath)) return

    const content = await readTextFile(srcPath)
    await this.writeFile('.clinerules', content)
  }

  /** Copy skills into .cline/skills/ instead of the default skills/ */
  private copyClineSkills(): void {
    this.copyDir(this.config.skills, '.cline/skills/', 'skills')
  }
}
