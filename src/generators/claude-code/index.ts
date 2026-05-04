import { Generator } from '../base'
import { generateClaudeFamilyOutputs } from '../shared/claude-family'
import type { TargetPlatform } from '../../schema'
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'fs'
import { basename, join } from 'path'
import { getCanonicalAgentMetadata, type AgentFrontmatterMap, readCanonicalAgentFiles } from '../../agents'
import { buildDelegationBehaviorNotes } from '../../delegation'
import { getCanonicalCommandMetadata, readCanonicalCommandFiles } from '../../commands'
import { parseSkillMarkdown, readCanonicalSkillFiles, serializeSkillMarkdown } from '../../skills'

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
    const wrappedSkills = this.collectCommandWrappedSkills()
    for (const skill of collidingSkills) {
      const outputPath = join(this.outDir, 'skills', skill.dirName, 'SKILL.md')
      if (!existsSync(outputPath)) continue

      const current = readFileSync(outputPath, 'utf-8')
      const hiddenName = buildHiddenSkillName(skill.effectiveName)
      const rewritten = rewriteClaudeSkillVisibility(current, {
        nameOverride: hiddenName,
        userInvocable: false,
      })
      if (rewritten !== current) {
        writeFileSync(outputPath, rewritten, 'utf-8')
      }
    }

    for (const skill of wrappedSkills) {
      if (collidingSkills.some((entry) => entry.dirName === skill.dirName)) continue

      const outputPath = join(this.outDir, 'skills', skill.dirName, 'SKILL.md')
      if (!existsSync(outputPath)) continue

      const current = readFileSync(outputPath, 'utf-8')
      const rewritten = rewriteClaudeSkillVisibility(current, {
        userInvocable: false,
      })
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
      const metadata = getCanonicalAgentMetadata(agent)
      const frontmatter = [
        '---',
        `name: ${JSON.stringify(metadata.name)}`,
        `description: ${JSON.stringify(metadata.description)}`,
      ]

      if (metadata.model) {
        frontmatter.push(`model: ${JSON.stringify(metadata.model)}`)
      }

      if (metadata.modelReasoningEffort) {
        frontmatter.push(`effort: ${JSON.stringify(metadata.modelReasoningEffort)}`)
      }

      if (typeof metadata.steps === 'number') {
        frontmatter.push(`maxTurns: ${metadata.steps}`)
      }

      const claudeTools = selectClaudeToolsField(agent.frontmatter)
      if (claudeTools) {
        frontmatter.push(`tools: ${claudeTools}`)
      }

      const disallowedTools = buildClaudeDisallowedTools(agent.frontmatter)
      if (disallowedTools.length > 0) {
        frontmatter.push(`disallowedTools: ${disallowedTools.join(', ')}`)
      }

      if (metadata.skills) {
        frontmatter.push(`skills: ${metadata.skills}`)
      }
      if (metadata.memory) {
        frontmatter.push(`memory: ${JSON.stringify(metadata.memory)}`)
      }
      if (typeof metadata.background === 'boolean') {
        frontmatter.push(`background: ${metadata.background}`)
      }
      if (metadata.isolation) {
        frontmatter.push(`isolation: ${JSON.stringify(metadata.isolation)}`)
      }
      if (metadata.color) {
        frontmatter.push(`color: ${JSON.stringify(metadata.color)}`)
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
        metadata.body,
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

    for (const skill of readCanonicalSkillFiles(skillsSrc)) {
      const effectiveName = skill.name ?? skill.dirName
      if (commandNames.has(effectiveName)) {
        collidingSkills.push({ dirName: skill.dirName, effectiveName })
      }
    }

    return collidingSkills
  }

  private collectCommandWrappedSkills(): Array<{ dirName: string; effectiveName: string }> {
    if (!this.config.commands) return []

    const commandsSrc = this.resolveConfigPath(this.config.commands, 'commands')
    const skillsSrc = this.resolveConfigPath(this.config.skills, 'skills')
    if (!existsSync(commandsSrc) || !existsSync(skillsSrc)) return []

    const referencedSkills = collectWrappedSkillNames(commandsSrc)
    if (referencedSkills.size === 0) return []

    const wrappedSkills: Array<{ dirName: string; effectiveName: string }> = []

    for (const skill of readCanonicalSkillFiles(skillsSrc)) {
      const effectiveName = skill.name ?? skill.dirName
      if (referencedSkills.has(effectiveName)) {
        wrappedSkills.push({ dirName: skill.dirName, effectiveName })
      }
    }

    return wrappedSkills
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

function collectWrappedSkillNames(commandsRoot: string): Set<string> {
  const wrappedSkills = new Set<string>()
  for (const command of readCanonicalCommandFiles(commandsRoot)) {
    const metadata = getCanonicalCommandMetadata(command)
    for (const skillName of metadata.skills) {
      if (skillName) wrappedSkills.add(skillName)
    }
  }
  return wrappedSkills
}

function buildHiddenSkillName(name: string): string {
  const maxBaseLength = 64 - '-skill'.length
  const trimmed = name.length > maxBaseLength ? name.slice(0, maxBaseLength) : name
  return `${trimmed}-skill`
}

function rewriteClaudeSkillVisibility(
  content: string,
  options: { nameOverride?: string; userInvocable?: boolean },
): string {
  const parsed = parseSkillMarkdown(content)
  if (!parsed.hasValidFrontmatter) {
    const generatedFrontmatter = ['---']
    if (options.nameOverride) generatedFrontmatter.push(`name: ${options.nameOverride}`)
    if (options.userInvocable === false) generatedFrontmatter.push('user-invocable: false')
    return [
      ...generatedFrontmatter,
      '---',
      '',
      content.trimStart(),
    ].join('\n')
  }

  const rewritten = [...parsed.frontmatterLines]
  let sawName = false
  let sawUserInvocable = false

  for (let index = 0; index < rewritten.length; index += 1) {
    const trimmed = rewritten[index].trim()
    if (options.nameOverride && /^name:\s*/i.test(trimmed)) {
      rewritten[index] = `name: ${options.nameOverride}`
      sawName = true
      continue
    }
    if (options.userInvocable === false && /^user-invocable:\s*/i.test(trimmed)) {
      rewritten[index] = 'user-invocable: false'
      sawUserInvocable = true
    }
  }

  if (options.nameOverride && !sawName) rewritten.push(`name: ${options.nameOverride}`)
  if (options.userInvocable === false && !sawUserInvocable) rewritten.push('user-invocable: false')

  return serializeSkillMarkdown(rewritten, parsed.body)
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

function selectClaudeToolsField(frontmatter: AgentFrontmatterMap): string | null {
  if (typeof frontmatter.tools !== 'string') return null

  const tools = frontmatter.tools
    .split(',')
    .map(token => token.trim())
    .filter(Boolean)

  if (tools.length === 0) return null

  // Claude plugin subagents inherit MCP tools from the parent task. Emitting
  // explicit mcp__... entries in the allowlist causes current plugin installs
  // to fail schema validation, so prefer inherited MCP access plus
  // disallowedTools restrictions in that case.
  if (tools.some(token => token.startsWith('mcp__'))) {
    return null
  }

  return tools.join(', ')
}

function asMap(value: unknown): AgentFrontmatterMap | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined
  return value as AgentFrontmatterMap
}
