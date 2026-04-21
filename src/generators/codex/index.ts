import { existsSync } from 'fs'
import { relative } from 'path'
import { Generator } from '../base'
import type { TargetPlatform } from '../../schema'
import { collectPermissionRules } from '../../permissions'
import { readCanonicalAgentFiles } from '../../agents'
import { readCanonicalCommandFiles } from '../../commands'
import { buildDelegationBehaviorNotes } from '../../delegation'
import { mapHookEventToPascalCase } from '../../hook-events'
import { readTextFile } from '../../text-files'

const CODEX_SUPPORTED_HOOK_EVENTS = new Set([
  'SessionStart',
  'PreToolUse',
  'PostToolUse',
  'UserPromptSubmit',
  'Stop',
])

export class CodexGenerator extends Generator {
  readonly platform: TargetPlatform = 'codex'

  async generate(): Promise<void> {
    await Promise.all([
      this.generateManifest(),
      this.generateMcpConfig('.mcp.json', {
        includeDefaultAuthHeaders: false,
        transformRemoteEntry: ({ name, server }) => {
          const entry: Record<string, unknown> = {
            url: server.url,
          }

          if (server.auth?.type === 'bearer' && server.auth.envVar) {
            entry.bearer_token_env_var = server.auth.envVar
          } else if (server.auth?.type === 'header' && server.auth.envVar) {
            const isBearerAuthorizationHeader =
              server.auth.headerName === 'Authorization'
              && server.auth.headerTemplate === 'Bearer ${value}'

            if (isBearerAuthorizationHeader) {
              entry.bearer_token_env_var = server.auth.envVar
            } else if (server.auth.headerTemplate === '${value}') {
              entry.env_http_headers = {
                [server.auth.headerName]: server.auth.envVar,
              }
            } else if (!server.auth.headerTemplate.includes('${value}')) {
              entry.http_headers = {
                [server.auth.headerName]: server.auth.headerTemplate,
              }
            } else {
              console.warn(
                `[pluxx] codex generator: MCP server "${name}" uses auth.type "header" with a templated header Codex cannot express exactly. `
                + 'Supported Codex auth outputs are bearer_token_env_var, env_http_headers, and http_headers; this header was omitted.'
              )
            }
          }

          return entry
        },
      }),
      this.generateAgentsMd(),
      this.generateNativeAgents(),
      this.generateHooksCompanion(),
      this.generateCommandsCompanion(),
      this.generatePermissionsCompanion(),
    ])

    this.copySkills()
    this.copyAgents()
    this.copyScripts()
    this.copyAssets()
    this.copyPassthrough()
  }

  private async generateManifest(): Promise<void> {
    const manifest: Record<string, unknown> = {
      name: this.config.name,
      version: this.config.version,
      description: this.config.description,
      author: this.config.author,
    }

    if (this.config.repository) manifest.homepage = this.config.repository
    if (this.config.repository) manifest.repository = this.config.repository
    if (this.config.license) manifest.license = this.config.license
    if (this.config.keywords) manifest.keywords = this.config.keywords

    manifest.skills = './skills/'
    if (this.config.mcp) manifest.mcpServers = './.mcp.json'

    // Codex supports rich interface metadata
    if (this.config.brand) {
      const iface: Record<string, unknown> = {
        displayName: this.config.brand.displayName,
        shortDescription: this.config.brand.shortDescription ?? this.config.description,
        category: this.config.brand.category,
      }

      if (this.config.brand.longDescription) {
        iface.longDescription = this.config.brand.longDescription
      }
      if (this.config.brand.color) {
        iface.brandColor = this.config.brand.color
      }
      if (this.config.brand.icon) {
        iface.composerIcon = this.config.brand.icon
        iface.logo = this.config.brand.icon
      }
      if (this.config.brand.defaultPrompts) {
        iface.defaultPrompt = this.config.brand.defaultPrompts
      }
      if (this.config.brand.websiteURL) {
        iface.websiteURL = this.config.brand.websiteURL
      }
      if (this.config.brand.privacyPolicyURL) {
        iface.privacyPolicyURL = this.config.brand.privacyPolicyURL
      }
      if (this.config.brand.termsOfServiceURL) {
        iface.termsOfServiceURL = this.config.brand.termsOfServiceURL
      }
      if (this.config.brand.screenshots) {
        iface.screenshots = this.config.brand.screenshots
      }

      // Merge Codex-specific interface overrides
      const codexOverrides = this.config.platforms?.codex?.interface
      if (codexOverrides) {
        Object.assign(iface, codexOverrides)
      }

      iface.developerName = this.config.author.name

      manifest.interface = iface
    }

    await this.writeJson('.codex-plugin/plugin.json', manifest)
  }

  private async generatePermissionsCompanion(): Promise<void> {
    const compilerIntent = this.getCompilerIntent()
    const rules = collectPermissionRules(this.config.permissions)
    const skillPolicies = compilerIntent?.skillPolicies ?? []
    if (rules.length === 0 && skillPolicies.length === 0) return

    await this.writeJson('.codex/permissions.generated.json', {
      model: 'pluxx.permissions.v1',
      enforcedByPluginBundle: false,
      note: skillPolicies.length > 0
        ? 'Codex permissions are configured externally. Use this file as a generated mirror of canonical rules for Codex user/admin policy or hook configuration. skillPolicies preserves migrated skill-scoped intent that cannot yet be enforced directly by the plugin bundle.'
        : 'Codex permissions are configured externally. Use this file as a generated mirror of canonical rules for Codex user/admin policy or hook configuration.',
      rules,
      ...(skillPolicies.length > 0 ? { skillPolicies } : {}),
    })
  }

