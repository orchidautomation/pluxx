import { Generator } from '../base'
import { generateClaudeFamilyOutputs } from '../shared/claude-family'
import type { TargetPlatform } from '../../schema'

/**
 * OpenHands uses .plugin/plugin.json (Claude Code-compatible format).
 * Discovery dirs: .openhands/skills/, .claude/skills/, .agents/skills/
 */
export class OpenHandsGenerator extends Generator {
  readonly platform: TargetPlatform = 'openhands'

  async generate(): Promise<void> {
    await generateClaudeFamilyOutputs({
      config: this.config,
      rootDir: this.rootDir,
      platform: this.platform,
      options: {
        manifestPath: '.plugin/plugin.json',
        instructionsFile: 'AGENTS.md',
        pluginRootVar: 'PLUGIN_ROOT',
      },
      writeJson: (relativePath, data) => this.writeJson(relativePath, data),
      writeFile: (relativePath, content) => this.writeFile(relativePath, content),
    })

    this.copySkills()
    this.copyCommands()
    this.copyAgents()
    this.copyScripts()
    this.copyAssets()
    this.copyPassthrough()
  }
}
