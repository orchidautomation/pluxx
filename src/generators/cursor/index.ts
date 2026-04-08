import { existsSync } from 'fs'
import { Generator } from '../base'
import type { TargetPlatform } from '../../schema'

export class CursorGenerator extends Generator {
  readonly platform: TargetPlatform = 'cursor'

  async generate(): Promise<void> {
    await Promise.all([
      this.generateManifest(),
      this.generateMcpConfig(),
      this.generateHooks(),
      this.generateRules(),
      this.generateAgentsMd(),
    ])

    this.copySkills()
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

    await this.writeJson('.cursor-plugin/plugin.json', manifest)
  }

  private async generateMcpConfig(): Promise<void> {
    if (!this.config.mcp) return

    // Cursor uses Claude Desktop format
    const mcpServers: Record<string, unknown> = {}

    for (const [name, server] of Object.entries(this.config.mcp)) {
      if (server.transport === 'stdio' && server.command) {
        mcpServers[name] = {
          command: server.command,
          args: server.args ?? [],
          env: server.env ?? {},
        }
      } else {
        const entry: Record<string, unknown> = {
          url: server.url,
        }

        if (server.auth?.type === 'bearer' && server.auth.envVar) {
          entry.headers = {
            Authorization: `Bearer \${${server.auth.envVar}}`,
          }
        } else if (server.auth?.type === 'header' && server.auth.envVar) {
          entry.headers = {
            [server.auth.headerName]: server.auth.headerTemplate.replace(
              '${value}',
              `\${${server.auth.envVar}}`
            ),
          }
        }

        mcpServers[name] = entry
      }
    }

    await this.writeJson('mcp.json', { mcpServers })
  }

  private async generateHooks(): Promise<void> {
    if (!this.config.hooks) return

    // Cursor hooks format matches the canonical format closely
    const hooks: Record<string, unknown[]> = {}

    for (const [event, entries] of Object.entries(this.config.hooks)) {
      if (!entries) continue
      hooks[event] = entries.map(entry => {
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

    await this.writeJson('hooks.json', { version: 1, hooks })
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
        `.cursor/rules/${filename}.mdc`,
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