  private async generateAgentsMd(): Promise<void> {
    const sections: string[] = []

    if (this.config.instructions) {
      const srcPath = this.resolveConfigPath(this.config.instructions, 'instructions')
      if (existsSync(srcPath)) {
        sections.push((await readTextFile(srcPath)).trim())
      }
    }

    const commandsSection = this.buildCodexCommandRoutingSection()
    if (commandsSection) {
      sections.push(commandsSection)
    }

    if (sections.length === 0) return
    await this.writeFile('AGENTS.md', sections.join('\n\n').trim() + '\n')
  }

  private async generateNativeAgents(): Promise<void> {
    if (!this.config.agents) return

    const agentsDir = this.resolveConfigPath(this.config.agents, 'agents')
    const agents = readCanonicalAgentFiles(agentsDir)
    if (agents.length === 0) return

    for (const agent of agents) {
      const relativePath = relative(agentsDir, agent.filePath).replace(/\\/g, '/').replace(/\.md$/i, '.toml')
      const lines = [
        `name = ${JSON.stringify(agent.name)}`,
        `description = ${JSON.stringify(agent.description ?? `${agent.name} specialist.`)}`,
      ]

      if (typeof agent.frontmatter.model === 'string' && agent.frontmatter.model) {
        lines.push(`model = ${JSON.stringify(agent.frontmatter.model)}`)
      }
      if (typeof agent.frontmatter.model_reasoning_effort === 'string' && agent.frontmatter.model_reasoning_effort) {
        lines.push(`model_reasoning_effort = ${JSON.stringify(agent.frontmatter.model_reasoning_effort)}`)
      }
      if (typeof agent.frontmatter.sandbox_mode === 'string' && agent.frontmatter.sandbox_mode) {
        lines.push(`sandbox_mode = ${JSON.stringify(agent.frontmatter.sandbox_mode)}`)
      }
      const delegationNotes = buildDelegationBehaviorNotes(agent.frontmatter)
      const developerInstructions = [
        ...(delegationNotes.length > 0
          ? [
              'Delegation contract:',
              ...delegationNotes.map((note) => `- ${note}`),
              '',
            ]
          : []),
        agent.body,
      ].filter(Boolean).join('\n')

      if (developerInstructions) {
        lines.push('developer_instructions = """')
        lines.push(developerInstructions.replace(/"""/g, '\\"\\"\\"'))
        lines.push('"""')
      }
      lines.push('')

      await this.writeFile(`.codex/agents/${relativePath}`, lines.join('\n'))
    }
  }

  private async generateHooksCompanion(): Promise<void> {
    if (!this.config.hooks) return

    const hooks: Record<string, Array<Record<string, unknown>>> = {}
    const unsupported: Array<Record<string, string>> = []

    for (const [event, entries] of Object.entries(this.config.hooks)) {
      if (!entries || entries.length === 0) continue

      const codexEvent = mapHookEventToPascalCase(event)
      const mappedEntries = entries
        .filter((entry) => entry.type !== 'prompt' && entry.command)
        .map((entry) => ({
          command: entry.command?.replace('${PLUGIN_ROOT}', '.'),
          ...(entry.matcher !== undefined ? { matcher: entry.matcher } : {}),
          ...(entry.timeout ? { timeout: entry.timeout } : {}),
          ...(entry.failClosed !== undefined ? { failClosed: entry.failClosed } : {}),
        }))

      if (mappedEntries.length === 0) continue

      if (!CODEX_SUPPORTED_HOOK_EVENTS.has(codexEvent)) {
        unsupported.push({
          canonicalEvent: event,
          codexEvent,
          reason: 'Codex currently documents only SessionStart, PreToolUse, PostToolUse, UserPromptSubmit, and Stop for hook configuration.',
        })
        continue
      }

      hooks[codexEvent] = [
        ...(hooks[codexEvent] ?? []),
        ...mappedEntries,
      ]
    }

    if (Object.keys(hooks).length === 0 && unsupported.length === 0) return

    await this.writeJson('.codex/hooks.generated.json', {
      model: 'pluxx.codex-hooks.v1',
      enforcedByPluginBundle: false,
      featureFlag: 'codex_hooks',
      note: 'Codex hook configuration lives outside the plugin bundle. Use this file as a generated mirror for <repo>/.codex/hooks.json or ~/.codex/hooks.json and enable codex_hooks in Codex.',
      hooks,
      ...(unsupported.length > 0 ? { unsupported } : {}),
    })
  }

  private async generateCommandsCompanion(): Promise<void> {
    if (!this.config.commands) return

    const commandsDir = this.resolveConfigPath(this.config.commands, 'commands')
    const commands = readCanonicalCommandFiles(commandsDir)
    if (commands.length === 0) return

    await this.writeJson('.codex/commands.generated.json', {
      model: 'pluxx.commands.v1',
      nativeSurface: 'degraded-to-guidance',
      note: 'Codex does not currently document plugin-packaged slash commands. Use these canonical command entries as workflow routing guidance alongside AGENTS.md.',
      commands: commands.map((command) => ({
        id: command.commandId,
        title: command.title,
        ...(command.description ? { description: command.description } : {}),
        template: command.body,
      })),
    })
  }

  private buildCodexCommandRoutingSection(): string | null {
    if (!this.config.commands) return null

    const commandsDir = this.resolveConfigPath(this.config.commands, 'commands')
    const commands = readCanonicalCommandFiles(commandsDir)
    if (commands.length === 0) return null

    const lines = [
      '## Command Routing',
      '',
      'This plugin defines canonical command entrypoints. Codex does not package them as native slash commands today, so route those requests through the matching workflow directly.',
      '',
      ...commands.map((command) => `- \`/${command.commandId}\` - ${command.description ?? command.title}`),
    ]

    return lines.join('\n')
  }
}
