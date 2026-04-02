import { resolve } from 'path'
import { existsSync } from 'fs'
import { Generator } from '../base'
import type { TargetPlatform } from '../../schema'

export class ClaudeCodeGenerator extends Generator {
  readonly platform: TargetPlatform = 'claude-code'

  async generate(): Promise<void> {
    await Promise.all([
      this.generateManifest(),
      this.generateMcpConfig(),
      this.generateHooks(),
      this.generateInstructions(),
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
      version: this.config.version,
      description: this.config.description,
      author: this.config.author,
      license: this.config.license,
    }

    if (this.config.repository) {
      manifest.repository = this.config.repository
    }
    if (this.config.keywords) {
      manifest.keywords = this.config.keywords
    }
    if (this.config.commands) {
      manifest.commands = './commands/'
    }
    manifest.skills = './skills/'

    await this.writeJson('.claude-plugin/plugin.json', manifest)
  }

  private async generateMcpConfig(): Promise<void> {
    if (!this.config.mcp) return

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
          type: server.transport === 'sse' ? 'sse' : 'http',
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

    await this.writeJson('.mcp.json', { mcpServers })
  }

  private async generateHooks(): Promise<void> {
    if (!this.config.hooks) return

    // Claude Code hooks use a slightly different format
    const hooks: Record<string, unknown[]> = {}

    for (const [event, entries] of Object.entries(this.config.hooks)) {
      if (!entries) continue
      // Map canonical event names to Claude Code event names
      const claudeEvent = mapEventName(event)
      hooks[claudeEvent] = entries.map(entry => ({
        hooks: [{
          type: 'command',
          command: entry.command
            .replace('${PLUGIN_ROOT}', '${CLAUDE_PLUGIN_ROOT}'),
        }],
      }))
    }

    await this.writeJson('hooks.json', { hooks })
  }

  private async generateInstructions(): Promise<void> {
    if (!this.config.instructions) return
    const srcPath = resolve(this.rootDir, this.config.instructions)
    if (!existsSync(srcPath)) return

    const content = await Bun.file(srcPath).text()

    // Generate CLAUDE.md with plugin context header
    const claudeMd = [
      `# ${this.config.brand?.displayName ?? this.config.name} Plugin`,
      '',
      this.config.brand?.shortDescription ?? this.config.description,
      '',
      content,
    ].join('\n')

    await this.writeFile('CLAUDE.md', claudeMd)
  }
}

/** Map canonical hook event names to Claude Code format */
function mapEventName(event: string): string {
  const map: Record<string, string> = {
    sessionStart: 'SessionStart',
    preToolUse: 'PreToolUse',
    postToolUse: 'PostToolUse',
    // Claude Code uses PascalCase for events
  }
  return map[event] ?? event.charAt(0).toUpperCase() + event.slice(1)
}
