import { existsSync } from 'fs'
import { Generator } from '../base'
import type { TargetPlatform } from '../../schema'
import { readTextFile } from '../../text-files'

/**
 * Roo Code uses .roo/mcp.json for MCP config, .roorules for instructions,
 * and .roo/skills/ for skills. No plugin manifest.
 */
export class RooCodeGenerator extends Generator {
  readonly platform: TargetPlatform = 'roo-code'

  async generate(): Promise<void> {
    await Promise.all([
      this.generateMcpConfig('.roo/mcp.json'),
      this.generateRules(),
    ])

    this.copyRooSkills()
    this.copyScripts()
    this.copyPassthrough()
  }

  private async generateRules(): Promise<void> {
    if (!this.config.instructions) return
    const srcPath = this.resolveConfigPath(this.config.instructions, 'instructions')
    if (!existsSync(srcPath)) return

    const content = await readTextFile(srcPath)
    await this.writeFile('.roorules', content)
  }

  /** Copy skills into .roo/skills/ instead of the default skills/ */
  private copyRooSkills(): void {
    this.copyDir(this.config.skills, '.roo/skills/', 'skills')
  }
}
