import { Generator } from '../base'
import { generateClaudeFamilyOutputs } from '../shared/claude-family'
import type { TargetPlatform } from '../../schema'

export class ClaudeCodeGenerator extends Generator {
  readonly platform: TargetPlatform = 'claude-code'

  async generate(): Promise<void> {
    await generateClaudeFamilyOutputs({
      config: this.config,
      rootDir: this.rootDir,
      platform: this.platform,
      options: {
        manifestPath: '.claude-plugin/plugin.json',
        instructionsFile: 'CLAUDE.md',
        pluginRootVar: 'CLAUDE_PLUGIN_ROOT',
      },
      writeJson: (relativePath, data) => this.writeJson(relativePath, data),
      writeFile: (relativePath, content) => this.writeFile(relativePath, content),
    })

    this.copySkills()
    this.copyCommands()
    this.copyAgents()
    this.copyScripts()
    this.copyAssets()
  }
}
