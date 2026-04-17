import { Generator } from '../base'
import { generateClaudeFamilyOutputs } from '../shared/claude-family'
import type { TargetPlatform } from '../../schema'
import { cpSync, existsSync, mkdirSync, readdirSync } from 'fs'
import { basename, dirname, extname, join, relative } from 'path'

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

  protected copyCommands(): void {
    if (!this.config.commands) return

    const commandsSrc = this.resolveConfigPath(this.config.commands, 'commands')
    if (!existsSync(commandsSrc)) return

    const collidingSkillNames = this.collectCollidingSkillNames()
    if (collidingSkillNames.size === 0) {
      super.copyCommands()
      return
    }

    const commandFiles = collectCommandFiles(commandsSrc)
    const reservedOutputPaths = new Set(commandFiles)
    const allocatedOutputPaths = new Set<string>()
    const commandsDest = join(this.outDir, 'commands')

    for (const relativePath of commandFiles) {
      const sourcePath = join(commandsSrc, relativePath)
      let outputPath = relativePath
      const commandName = basename(relativePath, '.md')

      if (collidingSkillNames.has(commandName)) {
        outputPath = buildRemappedCommandPath(relativePath, reservedOutputPaths, allocatedOutputPaths)
      }

      const destinationPath = join(commandsDest, outputPath)
      mkdirSync(dirname(destinationPath), { recursive: true })
      cpSync(sourcePath, destinationPath)
      allocatedOutputPaths.add(outputPath)
    }
  }

  private collectCollidingSkillNames(): Set<string> {
    const skillsSrc = this.resolveConfigPath(this.config.skills, 'skills')
    if (!existsSync(skillsSrc)) return new Set<string>()
    return collectTopLevelSkillNames(skillsSrc)
  }
}

function collectTopLevelSkillNames(skillsRoot: string): Set<string> {
  const skillNames = new Set<string>()
  for (const entry of readdirSync(skillsRoot, { withFileTypes: true })) {
    if (entry.isDirectory()) skillNames.add(entry.name)
  }
  return skillNames
}

function collectCommandFiles(commandsRoot: string): string[] {
  const commandFiles: string[] = []
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
        if (relativePath) commandFiles.push(relativePath)
      }
    }
  }

  commandFiles.sort()
  return commandFiles
}

function buildRemappedCommandPath(
  relativePath: string,
  reservedOutputPaths: Set<string>,
  allocatedOutputPaths: Set<string>,
): string {
  const dir = dirname(relativePath)
  const ext = extname(relativePath) || '.md'
  const stem = basename(relativePath, ext)

  let suffix = ''
  let counter = 1
  while (true) {
    const candidateName = `${stem}-command${suffix}${ext}`
    const candidatePath = dir === '.' ? candidateName : join(dir, candidateName)
    if (!reservedOutputPaths.has(candidatePath) && !allocatedOutputPaths.has(candidatePath)) {
      return candidatePath
    }
    counter += 1
    suffix = `-${counter}`
  }
}
