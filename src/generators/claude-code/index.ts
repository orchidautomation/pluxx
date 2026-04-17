import { Generator } from '../base'
import { generateClaudeFamilyOutputs } from '../shared/claude-family'
import type { TargetPlatform } from '../../schema'
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'fs'
import { basename, join } from 'path'

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
    super.copySkills()

    const collidingSkills = this.collectCollidingSkills()
    for (const skill of collidingSkills) {
      const outputPath = join(this.outDir, 'skills', skill.dirName, 'SKILL.md')
      if (!existsSync(outputPath)) continue

      const current = readFileSync(outputPath, 'utf-8')
      const hiddenName = buildHiddenSkillName(skill.effectiveName)
      const rewritten = rewriteClaudeCollidingSkill(current, hiddenName)
      if (rewritten !== current) {
        writeFileSync(outputPath, rewritten, 'utf-8')
      }
    }
  }

  private collectCollidingSkills(): Array<{ dirName: string; effectiveName: string }> {
    if (!this.config.commands) return []

    const commandsSrc = this.resolveConfigPath(this.config.commands, 'commands')
    const skillsSrc = this.resolveConfigPath(this.config.skills, 'skills')
    if (!existsSync(commandsSrc) || !existsSync(skillsSrc)) return []

    const commandNames = collectTopLevelCommandNames(commandsSrc)
    const collidingSkills: Array<{ dirName: string; effectiveName: string }> = []

    for (const entry of readdirSync(skillsSrc, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue
      const skillFile = join(skillsSrc, entry.name, 'SKILL.md')
      if (!existsSync(skillFile)) continue

      const content = readFileSync(skillFile, 'utf-8')
      const effectiveName = getEffectiveSkillName(content, entry.name)
      if (commandNames.has(effectiveName)) {
        collidingSkills.push({ dirName: entry.name, effectiveName })
      }
    }

    return collidingSkills
  }
}

function collectTopLevelCommandNames(commandsRoot: string): Set<string> {
  const commandNames = new Set<string>()
  for (const entry of readdirSync(commandsRoot, { withFileTypes: true })) {
    if (entry.isFile() && entry.name.toLowerCase().endsWith('.md')) {
      commandNames.add(basename(entry.name, '.md'))
    }
  }
  return commandNames
}

function getEffectiveSkillName(content: string, fallback: string): string {
  const frontmatter = extractFrontmatterLines(content)
  if (!frontmatter) return fallback

  for (const line of frontmatter) {
    const match = /^name:\s*(.+)\s*$/i.exec(line.trim())
    if (match?.[1]) {
      return stripYamlScalar(match[1]) || fallback
    }
  }

  return fallback
}

function buildHiddenSkillName(name: string): string {
  const maxBaseLength = 64 - '-skill'.length
  const trimmed = name.length > maxBaseLength ? name.slice(0, maxBaseLength) : name
  return `${trimmed}-skill`
}

function rewriteClaudeCollidingSkill(content: string, hiddenName: string): string {
  const frontmatter = extractFrontmatterLines(content)
  if (!frontmatter) {
    return [
      '---',
      `name: ${hiddenName}`,
      'user-invocable: false',
      '---',
      '',
      content.trimStart(),
    ].join('\n')
  }

  const rewritten = [...frontmatter]
  let sawName = false
  let sawUserInvocable = false

  for (let index = 0; index < rewritten.length; index += 1) {
    const trimmed = rewritten[index].trim()
    if (/^name:\s*/i.test(trimmed)) {
      rewritten[index] = `name: ${hiddenName}`
      sawName = true
      continue
    }
    if (/^user-invocable:\s*/i.test(trimmed)) {
      rewritten[index] = 'user-invocable: false'
      sawUserInvocable = true
    }
  }

  if (!sawName) rewritten.push(`name: ${hiddenName}`)
  if (!sawUserInvocable) rewritten.push('user-invocable: false')

  const lines = content.split('\n')
  const endIndex = findFrontmatterEndIndex(lines)
  const body = endIndex === -1 ? content : lines.slice(endIndex + 1).join('\n')
  return ['---', ...rewritten, '---', body ? `\n${body.replace(/^\n/, '')}` : ''].join('\n')
}

function extractFrontmatterLines(content: string): string[] | null {
  const lines = content.split('\n')
  const endIndex = findFrontmatterEndIndex(lines)
  if (endIndex === -1) return null
  return lines.slice(1, endIndex)
}

function findFrontmatterEndIndex(lines: string[]): number {
  if (lines[0]?.trim() !== '---') return -1

  for (let index = 1; index < lines.length; index += 1) {
    if (lines[index].trim() === '---') {
      return index
    }
  }

  return -1
}

function stripYamlScalar(value: string): string {
  const trimmed = value.trim()
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"'))
    || (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1).trim()
  }
  return trimmed
}
