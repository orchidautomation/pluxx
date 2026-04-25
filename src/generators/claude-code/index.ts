import { Generator } from '../base'
import { generateClaudeFamilyOutputs } from '../shared/claude-family'
import type { TargetPlatform } from '../../schema'
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'fs'
import { basename, join } from 'path'
import { type AgentFrontmatterMap, readCanonicalAgentFiles } from '../../agents'
import { buildDelegationBehaviorNotes } from '../../delegation'

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
        agentsManifestMode: 'files',
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

  protected copyAgents(): void {
    if (!this.config.agents) return

    const agentsDir = this.resolveConfigPath(this.config.agents, 'agents')
    const agents = readCanonicalAgentFiles(agentsDir)
    if (agents.length === 0) return
    mkdirSync(join(this.outDir, 'agents'), { recursive: true })

    for (const agent of agents) {
      const frontmatter = [
        '---',
        `name: ${JSON.stringify(agent.name)}`,
        `description: ${JSON.stringify(agent.description ?? `${agent.name} specialist.`)}`,
      ]

      if (typeof agent.frontmatter.model === 'string' && agent.frontmatter.model) {
        frontmatter.push(`model: ${JSON.stringify(agent.frontmatter.model)}`)
      }

      const effort = typeof agent.frontmatter.model_reasoning_effort === 'string' && agent.frontmatter.model_reasoning_effort
        ? agent.frontmatter.model_reasoning_effort
        : typeof agent.frontmatter.effort === 'string' && agent.frontmatter.effort
          ? agent.frontmatter.effort
          : undefined
      if (effort) {
        frontmatter.push(`effort: ${JSON.stringify(effort)}`)
      }

      const maxTurns = typeof agent.frontmatter.maxTurns === 'number'
        ? agent.frontmatter.maxTurns
        : typeof agent.frontmatter.steps === 'number'
          ? agent.frontmatter.steps
          : typeof agent.frontmatter.maxSteps === 'number'
            ? agent.frontmatter.maxSteps
            : undefined
      if (typeof maxTurns === 'number') {
        frontmatter.push(`maxTurns: ${maxTurns}`)
      }

      const disallowedTools = buildClaudeDisallowedTools(agent.frontmatter)
      if (disallowedTools.length > 0) {
        frontmatter.push(`disallowedTools: ${disallowedTools.join(', ')}`)
      }

      frontmatter.push('---')

      const delegationNotes = buildDelegationBehaviorNotes(agent.frontmatter)
      const bodyParts = [
        ...(delegationNotes.length > 0
          ? [
              'Delegation contract:',
              ...delegationNotes.map((note) => `- ${note}`),
              '',
            ]
          : []),
        agent.body,
      ].filter(Boolean)

      const outputPath = join(this.outDir, 'agents', `${agent.fileStem}.md`)
      writeFileSync(outputPath, `${frontmatter.join('\n')}\n\n${bodyParts.join('\n').trim()}\n`, 'utf-8')
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

function buildClaudeDisallowedTools(frontmatter: AgentFrontmatterMap): string[] {
  const tools = new Set<string>()
  const permission = asMap(frontmatter.permission)
  const bash = asMap(permission?.bash)
  const legacyTools = asMap(frontmatter.tools)

  if (permission?.edit === 'deny') {
    tools.add('Write')
    tools.add('Edit')
    tools.add('MultiEdit')
  }

  if (permission?.bash === 'deny' || bash?.['*'] === 'deny') {
    tools.add('Bash')
  }

  if (
    legacyTools?.write === false
    || legacyTools?.edit === false
    || legacyTools?.patch === false
    || legacyTools?.multiedit === false
  ) {
    tools.add('Write')
    tools.add('Edit')
    tools.add('MultiEdit')
  }

  if (legacyTools?.bash === false || legacyTools?.shell === false) {
    tools.add('Bash')
  }

  if (typeof frontmatter.disallowedTools === 'string') {
    for (const token of frontmatter.disallowedTools.split(',')) {
      const trimmed = token.trim()
      if (trimmed) tools.add(trimmed)
    }
  }

  return Array.from(tools)
}

function asMap(value: unknown): AgentFrontmatterMap | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined
  return value as AgentFrontmatterMap
}
