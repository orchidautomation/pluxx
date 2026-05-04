import { existsSync } from 'fs'
import { Generator } from '../base'
import type { TargetPlatform } from '../../schema'
import { buildGeneratedPermissionHookScript } from '../../permissions'
import { readInstructionsContent } from '../../instructions'
import { getCanonicalAgentMetadata, type AgentFrontmatterMap, readCanonicalAgentFiles } from '../../agents'
import { buildDelegationBehaviorNotes } from '../../delegation'
import { getHookFieldSupportedEvents } from '../../hook-translation-registry'
import { buildGeneratedReadinessScript, getRuntimeReadinessPlan } from '../../readiness'
import { getEnabledRuntimeReadinessBindings, getRuntimeReadinessCapability } from '../../runtime-readiness-registry'

export class CursorGenerator extends Generator {
  readonly platform: TargetPlatform = 'cursor'

  async generate(): Promise<void> {
    await Promise.all([
      this.generateManifest(),
      this.generateMcpConfig('mcp.json'),
      this.generateHooks(),
      this.generateRules(),
      this.generateAgents(),
      this.generateAgentsMd(),
    ])

    this.copySkills()
    this.copyCommands()
    this.copyScripts()
    this.copyAssets()
    this.copyPassthrough()
  }

  private async generateManifest(): Promise<void> {
    const manifest: Record<string, unknown> = {
      name: this.config.name,
      description: this.config.description,
      version: this.config.version,
      author: this.config.author,
    }

    if (this.config.repository) manifest.repository = this.config.repository
    if (this.config.license) manifest.license = this.config.license
    if (this.config.keywords) manifest.keywords = this.config.keywords
    if (this.config.brand?.websiteURL) manifest.homepage = this.config.brand.websiteURL
    if (this.config.brand?.icon) manifest.logo = this.config.brand.icon

    manifest.skills = './skills/'
    if (this.config.commands) manifest.commands = './commands/'
    if (this.config.agents) manifest.agents = './agents/'
    if (this.config.platforms?.cursor?.rules?.length) manifest.rules = './rules/'
    if (this.config.hooks || this.config.permissions) manifest.hooks = './hooks/hooks.json'
    if (this.config.mcp) manifest.mcpServers = './mcp.json'

    await this.writeJson('.cursor-plugin/plugin.json', manifest)
  }

