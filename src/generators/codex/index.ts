import { existsSync } from 'fs'
import { Generator } from '../base'
import type { TargetPlatform } from '../../schema'
import { collectPermissionRules } from '../../permissions'

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
    if (!this.config.instructions) return
    const srcPath = this.resolveConfigPath(this.config.instructions, 'instructions')
    if (!existsSync(srcPath)) return

    const content = await Bun.file(srcPath).text()
    await this.writeFile('AGENTS.md', content)
  }
}
