import { Generator } from '../base'
import { generateClaudeFamilyOutputs } from '../shared/claude-family'
import type { TargetPlatform } from '../../schema'
import { cpSync, existsSync, mkdirSync, readdirSync } from 'fs'
import { basename, extname, join, relative } from 'path'

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
        includeStandardHooksManifest: false,
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

  protected copySkills(): void {
    if (!this.config.commands) {
      super.copySkills()
      return
    }

    const skillsSrc = this.resolveConfigPath(this.config.skills, 'skills')
    if (!existsSync(skillsSrc)) return

    const commandsSrc = this.resolveConfigPath(this.config.commands, 'commands')
    if (!existsSync(commandsSrc)) {
      super.copySkills()
      return
    }

    const collidingSkillNames = collectCommandNames(commandsSrc)
    if (collidingSkillNames.size === 0) {
      super.copySkills()
      return
    }

    const skillsDest = join(this.outDir, 'skills')
    mkdirSync(skillsDest, { recursive: true })

    for (const entry of readdirSync(skillsSrc, { withFileTypes: true })) {
      const srcPath = join(skillsSrc, entry.name)
      const destPath = join(skillsDest, entry.name)
      if (entry.isDirectory() && collidingSkillNames.has(entry.name)) {
        continue
      }
      cpSync(srcPath, destPath, { recursive: true })
    }
  }
}

function collectCommandNames(commandsRoot: string): Set<string> {
  const commandNames = new Set<string>()
  const stack = [commandsRoot]

  while (stack.length > 0) {
    const currentDir = stack.pop()
    if (!currentDir) continue

    for (const entry of readdirSync(currentDir, { withFileTypes: true })) {
      const fullPath = join(currentDir, entry.name)
      if (entry.isDirectory()) {
        stack.push(fullPath)
        continue
      }

      if (entry.isFile() && extname(entry.name).toLowerCase() === '.md') {
        const relativePath = relative(commandsRoot, fullPath)
        const commandName = basename(relativePath, '.md')
        if (commandName) {
          commandNames.add(commandName)
        }
      }
    }
  }

  return commandNames
}
