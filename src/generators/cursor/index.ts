import { existsSync } from 'fs'
import { Generator } from '../base'
import type { TargetPlatform } from '../../schema'

export class CursorGenerator extends Generator {
  readonly platform: TargetPlatform = 'cursor'

  async generate(): Promise<void> {
    await Promise.all([
      this.generateManifest(),
      this.generateMcpConfig('mcp.json'),
      this.generateHooks(),
      this.generateRules(),
      this.generateAgentsMd(),
    ])

    this.copySkills()
    this.copyCommands()
    this.copyAgents()
    this.copyScripts()
    this.copyAssets()
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
    if (this.config.hooks) manifest.hooks = './hooks/hooks.json'
    if (this.config.mcp) manifest.mcpServers = './mcp.json'

    await this.writeJson('.cursor-plugin/plugin.json', manifest)
  }

  private async generateHooks(): Promise<void> {
    if (!this.config.hooks) return
    const usesPlatformManagedAuth = this.config.platforms?.cursor?.mcpAuth === 'platform'

    // Cursor hooks format matches the canonical format closely
    const hooks: Record<string, unknown[]> = {}

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

      hooks[event] = filteredEntries.map(entry => {
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
        if (entry.loop_limit !== undefined) hookDef.loop_limit = entry.loop_limit
        return hookDef
      })
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
    if (!this.config.instructions) return
    const srcPath = this.resolveConfigPath(this.config.instructions, 'instructions')
    if (!existsSync(srcPath)) return

    const content = await Bun.file(srcPath).text()
    await this.writeFile('AGENTS.md', content)
  }
}
