import { describe, expect, it } from 'bun:test'
import { existsSync, readFileSync } from 'fs'
import { resolve } from 'path'

const ROOT = resolve(import.meta.dir, '..')
const PLUGIN_ROOT = resolve(ROOT, 'plugins/pluxx')
const EXAMPLE_ROOT = resolve(ROOT, 'example/pluxx')

describe('pluxx dogfood plugin', () => {
  it('ships a repo-local Codex plugin manifest and marketplace entry', () => {
    const manifestPath = resolve(PLUGIN_ROOT, '.codex-plugin/plugin.json')
    const marketplacePath = resolve(ROOT, '.agents/plugins/marketplace.json')
    const agentsPath = resolve(PLUGIN_ROOT, 'AGENTS.md')
    const commandsPath = resolve(PLUGIN_ROOT, '.codex/commands.generated.json')

    expect(existsSync(manifestPath)).toBe(true)
    expect(existsSync(marketplacePath)).toBe(true)
    expect(existsSync(agentsPath)).toBe(true)
    expect(existsSync(commandsPath)).toBe(true)

    const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8')) as {
      name: string
      skills: string
      interface: {
        displayName: string
        defaultPrompt: string[]
        composerIcon?: string
        logo?: string
        screenshots?: string[]
        websiteURL?: string
      }
    }
    const marketplace = JSON.parse(readFileSync(marketplacePath, 'utf-8')) as {
      plugins: Array<{ name: string; source: { path: string } }>
    }
    const commands = JSON.parse(readFileSync(commandsPath, 'utf-8')) as {
      commands: Array<{ id: string }>
    }

    expect(manifest.name).toBe('pluxx')
    expect(manifest.skills).toBe('./skills/')
    expect(manifest.interface.displayName).toBe('Pluxx')
    expect(manifest.interface.defaultPrompt.length).toBeLessThanOrEqual(3)
    expect(manifest.interface.websiteURL).toBe('https://pluxx.dev')
    expect(manifest.interface.composerIcon).toBe('./assets/icon/pluxx-icon.svg')
    expect(manifest.interface.logo).toBe('./assets/icon/pluxx-icon.svg')
    expect(manifest.interface.screenshots).toEqual([
      './assets/screenshots/import-workflow.svg',
      './assets/screenshots/build-install-workflow.svg',
      './assets/screenshots/verify-install-workflow.svg',
    ])
    expect(marketplace.plugins.some((plugin) => plugin.name === 'pluxx' && plugin.source.path === './plugins/pluxx')).toBe(true)
    expect(commands.commands.map((command) => command.id)).toEqual([
      'autopilot',
      'bootstrap-runtime',
      'build-install',
      'import-mcp',
      'migrate-plugin',
      'prepare-context',
      'publish-plugin',
      'refine-taxonomy',
      'review-scaffold',
      'rewrite-instructions',
      'sync-mcp',
      'troubleshoot-install',
      'validate-scaffold',
      'verify-install',
    ])
  })

  it('defines the expected skill pack with valid frontmatter', () => {
    const skills = [
      'pluxx-autopilot',
      'pluxx-bootstrap-runtime',
      'pluxx-build-install',
      'pluxx-import-mcp',
      'pluxx-migrate-plugin',
      'pluxx-prepare-context',
      'pluxx-publish-plugin',
      'pluxx-troubleshoot-install',
      'pluxx-validate-scaffold',
      'pluxx-refine-taxonomy',
      'pluxx-rewrite-instructions',
      'pluxx-review-scaffold',
      'pluxx-sync-mcp',
      'pluxx-verify-install',
    ]

    for (const skill of skills) {
      const skillPath = resolve(PLUGIN_ROOT, `skills/${skill}/SKILL.md`)
      const yamlPath = resolve(PLUGIN_ROOT, `skills/${skill}/agents/openai.yaml`)

      expect(existsSync(skillPath)).toBe(true)

      const content = readFileSync(skillPath, 'utf-8')
      expect(content.startsWith('---\n')).toBe(true)
      expect(content).toContain(`name: ${skill}`)
      expect(content).toContain('description:')

      if (existsSync(yamlPath)) {
        const yaml = readFileSync(yamlPath, 'utf-8')
        expect(yaml).toContain('interface:')
        expect(yaml).toContain('display_name:')
      }
    }
  })

  it('keeps the self-hosted example source aligned with the operator model', () => {
    const configPath = resolve(EXAMPLE_ROOT, 'pluxx.config.ts')
    const instructionsPath = resolve(EXAMPLE_ROOT, 'INSTRUCTIONS.md')
    const commands = [
      'autopilot',
      'bootstrap-runtime',
      'build-install',
      'import-mcp',
      'migrate-plugin',
      'prepare-context',
      'publish-plugin',
      'troubleshoot-install',
      'validate-scaffold',
      'refine-taxonomy',
      'rewrite-instructions',
      'review-scaffold',
      'sync-mcp',
      'verify-install',
    ]
    const skills = [
      'pluxx-autopilot',
      'pluxx-bootstrap-runtime',
      'pluxx-build-install',
      'pluxx-import-mcp',
      'pluxx-migrate-plugin',
      'pluxx-prepare-context',
      'pluxx-publish-plugin',
      'pluxx-troubleshoot-install',
      'pluxx-validate-scaffold',
      'pluxx-refine-taxonomy',
      'pluxx-rewrite-instructions',
      'pluxx-review-scaffold',
      'pluxx-sync-mcp',
      'pluxx-verify-install',
    ]

    expect(existsSync(configPath)).toBe(true)
    expect(existsSync(instructionsPath)).toBe(true)

    const config = readFileSync(configPath, 'utf-8')
    const instructions = readFileSync(instructionsPath, 'utf-8')

    expect(config).toContain("skills: './skills/'")
    expect(config).toContain("commands: './commands/'")
    expect(instructions).toContain('### CLI Resolution')

    for (const command of commands) {
      expect(existsSync(resolve(EXAMPLE_ROOT, `commands/${command}.md`))).toBe(true)
    }

    for (const skill of skills) {
      const skillPath = resolve(EXAMPLE_ROOT, `skills/${skill}/SKILL.md`)
      expect(existsSync(skillPath)).toBe(true)
      expect(readFileSync(skillPath, 'utf-8')).toContain(`name: ${skill}`)
    }
  })
})
