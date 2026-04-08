import { resolve } from 'path'
import { existsSync } from 'fs'
import { Generator } from '../base'
import { warnDroppedHookFields } from '../hooks-warning'
import type { TargetPlatform } from '../../schema'

export class ClaudeCodeGenerator extends Generator {
  readonly platform: TargetPlatform = 'claude-code'

  /** Override in subclasses to change output paths */
  protected get manifestPath(): string { return '.claude-plugin/plugin.json' }
  protected get instructionsFile(): string { return 'CLAUDE.md' }
  protected get pluginRootVar(): string { return 'CLAUDE_PLUGIN_ROOT' }

  async generate(): Promise<void> {
    await Promise.all([
      this.generateManifest(),
      this.generateMcpConfig('.mcp.json', {
        transformRemoteEntry: ({ server, entry }) => ({
          type: server.transport === 'sse' ? 'sse' : 'http',
          ...entry,
        }),
      }),
      this.generateHooks(),
      this.generateInstructions(),
    ])

    this.copySkills()
    this.copyCommands()
    this.copyAgents()
    this.copyScripts()
    this.copyAssets()
  }

  protected async generateManifest(): Promise<void> {
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

    await this.writeJson(this.manifestPath, manifest)
  }

  protected async generateHooks(): Promise<void> {
    if (!this.config.hooks) return

    // Claude Code hooks use a slightly different format
    const hooks: Record<string, unknown[]> = {}

    for (const [event, entries] of Object.entries(this.config.hooks)) {
      if (!entries) continue
      warnDroppedHookFields(this.platform, event, entries)
      // Map canonical event names to Claude Code event names
      const claudeEvent = mapEventName(event)
      const commandEntries = entries.filter(entry => entry.type !== 'prompt' && entry.command)
      if (commandEntries.length === 0) continue
      hooks[claudeEvent] = commandEntries.map(entry => ({
        hooks: [{
          type: 'command',
          command: entry.command!
            .replace('${PLUGIN_ROOT}', `\${${this.pluginRootVar}}`),
        }],
      }))
    }

    await this.writeJson('hooks.json', { hooks })
  }

  protected async generateInstructions(): Promise<void> {
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

    await this.writeFile(this.instructionsFile, claudeMd)
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