  private async generateHooks(): Promise<void> {
    const permissionScript = buildGeneratedPermissionHookScript(this.config.permissions)
    const readinessPlan = getRuntimeReadinessPlan(this.config.readiness)
    const readinessCapability = getRuntimeReadinessCapability('cursor')
    if (!this.config.hooks && !permissionScript && !readinessPlan.hasReadiness) return
    const usesPlatformManagedAuth = this.config.platforms?.cursor?.mcpAuth === 'platform'

    // Cursor hooks format matches the canonical format closely
    const hooks: Record<string, unknown[]> = {}

    if (readinessPlan.hasReadiness && this.config.readiness) {
      await this.writeFile('hooks/pluxx-readiness.mjs', buildGeneratedReadinessScript(this.config.readiness))

      for (const binding of getEnabledRuntimeReadinessBindings(readinessCapability, readinessPlan)) {
        hooks[binding.event] = [
          ...(hooks[binding.event] ?? []),
          {
            command: binding.command,
          },
        ]
      }
    }

    if (permissionScript) {
      await this.writeFile('hooks/pluxx-permissions.mjs', permissionScript)
      hooks.preToolUse = [
        ...(hooks.preToolUse ?? []),
        {
          command: 'node ./hooks/pluxx-permissions.mjs cursor-pretool',
        },
      ]
      hooks.beforeShellExecution = [
        ...(hooks.beforeShellExecution ?? []),
        {
          command: 'node ./hooks/pluxx-permissions.mjs cursor-shell',
        },
      ]
      hooks.beforeReadFile = [
        ...(hooks.beforeReadFile ?? []),
        {
          command: 'node ./hooks/pluxx-permissions.mjs cursor-read',
        },
      ]
      hooks.beforeMCPExecution = [
        ...(hooks.beforeMCPExecution ?? []),
        {
          command: 'node ./hooks/pluxx-permissions.mjs cursor-mcp',
        },
      ]
    }

    if (!this.config.hooks) {
      await this.writeJson('hooks/hooks.json', { version: 1, hooks })
      return
    }

    for (const [event, entries] of Object.entries(this.config.hooks)) {
      if (!entries) continue
      const filteredEntries = entries.filter((entry) => {
        if (
          usesPlatformManagedAuth
          && entry.type !== 'prompt'
          && entry.command?.includes('check-env.sh')
        ) {
          return false
        }
        return true
      })

      if (filteredEntries.length === 0) continue

      hooks[event] = [
        ...(hooks[event] ?? []),
        ...filteredEntries.map(entry => {
        const hookDef: Record<string, unknown> = {}
        if (entry.type === 'prompt') {
          hookDef.type = 'prompt'
          hookDef.prompt = entry.prompt
          if (entry.model) hookDef.model = entry.model
        } else if (entry.command) {
          hookDef.command = entry.command.replace('${PLUGIN_ROOT}', '.')
        }
        if (entry.timeout) hookDef.timeout = entry.timeout
        if (entry.matcher) hookDef.matcher = entry.matcher
        if (entry.failClosed) hookDef.failClosed = entry.failClosed
        if (entry.loop_limit !== undefined && getHookFieldSupportedEvents('cursor', 'loop_limit').includes(event)) {
          hookDef.loop_limit = entry.loop_limit
        }
        return hookDef
      }),
      ]
    }

    await this.writeJson('hooks/hooks.json', { version: 1, hooks })
  }

  private async generateRules(): Promise<void> {
    const overrides = this.config.platforms?.cursor
    if (!overrides?.rules?.length) return

    for (const rule of overrides.rules) {
      const frontmatter = [
        '---',
        `description: "${rule.description}"`,
      ]
      if (rule.globs) {
        if (Array.isArray(rule.globs)) {
          frontmatter.push(`globs: ${JSON.stringify(rule.globs)}`)
        } else {
          frontmatter.push(`globs: "${rule.globs}"`)
        }
      }
      if (rule.alwaysApply !== undefined) {
        frontmatter.push(`alwaysApply: ${rule.alwaysApply}`)
      }
      frontmatter.push('---')

      const content = rule.content ?? ''
      const filename = rule.description
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')

      await this.writeFile(
        `rules/${filename}.mdc`,
        frontmatter.join('\n') + '\n\n' + content
      )
    }
  }

  private async generateAgentsMd(): Promise<void> {
    const content = await readInstructionsContent(this.rootDir, this.config)
    if (!content) return
    await this.writeFile('AGENTS.md', content)
  }

  private async generateAgents(): Promise<void> {
    if (!this.config.agents) return

    const agentsDir = this.resolveConfigPath(this.config.agents, 'agents')
    const agents = readCanonicalAgentFiles(agentsDir)
    if (agents.length === 0) return

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

      frontmatter.push('---')

      const translatedNotes = buildCursorAgentTranslationNotes(agent.frontmatter)
      const bodyParts = [
        ...translatedNotes,
        agent.body,
      ].filter(Boolean)

      await this.writeFile(
        `agents/${agent.fileStem}.md`,
        `${frontmatter.join('\n')}\n\n${bodyParts.join('\n\n').trim()}\n`,
      )
    }
  }
}

function buildCursorAgentTranslationNotes(frontmatter: AgentFrontmatterMap): string[] {
  return buildDelegationBehaviorNotes(frontmatter).map(
    (note) => `Cursor translation note: ${note.charAt(0).toLowerCase()}${note.slice(1)}`,
  )
}
