import { cpSync, mkdirSync } from 'fs'
import { resolve } from 'path'
import type { TargetPlatform } from '../../schema'
import {
  buildAgentPluginsManifest,
  buildAgentPluginsMcpConfig,
  getAgentPluginsPortabilityDecisions,
  validateAgentPluginsPackage,
  validateAgentPluginsSkillSource,
} from '../../agent-plugins'
import { Generator } from '../base'

export class AgentPluginsGenerator extends Generator {
  readonly platform: TargetPlatform = 'agent-plugins'

  async generate(): Promise<void> {
    await this.writeJson('plugin.json', buildAgentPluginsManifest(this.config))
    const mcp = buildAgentPluginsMcpConfig(this.config)
    if (mcp) await this.writeJson('mcp.json', mcp)

    const skillsRoot = this.resolveConfigPath(this.config.skills, 'skills')
    const skillNames = validateAgentPluginsSkillSource(skillsRoot)
    if (skillNames.length > 0) {
      mkdirSync(resolve(this.outDir, 'skills'), { recursive: true })
      for (const skillName of skillNames) {
        cpSync(resolve(skillsRoot, skillName), resolve(this.outDir, 'skills', skillName), { recursive: true })
      }
    }

    for (const decision of getAgentPluginsPortabilityDecisions(this.config)) {
      if (decision.mode !== 'preserve') console.warn(`[pluxx] agent-plugins ${decision.mode} ${decision.bucket}: ${decision.detail}`)
    }
    validateAgentPluginsPackage(this.outDir)
  }
}
